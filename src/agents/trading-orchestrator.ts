/**
 * Trading Orchestrator - Parallel Analysis & Execution System
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    TRADING ORCHESTRATOR                        │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
 * │  │ Market Monitor│───▶│ Analysis      │───▶│ Trade         │   │
 * │  │ (Continuous)  │    │ Engine        │    │ Executor      │   │
 * │  └───────────────┘    └───────────────┘    └───────────────┘   │
 * │         │                    │                    │            │
 * │         ▼                    ▼                    ▼            │
 * │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
 * │  │ Market State  │    │ Signal Queue  │    │ Position      │   │
 * │  │ (Live Data)   │    │ (Opportunities│    │ Manager       │   │
 * │  └───────────────┘    └───────────────┘    └───────────────┘   │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * Benefits:
 * - Continuous market monitoring without blocking trades
 * - Accumulated market intelligence for better decisions
 * - Real-time position management with dynamic exits
 * - Parallel processing for faster response
 */

import { EventEmitter } from 'events';
import Groq from 'groq-sdk';
import { EtherealClient, EtherealMarket } from '../clients/ethereal-client';
import { TradeTracker, TradeResult } from './trade-tracker';
import { ProfitScorer } from './profit-scorer';
import { MarketAnalyzer, MarketSignals, TradingParameters } from './market-analyzer';

// ============================================================================
// TYPES
// ============================================================================

export interface MarketSnapshot {
  market: EtherealMarket;
  timestamp: number;
  signals: MarketSignals;
  parameters: TradingParameters;
  historicalPrices: number[];
  volatilityTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
  momentumShift: boolean;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  action: 'LONG' | 'SHORT';
  confidence: number;
  urgency: 'IMMEDIATE' | 'SOON' | 'WAIT';
  entryPrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  positionSize: number;
  leverage: number;
  holdTimeMinutes: number;
  reasoning: string;
  createdAt: number;
  expiresAt: number;
  marketSnapshot: MarketSnapshot;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  trailingStopPrice?: number;
  enteredAt: number;
  maxHoldTime: number;
  marketSnapshot: MarketSnapshot;
  exitReason?: string;
}

export interface OrchestratorConfig {
  groqApiKey: string;
  totalCapital: number;
  
  // Timing
  marketUpdateIntervalMs: number;    // How often to fetch market data
  analysisIntervalMs: number;        // How often to run deep analysis
  positionCheckIntervalMs: number;   // How often to check positions
  
  // Trading limits
  maxConcurrentPositions: number;
  maxPositionPercent: number;
  minConfidence: number;
  maxRiskScore: number;
  
  // Signal management
  signalExpiryMs: number;            // How long signals are valid
  minSignalAge: number;              // Minimum time to observe before trading
  
  dryRun: boolean;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: Partial<OrchestratorConfig> = {
  totalCapital: 5,
  marketUpdateIntervalMs: 5000,      // Update markets every 5s
  analysisIntervalMs: 15000,         // Deep analysis every 15s
  positionCheckIntervalMs: 3000,     // Check positions every 3s
  maxConcurrentPositions: 3,
  maxPositionPercent: 0.30,
  minConfidence: 70,
  maxRiskScore: 60,
  signalExpiryMs: 120000,            // Signals expire after 2 min
  minSignalAge: 10000,               // Observe for 10s before acting
  dryRun: true,
};

// ============================================================================
// MARKET MONITOR - Continuous Data Collection
// ============================================================================

class MarketMonitor extends EventEmitter {
  private ethereal: EtherealClient;
  private marketSnapshots: Map<string, MarketSnapshot[]> = new Map();
  private latestMarkets: Map<string, EtherealMarket> = new Map();
  private analyzer: MarketAnalyzer;
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;
  
  constructor(private config: OrchestratorConfig) {
    super();
    this.ethereal = new EtherealClient();
    this.analyzer = new MarketAnalyzer();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('📡 Market Monitor started');
    await this.updateMarkets();
    
    this.updateInterval = setInterval(
      () => this.updateMarkets(),
      this.config.marketUpdateIntervalMs
    );
  }

  stop(): void {
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    console.log('📡 Market Monitor stopped');
  }

  private async updateMarkets(): Promise<void> {
    try {
      const markets = await this.ethereal.getMarkets();
      const timestamp = Date.now();
      
      for (const market of markets) {
        // Store latest
        this.latestMarkets.set(market.symbol, market);
        
        // Analyze signals
        const signals = this.analyzer.analyzeSignals(market);
        const parameters = this.analyzer.getOptimalParameters(
          market, 
          signals, 
          this.config.totalCapital
        );
        
        // Get historical prices for this symbol
        const history = this.marketSnapshots.get(market.symbol) || [];
        const historicalPrices = history.map(s => s.market.lastPrice);
        
        // Detect volatility trend
        const volatilityTrend = this.detectVolatilityTrend(history);
        
        // Detect momentum shift
        const momentumShift = this.detectMomentumShift(market, history);
        
        const snapshot: MarketSnapshot = {
          market,
          timestamp,
          signals,
          parameters,
          historicalPrices,
          volatilityTrend,
          momentumShift,
        };
        
        // Store snapshot (keep last 60 snapshots = 5 minutes at 5s intervals)
        if (!this.marketSnapshots.has(market.symbol)) {
          this.marketSnapshots.set(market.symbol, []);
        }
        const snapshots = this.marketSnapshots.get(market.symbol)!;
        snapshots.push(snapshot);
        if (snapshots.length > 60) snapshots.shift();
        
        // Emit update
        this.emit('marketUpdate', snapshot);
        
        // Emit opportunity if strong signal
        if (Math.abs(signals.composite.score) > 40 && 
            signals.composite.confidence >= this.config.minConfidence) {
          this.emit('opportunity', snapshot);
        }
      }
      
      this.emit('allMarketsUpdated', Array.from(this.latestMarkets.values()));
      
    } catch (error) {
      this.emit('error', error);
    }
  }

