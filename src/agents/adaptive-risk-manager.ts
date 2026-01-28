import { TradeResult } from "./trade-tracker";
import { PerformanceMetrics } from "./advanced-analytics";
import { TradingSignal } from "./ml-predictor";

export interface RiskMetrics {
  var: number; // Value at Risk
  cvar: number; // Conditional Value at Risk
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  beta: number;
  alpha: number;
  volatility: number;
  skewness: number;
  kurtosis: number;
}

export interface PositionSize {
  percentage: number;
  amount: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  expectedReturn: number;
}

export interface RiskParameters {
  maxPositionSize: number;
  maxLeverage: number;
  maxDrawdownAllowed: number;
  varConfidence: number;
  stopLossPercentage: number;
  takeProfitMultiplier: number;
  correlationThreshold: number;
  maxConcurrentPositions: number;
}

export class AdaptiveRiskManager {
  private riskParameters: RiskParameters;
  private currentPositions: Map<string, PositionSize> = new Map();
  private portfolioHistory: number[] = [];
  private tradeHistory: TradeResult[] = [];
  private correlationMatrix: Map<string, Map<string, number>> = new Map();

  constructor(initialCapital: number = 10000) {
    this.riskParameters = {
      maxPositionSize: 0.2, // 20% max per position
      maxLeverage: 10, // 10x max leverage
      maxDrawdownAllowed: 0.15, // 15% max drawdown
      varConfidence: 0.95, // 95% VaR
      stopLossPercentage: 0.05, // 5% stop loss
      takeProfitMultiplier: 3, // 3x take profit
      correlationThreshold: 0.7, // 70% correlation threshold
      maxConcurrentPositions: 5, // Max 5 concurrent positions
    };
  }

  /**
   * Calculate optimal position size using multiple methods
   */
  calculateOptimalPositionSize(
    signal: TradingSignal,
    currentCapital: number,
    existingPositions: PositionSize[] = [],
  ): PositionSize {
    // Kelly Criterion position sizing
    const kellySize = this.calculateKellyPosition(signal, currentCapital);

    // Risk Parity position sizing
    const riskParitySize = this.calculateRiskParityPosition(
      signal,
      currentCapital,
    );

    // Volatility-adjusted position sizing
    const volatilitySize = this.calculateVolatilityAdjustedPosition(
      signal,
      currentCapital,
    );

    // Portfolio heat position sizing
    const portfolioHeatSize = this.calculatePortfolioHeatPosition(
      signal,
      currentCapital,
      existingPositions,
    );

    // Weighted average of all methods
    const weights = {
      kelly: 0.3,
      riskParity: 0.25,
      volatility: 0.25,
      portfolioHeat: 0.2,
    };
    const optimalSize =
      kellySize * weights.kelly +
      riskParitySize * weights.riskParity +
      volatilitySize * weights.volatility +
      portfolioHeatSize * weights.portfolioHeat;

    // Apply risk limits
    const maxSize = currentCapital * this.riskParameters.maxPositionSize;
    const finalSize = Math.min(optimalSize, maxSize);

    // Calculate leverage based on confidence
    const leverage = Math.min(
      this.riskParameters.maxLeverage,
      Math.max(1, Math.floor(signal.confidence * 10)),
    );

    // Calculate stop loss and take profit
    const stopLoss = finalSize * this.riskParameters.stopLossPercentage;
    const takeProfit =
      finalSize * this.riskParameters.takeProfitMultiplier * leverage;

    return {
      percentage: (finalSize / currentCapital) * 100,
      amount: finalSize,
      leverage,
      stopLoss,
      takeProfit,
      riskAmount: stopLoss,
      expectedReturn: signal.expectedReturn * finalSize * leverage,
    };
  }

  /**
   * Kelly Criterion position sizing
   */
  private calculateKellyPosition(
    signal: TradingSignal,
    capital: number,
  ): number {
    const winProbability = signal.confidence;
    const avgWin = signal.expectedReturn - 1;
    const avgLoss = this.riskParameters.stopLossPercentage;

    const kellyFraction =
      (winProbability * avgWin - (1 - winProbability) * avgLoss) / avgWin;

    // Conservative Kelly (half Kelly)
    const conservativeKelly = Math.max(0, Math.min(kellyFraction * 0.5, 0.25));

    return capital * conservativeKelly;
  }

  /**
   * Risk Parity position sizing
   */
  private calculateRiskParityPosition(
    signal: TradingSignal,
    capital: number,
  ): number {
    // Calculate risk contribution
    const riskScore =
      signal.riskLevel === "LOW"
        ? 0.1
        : signal.riskLevel === "MEDIUM"
          ? 0.2
          : signal.riskLevel === "HIGH"
            ? 0.3
            : 0.4;

    // Target equal risk contribution
    const targetRisk = 0.1; // 10% risk per position
    const positionSize = (targetRisk / riskScore) * capital;

    return Math.min(positionSize, capital * 0.2);
  }

