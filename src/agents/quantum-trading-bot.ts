import { ethers } from "ethers";
import Groq from "groq-sdk";
import axios from "axios";
import { TradeResult } from "./trade-tracker";
import { AdvancedAnalytics } from "./advanced-analytics";
import { MLPredictor, TradingSignal } from "./ml-predictor";
import { UltraAggressiveTrader, QuantumTrade } from "./ultra-aggressive-trader";
import { MarketSentimentAnalyzer, RealTimeSignal } from "./market-sentiment";
import { AdaptiveRiskManager, PositionSize } from "./adaptive-risk-manager";

export interface BotConfig {
  initialCapital: number;
  targetCapital: number;
  maxLeverage: number;
  riskLevel: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "ULTRA_AGGRESSIVE";
  tradingMode: "MANUAL" | "SEMI_AUTO" | "FULL_AUTO";
  updateInterval: number; // milliseconds
  maxConcurrentTrades: number;
  enableML: boolean;
  enableSentiment: boolean;
  enableUltraAggressive: boolean;
}

export interface BotStatus {
  isRunning: boolean;
  currentCapital: number;
  totalROI: number;
  tradesExecuted: number;
  winRate: number;
  currentPositions: number;
  lastUpdate: number;
  uptime: number;
  errors: string[];
}

export interface OptimizationResult {
  newParameters: Partial<BotConfig>;
  expectedImprovement: number;
  confidence: number;
  reasoning: string;
}

export class QuantumTradingBot {
  private config: BotConfig;
  private analytics: AdvancedAnalytics;
  private mlPredictor: MLPredictor;
  private ultraAggressiveTrader: UltraAggressiveTrader;
  private sentimentAnalyzer: MarketSentimentAnalyzer;
  private riskManager: AdaptiveRiskManager;
  private groq: Groq;
  private provider: ethers.JsonRpcProvider;

  private isRunning: boolean = false;
  private startTime: number = 0;
  private updateInterval: NodeJS.Timeout | null = null;
  private currentPositions: Map<string, any> = new Map();
  private tradeHistory: TradeResult[] = [];
  private errors: string[] = [];

  constructor(config: BotConfig, groqApiKey: string, rpcUrl?: string) {
    this.config = config;
    this.analytics = new AdvancedAnalytics();
    this.mlPredictor = new MLPredictor();
    this.ultraAggressiveTrader = new UltraAggressiveTrader(
      config.initialCapital,
      config.targetCapital,
    );
    this.sentimentAnalyzer = new MarketSentimentAnalyzer();
    this.riskManager = new AdaptiveRiskManager(config.initialCapital);

    this.groq = new Groq({ apiKey: groqApiKey });
    this.provider = new ethers.JsonRpcProvider(
      rpcUrl || "https://arb1.arbitrum.io/rpc",
    );
  }