  private detectVolatilityTrend(
    history: MarketSnapshot[]
  ): 'INCREASING' | 'STABLE' | 'DECREASING' {
    if (history.length < 10) return 'STABLE';
    
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    const recentVol = this.calculateVolatility(recent.map(s => s.market.lastPrice));
    const olderVol = this.calculateVolatility(older.map(s => s.market.lastPrice));
    
    const change = (recentVol - olderVol) / olderVol;
    
    if (change > 0.2) return 'INCREASING';
    if (change < -0.2) return 'DECREASING';
    return 'STABLE';
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private detectMomentumShift(
    current: EtherealMarket, 
    history: MarketSnapshot[]
  ): boolean {
    if (history.length < 5) return false;
    
    const recentDirection = current.priceChangePercent24h > 0 ? 1 : -1;
    const olderSnapshot = history[history.length - 5];
    const olderDirection = olderSnapshot.market.priceChangePercent24h > 0 ? 1 : -1;
    
    return recentDirection !== olderDirection;
  }

  getSnapshot(symbol: string): MarketSnapshot | undefined {
    const snapshots = this.marketSnapshots.get(symbol);
    return snapshots?.[snapshots.length - 1];
  }

  getHistory(symbol: string): MarketSnapshot[] {
    return this.marketSnapshots.get(symbol) || [];
  }

  getLatestMarkets(): EtherealMarket[] {
    return Array.from(this.latestMarkets.values());
  }
}

// ============================================================================
// ANALYSIS ENGINE - Deep Market Analysis
// ============================================================================

class AnalysisEngine extends EventEmitter {
  private groq: Groq;
  private signalQueue: Map<string, TradingSignal> = new Map();
  private isRunning = false;
  private analysisInterval?: NodeJS.Timeout;

  constructor(private config: OrchestratorConfig) {
    super();
    this.groq = new Groq({ apiKey: config.groqApiKey });
  }

  async start(marketMonitor: MarketMonitor): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('🧠 Analysis Engine started');
    
    // Listen to market opportunities
    marketMonitor.on('opportunity', (snapshot: MarketSnapshot) => {
      this.queueForAnalysis(snapshot);
    });
    
    // Run periodic deep analysis
    this.analysisInterval = setInterval(
      () => this.runDeepAnalysis(marketMonitor),
      this.config.analysisIntervalMs
    );
  }

  stop(): void {
    this.isRunning = false;
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    console.log('🧠 Analysis Engine stopped');
  }

  private async queueForAnalysis(snapshot: MarketSnapshot): Promise<void> {
    const symbol = snapshot.market.symbol;
    const now = Date.now();
    
    // Check if we already have a valid signal
    const existing = this.signalQueue.get(symbol);
    if (existing && existing.expiresAt > now) {
      // Update existing signal with new data
      existing.marketSnapshot = snapshot;
      
      // Check if direction should flip (significant change)
      const priceChange = snapshot.market.priceChangePercent24h;
      const shouldBeLong = priceChange > 1.5;
      const shouldBeShort = priceChange < -1.5;
      const currentIsLong = existing.action === 'LONG';
      
      // If direction should flip, generate new signal
      if ((shouldBeLong && !currentIsLong) || (shouldBeShort && currentIsLong)) {
        const signal = await this.generateSignal(snapshot);
        if (signal) {
          this.signalQueue.set(symbol, signal);
          this.emit('newSignal', signal);
        }
      }
      return;
    }
    
    // Generate new signal
    const signal = await this.generateSignal(snapshot);
    if (signal) {
      this.signalQueue.set(symbol, signal);
      this.emit('newSignal', signal);
    }
  }

  private async runDeepAnalysis(marketMonitor: MarketMonitor): Promise<void> {
    const markets = marketMonitor.getLatestMarkets();
    
    // Score all markets
    const scoredMarkets = markets.map(market => {
      const snapshot = marketMonitor.getSnapshot(market.symbol);
      return {
        market,
        snapshot,
        score: snapshot ? Math.abs(snapshot.signals.composite.score) : 0,
      };
    }).sort((a, b) => b.score - a.score);
    
    // Analyze top 5 opportunities to find more trades
    for (const { snapshot } of scoredMarkets.slice(0, 5)) {
      if (snapshot && Math.abs(snapshot.signals.composite.score) > 25) {
        await this.queueForAnalysis(snapshot);
      }
    }
    
    // Clean expired signals
    this.cleanExpiredSignals();
    
    this.emit('analysisComplete', {
      totalMarkets: markets.length,
      activeSignals: this.signalQueue.size,
    });
  }