  /**
   * Volatility-adjusted position sizing
   */
  private calculateVolatilityAdjustedPosition(
    signal: TradingSignal,
    capital: number,
  ): number {
    // Estimate volatility from confidence (inverse relationship)
    const estimatedVolatility = 1 - signal.confidence;

    // Target constant volatility
    const targetVolatility = 0.15; // 15% annual volatility
    const volatilityRatio =
      targetVolatility / Math.max(estimatedVolatility, 0.05);

    const baseSize = capital * 0.1; // 10% base position
    const adjustedSize = baseSize * volatilityRatio;

    return Math.min(adjustedSize, capital * 0.25);
  }

  /**
   * Portfolio heat position sizing
   */
  private calculatePortfolioHeatPosition(
    signal: TradingSignal,
    capital: number,
    existingPositions: PositionSize[],
  ): number {
    // Calculate current portfolio heat
    const currentExposure = existingPositions.reduce(
      (sum, pos) => sum + pos.amount,
      0,
    );
    const maxExposure = capital * 0.8; // 80% max exposure

    const availableCapacity = maxExposure - currentExposure;

    if (availableCapacity <= 0) return 0;

    // Adjust position size based on portfolio correlation
    const correlationAdjustment = this.calculateCorrelationAdjustment(
      signal,
      existingPositions,
    );

    const baseSize = capital * 0.1; // 10% base position
    const adjustedSize = baseSize * correlationAdjustment;

    return Math.min(adjustedSize, availableCapacity);
  }

  /**
   * Calculate correlation adjustment
   */
  private calculateCorrelationAdjustment(
    signal: TradingSignal,
    existingPositions: PositionSize[],
  ): number {
    if (existingPositions.length === 0) return 1;

    // Simplified correlation calculation
    // In practice, would use actual correlation data
    let avgCorrelation = 0;
    let count = 0;

    for (const position of existingPositions) {
      // Estimate correlation based on signal characteristics
      const correlation = this.estimateCorrelation(signal, position);
      avgCorrelation += correlation;
      count++;
    }

    if (count === 0) return 1;

    avgCorrelation /= count;

    // Reduce position size if high correlation
    if (avgCorrelation > this.riskParameters.correlationThreshold) {
      return 0.5; // Reduce by 50%
    } else if (avgCorrelation > 0.5) {
      return 0.75; // Reduce by 25%
    }

    return 1;
  }

  /**
   * Estimate correlation between signals
   */
  private estimateCorrelation(
    signal1: TradingSignal,
    position: PositionSize,
  ): number {
    // Simplified correlation estimation
    // In practice, would use more sophisticated methods
    const timeDiff = Date.now() - (position as any).timestamp;
    const timeDecay = Math.exp(-timeDiff / (24 * 60 * 60 * 1000)); // 24 hour decay

    return timeDecay * 0.5; // Base correlation of 50% with time decay
  }

  /**
   * Calculate comprehensive risk metrics
   */
  calculateRiskMetrics(trades: TradeResult[]): RiskMetrics {
    if (trades.length === 0) {
      return this.getDefaultRiskMetrics();
    }

    const returns = trades
      .filter((t) => t.resolved && t.pnl !== undefined)
      .map((t) => t.pnl!);

    if (returns.length === 0) {
      return this.getDefaultRiskMetrics();
    }

    // Basic statistics
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;
    const volatility = Math.sqrt(variance);

    // Value at Risk (VaR)
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor(
      (1 - this.riskParameters.varConfidence) * returns.length,
    );
    const var_ = sortedReturns[varIndex];

    // Conditional VaR (CVaR)
    const cvarReturns = sortedReturns.slice(0, varIndex);
    const cvar =
      cvarReturns.length > 0
        ? cvarReturns.reduce((sum, r) => sum + r, 0) / cvarReturns.length
        : var_;

    // Maximum drawdown
    const maxDrawdown = this.calculateMaxDrawdown(returns);

    // Sharpe ratio
    const riskFreeRate = 0.02; // 2% annual risk-free rate
    const sharpeRatio = volatility > 0 ? (mean - riskFreeRate) / volatility : 0;

    // Sortino ratio (downside deviation)
    const downsideReturns = returns.filter((r) => r < mean);
    const downsideVariance =
      downsideReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      downsideReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);
    const sortinoRatio =
      downsideDeviation > 0 ? (mean - riskFreeRate) / downsideDeviation : 0;

    // Calmar ratio (return / max drawdown)
    const calmarRatio = maxDrawdown > 0 ? mean / maxDrawdown : 0;

    // Higher moments
    const skewness = this.calculateSkewness(returns, mean, volatility);
    const kurtosis = this.calculateKurtosis(returns, mean, volatility);

