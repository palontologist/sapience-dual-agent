import fs from "fs";
import path from "path";
import { TradeResult } from "./trade-tracker";

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  kellyCriterion: number;
  optimalPositionSize: number;
  expectedValue: number;
  volatility: number;
}

export interface Pattern {
  pattern: string;
  successRate: number;
  avgReturn: number;
  frequency: number;
  confidence: number;
}

export interface MarketCondition {
  priceRange: string;
  volumeLevel: string;
  timeToResolution: string;
  volatilityLevel: string;
  successRate: number;
  avgReturn: number;
}

export class AdvancedAnalytics {
  private resultsDir: string;
  private performanceFile: string;
  private patternsFile: string;
  private marketConditionsFile: string;

  constructor(resultsDir: string = "./trade-results") {
    this.resultsDir = resultsDir;
    this.performanceFile = path.join(resultsDir, "performance.json");
    this.patternsFile = path.join(resultsDir, "patterns.json");
    this.marketConditionsFile = path.join(resultsDir, "market-conditions.json");
    this.ensureResultsDir();
  }

  private ensureResultsDir(): void {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Analyze historical performance with advanced metrics
   */
  analyzePerformance(trades: TradeResult[]): PerformanceMetrics {
    if (trades.length === 0) {
      return this.getDefaultMetrics();
    }

    const resolvedTrades = trades.filter(
      (t) => t.resolved && t.pnl !== undefined,
    );
    const wins = resolvedTrades.filter((t) => t.pnl! > 0);
    const losses = resolvedTrades.filter((t) => t.pnl! < 0);

    const totalPnL = resolvedTrades.reduce((sum, t) => sum + t.pnl!, 0);
    const avgWin =
      wins.length > 0
        ? wins.reduce((sum, t) => sum + t.pnl!, 0) / wins.length
        : 0;
    const avgLoss =
      losses.length > 0
        ? losses.reduce((sum, t) => sum + Math.abs(t.pnl!), 0) / losses.length
        : 0;

    const winRate =
      resolvedTrades.length > 0 ? wins.length / resolvedTrades.length : 0;
    const profitFactor =
      avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;

    // Calculate Sharpe Ratio (simplified)
    const returns = resolvedTrades.map((t) => t.pnl!);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
        returns.length,
    );
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

    // Calculate Maximum Drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let cumulative = 0;
    resolvedTrades.forEach((trade) => {
      cumulative += trade.pnl!;
      peak = Math.max(peak, cumulative);
      maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    });

    // Kelly Criterion
    const kelly =
      avgLoss > 0 ? (winRate * avgWin - (1 - winRate) * avgLoss) / avgLoss : 0;

    // Expected Value per trade
    const expectedValue = winRate * avgWin - (1 - winRate) * avgLoss;

    const metrics: PerformanceMetrics = {
      totalTrades: trades.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      kellyCriterion: Math.max(0, Math.min(kelly, 0.25)), // Cap at 25%
      optimalPositionSize: Math.max(0.01, Math.min(kelly * 0.5, 0.1)), // Conservative Kelly
      expectedValue,
      volatility,
    };

    this.savePerformance(metrics);
    return metrics;
  }

  /**
   * Identify winning patterns from historical trades
   */
  identifyPatterns(trades: TradeResult[]): Pattern[] {
    const patterns: Map<
      string,
      { wins: number; losses: number; returns: number[] }
    > = new Map();

    trades.forEach((trade) => {
      if (!trade.resolved || trade.pnl === undefined) return;

      const key = this.generatePatternKey(trade);
      if (!patterns.has(key)) {
        patterns.set(key, { wins: 0, losses: 0, returns: [] });
      }

      const pattern = patterns.get(key)!;
      if (trade.pnl > 0) {
        pattern.wins++;
      } else {
        pattern.losses++;
      }
      pattern.returns.push(trade.pnl);
    });

    const identifiedPatterns: Pattern[] = [];
    patterns.forEach((data, pattern) => {
      const total = data.wins + data.losses;
      const successRate = data.wins / total;
      const avgReturn =
        data.returns.reduce((sum, r) => sum + r, 0) / data.returns.length;

      if (total >= 3 && successRate > 0.6 && Math.abs(avgReturn) > 0.1) {
        // Minimum 3 occurrences, 60% win rate, 10% avg return
        identifiedPatterns.push({
          pattern,
          successRate,
          avgReturn,
          frequency: total / trades.length,
          confidence: Math.min(1, total / 10), // Confidence increases with more data
        });
      }
    });

    identifiedPatterns.sort(
      (a, b) => b.successRate * b.avgReturn - a.successRate * a.avgReturn,
    );
    this.savePatterns(identifiedPatterns);
    return identifiedPatterns;
  }