  private async generateSignal(snapshot: MarketSnapshot): Promise<TradingSignal | null> {
    const { market, signals, parameters, historicalPrices, volatilityTrend, momentumShift } = snapshot;
    
    if (parameters.action === 'SKIP') return null;
    
    try {
      // Try enhanced AI analysis with historical context
      let analysis = await this.getEnhancedAIAnalysis(
        market, 
        historicalPrices, 
        volatilityTrend, 
        momentumShift
      );
      
      // Fallback if AI fails - use market signals
      if (!analysis) {
        analysis = this.getFallbackAnalysis(market, signals);
      }
      
      if (!analysis || analysis.confidence < this.config.minConfidence) {
        return null;
      }
      
      // Calculate position size
      const positionSize = this.calculatePositionSize(analysis.confidence, signals);
      
      // Determine leverage
      const leverage = this.calculateLeverage(analysis.confidence, signals.volatility.regime);
      
      // Calculate optimal hold time based on market conditions
      const holdTimeMinutes = this.calculateHoldTime(signals, volatilityTrend, analysis);
      
      const now = Date.now();
      
      return {
        id: `${market.symbol}-${now}`,
        symbol: market.symbol,
        action: analysis.action,
        confidence: analysis.confidence,
        urgency: analysis.urgency,
        entryPrice: market.lastPrice,
        takeProfitPrice: analysis.action === 'LONG' 
          ? market.lastPrice * (1 + analysis.takeProfitPercent / 100)
          : market.lastPrice * (1 - analysis.takeProfitPercent / 100),
        stopLossPrice: analysis.action === 'LONG'
          ? market.lastPrice * (1 - analysis.stopLossPercent / 100)
          : market.lastPrice * (1 + analysis.stopLossPercent / 100),
        positionSize,
        leverage,
        holdTimeMinutes,
        reasoning: analysis.reasoning,
        createdAt: now,
        expiresAt: now + this.config.signalExpiryMs,
        marketSnapshot: snapshot,
      };
    } catch (error) {
      console.error(`Analysis error for ${market.symbol}:`, error);
      return null;
    }
  }

  private async getEnhancedAIAnalysis(
    market: EtherealMarket,
    historicalPrices: number[],
    volatilityTrend: string,
    momentumShift: boolean
  ): Promise<{
    action: 'LONG' | 'SHORT';
    confidence: number;
    urgency: 'IMMEDIATE' | 'SOON' | 'WAIT';
    takeProfitPercent: number;
    stopLossPercent: number;
    reasoning: string;
    optimalHoldMinutes: number;
  } | null> {
    const priceHistory = historicalPrices.length > 0 
      ? `Recent prices: ${historicalPrices.slice(-5).map(p => p.toFixed(2)).join(' → ')}`
      : 'No price history';

    const prompt = `PERPETUAL FUTURES ANALYSIS - ${market.symbol}

CURRENT STATE:
  Price: $${market.lastPrice.toLocaleString()}
  24h Change: ${market.priceChangePercent24h.toFixed(2)}%
  Funding Rate: ${(market.fundingRate * 100).toFixed(4)}%
  Volume: $${(market.volume24h / 1000000).toFixed(2)}M
  
MARKET DYNAMICS:
  ${priceHistory}
  Volatility Trend: ${volatilityTrend}
  Momentum Shift Detected: ${momentumShift ? 'YES ⚠️' : 'NO'}

CAPITAL: $5 USDE (small account - need high probability)

ANALYZE and provide JSON:
{
  "action": "LONG" | "SHORT",
  "confidence": 70-95,
  "urgency": "IMMEDIATE" | "SOON" | "WAIT",
  "takeProfitPercent": 2.0-5.0,
  "stopLossPercent": 1.0-2.5,
  "reasoning": "2-3 sentence analysis",
  "optimalHoldMinutes": 15-180
}

Consider:
1. Is momentum shifting? If yes, be more cautious
2. Volatility increasing? Wider stops, shorter hold
3. Volatility decreasing? Tighter stops, longer hold
4. Strong signal? Higher confidence, can hold longer`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are an expert crypto trader specializing in perpetual futures. 
Focus on HIGH PROBABILITY setups only. Be selective and patient.
Consider market dynamics and timing carefully.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || "";
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) return null;
      
      const data = JSON.parse(jsonMatch[0]);
      
