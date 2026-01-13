/**
 * Advanced Market Analyzer for Ethereal Perps
 * 
 * Multi-signal analysis for maximum profitability:
 * - Technical indicators
 * - Funding rate arbitrage
 * - Volume profile analysis
 * - Momentum scoring
 * - Volatility-adjusted timing
 */

import { EtherealMarket } from '../clients/ethereal-client';

export interface MarketSignals {
  // Momentum signals
  momentum: {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;  // 0-100
    acceleration: 'INCREASING' | 'DECREASING' | 'STABLE';
  };
  
  // Funding rate signals
  funding: {
    bias: 'LONG' | 'SHORT' | 'NEUTRAL';
    extremity: 'EXTREME' | 'ELEVATED' | 'NORMAL';
    opportunity: 'CONTRARIAN_LONG' | 'CONTRARIAN_SHORT' | 'TREND_FOLLOW' | 'NONE';
  };
  
  // Volume analysis
  volume: {
    strength: 'STRONG' | 'MODERATE' | 'WEAK';
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    conviction: number;  // 0-100
  };
  
  // Liquidity
  liquidity: {
    score: number;  // 0-100
    slippage: 'LOW' | 'MEDIUM' | 'HIGH';
    tradeable: boolean;
  };
  
  // Volatility
  volatility: {
    regime: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    impliedMove: number;  // Expected % move
    optimalHoldTime: number;  // Minutes
  };
  
  // Overall signal
  composite: {
    signal: 'STRONG_LONG' | 'LONG' | 'WEAK_LONG' | 'NEUTRAL' | 'WEAK_SHORT' | 'SHORT' | 'STRONG_SHORT';
    score: number;  // -100 to +100
    confidence: number;  // 0-100
    urgency: 'IMMEDIATE' | 'SOON' | 'WAIT' | 'SKIP';
  };
}

export interface TradingParameters {
  action: 'LONG' | 'SHORT' | 'SKIP';
  positionSizePercent: number;  // % of capital
  leverage: number;
  entryPrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  holdTimeMinutes: number;
  riskRewardRatio: number;
  expectedPnlPercent: number;
}

export class MarketAnalyzer {
  /**
   * Analyze all market signals
   */
  analyzeSignals(market: EtherealMarket): MarketSignals {
    const momentum = this.analyzeMomentum(market);
    const funding = this.analyzeFunding(market);
    const volume = this.analyzeVolume(market);
    const liquidity = this.analyzeLiquidity(market);
    const volatility = this.analyzeVolatility(market);
    const composite = this.calculateComposite(momentum, funding, volume, liquidity, volatility);
    
    return {
      momentum,
      funding,
      volume,
      liquidity,
      volatility,
      composite,
    };
  }

  /**
   * Get optimal trading parameters based on signals
   */
  getOptimalParameters(
    market: EtherealMarket,
    signals: MarketSignals,
    capitalUSD: number
  ): TradingParameters {
    const { composite, volatility } = signals;
    
    // Skip if signal not strong enough
    if (composite.urgency === 'SKIP' || Math.abs(composite.score) < 30) {
      return this.skipTrade(market);
    }
    
    const action = composite.score > 0 ? 'LONG' : 'SHORT';
    
    // Position sizing based on signal strength
    let positionSizePercent = this.calculatePositionSize(composite, capitalUSD);
    
    // Leverage based on confidence and volatility
    const leverage = this.calculateOptimalLeverage(composite, volatility);
    
    // Price targets based on volatility
    const { takeProfitPrice, stopLossPrice } = this.calculatePriceTargets(
      market, 
      action, 
      volatility
    );
    
    // Hold time based on volatility and signal strength
    const holdTimeMinutes = volatility.optimalHoldTime;
    
    // Risk/reward calculation
    const tpDistance = Math.abs(takeProfitPrice - market.lastPrice) / market.lastPrice;
    const slDistance = Math.abs(stopLossPrice - market.lastPrice) / market.lastPrice;
    const riskRewardRatio = tpDistance / slDistance;
    
    // Expected PnL (probability weighted)
    const winProb = composite.confidence / 100;
    const expectedPnlPercent = (winProb * tpDistance * leverage - (1 - winProb) * slDistance * leverage) * 100;
    
    return {
      action,
      positionSizePercent,
      leverage,
      entryPrice: market.lastPrice,
      takeProfitPrice,
      stopLossPrice,
      holdTimeMinutes,
      riskRewardRatio,
      expectedPnlPercent,
    };
  }

