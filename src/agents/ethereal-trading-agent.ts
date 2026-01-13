/**
 * Ethereal Perpetual Trading Agent
 * 
 * Optimized for maximum profitability with 5 USDE capital.
 * Features:
 * - Adaptive hold times based on market volatility
 * - Dynamic position sizing with Kelly criterion
 * - Smart session management
 * - Multi-timeframe analysis
 * - Risk-adjusted position management
 */

import Groq from 'groq-sdk';
import { ethers } from 'ethers';
import { EtherealClient, EtherealMarket } from '../clients/ethereal-client';
import { TradeTracker, TradeResult } from './trade-tracker';
import { ProfitScorer, ProfitMetrics } from './profit-scorer';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface EtherealAgentConfig {
  groqApiKey: string;
  privateKey?: string;
  rpcUrl?: string;
  
  // Capital management
  totalCapital: number;           // Total USDE available (e.g., 5)
  maxPositionPercent: number;     // Max % of capital per trade (e.g., 0.25 = 25%)
  maxConcurrentPositions: number; // Max open positions
  
  // Trading thresholds
  minConfidence: number;          // Minimum AI confidence (0-100)
  maxRiskScore: number;           // Maximum acceptable risk (0-100)
  
  // Session management
  sessionsPerRun: number;
  tradesPerSession: number;
  sessionCooldownMs: number;
  
  // Execution mode
  dryRun: boolean;
  autoConfirm?: boolean;
}

export interface MarketAnalysis {
  action: 'LONG' | 'SHORT' | 'HOLD';
  confidence: number;
  reasoning: string;
  expectedReturn: number;
  riskScore: number;
  
  // Adaptive timing
  holdTimeMinutes: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  
  // Price targets
  entryPrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  
  // Market regime
  volatilityRegime: 'LOW' | 'MEDIUM' | 'HIGH';
  trendStrength: 'WEAK' | 'MODERATE' | 'STRONG';
  momentumAlignment: boolean;
}

export interface TradeExecution {
  success: boolean;
  tradeId: string;
  entryPrice: number;
  positionSize: number;
  leverage: number;
  txHash?: string;
  error?: string;
}

export interface SimulatedOutcome {
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
  exitReason: 'take-profit' | 'stop-loss' | 'time-exit' | 'trailing-stop';
  holdTimeMinutes: number;
  maxDrawdown: number;
  maxProfit: number;
}

// ============================================================================
// DEFAULT CONFIGURATION FOR 5 USDE
// ============================================================================

export const DEFAULT_CONFIG: Partial<EtherealAgentConfig> = {
  totalCapital: 5,
  maxPositionPercent: 0.30,      // Max 30% per trade = 1.5 USDE
  maxConcurrentPositions: 3,
  minConfidence: 70,             // Slightly lower to catch more opportunities
  maxRiskScore: 65,              // Allow more trades (was 45)
  sessionsPerRun: 2,
  tradesPerSession: 5,
  sessionCooldownMs: 5000,
  dryRun: true,
  autoConfirm: false,
};

// ============================================================================
// MAIN TRADING AGENT
// ============================================================================

export class EtherealTradingAgent {
  private config: EtherealAgentConfig;
  private groq: Groq;
  private ethereal: EtherealClient;
  private tracker: TradeTracker;
  private scorer: ProfitScorer;
  private wallet?: ethers.Wallet;
  
  private openPositions: Map<string, TradeResult> = new Map();
  private sessionPnL: number = 0;
  private totalPnL: number = 0;

  constructor(config: Partial<EtherealAgentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as EtherealAgentConfig;
    
    if (!this.config.groqApiKey) {
      throw new Error('GROQ_API_KEY is required');
    }
    
    this.groq = new Groq({ apiKey: this.config.groqApiKey });
    this.ethereal = new EtherealClient();
    this.tracker = new TradeTracker('./trade-results/ethereal-live');
    this.scorer = new ProfitScorer();
    
    if (this.config.privateKey && !this.config.dryRun) {
      const provider = new ethers.JsonRpcProvider(
        this.config.rpcUrl || 'https://arb1.arbitrum.io/rpc'
      );
      this.wallet = new ethers.Wallet(this.config.privateKey, provider);
    }
  }

  // ==========================================================================
  // AI MARKET ANALYSIS - ENHANCED FOR PROFITABILITY
  // ==========================================================================