      return {
        action: data.action,
        confidence: Math.min(95, Math.max(50, data.confidence)),
        urgency: data.urgency || 'SOON',
        takeProfitPercent: Math.min(5, Math.max(1.5, data.takeProfitPercent)),
        stopLossPercent: Math.min(2.5, Math.max(0.8, data.stopLossPercent)),
        reasoning: data.reasoning || 'Signal detected',
        optimalHoldMinutes: Math.min(180, Math.max(15, data.optimalHoldMinutes)),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fallback analysis when AI is unavailable
   */
  private getFallbackAnalysis(
    market: EtherealMarket,
    signals: MarketSignals
  ): {
    action: 'LONG' | 'SHORT';
    confidence: number;
    urgency: 'IMMEDIATE' | 'SOON' | 'WAIT';
    takeProfitPercent: number;
    stopLossPercent: number;
    reasoning: string;
    optimalHoldMinutes: number;
  } | null {
    const priceChange = market.priceChangePercent24h;
    const absChange = Math.abs(priceChange);
    
    // Only trade clear momentum
    if (absChange < 1.5) return null;
    
    const action: 'LONG' | 'SHORT' = priceChange > 0 ? 'LONG' : 'SHORT';
    
    // Confidence based on momentum strength
    let confidence = 70;
    if (absChange > 3.0) confidence = 82;
    else if (absChange > 2.5) confidence = 78;
    else if (absChange > 2.0) confidence = 75;
    else if (absChange > 1.5) confidence = 72;
    
    // Urgency based on momentum
    let urgency: 'IMMEDIATE' | 'SOON' | 'WAIT' = 'SOON';
    if (absChange > 3.0) urgency = 'IMMEDIATE';
    else if (absChange < 2.0) urgency = 'WAIT';
    
    // TP/SL based on volatility
    const takeProfitPercent = absChange > 3 ? 3.5 : absChange > 2 ? 3.0 : 2.5;
    const stopLossPercent = absChange > 3 ? 2.0 : absChange > 2 ? 1.8 : 1.5;
    
    const reasoning = `${action} signal: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}% momentum with ${signals.composite.signal} composite`;
    
    return {
      action,
      confidence,
      urgency,
      takeProfitPercent,
      stopLossPercent,
      reasoning,
      optimalHoldMinutes: absChange > 3 ? 60 : absChange > 2 ? 45 : 30,
    };
  }

  private calculatePositionSize(confidence: number, signals: MarketSignals): number {
    const { totalCapital, maxPositionPercent, maxConcurrentPositions } = this.config;
    
    // Base size on confidence
    let sizePercent = 0.15;
    if (confidence > 85) sizePercent = 0.30;
    else if (confidence > 80) sizePercent = 0.25;
    else if (confidence > 75) sizePercent = 0.20;
    
    // Reduce for weak liquidity
    if (signals.liquidity.slippage === 'HIGH') {
      sizePercent *= 0.7;
    }
    
    // Apply limits
    const maxSize = totalCapital * Math.min(sizePercent, maxPositionPercent);
    const perPositionMax = totalCapital / maxConcurrentPositions;
    
    return Math.round(Math.min(maxSize, perPositionMax) * 100) / 100;
  }

  private calculateLeverage(confidence: number, volatilityRegime: string): number {
    let leverage = 2;
    
    if (confidence > 85) leverage = 5;
    else if (confidence > 80) leverage = 4;
    else if (confidence > 75) leverage = 3;
    
    // Reduce for high volatility
    if (volatilityRegime === 'EXTREME') leverage = Math.max(1, leverage - 2);
    else if (volatilityRegime === 'HIGH') leverage = Math.max(1, leverage - 1);
    
    return leverage;
  }

  private calculateHoldTime(
    signals: MarketSignals,
    volatilityTrend: string,
    analysis: { optimalHoldMinutes: number; confidence: number }
  ): number {
    let holdTime = analysis.optimalHoldMinutes;
    
    // Adjust based on volatility trend
    if (volatilityTrend === 'INCREASING') {
      holdTime = Math.max(15, holdTime * 0.7); // Shorter hold
    } else if (volatilityTrend === 'DECREASING') {
      holdTime = Math.min(180, holdTime * 1.3); // Longer hold
    }
    
    // Strong signals can hold longer
    if (analysis.confidence > 85) {
      holdTime = Math.min(180, holdTime * 1.2);
    }
    
    return Math.round(holdTime);
  }

  private cleanExpiredSignals(): void {
    const now = Date.now();
    for (const [symbol, signal] of this.signalQueue) {
      if (signal.expiresAt < now) {
        this.signalQueue.delete(symbol);
      }
    }
  }

  getActiveSignals(): TradingSignal[] {
    const now = Date.now();
    return Array.from(this.signalQueue.values())
      .filter(s => s.expiresAt > now)
      .sort((a, b) => b.confidence - a.confidence);
  }

  getSignal(symbol: string): TradingSignal | undefined {
    const signal = this.signalQueue.get(symbol);
    if (signal && signal.expiresAt > Date.now()) {
      return signal;
    }
    return undefined;
  }
}

// ============================================================================
// POSITION MANAGER - Trade Execution & Monitoring
// ============================================================================

class PositionManager extends EventEmitter {
  private openPositions: Map<string, OpenPosition> = new Map();
  private closedPositions: TradeResult[] = [];
  private tracker: TradeTracker;
  private scorer: ProfitScorer;
  private checkInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(private config: OrchestratorConfig) {
    super();
    this.tracker = new TradeTracker('./trade-results/orchestrator');
    this.scorer = new ProfitScorer();
  }

  async start(marketMonitor: MarketMonitor): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('💼 Position Manager started');
    
    // Monitor positions
    this.checkInterval = setInterval(
      () => this.checkPositions(marketMonitor),
      this.config.positionCheckIntervalMs
    );
  }

  stop(): void {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    console.log('💼 Position Manager stopped');
  }

  canOpenPosition(): boolean {
    return this.openPositions.size < this.config.maxConcurrentPositions;
  }