  // ===========================================================================
  // MOMENTUM ANALYSIS
  // ===========================================================================

  private analyzeMomentum(market: EtherealMarket): MarketSignals['momentum'] {
    const change = market.priceChangePercent24h;
    const absChange = Math.abs(change);
    
    // Direction
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (change > 0.5) direction = 'BULLISH';
    else if (change < -0.5) direction = 'BEARISH';
    else direction = 'NEUTRAL';
    
    // Strength (0-100)
    const strength = Math.min(100, absChange * 15);
    
    // Acceleration (based on magnitude)
    let acceleration: 'INCREASING' | 'DECREASING' | 'STABLE';
    if (absChange > 4) acceleration = 'INCREASING';
    else if (absChange > 1.5) acceleration = 'STABLE';
    else acceleration = 'DECREASING';
    
    return { direction, strength, acceleration };
  }

  // ===========================================================================
  // FUNDING RATE ANALYSIS
  // ===========================================================================

  private analyzeFunding(market: EtherealMarket): MarketSignals['funding'] {
    const rate = market.fundingRate;
    const ratePercent = rate * 100;
    
    // Bias (which side is paying)
    let bias: 'LONG' | 'SHORT' | 'NEUTRAL';
    if (ratePercent > 0.005) bias = 'LONG';  // Longs paying shorts
    else if (ratePercent < -0.005) bias = 'SHORT';  // Shorts paying longs
    else bias = 'NEUTRAL';
    
    // Extremity
    const absRate = Math.abs(ratePercent);
    let extremity: 'EXTREME' | 'ELEVATED' | 'NORMAL';
    if (absRate > 0.05) extremity = 'EXTREME';
    else if (absRate > 0.02) extremity = 'ELEVATED';
    else extremity = 'NORMAL';
    
    // Opportunity identification
    let opportunity: 'CONTRARIAN_LONG' | 'CONTRARIAN_SHORT' | 'TREND_FOLLOW' | 'NONE';
    const priceChange = market.priceChangePercent24h;
    
    // Contrarian: High funding + price moving against crowd
    if (ratePercent > 0.03 && priceChange < -1) {
      opportunity = 'CONTRARIAN_SHORT';  // Longs overleveraged, price dropping
    } else if (ratePercent < -0.03 && priceChange > 1) {
      opportunity = 'CONTRARIAN_LONG';  // Shorts overleveraged, price rising
    }
    // Trend follow: Low funding + strong momentum
    else if (absRate < 0.01 && Math.abs(priceChange) > 2) {
      opportunity = 'TREND_FOLLOW';
    }
    else {
      opportunity = 'NONE';
    }
    
    return { bias, extremity, opportunity };
  }

  // ===========================================================================
  // VOLUME ANALYSIS
  // ===========================================================================

  private analyzeVolume(market: EtherealMarket): MarketSignals['volume'] {
    const volume = market.volume24h;
    
    // Strength relative to market size
    let strength: 'STRONG' | 'MODERATE' | 'WEAK';
    if (volume > 20000000) strength = 'STRONG';
    else if (volume > 5000000) strength = 'MODERATE';
    else strength = 'WEAK';
    
    // Trend (comparing to OI as proxy)
    let trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    const volumeToOI = volume / market.openInterest;
    if (volumeToOI > 1.5) trend = 'INCREASING';
    else if (volumeToOI < 0.5) trend = 'DECREASING';
    else trend = 'STABLE';
    
    // Conviction score
    const conviction = Math.min(100, (volume / 10000000) * 50 + (volumeToOI * 25));
    
    return { strength, trend, conviction };
  }