  /**
   * Start the quantum trading bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️  Bot is already running");
      return;
    }

    console.log("🚀 Starting Quantum Trading Bot...");
    console.log(
      `💰 Initial Capital: $${this.config.initialCapital.toLocaleString()}`,
    );
    console.log(
      `🎯 Target Capital: $${this.config.targetCapital.toLocaleString()}`,
    );
    console.log(`⚡ Risk Level: ${this.config.riskLevel}`);
    console.log(`🤖 Trading Mode: ${this.config.tradingMode}`);

    this.isRunning = true;
    this.startTime = Date.now();

    // Start real-time sentiment analysis
    if (this.config.enableSentiment) {
      this.sentimentAnalyzer.startRealTimeAnalysis(this.config.updateInterval);
    }

    // Train ML model if enabled
    if (this.config.enableML) {
      await this.trainMLModel();
    }

    // Start main trading loop
    this.startTradingLoop();

    console.log("✅ Quantum Trading Bot started successfully");
  }

  /**
   * Stop the trading bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("⚠️  Bot is not running");
      return;
    }

    console.log("🛑 Stopping Quantum Trading Bot...");

    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Stop sentiment analysis
    if (this.config.enableSentiment) {
      this.sentimentAnalyzer.stopRealTimeAnalysis();
    }

    // Close all positions
    await this.closeAllPositions();

    console.log("✅ Quantum Trading Bot stopped");
  }

  /**
   * Main trading loop
   */
  private startTradingLoop(): void {
    this.updateInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.executeTradingCycle();
      } catch (error) {
        console.error(`❌ Error in trading cycle: ${error}`);
        this.errors.push(`${Date.now()}: ${error}`);
      }
    }, this.config.updateInterval);
  }

  /**
   * Execute one trading cycle
   */
  private async executeTradingCycle(): Promise<void> {
    // Fetch available markets
    const markets = await this.fetchMarkets();

    // Analyze each market
    for (const market of markets) {
      if (this.currentPositions.size >= this.config.maxConcurrentTrades) {
        break; // Max positions reached
      }

      try {
        const decision = await this.analyzeMarket(market);

        if (decision && this.shouldExecuteTrade(decision)) {
          await this.executeTrade(market, decision);
        }
      } catch (error) {
        console.error(`Error analyzing market ${market.id}: ${error}`);
      }
    }

    // Monitor existing positions
    await this.monitorPositions();

    // Optimize parameters
    if (Math.random() < 0.1) {
      // 10% chance per cycle
      await this.optimizeParameters();
    }
  }

  /**
   * Analyze market and generate trading decision
   */
  private async analyzeMarket(market: any): Promise<TradingSignal | null> {
    let signal: TradingSignal | null = null;

    // ML prediction
    if (this.config.enableML) {
      signal = this.mlPredictor.predict(
        market,
        market.confidence || 0.8,
        market.riskScore || 0.3,
        market.expectedReturn || 1.5,
      );
    }

    // Sentiment analysis
    if (this.config.enableSentiment) {
      const sentimentSignal =
        await this.sentimentAnalyzer.getRealTimeSignal(market);

      if (signal) {
        // Combine ML and sentiment signals
        signal = this.combineSignals(signal, sentimentSignal);
      } else {
        // Use sentiment only
        signal = this.sentimentToTradingSignal(sentimentSignal);
      }
    }

    // Ultra-aggressive mode
    if (
      this.config.enableUltraAggressive &&
      this.config.riskLevel === "ULTRA_AGGRESSIVE"
    ) {
      signal = this.enhanceForUltraAggressive(signal, market);
    }

    return signal;
  }

  /**
   * Execute trade
   */
  private async executeTrade(
    market: any,
    signal: TradingSignal,
  ): Promise<void> {
    // Calculate position size
    const existingPositions = Array.from(this.currentPositions.values());
    const positionSize = this.riskManager.calculateOptimalPositionSize(
      signal,
      this.getCurrentCapital(),
      existingPositions,
    );

    // Risk check
    const riskCheck = this.riskManager.isTradeAcceptable(
      signal,
      positionSize,
      this.getCurrentCapital(),
    );
    if (!riskCheck.acceptable) {
      console.log(`⚠️  Trade rejected: ${riskCheck.reasons.join(", ")}`);
      return;
    }

    // Execute trade based on mode
    if (this.config.tradingMode === "FULL_AUTO") {
      await this.executeAutoTrade(market, signal, positionSize);
    } else if (this.config.tradingMode === "SEMI_AUTO") {
      await this.requestTradeApproval(market, signal, positionSize);
    }
  }

  /**
   * Execute automatic trade
   */
  private async executeAutoTrade(
    market: any,
    signal: TradingSignal,
    positionSize: PositionSize,
  ): Promise<void> {
    console.log(`💰 Executing ${signal.action} on ${market.question}`);
    console.log(
      `📊 Position Size: $${positionSize.amount.toLocaleString()} (${positionSize.percentage.toFixed(1)}%)`,
    );
    console.log(`⚡ Leverage: ${positionSize.leverage}x`);
    console.log(
      `🎯 Expected Return: ${positionSize.expectedReturn.toFixed(2)}`,
    );

    // Simulate trade execution
    const trade = await this.simulateTradeExecution(
      market,
      signal,
      positionSize,
    );

    // Track position
    this.currentPositions.set(market.id, {
      market,
      signal,
      positionSize,
      trade,
      entryTime: Date.now(),
    });

    // Record trade
    this.tradeHistory.push(trade);
  }

  /**
   * Simulate trade execution
   */
  private async simulateTradeExecution(
    market: any,
    signal: TradingSignal,
    positionSize: PositionSize,
  ): Promise<TradeResult> {
    const successProbability = signal.confidence;
    const isSuccess = Math.random() < successProbability;

    const pnl = isSuccess
      ? positionSize.expectedReturn * (0.5 + Math.random() * 0.5)
      : -positionSize.riskAmount * (0.8 + Math.random() * 0.2);

    return {
      tradeId: `${market.id}-${Date.now()}`,
      marketId: market.id,
      question: market.question,
      action:
        signal.action === "AGGRESSIVE_BUY"
          ? "buy"
          : (signal.action.toLowerCase() as any),
      entryPrice: market.yes_price || 0.5,
      size: positionSize.percentage / 100,
      confidence: signal.confidence,
      expectedReturn: signal.expectedReturn,
      riskScore:
        signal.riskLevel === "LOW"
          ? 0.2
          : signal.riskLevel === "MEDIUM"
            ? 0.5
            : 0.8,
      timestamp: Date.now(),
      reasoning: signal.reasoning,
      pnl,
      resolved: true,
    };
  }

  /**
   * Monitor existing positions
   */
  private async monitorPositions(): Promise<void> {
    for (const [marketId, position] of this.currentPositions) {
      const timeInPosition = Date.now() - position.entryTime;
      const maxHoldTime = 60 * 60 * 1000; // 1 hour max

      if (timeInPosition > maxHoldTime) {
        console.log(`⏰ Closing position ${marketId} (time limit)`);
        await this.closePosition(marketId);
      }
    }
  }

  /**
   * Close position
   */
  private async closePosition(marketId: string): Promise<void> {
    const position = this.currentPositions.get(marketId);
    if (!position) return;

    // Simulate position closing
    const finalPnL = position.trade.pnl || 0;
    console.log(
      `💵 Position ${marketId} closed with P&L: $${finalPnL.toFixed(2)}`,
    );

    this.currentPositions.delete(marketId);
    this.riskManager.removePosition(marketId);
  }

  /**
   * Close all positions
   */
  private async closeAllPositions(): Promise<void> {
    const positions = Array.from(this.currentPositions.keys());
    for (const marketId of positions) {
      await this.closePosition(marketId);
    }
  }

  /**
   * Train ML model
   */
  private async trainMLModel(): Promise<void> {
    console.log("🧠 Training ML model...");

    // Load historical trades
    const historicalTrades = this.tradeHistory;

    if (historicalTrades.length >= 10) {
      await this.mlPredictor.trainModel(historicalTrades);
      console.log(`✅ ML model trained with ${historicalTrades.length} trades`);
    } else {
      console.log("⚠️  Insufficient data for ML training");
    }
  }

  /**
   * Optimize bot parameters
   */
  private async optimizeParameters(): Promise<void> {
    console.log("🔧 Optimizing bot parameters...");

    const performance = this.analytics.analyzePerformance(this.tradeHistory);
    const optimization = await this.generateOptimization(performance);

    if (optimization.confidence > 0.7) {
      console.log(`📈 Applying optimization: ${optimization.reasoning}`);
      this.config = { ...this.config, ...optimization.newParameters };
    }
  }

  /**
   * Generate optimization suggestions
   */
  private async generateOptimization(
    performance: any,
  ): Promise<OptimizationResult> {
    const prompt = `Based on this trading performance, suggest parameter optimizations:
    Win Rate: ${performance.winRate}
    Sharpe Ratio: ${performance.sharpeRatio}
    Max Drawdown: ${performance.maxDrawdown}
    Total Trades: ${performance.totalTrades}
    
    Current config:
    Risk Level: ${this.config.riskLevel}
    Max Leverage: ${this.config.maxLeverage}
    Max Concurrent Trades: ${this.config.maxConcurrentTrades}
    
    Suggest improvements in JSON format:
    {
      "newParameters": {
        "maxLeverage": number,
        "maxConcurrentTrades": number,
        "riskLevel": "CONSERVATIVE|MODERATE|AGGRESSIVE|ULTRA_AGGRESSIVE"
      },
      "expectedImprovement": number,
      "confidence": number,
      "reasoning": "string"
    }`;

    const response = await this.groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "moonshotai/kimi-k2-instruct-0905",
      temperature: 0.3,
      max_tokens: 500,
    });

    try {
      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Error parsing optimization response:", error);
    }

    return {
      newParameters: {},
      expectedImprovement: 0,
      confidence: 0,
      reasoning: "Failed to generate optimization",
    };
  }

  /**
   * Get bot status
   */
  getStatus(): BotStatus {
    const currentCapital = this.getCurrentCapital();
    const initialCapital = this.config.initialCapital;
    const totalROI = ((currentCapital - initialCapital) / initialCapital) * 100;

    const resolvedTrades = this.tradeHistory.filter((t) => t.resolved);
    const wins = resolvedTrades.filter((t) => (t.pnl || 0) > 0);
    const winRate =
      resolvedTrades.length > 0 ? wins.length / resolvedTrades.length : 0;

    return {
      isRunning: this.isRunning,
      currentCapital,
      totalROI,
      tradesExecuted: this.tradeHistory.length,
      winRate,
      currentPositions: this.currentPositions.size,
      lastUpdate: Date.now(),
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      errors: this.errors.slice(-10), // Last 10 errors
    };
  }

  /**
   * Get current capital
   */
  private getCurrentCapital(): number {
    const initialCapital = this.config.initialCapital;
    const totalPnL = this.tradeHistory.reduce(
      (sum, trade) => sum + (trade.pnl || 0),
      0,
    );
    return initialCapital + totalPnL;
  }

  /**
   * Fetch markets
   */
  private async fetchMarkets(): Promise<any[]> {
    try {
      const response = await axios.get("https://api.sapience.xyz/markets", {
        params: { status: "active", limit: 50 },
      });
      return response.data.markets || [];
    } catch (error) {
      console.error("Error fetching markets:", error);
      return [];
    }
  }

  /**
   * Helper methods
   */
  private shouldExecuteTrade(signal: TradingSignal): boolean {
    return signal.confidence >= 0.7 && signal.action !== "SKIP";
  }

  private combineSignals(
    mlSignal: TradingSignal,
    sentimentSignal: RealTimeSignal,
  ): TradingSignal {
    // Combine ML and sentiment signals
    const combinedConfidence =
      (mlSignal.confidence + sentimentSignal.confidence) / 2;

    return {
      ...mlSignal,
      confidence: combinedConfidence,
      reasoning: `${mlSignal.reasoning} | Sentiment: ${sentimentSignal.recommendation}`,
    };
  }

  private sentimentToTradingSignal(
    sentimentSignal: RealTimeSignal,
  ): TradingSignal {
    const action =
      sentimentSignal.recommendation === "STRONG_BUY" ||
      sentimentSignal.recommendation === "BUY"
        ? "BUY_YES"
        : sentimentSignal.recommendation === "STRONG_SELL" ||
            sentimentSignal.recommendation === "SELL"
          ? "BUY_NO"
          : "SKIP";

    return {
      action,
      confidence: sentimentSignal.confidence,
      expectedReturn: 1.5,
      positionSize: 0.1,
      reasoning: `Sentiment-based: ${sentimentSignal.recommendation}`,
      riskLevel: "MEDIUM",
      projectedROI: 10,
    };
  }

  private enhanceForUltraAggressive(
    signal: TradingSignal | null,
    market: any,
  ): TradingSignal {
    if (!signal) {
      return {
        action: "AGGRESSIVE_BUY",
        confidence: 0.8,
        expectedReturn: 3.0,
        positionSize: 0.3,
        reasoning: "Ultra-aggressive mode: maximum opportunity",
        riskLevel: "HIGH",
        projectedROI: 50,
      };
    }

    return {
      ...signal,
      action: signal.confidence > 0.8 ? "AGGRESSIVE_BUY" : signal.action,
      expectedReturn: signal.expectedReturn * 2,
      positionSize: Math.min(0.5, signal.positionSize * 2),
      riskLevel: "HIGH",
      projectedROI: signal.projectedROI * 2,
    };
  }

  private async requestTradeApproval(
    market: any,
    signal: TradingSignal,
    positionSize: PositionSize,
  ): Promise<void> {
    console.log(`🔍 Trade approval requested for ${market.question}`);
    console.log(
      `📊 Signal: ${signal.action} | Confidence: ${(signal.confidence * 100).toFixed(1)}%`,
    );
    console.log(`💰 Position: $${positionSize.amount.toLocaleString()}`);
    // In semi-auto mode, would wait for user approval
  }
}