  async openPosition(signal: TradingSignal): Promise<OpenPosition | null> {
    if (!this.canOpenPosition()) {
      console.log(`   ⚠️ Max positions reached (${this.config.maxConcurrentPositions})`);
      return null;
    }
    
    // Check if already have position in this market
    if (this.openPositions.has(signal.symbol)) {
      console.log(`   ⚠️ Already have position in ${signal.symbol}`);
      return null;
    }
    
    const position: OpenPosition = {
      id: signal.id,
      symbol: signal.symbol,
      side: signal.action,
      entryPrice: signal.entryPrice,
      currentPrice: signal.entryPrice,
      size: signal.positionSize,
      leverage: signal.leverage,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      takeProfitPrice: signal.takeProfitPrice,
      stopLossPrice: signal.stopLossPrice,
      enteredAt: Date.now(),
      maxHoldTime: signal.holdTimeMinutes * 60 * 1000,
      marketSnapshot: signal.marketSnapshot,
    };
    
    this.openPositions.set(signal.symbol, position);
    
    console.log(`\n   ✅ POSITION OPENED: ${signal.action} ${signal.symbol}`);
    console.log(`      Size: $${signal.positionSize.toFixed(2)} @ ${signal.leverage}x`);
    console.log(`      Entry: $${signal.entryPrice.toLocaleString()}`);
    console.log(`      TP: $${signal.takeProfitPrice.toLocaleString()}`);
    console.log(`      SL: $${signal.stopLossPrice.toLocaleString()}`);
    console.log(`      Max Hold: ${signal.holdTimeMinutes}min`);
    
    this.emit('positionOpened', position);
    
    return position;
  }

  private checkPositions(marketMonitor: MarketMonitor): void {
    for (const [symbol, position] of this.openPositions) {
      const snapshot = marketMonitor.getSnapshot(symbol);
      if (!snapshot) continue;
      
      const currentPrice = snapshot.market.lastPrice;
      position.currentPrice = currentPrice;
      
      // Calculate unrealized PnL
      if (position.side === 'LONG') {
        position.unrealizedPnL = (currentPrice - position.entryPrice) / position.entryPrice;
      } else {
        position.unrealizedPnL = (position.entryPrice - currentPrice) / position.entryPrice;
      }
      position.unrealizedPnL *= position.leverage;
      position.unrealizedPnLPercent = position.unrealizedPnL * 100;
      
      // Update trailing stop if in profit
      if (position.unrealizedPnLPercent > 2) {
        const trailingDistance = Math.abs(position.entryPrice - position.stopLossPrice) * 0.5;
        if (position.side === 'LONG') {
          const newTrailingStop = currentPrice - trailingDistance;
          if (!position.trailingStopPrice || newTrailingStop > position.trailingStopPrice) {
            position.trailingStopPrice = newTrailingStop;
          }
        } else {
          const newTrailingStop = currentPrice + trailingDistance;
          if (!position.trailingStopPrice || newTrailingStop < position.trailingStopPrice) {
            position.trailingStopPrice = newTrailingStop;
          }
        }
      }
      
      // Check exit conditions
      this.checkExitConditions(position, snapshot);
    }
  }

  private checkExitConditions(position: OpenPosition, snapshot: MarketSnapshot): void {
    const currentPrice = snapshot.market.lastPrice;
    const elapsed = Date.now() - position.enteredAt;
    
    let shouldClose = false;
    let exitReason = '';
    
    // Take profit hit
    if (position.side === 'LONG' && currentPrice >= position.takeProfitPrice) {
      shouldClose = true;
      exitReason = 'take-profit';
    } else if (position.side === 'SHORT' && currentPrice <= position.takeProfitPrice) {
      shouldClose = true;
      exitReason = 'take-profit';
    }
    
    // Stop loss hit
    if (position.side === 'LONG' && currentPrice <= position.stopLossPrice) {
      shouldClose = true;
      exitReason = 'stop-loss';
    } else if (position.side === 'SHORT' && currentPrice >= position.stopLossPrice) {
      shouldClose = true;
      exitReason = 'stop-loss';
    }
    
    // Trailing stop hit
    if (position.trailingStopPrice) {
      if (position.side === 'LONG' && currentPrice <= position.trailingStopPrice) {
        shouldClose = true;
        exitReason = 'trailing-stop';
      } else if (position.side === 'SHORT' && currentPrice >= position.trailingStopPrice) {
        shouldClose = true;
        exitReason = 'trailing-stop';
      }
    }
    
    // Max hold time
    if (elapsed >= position.maxHoldTime) {
      shouldClose = true;
      exitReason = 'time-exit';
    }
    
    // Momentum shift (early exit)
    if (snapshot.momentumShift && position.unrealizedPnLPercent > 0.5) {
      shouldClose = true;
      exitReason = 'momentum-shift';
    }
    
    if (shouldClose) {
      this.closePosition(position, currentPrice, exitReason);
    }
  }