  // ===========================================================================
  // LIQUIDITY ANALYSIS  
  // ===========================================================================

  private analyzeLiquidity(market: EtherealMarket): MarketSignals['liquidity'] {
    const oi = market.openInterest;
    const volume = market.volume24h;
    
    // Liquidity score based on OI and volume
    const oiScore = Math.min(50, (oi / 50000000) * 50);
    const volumeScore = Math.min(50, (volume / 30000000) * 50);
    const score = oiScore + volumeScore;
    
    // Estimated slippage
    let slippage: 'LOW' | 'MEDIUM' | 'HIGH';
    if (volume > 30000000) slippage = 'LOW';
    else if (volume > 5000000) slippage = 'MEDIUM';
    else slippage = 'HIGH';
    
    // Tradeable threshold
    const tradeable = volume > 500000 && oi > 200000;
    
    return { score, slippage, tradeable };
  }

  // ===========================================================================
  // VOLATILITY ANALYSIS
  // ===========================================================================

  private analyzeVolatility(market: EtherealMarket): MarketSignals['volatility'] {
    const absChange = Math.abs(market.priceChangePercent24h);
    
    // Regime classification
    let regime: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    if (absChange > 8) regime = 'EXTREME';
    else if (absChange > 4) regime = 'HIGH';
    else if (absChange > 1.5) regime = 'MEDIUM';
    else regime = 'LOW';
    
    // Implied move (next few hours)
    const impliedMove = absChange / 6;  // Rough 4-hour projection
    
    // Optimal hold time based on volatility
    let optimalHoldTime: number;
    switch (regime) {
      case 'EXTREME': optimalHoldTime = 30; break;   // Quick in and out
      case 'HIGH': optimalHoldTime = 60; break;      // Short hold
      case 'MEDIUM': optimalHoldTime = 90; break;    // Standard hold
      case 'LOW': optimalHoldTime = 120; break;      // Longer hold needed
    }
    
    return { regime, impliedMove, optimalHoldTime };
  }

  // ===========================================================================
  // COMPOSITE SIGNAL
  // ===========================================================================

  private calculateComposite(
    momentum: MarketSignals['momentum'],
    funding: MarketSignals['funding'],
    volume: MarketSignals['volume'],
    liquidity: MarketSignals['liquidity'],
    volatility: MarketSignals['volatility']
  ): MarketSignals['composite'] {
    let score = 0;
    let confidence = 50;
    
    // Momentum contribution (-40 to +40)
    if (momentum.direction === 'BULLISH') {
      score += momentum.strength * 0.4;
    } else if (momentum.direction === 'BEARISH') {
      score -= momentum.strength * 0.4;
    }
    
    // Funding rate contribution (-20 to +20)
    if (funding.opportunity === 'CONTRARIAN_LONG') {
      score += 20;
      confidence += 5;
    } else if (funding.opportunity === 'CONTRARIAN_SHORT') {
      score -= 20;
      confidence += 5;
    } else if (funding.opportunity === 'TREND_FOLLOW') {
      score += (momentum.direction === 'BULLISH' ? 15 : -15);
      confidence += 8;
    }
    
    // Volume confirmation (-15 to +15)
    if (volume.strength === 'STRONG') {
      score *= 1.15;  // Amplify signal
      confidence += 10;
    } else if (volume.strength === 'WEAK') {
      score *= 0.85;  // Dampen signal
      confidence -= 10;
    }
    
    // Liquidity adjustment
    if (!liquidity.tradeable) {
      score = 0;  // Can't trade illiquid markets
      confidence = 0;
    } else if (liquidity.slippage === 'HIGH') {
      confidence -= 15;
    }
    
    // Volatility adjustment
    if (volatility.regime === 'EXTREME') {
      confidence -= 10;  // More uncertainty
    }
    
    // Cap score and confidence
    score = Math.max(-100, Math.min(100, score));
    confidence = Math.max(0, Math.min(95, confidence));
    
    // Determine signal strength
    let signal: MarketSignals['composite']['signal'];
    if (score > 60) signal = 'STRONG_LONG';
    else if (score > 35) signal = 'LONG';
    else if (score > 15) signal = 'WEAK_LONG';
    else if (score > -15) signal = 'NEUTRAL';
    else if (score > -35) signal = 'WEAK_SHORT';
    else if (score > -60) signal = 'SHORT';
    else signal = 'STRONG_SHORT';
    
    // Urgency
    let urgency: MarketSignals['composite']['urgency'];
    if (!liquidity.tradeable || Math.abs(score) < 20) {
      urgency = 'SKIP';
    } else if (Math.abs(score) > 50 && confidence > 70) {
      urgency = 'IMMEDIATE';
    } else if (Math.abs(score) > 35 && confidence > 60) {
      urgency = 'SOON';
    } else {
      urgency = 'WAIT';
    }
    
    return { signal, score, confidence, urgency };
  }