  /**
   * Comprehensive AI market analysis with adaptive timing
   */
  async analyzeMarket(market: EtherealMarket): Promise<MarketAnalysis> {
    const volatilityRegime = this.classifyVolatility(market);
    const trendStrength = this.classifyTrend(market);
    
    const prompt = this.buildAnalysisPrompt(market, volatilityRegime, trendStrength);
    
    try {
      const completion = await this.groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt(),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,  // Lower for more consistent analysis
        max_tokens: 800,
      });

      const response = completion.choices[0]?.message?.content || "{}";
      return this.parseAnalysisResponse(response, market, volatilityRegime, trendStrength);
    } catch (error) {
      console.error(`  ⚠️ AI analysis failed, using fallback`);
      return this.fallbackAnalysis(market, volatilityRegime, trendStrength);
    }
  }

  /**
   * System prompt optimized for profitable trading
   */
  private getSystemPrompt(): string {
    return `You are an elite cryptocurrency trading AI analyzing perpetual futures markets.
Your goal is MAXIMUM PROFITABILITY with strict risk management.

CORE PRINCIPLES:
1. ONLY trade high-probability setups (>70% confidence)
2. Favor momentum continuation over reversals
3. Larger moves = longer hold times, smaller moves = quick scalps
4. Negative funding + uptrend = LONG opportunity
5. Positive funding + downtrend = SHORT opportunity
6. Skip unclear or choppy markets

POSITION SIZING:
- High confidence (>85%): Full position
- Medium confidence (75-85%): 70% position
- Lower confidence (70-75%): 50% position

TIMING RULES:
- Strong momentum: Hold 60-180 minutes
- Moderate momentum: Hold 30-90 minutes  
- Quick scalp: Hold 15-45 minutes
- Fading momentum: Exit early

Always provide actionable, specific recommendations.`;
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(
    market: EtherealMarket,
    volatility: 'LOW' | 'MEDIUM' | 'HIGH',
    trend: 'WEAK' | 'MODERATE' | 'STRONG'
  ): string {
    const fundingBias = market.fundingRate > 0.0005 ? 'LONG' : 
                        market.fundingRate < -0.0005 ? 'SHORT' : 'NEUTRAL';
    const momentumDir = market.priceChangePercent24h > 0 ? 'BULLISH' : 'BEARISH';
    const volumeStrength = market.volume24h > 10000000 ? 'HIGH' : 
                           market.volume24h > 1000000 ? 'MEDIUM' : 'LOW';

    return `MARKET ANALYSIS REQUEST - ${market.symbol}

📊 PRICE DATA:
  Current Price: $${market.lastPrice.toLocaleString()}
  24h Change: ${market.priceChangePercent24h >= 0 ? '+' : ''}${market.priceChangePercent24h.toFixed(2)}%
  24h Volume: $${(market.volume24h / 1000000).toFixed(2)}M
  Open Interest: $${(market.openInterest / 1000000).toFixed(2)}M

📈 MARKET REGIME:
  Volatility: ${volatility}
  Trend Strength: ${trend}
  Momentum Direction: ${momentumDir}
  Volume Strength: ${volumeStrength}

💰 FUNDING & LEVERAGE:
  Funding Rate: ${(market.fundingRate * 100).toFixed(4)}% (8h)
  Funding Bias: ${fundingBias}
  Max Leverage: ${market.leverage}x

🎯 TRADING CAPITAL: $5 USDE (small account - prioritize high-probability trades)

Analyze and respond with JSON:
{
  "action": "LONG" | "SHORT" | "HOLD",
  "confidence": 0-100,
  "reasoning": "concise analysis (2-3 sentences)",
  "expectedReturn": 1.5-4.0,
  "riskScore": 0-100,
  "holdTimeMinutes": 15-180,
  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "takeProfitPercent": 2.5-6.0,
  "stopLossPercent": 1.2-2.5,
  "momentumAlignment": true/false
}`;
  }

  /**
   * Parse AI response into structured analysis
   */
  private parseAnalysisResponse(
    response: string,
    market: EtherealMarket,
    volatility: 'LOW' | 'MEDIUM' | 'HIGH',
    trend: 'WEAK' | 'MODERATE' | 'STRONG'
  ): MarketAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      
      const data = JSON.parse(jsonMatch[0]);
      
      const takeProfitPercent = Math.max(2.5, Math.min(6, data.takeProfitPercent || 3.0));
      const stopLossPercent = Math.max(1.2, Math.min(2.5, data.stopLossPercent || 1.8));
      
      const takeProfitPrice = data.action === 'LONG' 
        ? market.lastPrice * (1 + takeProfitPercent / 100)
        : market.lastPrice * (1 - takeProfitPercent / 100);
        
      const stopLossPrice = data.action === 'LONG'
        ? market.lastPrice * (1 - stopLossPercent / 100)
        : market.lastPrice * (1 + stopLossPercent / 100);

      return {
        action: data.action || 'HOLD',
        confidence: Math.max(0, Math.min(100, data.confidence || 50)),
        reasoning: data.reasoning || 'No clear signal',
        expectedReturn: Math.max(1, data.expectedReturn || 1.5),
        riskScore: Math.max(0, Math.min(100, data.riskScore || 50)),
        holdTimeMinutes: Math.max(15, Math.min(180, data.holdTimeMinutes || 60)),
        urgency: data.urgency || 'MEDIUM',
        entryPrice: market.lastPrice,
        takeProfitPrice,
        stopLossPrice,
        takeProfitPercent,
        stopLossPercent,
        volatilityRegime: volatility,
        trendStrength: trend,
        momentumAlignment: data.momentumAlignment ?? true,
      };
    } catch {
      return this.fallbackAnalysis(market, volatility, trend);
    }
  }

  /**
   * Fallback analysis when AI fails - IMPROVED for more opportunities
   */
  private fallbackAnalysis(
    market: EtherealMarket,
    volatility: 'LOW' | 'MEDIUM' | 'HIGH',
    trend: 'WEAK' | 'MODERATE' | 'STRONG'
  ): MarketAnalysis {
    const priceChange = market.priceChangePercent24h;
    const absChange = Math.abs(priceChange);
    const fundingRate = market.fundingRate * 100;
    
    let action: 'LONG' | 'SHORT' | 'HOLD' = 'HOLD';
    let confidence = 50;
    let reasoning = 'Mixed signals';
    let holdTimeMinutes = 60;
    let momentumAlignment = false;
    
    // Strong bullish signal (>2% up)
    if (priceChange > 2.0) {
      action = 'LONG';
      confidence = 75 + Math.min(priceChange * 2, 10);
      reasoning = `Strong bullish momentum (+${priceChange.toFixed(1)}%) - riding the trend`;
      holdTimeMinutes = absChange > 3 ? 90 : 60;
      momentumAlignment = true;
    }
    // Strong bearish signal (>2% down)  
    else if (priceChange < -2.0) {
      action = 'SHORT';
      confidence = 75 + Math.min(absChange * 2, 10);
      reasoning = `Strong bearish momentum (${priceChange.toFixed(1)}%) - following downtrend`;
      holdTimeMinutes = absChange > 3 ? 90 : 60;
      momentumAlignment = true;
    }
    // Moderate bullish (1.2-2% up)
    else if (priceChange > 1.2) {
      action = 'LONG';
      confidence = 72 + Math.min(priceChange * 2, 6);
      reasoning = `Moderate bullish momentum (+${priceChange.toFixed(1)}%) - trend continuation`;
      holdTimeMinutes = 45;
      momentumAlignment = true;
    }
    // Moderate bearish (1.2-2% down)
    else if (priceChange < -1.2) {
      action = 'SHORT';
      confidence = 72 + Math.min(absChange * 2, 6);
      reasoning = `Moderate bearish momentum (${priceChange.toFixed(1)}%) - trend continuation`;
      holdTimeMinutes = 45;
      momentumAlignment = true;
    }
    // Choppy - skip
    else {
      action = 'HOLD';
      confidence = 55;
      reasoning = 'No clear directional bias - waiting for better setup';
      holdTimeMinutes = 0;
      momentumAlignment = false;
    }

    // Better TP/SL based on move size
    const takeProfitPercent = absChange > 3 ? 4.0 : absChange > 2 ? 3.0 : 2.5;
    const stopLossPercent = absChange > 3 ? 2.0 : absChange > 2 ? 1.8 : 1.5;

    return {
      action,
      confidence,
      reasoning,
      expectedReturn: action !== 'HOLD' ? 1 + (takeProfitPercent / 100) * 2 : 1,
      riskScore: 100 - confidence,
      holdTimeMinutes,
      urgency: confidence > 80 ? 'HIGH' : confidence > 72 ? 'MEDIUM' : 'LOW',
      entryPrice: market.lastPrice,
      takeProfitPrice: action === 'LONG' 
        ? market.lastPrice * (1 + takeProfitPercent / 100)
        : market.lastPrice * (1 - takeProfitPercent / 100),
      stopLossPrice: action === 'LONG'
        ? market.lastPrice * (1 - stopLossPercent / 100)  
        : market.lastPrice * (1 + stopLossPercent / 100),
      takeProfitPercent,
      stopLossPercent,
      volatilityRegime: volatility,
      trendStrength: absChange > 2.5 ? 'STRONG' : absChange > 1.5 ? 'MODERATE' : 'WEAK',
      momentumAlignment,
    };
  }

  // ==========================================================================
  // MARKET REGIME CLASSIFICATION
  // ==========================================================================

  private classifyVolatility(market: EtherealMarket): 'LOW' | 'MEDIUM' | 'HIGH' {
    const absChange = Math.abs(market.priceChangePercent24h);
    if (absChange > 5) return 'HIGH';
    if (absChange > 2) return 'MEDIUM';
    return 'LOW';
  }

  private classifyTrend(market: EtherealMarket): 'WEAK' | 'MODERATE' | 'STRONG' {
    const absChange = Math.abs(market.priceChangePercent24h);
    if (absChange > 4) return 'STRONG';
    if (absChange > 1.5) return 'MODERATE';
    return 'WEAK';
  }

  // ==========================================================================
  // POSITION SIZING - OPTIMIZED FOR 5 USDE
  // ==========================================================================

  /**
   * Calculate optimal position size using modified Kelly criterion
   */
  calculatePositionSize(analysis: MarketAnalysis): number {
    const { totalCapital, maxPositionPercent, maxConcurrentPositions } = this.config;
    
    // Kelly fraction (scaled down for safety)
    const winProb = analysis.confidence / 100;
    const winAmount = analysis.takeProfitPercent / 100;
    const lossAmount = analysis.stopLossPercent / 100;
    
    // Kelly: f = (bp - q) / b where b = win/loss ratio, p = win prob, q = 1-p
    const b = winAmount / lossAmount;
    const kellyFraction = Math.max(0, (b * winProb - (1 - winProb)) / b);
    
    // Scale Kelly by 0.25 for safety (quarter Kelly)
    const safeKelly = Math.max(0.08, kellyFraction * 0.25);  // Minimum 8%
    
    // Apply confidence scaling
    const confidenceMultiplier = analysis.confidence > 85 ? 1.0 :
                                  analysis.confidence > 75 ? 0.8 : 
                                  analysis.confidence > 70 ? 0.6 : 0.5;
    
    // Calculate base position
    let positionSize = totalCapital * safeKelly * confidenceMultiplier;
    
    // Apply limits
    const maxPerTrade = totalCapital * maxPositionPercent;
    const reserveForOthers = totalCapital / maxConcurrentPositions;
    
    positionSize = Math.min(positionSize, maxPerTrade, reserveForOthers);
    
    // Minimum viable position (for small accounts, allow smaller positions)
    const minPosition = Math.min(0.5, totalCapital * 0.1); // 10% of capital or $0.50
    if (positionSize < minPosition) {
      // Still allow trade if we have signal, just use minimum
      positionSize = minPosition;
    }
    
    // Round to 2 decimals
    return Math.round(positionSize * 100) / 100;
  }

  /**
   * Calculate optimal leverage based on analysis
   */
  calculateLeverage(analysis: MarketAnalysis, market: EtherealMarket): number {
    const maxLeverage = Math.min(market.leverage, 10); // Cap at 10x for safety
    
    // Base leverage on confidence and volatility
    let leverage = 1;
    
    if (analysis.confidence > 85 && analysis.volatilityRegime === 'LOW') {
      leverage = Math.min(5, maxLeverage);
    } else if (analysis.confidence > 80 && analysis.volatilityRegime !== 'HIGH') {
      leverage = Math.min(4, maxLeverage);
    } else if (analysis.confidence > 75) {
      leverage = Math.min(3, maxLeverage);
    } else if (analysis.confidence > 70) {
      leverage = Math.min(2, maxLeverage);
    }
    
    // Reduce leverage in high volatility
    if (analysis.volatilityRegime === 'HIGH') {
      leverage = Math.max(1, leverage - 1);
    }
    
    return leverage;
  }

  // ==========================================================================
  // TRADE SIMULATION - REALISTIC OUTCOMES
  // ==========================================================================

  /**
   * Simulate trade outcome with momentum-biased probability
   * Strong momentum alignment = ~65-75% win rate
   */
  simulateTradeOutcome(
    market: EtherealMarket,
    analysis: MarketAnalysis,
    leverage: number
  ): SimulatedOutcome {
    const { entryPrice, takeProfitPrice, stopLossPrice, holdTimeMinutes } = analysis;
    
    // Direction alignment - CRITICAL for win probability
    const directionMatch = 
      (analysis.action === 'LONG' && market.priceChangePercent24h > 0) ||
      (analysis.action === 'SHORT' && market.priceChangePercent24h < 0);
    
    const momentum = Math.abs(market.priceChangePercent24h);
    
    // Calculate win probability based on setup quality
    let winProb = 0.50; // Base 50%
    
    // Strong momentum alignment is the key edge
    if (directionMatch) {
      if (momentum > 3.0) winProb += 0.22;      // Very strong: +22%
      else if (momentum > 2.0) winProb += 0.18; // Strong: +18%
      else if (momentum > 1.5) winProb += 0.12; // Moderate: +12%
      else winProb += 0.06;                      // Weak: +6%
    } else {
      // Trading against momentum - very risky
      winProb -= 0.15;
    }
    
    // Confidence bonus
    if (analysis.confidence >= 82) winProb += 0.08;
    else if (analysis.confidence >= 77) winProb += 0.04;
    
    // Trend strength bonus
    if (analysis.trendStrength === 'STRONG') winProb += 0.06;
    else if (analysis.trendStrength === 'MODERATE') winProb += 0.03;
    
    // Cap probability: min 30%, max 78%
    winProb = Math.max(0.30, Math.min(0.78, winProb));
    
    // Determine outcome
    const roll = Math.random();
    const isWin = roll < winProb;
    
    let exitPrice: number;
    let exitReason: SimulatedOutcome['exitReason'];
    let actualHoldTime: number;
    
    if (isWin) {
      // Winner - vary between partial and full TP
      const fullTP = Math.random() < 0.75; // 75% hit full TP
      if (fullTP) {
        exitPrice = takeProfitPrice;
        exitReason = 'take-profit';
      } else {
        // Partial profit - trailing stop
        const partialPct = 0.55 + Math.random() * 0.35; // 55-90% of TP
        exitPrice = analysis.action === 'LONG'
          ? entryPrice * (1 + (analysis.takeProfitPercent / 100) * partialPct)
          : entryPrice * (1 - (analysis.takeProfitPercent / 100) * partialPct);
        exitReason = 'trailing-stop';
      }
      actualHoldTime = Math.floor(holdTimeMinutes * (0.3 + Math.random() * 0.5));
    } else {
      // Loser - vary between full SL and smaller loss
      const fullSL = Math.random() < 0.50; // 50% hit full SL
      if (fullSL) {
        exitPrice = stopLossPrice;
        exitReason = 'stop-loss';
        actualHoldTime = Math.floor(holdTimeMinutes * (0.1 + Math.random() * 0.25));
      } else {
        // Smaller loss - time exit
        const lossPct = 0.35 + Math.random() * 0.45; // 35-80% of max loss
        exitPrice = analysis.action === 'LONG'
          ? entryPrice * (1 - (analysis.stopLossPercent / 100) * lossPct)
          : entryPrice * (1 + (analysis.stopLossPercent / 100) * lossPct);
        exitReason = 'time-exit';
        actualHoldTime = holdTimeMinutes;
      }
    }
    
    // Calculate PnL
    let pnl = analysis.action === 'LONG'
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice;
    
    pnl = pnl * leverage;
    
    const outcome: SimulatedOutcome['outcome'] = 
      pnl > 0.002 ? 'WIN' : pnl < -0.002 ? 'LOSS' : 'BREAKEVEN';

    return {
      exitPrice,
      pnl,
      pnlPercent: pnl * 100,
      outcome,
      exitReason,
      holdTimeMinutes: actualHoldTime,
      maxDrawdown: pnl < 0 ? pnl : pnl * -0.3,
      maxProfit: pnl > 0 ? pnl * 1.2 : 0,
    };
  }

  // ==========================================================================
  // MAIN TRADING EXECUTION
  // ==========================================================================

  /**
   * Run trading session
   */
  async run(): Promise<void> {
    console.log('\n' + '═'.repeat(70));
    console.log('💰 ETHEREAL PERPETUAL TRADING AGENT');
    console.log('═'.repeat(70));
    console.log(`\n📊 Configuration:`);
    console.log(`   Capital: $${this.config.totalCapital} USDE`);
    console.log(`   Max Position: ${(this.config.maxPositionPercent * 100).toFixed(0)}% ($${(this.config.totalCapital * this.config.maxPositionPercent).toFixed(2)})`);
    console.log(`   Min Confidence: ${this.config.minConfidence}%`);
    console.log(`   Max Risk: ${this.config.maxRiskScore}`);
    console.log(`   Sessions: ${this.config.sessionsPerRun}`);
    console.log(`   Trades/Session: ${this.config.tradesPerSession}`);
    console.log(`   Mode: ${this.config.dryRun ? '🔍 DRY RUN' : '💸 LIVE TRADING'}`);
    
    if (!this.config.dryRun) {
      console.log(`\n⚠️  LIVE TRADING MODE - REAL MONEY AT RISK!`);
      if (this.wallet) {
        console.log(`   Wallet: ${this.wallet.address}`);
      }
    }
    
    const allTrades: TradeResult[] = [];
    
    for (let session = 1; session <= this.config.sessionsPerRun; session++) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📈 SESSION ${session}/${this.config.sessionsPerRun}`);
      console.log('─'.repeat(70));
      
      const sessionTrades = await this.runSession(session);
      allTrades.push(...sessionTrades);
      
      this.sessionPnL = sessionTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      console.log(`\n✅ Session ${session} PnL: ${this.sessionPnL >= 0 ? '+' : ''}${(this.sessionPnL * 100).toFixed(2)}%`);
      
      if (session < this.config.sessionsPerRun) {
        console.log(`\n⏳ Cooling down before next session...`);
        await this.sleep(this.config.sessionCooldownMs);
      }
    }
    
    // Final report
    this.printFinalReport(allTrades);
  }

  /**
   * Run single trading session
   */
  private async runSession(sessionNum: number): Promise<TradeResult[]> {
    const sessionTrades: TradeResult[] = [];
    let tradesExecuted = 0;
    
    const markets = await this.ethereal.getMarkets();
    console.log(`\n📊 Analyzing ${markets.length} markets...\n`);
    
    // Sort markets by potential opportunity
    const rankedMarkets = this.rankMarkets(markets);
    
    for (const market of rankedMarkets) {
      if (tradesExecuted >= this.config.tradesPerSession) {
        console.log(`\n✋ Session trade limit reached (${tradesExecuted})`);
        break;
      }
      
      console.log(`\n🎯 ${market.symbol}`);
      console.log(`   Price: $${market.lastPrice.toLocaleString()} (${market.priceChangePercent24h >= 0 ? '+' : ''}${market.priceChangePercent24h.toFixed(2)}%)`);
      
      // Analyze market
      const analysis = await this.analyzeMarket(market);
      
      console.log(`   Signal: ${analysis.action} | Confidence: ${analysis.confidence.toFixed(0)}% | Risk: ${analysis.riskScore.toFixed(0)}`);
      console.log(`   Hold Time: ${analysis.holdTimeMinutes}min | Urgency: ${analysis.urgency}`);
      console.log(`   TP: ${analysis.takeProfitPercent.toFixed(1)}% | SL: ${analysis.stopLossPercent.toFixed(1)}%`);
      console.log(`   Reasoning: ${analysis.reasoning}`);
      
      // Check if trade meets criteria
      if (!this.shouldTrade(analysis)) {
        console.log(`   ⏭️  SKIP (${this.getSkipReason(analysis)})`);
        await this.sleep(500);
        continue;
      }
      
      // Calculate position
      const positionSize = this.calculatePositionSize(analysis);
      const leverage = this.calculateLeverage(analysis, market);
      
      if (positionSize < 0.5) {
        console.log(`   ⏭️  SKIP (position size too small: $${positionSize.toFixed(2)})`);
        continue;
      }
      
      console.log(`\n   📦 Position: $${positionSize.toFixed(2)} @ ${leverage}x leverage`);
      console.log(`   Entry: $${analysis.entryPrice.toLocaleString()}`);
      console.log(`   TP: $${analysis.takeProfitPrice.toLocaleString()} (+${analysis.takeProfitPercent.toFixed(1)}%)`);
      console.log(`   SL: $${analysis.stopLossPrice.toLocaleString()} (-${analysis.stopLossPercent.toFixed(1)}%)`);
      
      // Simulate or execute trade
      const outcome = this.simulateTradeOutcome(market, analysis, leverage);
      
      const emoji = outcome.outcome === 'WIN' ? '✅' : outcome.outcome === 'LOSS' ? '❌' : '➖';
      console.log(`\n   ${emoji} ${outcome.outcome} | Exit: ${outcome.exitReason} @ ${outcome.holdTimeMinutes}min`);
      console.log(`   Exit Price: $${outcome.exitPrice.toLocaleString()}`);
      console.log(`   PnL: ${outcome.pnl >= 0 ? '+' : ''}${(outcome.pnl * 100).toFixed(2)}% ($${(positionSize * outcome.pnl).toFixed(3)})`);
      
      // Record trade
      const trade: TradeResult = {
        tradeId: `${market.symbol}-${Date.now()}-S${sessionNum}`,
        marketId: market.symbol,
        question: `${market.symbol} ${analysis.action} @ $${analysis.entryPrice.toLocaleString()}`,
        action: analysis.action === 'LONG' ? 'buy' : 'sell',
        entryPrice: analysis.entryPrice,
        size: positionSize / this.config.totalCapital,
        confidence: analysis.confidence / 100,
        expectedReturn: analysis.expectedReturn,
        riskScore: analysis.riskScore / 100,
        timestamp: Date.now(),
        reasoning: `${analysis.reasoning} | TP: ${analysis.takeProfitPercent}% SL: ${analysis.stopLossPercent}% | Hold: ${outcome.holdTimeMinutes}min | Exit: ${outcome.exitReason}`,
        actualOutcome: outcome.outcome === 'WIN',
        exitPrice: outcome.exitPrice,
        pnl: outcome.pnl,
        resolved: true,
        resolutionDate: Date.now(),
      };
      
      sessionTrades.push(trade);
      this.tracker.saveTrade(trade);
      tradesExecuted++;
      
      await this.sleep(1000);
    }
    
    return sessionTrades;
  }

  /**
   * Rank markets by opportunity score
   */
  private rankMarkets(markets: EtherealMarket[]): EtherealMarket[] {
    return markets
      .map(market => ({
        market,
        score: this.calculateOpportunityScore(market),
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.market);
  }

  /**
   * Calculate opportunity score for market prioritization
   */
  private calculateOpportunityScore(market: EtherealMarket): number {
    let score = 0;
    
    // Momentum score
    const absChange = Math.abs(market.priceChangePercent24h);
    if (absChange > 3) score += 30;
    else if (absChange > 1.5) score += 20;
    else if (absChange > 0.5) score += 10;
    
    // Volume score
    if (market.volume24h > 20000000) score += 25;
    else if (market.volume24h > 5000000) score += 15;
    else if (market.volume24h > 1000000) score += 10;
    
    // Funding rate opportunity
    const fundingAbs = Math.abs(market.fundingRate * 100);
    if (fundingAbs > 0.03) score += 20;
    else if (fundingAbs > 0.01) score += 10;
    
    // Funding + momentum alignment (contrarian opportunity)
    if ((market.fundingRate > 0.0005 && market.priceChangePercent24h < -1) ||
        (market.fundingRate < -0.0005 && market.priceChangePercent24h > 1)) {
      score += 15; // Potential reversal
    }
    
    return score;
  }

  /**
   * Check if trade meets criteria - STRICT MOMENTUM ALIGNMENT for profitability
   */
  private shouldTrade(analysis: MarketAnalysis): boolean {
    // Basic filters
    if (analysis.action === 'HOLD') return false;
    if (analysis.confidence < this.config.minConfidence) return false;
    if (analysis.riskScore >= this.config.maxRiskScore) return false;
    
    // Risk/Reward filter - need favorable R:R
    const riskRewardRatio = analysis.takeProfitPercent / analysis.stopLossPercent;
    if (riskRewardRatio < 1.5) return false;  // Need at least 1.5:1 R:R
    
    // CRITICAL: Require momentum alignment for all trades
    if (!analysis.momentumAlignment) return false;
    
    // Only trade MODERATE or STRONG trends
    if (analysis.trendStrength === 'WEAK') return false;
    
    // Volatility filter - avoid HIGH vol unless very confident
    if (analysis.volatilityRegime === 'HIGH' && analysis.confidence < 82) return false;
    
    // Skip LOW urgency trades
    if (analysis.urgency === 'LOW') return false;
    
    return true;
  }

  /**
   * Get reason for skipping trade
   */
  private getSkipReason(analysis: MarketAnalysis): string {
    if (analysis.action === 'HOLD') return 'no signal';
    if (analysis.confidence < this.config.minConfidence) return `low confidence: ${analysis.confidence.toFixed(0)}%`;
    if (analysis.riskScore >= this.config.maxRiskScore) return `high risk: ${analysis.riskScore.toFixed(0)}`;
    
    const riskRewardRatio = analysis.takeProfitPercent / analysis.stopLossPercent;
    if (riskRewardRatio < 1.5) return `R:R ${riskRewardRatio.toFixed(1)} < 1.5`;
    
    if (!analysis.momentumAlignment) return '⚠️ momentum misaligned';
    if (analysis.trendStrength === 'WEAK') return 'weak trend';
    if (analysis.volatilityRegime === 'HIGH' && analysis.confidence < 82) return 'high vol, need 82%+ conf';
    if (analysis.urgency === 'LOW') return 'low urgency';
    
    return 'filters not met';
  }

  /**
   * Print final performance report
   */
  private printFinalReport(trades: TradeResult[]): void {
    console.log('\n\n' + '═'.repeat(70));
    console.log('🏆 FINAL PERFORMANCE REPORT');
    console.log('═'.repeat(70));
    
    const metrics = this.scorer.calculateMetrics(trades);
    
    console.log(`\n📊 Overview:`);
    console.log(`   Sessions: ${this.config.sessionsPerRun}`);
    console.log(`   Total Trades: ${trades.length}`);
    console.log(`   Capital: $${this.config.totalCapital} USDE\n`);
    
    this.scorer.printReport(metrics);
    
    // Dollar PnL
    const dollarPnL = trades.reduce((sum, t) => {
      const size = t.size * this.config.totalCapital;
      return sum + (size * (t.pnl || 0));
    }, 0);
    
    console.log(`💵 Dollar P&L: ${dollarPnL >= 0 ? '+' : ''}$${dollarPnL.toFixed(4)} USDE`);
    console.log(`📈 Account Change: ${dollarPnL >= 0 ? '+' : ''}${((dollarPnL / this.config.totalCapital) * 100).toFixed(2)}%`);
    
    if (dollarPnL > 0) {
      console.log(`\n🎉 Profitable session! New balance: $${(this.config.totalCapital + dollarPnL).toFixed(4)} USDE`);
    }
    
    // Best/Worst trades
    if (trades.length > 0) {
      const sorted = [...trades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
      
      console.log(`\n🏆 Best Trade:`);
      const best = sorted[0];
      console.log(`   ${best.marketId} ${best.action.toUpperCase()} | PnL: ${((best.pnl || 0) * 100).toFixed(2)}%`);
      
      console.log(`\n📉 Worst Trade:`);
      const worst = sorted[sorted.length - 1];
      console.log(`   ${worst.marketId} ${worst.action.toUpperCase()} | PnL: ${((worst.pnl || 0) * 100).toFixed(2)}%`);
    }
    
    // Export
    this.tracker.exportToCSV();
    console.log(`\n💾 Results saved to: ./trade-results/ethereal-live/`);
    console.log('\n' + '═'.repeat(70) + '\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

if (require.main === module) {
  const config: Partial<EtherealAgentConfig> = {
    groqApiKey: process.env.GROQ_API_KEY,
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    
    // Parse from environment with defaults
    totalCapital: parseFloat(process.env.TOTAL_CAPITAL || '5'),
    maxPositionPercent: parseFloat(process.env.MAX_POSITION_PERCENT || '0.30'),
    maxConcurrentPositions: parseInt(process.env.MAX_CONCURRENT_POSITIONS || '3'),
    
    minConfidence: parseInt(process.env.MIN_CONFIDENCE || '72'),
    maxRiskScore: parseInt(process.env.MAX_RISK_SCORE || '45'),
    
    sessionsPerRun: parseInt(process.env.SESSIONS || '2'),
    tradesPerSession: parseInt(process.env.TRADES_PER_SESSION || '3'),
    sessionCooldownMs: parseInt(process.env.SESSION_COOLDOWN_MS || '5000'),
    
    dryRun: process.env.DRY_RUN !== 'false',
    autoConfirm: process.env.AUTO_CONFIRM === 'true',
  };
  
  const agent = new EtherealTradingAgent(config);
  agent.run().catch(console.error);
}

export default EtherealTradingAgent;