  private closePosition(position: OpenPosition, exitPrice: number, reason: string): void {
    position.exitReason = reason;
    
    const pnl = position.side === 'LONG'
      ? (exitPrice - position.entryPrice) / position.entryPrice * position.leverage
      : (position.entryPrice - exitPrice) / position.entryPrice * position.leverage;
    
    const dollarPnL = position.size * pnl;
    const holdTimeMin = (Date.now() - position.enteredAt) / 60000;
    
    const emoji = pnl > 0 ? '✅' : '❌';
    console.log(`\n   ${emoji} POSITION CLOSED: ${position.symbol}`);
    console.log(`      Exit Reason: ${reason}`);
    console.log(`      Entry: $${position.entryPrice.toLocaleString()} → Exit: $${exitPrice.toLocaleString()}`);
    console.log(`      PnL: ${pnl >= 0 ? '+' : ''}${(pnl * 100).toFixed(2)}% ($${dollarPnL.toFixed(4)})`);
    console.log(`      Hold Time: ${holdTimeMin.toFixed(1)}min`);
    
    // Record trade
    const trade: TradeResult = {
      tradeId: position.id,
      marketId: position.symbol,
      question: `${position.symbol} ${position.side} @ $${position.entryPrice.toLocaleString()}`,
      action: position.side === 'LONG' ? 'buy' : 'sell',
      entryPrice: position.entryPrice,
      exitPrice: exitPrice,
      size: position.size / this.config.totalCapital,
      confidence: position.marketSnapshot.signals.composite.confidence / 100,
      expectedReturn: 1 + Math.abs(position.takeProfitPrice - position.entryPrice) / position.entryPrice,
      riskScore: (100 - position.marketSnapshot.signals.composite.confidence) / 100,
      timestamp: position.enteredAt,
      reasoning: `Exit: ${reason} after ${holdTimeMin.toFixed(1)}min`,
      actualOutcome: pnl > 0,
      pnl: pnl,
      resolved: true,
      resolutionDate: Date.now(),
    };
    
    this.tracker.saveTrade(trade);
    this.closedPositions.push(trade);
    this.openPositions.delete(position.symbol);
    
    this.emit('positionClosed', { position, trade, reason });
  }

  getOpenPositions(): OpenPosition[] {
    return Array.from(this.openPositions.values());
  }

  getClosedPositions(): TradeResult[] {
    return this.closedPositions;
  }

  getStats(): { 
    openCount: number; 
    closedCount: number; 
    totalPnL: number;
    winRate: number;
  } {
    const wins = this.closedPositions.filter(t => (t.pnl || 0) > 0).length;
    const totalPnL = this.closedPositions.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    return {
      openCount: this.openPositions.size,
      closedCount: this.closedPositions.length,
      totalPnL,
      winRate: this.closedPositions.length > 0 ? wins / this.closedPositions.length : 0,
    };
  }

  exportResults(): void {
    this.tracker.exportToCSV();
    
    if (this.closedPositions.length > 0) {
      const metrics = this.scorer.calculateMetrics(this.closedPositions);
      this.scorer.printReport(metrics);
    }
  }
}

// ============================================================================
// TRADING ORCHESTRATOR - Main Controller
// ============================================================================

export class TradingOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private marketMonitor: MarketMonitor;
  private analysisEngine: AnalysisEngine;
  private positionManager: PositionManager;
  private isRunning = false;
  private displayInterval?: NodeJS.Timeout;
  private tradedSignals: Set<string> = new Set(); // Track consumed signals
  private lastTradeTime: Map<string, number> = new Map(); // Cooldown per symbol

  constructor(config: Partial<OrchestratorConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as OrchestratorConfig;
    
    if (!this.config.groqApiKey) {
      throw new Error('GROQ_API_KEY is required');
    }
    
    this.marketMonitor = new MarketMonitor(this.config);
    this.analysisEngine = new AnalysisEngine(this.config);
    this.positionManager = new PositionManager(this.config);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // When new signal is generated
    this.analysisEngine.on('newSignal', (signal: TradingSignal) => {
      this.handleNewSignal(signal);
    });
    
    // When position is closed
    this.positionManager.on('positionClosed', (data) => {
      this.emit('tradeClosed', data);
      // Record cooldown for this symbol
      this.lastTradeTime.set(data.position.symbol, Date.now());
    });
  }

  private async handleNewSignal(signal: TradingSignal): Promise<void> {
    // Check if signal is mature enough
    const signalAge = Date.now() - signal.createdAt;
    if (signalAge < this.config.minSignalAge) {
      // Wait for signal to mature
      return;
    }
    
    // Check if we can open position
    if (!this.positionManager.canOpenPosition()) {
      return;
    }
    
    // Only trade high urgency or soon signals
    if (signal.urgency === 'WAIT') {
      return;
    }
    
    // Execute trade
    if (this.config.dryRun) {
      await this.simulateTrade(signal);
    } else {
      await this.positionManager.openPosition(signal);
    }
  }

  private async simulateTrade(signal: TradingSignal): Promise<void> {
    const position = await this.positionManager.openPosition(signal);
    if (!position) return;
    
    // Simulate price movement
    const outcome = this.simulateOutcome(signal);
    
    // Simulated hold time: 5-15 seconds to demonstrate the trade
    // (Real hold time would be much longer in live trading)
    const simulatedDelayMs = 5000 + Math.random() * 10000;
    
    // Update position with simulated exit
    setTimeout(() => {
      this.positionManager['closePosition'](
        position,
        outcome.exitPrice,
        outcome.exitReason
      );
    }, simulatedDelayMs);
  }