  // ===========================================================================
  // POSITION SIZING
  // ===========================================================================

  private calculatePositionSize(
    composite: MarketSignals['composite'],
    capitalUSD: number
  ): number {
    const absScore = Math.abs(composite.score);
    const confidence = composite.confidence;
    
    // Base position sizing (10-30% of capital)
    let basePercent = 0.15;  // 15% default
    
    // Adjust based on signal strength
    if (absScore > 70 && confidence > 80) {
      basePercent = 0.30;  // Strong signal = larger position
    } else if (absScore > 50 && confidence > 70) {
      basePercent = 0.25;
    } else if (absScore > 35 && confidence > 60) {
      basePercent = 0.20;
    }
    
    // For small accounts (<$10), be more conservative
    if (capitalUSD < 10) {
      basePercent = Math.min(basePercent, 0.25);
    }
    
    return basePercent;
  }

  private calculateOptimalLeverage(
    composite: MarketSignals['composite'],
    volatility: MarketSignals['volatility']
  ): number {
    let leverage = 1;
    
    // Base leverage on confidence
    if (composite.confidence > 80) leverage = 5;
    else if (composite.confidence > 70) leverage = 4;
    else if (composite.confidence > 60) leverage = 3;
    else leverage = 2;
    
    // Reduce in high volatility
    if (volatility.regime === 'EXTREME') leverage = Math.max(1, leverage - 2);
    else if (volatility.regime === 'HIGH') leverage = Math.max(1, leverage - 1);
    
    return leverage;
  }

  private calculatePriceTargets(
    market: EtherealMarket,
    action: 'LONG' | 'SHORT',
    volatility: MarketSignals['volatility']
  ): { takeProfitPrice: number; stopLossPrice: number } {
    const price = market.lastPrice;
    
    // Base targets on volatility regime
    let tpPercent: number;
    let slPercent: number;
    
    switch (volatility.regime) {
      case 'EXTREME':
        tpPercent = 4.0;
        slPercent = 2.5;
        break;
      case 'HIGH':
        tpPercent = 3.0;
        slPercent = 1.8;
        break;
      case 'MEDIUM':
        tpPercent = 2.5;
        slPercent = 1.5;
        break;
      case 'LOW':
      default:
        tpPercent = 2.0;
        slPercent = 1.2;
        break;
    }
    
    if (action === 'LONG') {
      return {
        takeProfitPrice: price * (1 + tpPercent / 100),
        stopLossPrice: price * (1 - slPercent / 100),
      };
    } else {
      return {
        takeProfitPrice: price * (1 - tpPercent / 100),
        stopLossPrice: price * (1 + slPercent / 100),
      };
    }
  }

  private skipTrade(market: EtherealMarket): TradingParameters {
    return {
      action: 'SKIP',
      positionSizePercent: 0,
      leverage: 0,
      entryPrice: market.lastPrice,
      takeProfitPrice: market.lastPrice,
      stopLossPrice: market.lastPrice,
      holdTimeMinutes: 0,
      riskRewardRatio: 0,
      expectedPnlPercent: 0,
    };
  }
}

export default MarketAnalyzer;