    return {
      var: var_,
      cvar,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      beta: 1, // Would calculate against market
      alpha: mean - 1 * riskFreeRate, // Simplified alpha
      volatility,
      skewness,
      kurtosis,
    };
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(returns: number[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    returns.forEach((ret) => {
      cumulative += ret;
      peak = Math.max(peak, cumulative);
      maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    });

    return maxDrawdown;
  }

  /**
   * Calculate skewness
   */
  private calculateSkewness(
    returns: number[],
    mean: number,
    volatility: number,
  ): number {
    if (volatility === 0) return 0;

    const skew =
      returns.reduce(
        (sum, r) => sum + Math.pow((r - mean) / volatility, 3),
        0,
      ) / returns.length;
    return skew;
  }

  /**
   * Calculate kurtosis
   */
  private calculateKurtosis(
    returns: number[],
    mean: number,
    volatility: number,
  ): number {
    if (volatility === 0) return 0;

    const kurt =
      returns.reduce(
        (sum, r) => sum + Math.pow((r - mean) / volatility, 4),
        0,
      ) / returns.length;
    return kurt - 3; // Excess kurtosis
  }

  /**
   * Check if trade meets risk criteria
   */
  isTradeAcceptable(
    signal: TradingSignal,
    positionSize: PositionSize,
    currentCapital: number,
  ): { acceptable: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let acceptable = true;

    // Check position size limit
    if (positionSize.percentage > this.riskParameters.maxPositionSize * 100) {
      acceptable = false;
      reasons.push(
        `Position size ${positionSize.percentage.toFixed(1)}% exceeds maximum ${(this.riskParameters.maxPositionSize * 100).toFixed(1)}%`,
      );
    }

    // Check leverage limit
    if (positionSize.leverage > this.riskParameters.maxLeverage) {
      acceptable = false;
      reasons.push(
        `Leverage ${positionSize.leverage}x exceeds maximum ${this.riskParameters.maxLeverage}x`,
      );
    }

    // Check risk/reward ratio
    const riskRewardRatio = positionSize.takeProfit / positionSize.stopLoss;
    if (riskRewardRatio < 2) {
      acceptable = false;
      reasons.push(
        `Risk/reward ratio ${riskRewardRatio.toFixed(2)} below minimum 2.0`,
      );
    }

    // Check portfolio correlation
    const totalExposure =
      Array.from(this.currentPositions.values()).reduce(
        (sum, pos) => sum + pos.amount,
        0,
      ) + positionSize.amount;

    if (totalExposure > currentCapital * 0.8) {
      acceptable = false;
      reasons.push(
        `Total exposure ${((totalExposure / currentCapital) * 100).toFixed(1)}% exceeds 80% limit`,
      );
    }

    // Check confidence threshold
    if (signal.confidence < 0.6) {
      acceptable = false;
      reasons.push(
        `Confidence ${(signal.confidence * 100).toFixed(1)}% below minimum 60%`,
      );
    }

    return { acceptable, reasons };
  }

  /**
   * Update risk parameters based on performance
   */
  updateRiskParameters(metrics: RiskMetrics): void {
    // Adaptive risk management based on performance

    if (metrics.sharpeRatio > 2) {
      // Excellent performance - can increase risk limits
      this.riskParameters.maxPositionSize = Math.min(
        0.3,
        this.riskParameters.maxPositionSize * 1.1,
      );
      this.riskParameters.maxLeverage = Math.min(
        15,
        this.riskParameters.maxLeverage * 1.1,
      );
    } else if (metrics.sharpeRatio < 0.5) {
      // Poor performance - decrease risk limits
      this.riskParameters.maxPositionSize = Math.max(
        0.05,
        this.riskParameters.maxPositionSize * 0.9,
      );
      this.riskParameters.maxLeverage = Math.max(
        3,
        this.riskParameters.maxLeverage * 0.9,
      );
    }

    if (metrics.maxDrawdown > this.riskParameters.maxDrawdownAllowed) {
      // High drawdown - reduce risk
      this.riskParameters.maxPositionSize = Math.max(
        0.05,
        this.riskParameters.maxPositionSize * 0.8,
      );
      this.riskParameters.maxLeverage = Math.max(
        3,
        this.riskParameters.maxLeverage * 0.8,
      );
    }

    if (metrics.volatility > 0.3) {
      // High volatility - tighten stops
      this.riskParameters.stopLossPercentage = Math.min(
        0.1,
        this.riskParameters.stopLossPercentage * 1.2,
      );
    }
  }

  /**
   * Get current risk parameters
   */
  getRiskParameters(): RiskParameters {
    return { ...this.riskParameters };
  }

  /**
   * Set custom risk parameters
   */
  setRiskParameters(params: Partial<RiskParameters>): void {
    this.riskParameters = { ...this.riskParameters, ...params };
  }

  /**
   * Add position to tracking
   */
  addPosition(marketId: string, position: PositionSize): void {
    this.currentPositions.set(marketId, position);
  }

  /**
   * Remove position from tracking
   */
  removePosition(marketId: string): void {
    this.currentPositions.delete(marketId);
  }

  /**
   * Get current positions
   */
  getCurrentPositions(): Map<string, PositionSize> {
    return new Map(this.currentPositions);
  }

  /**
   * Get default risk metrics
   */
  private getDefaultRiskMetrics(): RiskMetrics {
    return {
      var: 0,
      cvar: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      beta: 1,
      alpha: 0,
      volatility: 0.1,
      skewness: 0,
      kurtosis: 0,
    };
  }
}