  /**
   * Probability-based simulation - aligned with main trading agent
   */
  private simulateOutcome(signal: TradingSignal): {
    exitPrice: number;
    exitReason: string;
    holdTimeMs: number;
  } {
    const { entryPrice, takeProfitPrice, stopLossPrice, holdTimeMinutes } = signal;
    const market = signal.marketSnapshot.market;
    
    // Direction alignment - CRITICAL for win probability
    const aligned = 
      (signal.action === 'LONG' && market.priceChangePercent24h > 0) ||
      (signal.action === 'SHORT' && market.priceChangePercent24h < 0);
    
    const momentum = Math.abs(market.priceChangePercent24h);
    
    // Calculate win probability based on setup quality
    let winProb = 0.50;
    
    if (aligned) {
      if (momentum > 3.0) winProb += 0.22;
      else if (momentum > 2.0) winProb += 0.18;
      else if (momentum > 1.5) winProb += 0.12;
      else winProb += 0.06;
    } else {
      winProb -= 0.15;
    }
    
    // Confidence bonus
    if (signal.confidence >= 82) winProb += 0.08;
    else if (signal.confidence >= 77) winProb += 0.04;
    
    // Cap probability
    winProb = Math.max(0.30, Math.min(0.78, winProb));
    
    // Determine outcome
    const isWin = Math.random() < winProb;
    
    let exitPrice: number;
    let exitReason: string;
    let holdTimeMs: number;
    
    if (isWin) {
      const fullTP = Math.random() < 0.75;
      if (fullTP) {
        exitPrice = takeProfitPrice;
        exitReason = 'take-profit';
      } else {
        const partialPct = 0.55 + Math.random() * 0.35;
        exitPrice = signal.action === 'LONG'
          ? entryPrice * (1 + ((takeProfitPrice - entryPrice) / entryPrice) * partialPct)
          : entryPrice * (1 - ((entryPrice - takeProfitPrice) / entryPrice) * partialPct);
        exitReason = 'trailing-stop';
      }
      holdTimeMs = Math.floor(holdTimeMinutes * (0.3 + Math.random() * 0.5)) * 60 * 1000;
    } else {
      const fullSL = Math.random() < 0.50;
      if (fullSL) {
        exitPrice = stopLossPrice;
        exitReason = 'stop-loss';
        holdTimeMs = Math.floor(holdTimeMinutes * (0.1 + Math.random() * 0.25)) * 60 * 1000;
      } else {
        const lossPct = 0.35 + Math.random() * 0.45;
        exitPrice = signal.action === 'LONG'
          ? entryPrice * (1 - ((entryPrice - stopLossPrice) / entryPrice) * lossPct)
          : entryPrice * (1 + ((stopLossPrice - entryPrice) / entryPrice) * lossPct);
        exitReason = 'time-exit';
        holdTimeMs = holdTimeMinutes * 60 * 1000;
      }
    }
    
    return { exitPrice, exitReason, holdTimeMs };
  }