  /**
   * Analyze performance under different market conditions
   */
  analyzeMarketConditions(trades: TradeResult[]): MarketCondition[] {
    const conditions: Map<
      string,
      { wins: number; losses: number; returns: number[] }
    > = new Map();

    trades.forEach((trade) => {
      if (!trade.resolved || trade.pnl === undefined) return;

      const key = this.generateMarketConditionKey(trade);
      if (!conditions.has(key)) {
        conditions.set(key, { wins: 0, losses: 0, returns: [] });
      }

      const condition = conditions.get(key)!;
      if (trade.pnl > 0) {
        condition.wins++;
      } else {
        condition.losses++;
      }
      condition.returns.push(trade.pnl);
    });

    const marketConditions: MarketCondition[] = [];
    conditions.forEach((data, condition) => {
      const total = data.wins + data.losses;
      const successRate = data.wins / total;
      const avgReturn =
        data.returns.reduce((sum, r) => sum + r, 0) / data.returns.length;

      if (total >= 2) {
        // Minimum 2 occurrences
        const [priceRange, volumeLevel, timeToResolution, volatilityLevel] =
          condition.split("|");
        marketConditions.push({
          priceRange,
          volumeLevel,
          timeToResolution,
          volatilityLevel,
          successRate,
          avgReturn,
        });
      }
    });

    this.saveMarketConditions(marketConditions);
    return marketConditions;
  }

  /**
   * Generate pattern key based on trade characteristics
   */
  private generatePatternKey(trade: TradeResult): string {
    const priceRange = this.getPriceRange(trade.entryPrice);
    const confidenceLevel = this.getConfidenceLevel(trade.confidence);
    const riskLevel = this.getRiskLevel(trade.riskScore);
    const expectedReturnLevel = this.getExpectedReturnLevel(
      trade.expectedReturn,
    );

    return `${priceRange}|${confidenceLevel}|${riskLevel}|${expectedReturnLevel}`;
  }

  /**
   * Generate market condition key
   */
  private generateMarketConditionKey(trade: TradeResult): string {
    const priceRange = this.getPriceRange(trade.entryPrice);
    const volumeLevel = "Medium"; // Would need volume data
    const timeToResolution = "Medium"; // Would need resolution data
    const volatilityLevel = this.getVolatilityLevel(trade.riskScore);

    return `${priceRange}|${volumeLevel}|${timeToResolution}|${volatilityLevel}`;
  }

  private getPriceRange(price: number): string {
    if (price < 0.3) return "VeryLow";
    if (price < 0.4) return "Low";
    if (price < 0.6) return "Medium";
    if (price < 0.7) return "High";
    return "VeryHigh";
  }

  private getConfidenceLevel(confidence: number): string {
    if (confidence < 60) return "Low";
    if (confidence < 75) return "Medium";
    return "High";
  }

  private getRiskLevel(riskScore: number): string {
    if (riskScore < 0.3) return "Low";
    if (riskScore < 0.6) return "Medium";
    return "High";
  }

  private getExpectedReturnLevel(expectedReturn: number): string {
    if (expectedReturn < 1.1) return "Low";
    if (expectedReturn < 1.3) return "Medium";
    return "High";
  }

  private getVolatilityLevel(riskScore: number): string {
    return this.getRiskLevel(riskScore);
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      totalTrades: 0,
      winRate: 0.5,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 1,
      sharpeRatio: 0,
      maxDrawdown: 0,
      kellyCriterion: 0.02,
      optimalPositionSize: 0.01,
      expectedValue: 0,
      volatility: 0.1,
    };
  }

  private savePerformance(metrics: PerformanceMetrics): void {
    try {
      fs.writeFileSync(this.performanceFile, JSON.stringify(metrics, null, 2));
    } catch (error) {
      console.error("Error saving performance metrics:", error);
    }
  }

  private savePatterns(patterns: Pattern[]): void {
    try {
      fs.writeFileSync(this.patternsFile, JSON.stringify(patterns, null, 2));
    } catch (error) {
      console.error("Error saving patterns:", error);
    }
  }

  private saveMarketConditions(conditions: MarketCondition[]): void {
    try {
      fs.writeFileSync(
        this.marketConditionsFile,
        JSON.stringify(conditions, null, 2),
      );
    } catch (error) {
      console.error("Error saving market conditions:", error);
    }
  }

  /**
   * Load historical performance metrics
   */
  loadPerformance(): PerformanceMetrics | null {
    try {
      if (fs.existsSync(this.performanceFile)) {
        const data = fs.readFileSync(this.performanceFile, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading performance metrics:", error);
    }
    return null;
  }

  /**
   * Load identified patterns
   */
  loadPatterns(): Pattern[] {
    try {
      if (fs.existsSync(this.patternsFile)) {
        const data = fs.readFileSync(this.patternsFile, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading patterns:", error);
    }
    return [];
  }

  /**
   * Load market conditions
   */
  loadMarketConditions(): MarketCondition[] {
    try {
      if (fs.existsSync(this.marketConditionsFile)) {
        const data = fs.readFileSync(this.marketConditionsFile, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading market conditions:", error);
    }
    return [];
  }
}