  async start(durationMs: number = 300000): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.clear();
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   🔮 ETHEREAL TRADING ORCHESTRATOR                                   ║
║   Parallel Analysis & Execution System                               ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
`);
    
    console.log('📊 Configuration:');
    console.log(`   Capital: $${this.config.totalCapital} USDE`);
    console.log(`   Max Positions: ${this.config.maxConcurrentPositions}`);
    console.log(`   Min Confidence: ${this.config.minConfidence}%`);
    console.log(`   Mode: ${this.config.dryRun ? '🔍 DRY RUN' : '💸 LIVE'}`);
    console.log(`   Duration: ${(durationMs / 1000).toFixed(0)}s\n`);
    
    // Start components
    await this.marketMonitor.start();
    await this.analysisEngine.start(this.marketMonitor);
    await this.positionManager.start(this.marketMonitor);
    
    // Periodic status display
    this.displayInterval = setInterval(() => {
      this.displayStatus();
      // Check mature signals on each status update
      this.checkMatureSignals();
    }, 10000);
    
    // Also check signals more frequently (every 3s)
    const signalCheckInterval = setInterval(() => {
      this.checkMatureSignals();
    }, 3000);
    
    // Run for duration
    await new Promise(resolve => setTimeout(resolve, durationMs));
    
    clearInterval(signalCheckInterval);
    
    // Stop and report
    await this.stop();
  }

  /**
   * Check for mature signals and execute trades
   */
  private async checkMatureSignals(): Promise<void> {
    if (!this.positionManager.canOpenPosition()) return;
    
    const signals = this.analysisEngine.getActiveSignals();
    const now = Date.now();
    const COOLDOWN_MS = 20000; // 20 second cooldown per symbol after a trade
    
    // Clean up old cooldowns (allow new signals for same symbol after cooldown)
    for (const [symbol, lastTime] of this.lastTradeTime.entries()) {
      if (now - lastTime > COOLDOWN_MS * 2) {
        this.lastTradeTime.delete(symbol);
      }
    }
    
    for (const signal of signals) {
      const signalAge = now - signal.createdAt;
      
      // Skip if not mature enough
      if (signalAge < this.config.minSignalAge) continue;
      
      // Skip WAIT urgency unless very mature (>30s) and high confidence
      if (signal.urgency === 'WAIT' && (signalAge < 30000 || signal.confidence < 75)) continue;
      
      // Skip if we already have this position
      const positions = this.positionManager.getOpenPositions();
      if (positions.some(p => p.symbol === signal.symbol)) continue;
      
      // Skip if we already traded this exact signal
      if (this.tradedSignals.has(signal.id)) continue;
      
      // Skip if symbol is on cooldown (recently traded)
      const lastTrade = this.lastTradeTime.get(signal.symbol);
      if (lastTrade && (now - lastTrade) < COOLDOWN_MS) continue;
      
      // Mark signal as consumed
      this.tradedSignals.add(signal.id);
      
      // Execute trade
      console.log(`\n🎯 EXECUTING: ${signal.action} ${signal.symbol} (${signal.confidence}% conf, age: ${(signalAge/1000).toFixed(0)}s)`);
      
      if (this.config.dryRun) {
        await this.simulateTrade(signal);
      } else {
        await this.positionManager.openPosition(signal);
      }
      
      // Only execute one trade per check to avoid overloading
      break;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
    }
    
    this.marketMonitor.stop();
    this.analysisEngine.stop();
    this.positionManager.stop();
    
    // Final report
    this.printFinalReport();
    this.positionManager.exportResults();
  }

  private displayStatus(): void {
    const signals = this.analysisEngine.getActiveSignals();
    const positions = this.positionManager.getOpenPositions();
    const stats = this.positionManager.getStats();
    
    console.log('\n' + '─'.repeat(70));
    console.log(`📡 STATUS UPDATE @ ${new Date().toLocaleTimeString()}`);
    console.log('─'.repeat(70));
    
    console.log(`\n🎯 Active Signals: ${signals.length}`);
    for (const signal of signals.slice(0, 3)) {
      const age = ((Date.now() - signal.createdAt) / 1000).toFixed(0);
      console.log(`   ${signal.action} ${signal.symbol} | ${signal.confidence}% conf | ${signal.urgency} | Age: ${age}s`);
    }
    
    console.log(`\n💼 Open Positions: ${positions.length}/${this.config.maxConcurrentPositions}`);
    for (const pos of positions) {
      const emoji = pos.unrealizedPnLPercent >= 0 ? '📈' : '📉';
      console.log(`   ${emoji} ${pos.side} ${pos.symbol} | ${pos.unrealizedPnLPercent.toFixed(2)}% | Entry: $${pos.entryPrice.toLocaleString()}`);
    }
    
    console.log(`\n📊 Session Stats:`);
    console.log(`   Trades: ${stats.closedCount} | Win Rate: ${(stats.winRate * 100).toFixed(0)}% | PnL: ${stats.totalPnL >= 0 ? '+' : ''}${(stats.totalPnL * 100).toFixed(2)}%`);
  }

  private printFinalReport(): void {
    const stats = this.positionManager.getStats();
    const trades = this.positionManager.getClosedPositions();
    
    console.log('\n\n' + '═'.repeat(70));
    console.log('🏆 ORCHESTRATOR SESSION COMPLETE');
    console.log('═'.repeat(70));
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Trades: ${stats.closedCount}`);
    console.log(`   Win Rate: ${(stats.winRate * 100).toFixed(1)}%`);
    console.log(`   Total PnL: ${stats.totalPnL >= 0 ? '+' : ''}${(stats.totalPnL * 100).toFixed(2)}%`);
    
    const dollarPnL = trades.reduce((sum, t) => {
      const size = t.size * this.config.totalCapital;
      return sum + size * (t.pnl || 0);
    }, 0);
    
    console.log(`   Dollar PnL: ${dollarPnL >= 0 ? '+' : ''}$${dollarPnL.toFixed(4)} USDE`);
    
    if (trades.length > 0) {
      const sorted = [...trades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
      console.log(`\n🏆 Best: ${sorted[0].marketId} | ${((sorted[0].pnl || 0) * 100).toFixed(2)}%`);
      console.log(`📉 Worst: ${sorted[sorted.length-1].marketId} | ${((sorted[sorted.length-1].pnl || 0) * 100).toFixed(2)}%`);
    }
    
    console.log('\n' + '═'.repeat(70) + '\n');
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

if (require.main === module) {
  const config: Partial<OrchestratorConfig> = {
    groqApiKey: process.env.GROQ_API_KEY,
    totalCapital: parseFloat(process.env.TOTAL_CAPITAL || '5'),
    maxConcurrentPositions: parseInt(process.env.MAX_CONCURRENT_POSITIONS || '3'),
    minConfidence: parseInt(process.env.MIN_CONFIDENCE || '70'),
    maxRiskScore: parseInt(process.env.MAX_RISK_SCORE || '60'),
    marketUpdateIntervalMs: parseInt(process.env.MARKET_UPDATE_MS || '5000'),
    analysisIntervalMs: parseInt(process.env.ANALYSIS_INTERVAL_MS || '15000'),
    dryRun: process.env.DRY_RUN !== 'false',
  };
  
  const durationSec = parseInt(process.env.DURATION_SEC || '120');
  
  const orchestrator = new TradingOrchestrator(config);
  orchestrator.start(durationSec * 1000).catch(console.error);
}

export default TradingOrchestrator;
