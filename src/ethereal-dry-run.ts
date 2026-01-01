/**
 * Ethereal Perps Trading Agent - Dry Run Mode
 * 
 * Simulates perpetual futures trading based on prediction market forecasts.
 * Tests AI-driven perp trading without risking real money.
 */

import Groq from 'groq-sdk';
import { EtherealClient, Product, MarketPrice, Order } from './utils/ethereal-client';
import * as dotenv from 'dotenv';

dotenv.config();

interface PerpForecast {
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  targetPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
  leverage: number;
}

interface PerpTradeDecision {
  productId: string;
  symbol: string;
  action: 'OPEN_LONG' | 'OPEN_SHORT' | 'SKIP';
  size: number;
  leverage: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
  confidence: number;
  // Profit projections
  projectedWinProfit: number;
  projectedLossAmount: number;
  riskRewardRatio: number;
}

interface DryRunResults {
  totalMarketsAnalyzed: number;
  tradesRecommended: number;
  tradesSkipped: number;
  avgConfidence: number;
  avgLeverage: number;
  potentialCapitalDeployed: number;
  decisions: PerpTradeDecision[];
  timestamp: string;
  // Profit projections
  projectedProfit: {
    bestCase: number;
    worstCase: number;
    expectedCase: number;
    roi: number;
  };
  totalRisk: number;
  netExpectedProfit: number;
}

export class EtherealDryRun {
  private groq: Groq;
  private ethereal: EtherealClient;
  private minConfidence: number = 0.60; // 60% min to see more analysis
  private maxLeverage: number = 5; // Conservative 5x max
  private positionSize: number = 100; // $100 per position
  private maxTrades: number;

  constructor(config: {
    groqApiKey: string;
    privateKey: string;
    testnet?: boolean;
    maxTrades?: number;
  }) {
    this.groq = new Groq({
      apiKey: config.groqApiKey,
    });

    this.ethereal = new EtherealClient({
      privateKey: config.privateKey,
      testnet: config.testnet !== false, // Default to testnet for safety
    });

    this.maxTrades = config.maxTrades || 5;
  }

  /**
   * Get mock prices for dry run simulation (used when real prices unavailable)
   */
  private getMockPrice(ticker: string): string {
    const mockPrices: Record<string, number> = {
      'BTCUSD': 95000,
      'ETHUSD': 3200,
      'SOLUSD': 185,
      'ARBUSD': 1.25,
      'AVAXUSD': 35,
      'MATICUSD': 0.85
    };
    return (mockPrices[ticker] || 100).toString();
  }

  /**
   * Generate AI forecast for a perp market
   */
  async generateForecast(product: Product, price: MarketPrice): Promise<PerpForecast> {
    const prompt = `You are a cryptocurrency perpetual futures trading expert. Analyze this market:

Symbol: ${product.ticker}
Current Price: $${parseFloat(price.markPrice).toFixed(2)}
Index Price: $${parseFloat(price.indexPrice).toFixed(2)}

Provide a trading analysis in JSON format:
{
  "direction": "LONG" or "SHORT" or "NEUTRAL",
  "confidence": <number 0-100>,
  "targetPrice": <number>,
  "stopLoss": <number>,
  "takeProfit": <number>,
  "leverage": <number 1-5>,
  "reasoning": "<detailed analysis>"
}

Rules:
- direction: LONG if bullish, SHORT if bearish, NEUTRAL if uncertain
- confidence: How confident you are (0-100) - only recommend >70%
- targetPrice: Expected price movement
- stopLoss: Risk management exit price (2-5% from entry)
- takeProfit: Profit target (5-15% from entry)
- leverage: 1-5x based on confidence (higher confidence = higher leverage allowed)
- reasoning: Brief technical/fundamental analysis with specific factors`;

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a professional cryptocurrency trader specializing in perpetual futures with strong risk management.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: 'moonshotai/kimi-k2-instruct-0905',
        temperature: 0.4,
        max_tokens: 1024,
      });

      const content = chatCompletion.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from model response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      return {
        symbol: product.ticker,
        direction: analysis.direction,
        confidence: Math.max(0, Math.min(100, analysis.confidence)) / 100,
        targetPrice: analysis.targetPrice,
        stopLoss: analysis.stopLoss,
        takeProfit: analysis.takeProfit,
        reasoning: analysis.reasoning,
        leverage: Math.min(analysis.leverage, this.maxLeverage),
      };
    } catch (error: any) {
      console.error(`  ⚠️  Forecast error: ${error.message}`);
      // Return neutral forecast on error
      return {
        symbol: product.ticker,
        direction: 'NEUTRAL',
        confidence: 0,
        targetPrice: parseFloat(price.markPrice),
        stopLoss: parseFloat(price.markPrice) * 0.97,
        takeProfit: parseFloat(price.markPrice) * 1.03,
        reasoning: "Error generating forecast",
        leverage: 1,
      };
    }
  }

  /**
   * Evaluate a perp trade decision
   */
  evaluateTradeDecision(
    product: Product,
    price: MarketPrice,
    forecast: PerpForecast
  ): PerpTradeDecision {
    const currentPrice = parseFloat(price.markPrice);
    
    // Calculate profit projections
    let action: 'OPEN_LONG' | 'OPEN_SHORT' | 'SKIP' = 'SKIP';
    let projectedWinProfit = 0;
    let projectedLossAmount = 0;
    
    if (forecast.direction === 'LONG' && forecast.confidence >= this.minConfidence) {
      action = 'OPEN_LONG';
      const priceChange = (forecast.takeProfit - currentPrice) / currentPrice;
      projectedWinProfit = this.positionSize * priceChange * forecast.leverage;
      const lossChange = (currentPrice - forecast.stopLoss) / currentPrice;
      projectedLossAmount = -this.positionSize * lossChange * forecast.leverage;
    } else if (forecast.direction === 'SHORT' && forecast.confidence >= this.minConfidence) {
      action = 'OPEN_SHORT';
      const priceChange = (currentPrice - forecast.takeProfit) / currentPrice;
      projectedWinProfit = this.positionSize * priceChange * forecast.leverage;
      const lossChange = (forecast.stopLoss - currentPrice) / currentPrice;
      projectedLossAmount = -this.positionSize * lossChange * forecast.leverage;
    }
    
    const riskRewardRatio = projectedLossAmount !== 0 
      ? Math.abs(projectedWinProfit / projectedLossAmount)
      : 0;

    // Calculate position size in contracts
    const positionSizeInContracts = this.positionSize / currentPrice;

    return {
      productId: product.id,
      symbol: product.ticker,
      action,
      size: positionSizeInContracts,
      leverage: forecast.leverage,
      entryPrice: currentPrice,
      stopLoss: forecast.stopLoss,
      takeProfit: forecast.takeProfit,
      reasoning: forecast.reasoning,
      confidence: forecast.confidence,
      projectedWinProfit,
      projectedLossAmount,
      riskRewardRatio,
    };
  }

  /**
   * Display trade decision
   */
  displayDecision(decision: PerpTradeDecision, index: number): void {
    const action = decision.action !== 'SKIP' 
      ? `✅ ${decision.action.replace('_', ' ')}`
      : '⏭️  SKIP';
    const directionEmoji = decision.action === 'OPEN_LONG' ? '📈' : 
                          decision.action === 'OPEN_SHORT' ? '📉' : '➡️';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${directionEmoji} PERP MARKET #${index + 1}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Symbol: ${decision.symbol}`);
    console.log(`\n💰 PRICING:`);
    console.log(`   Entry Price: $${decision.entryPrice.toFixed(2)}`);
    console.log(`   Stop Loss: $${decision.stopLoss.toFixed(2)} (${((decision.stopLoss - decision.entryPrice) / decision.entryPrice * 100).toFixed(2)}%)`);
    console.log(`   Take Profit: $${decision.takeProfit.toFixed(2)} (${((decision.takeProfit - decision.entryPrice) / decision.entryPrice * 100).toFixed(2)}%)`);
    console.log(`\n🎯 DECISION: ${action}`);
    
    if (decision.action !== 'SKIP') {
      console.log(`   Position Size: $${this.positionSize}`);
      console.log(`   Leverage: ${decision.leverage}x`);
      console.log(`   Contracts: ${decision.size.toFixed(4)}`);
      
      console.log(`\n💵 PROFIT PROJECTION:`);
      console.log(`   If TARGET HIT: +$${decision.projectedWinProfit.toFixed(2)} (${((decision.projectedWinProfit / this.positionSize) * 100).toFixed(1)}% ROI)`);
      console.log(`   If STOP LOSS: $${decision.projectedLossAmount.toFixed(2)} (${((decision.projectedLossAmount / this.positionSize) * 100).toFixed(1)}% ROI)`);
      console.log(`   Risk/Reward Ratio: ${decision.riskRewardRatio.toFixed(2)}:1`);
    }
    
    console.log(`\n📊 METRICS:`);
    console.log(`   Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`\n💭 REASONING:`);
    console.log(`   ${decision.reasoning}`);
  }

  /**
   * Generate summary report
   */
  generateReport(results: DryRunResults): void {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📊 ETHEREAL PERPS DRY RUN SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`\n⏰ Timestamp: ${results.timestamp}`);
    console.log(`\n📈 ANALYSIS:`);
    console.log(`   Markets Analyzed: ${results.totalMarketsAnalyzed}`);
    console.log(`   Trades Recommended: ${results.tradesRecommended}`);
    console.log(`   Trades Skipped: ${results.tradesSkipped}`);
    
    if (results.tradesRecommended > 0) {
      console.log(`\n💰 CAPITAL ALLOCATION:`);
      console.log(`   Position Size per Trade: $${this.positionSize}`);
      console.log(`   Total Capital Required: $${results.potentialCapitalDeployed.toFixed(2)}`);
      console.log(`   Average Confidence: ${results.avgConfidence.toFixed(1)}%`);
      console.log(`   Average Leverage: ${results.avgLeverage.toFixed(1)}x`);
      console.log(`   Total Risk Exposure: $${results.totalRisk.toFixed(2)}`);
      
      console.log(`\n💵 PROFIT PROJECTIONS:`);
      console.log(`   📈 Best Case (All Targets Hit): +$${results.projectedProfit.bestCase.toFixed(2)}`);
      console.log(`   📉 Worst Case (All Stop Loss): $${results.projectedProfit.worstCase.toFixed(2)}`);
      console.log(`   🎯 Expected Case: $${results.projectedProfit.expectedCase.toFixed(2)}`);
      console.log(`   💎 Net Expected Profit: $${results.netExpectedProfit.toFixed(2)}`);
      console.log(`   📊 Expected ROI: ${results.projectedProfit.roi > 0 ? '+' : ''}${results.projectedProfit.roi.toFixed(1)}%`);
      
      const roiColor = results.projectedProfit.roi > 30 ? '🟢' : 
                       results.projectedProfit.roi > 15 ? '🟡' : 
                       results.projectedProfit.roi > 0 ? '🔵' : '🔴';
      const roiLabel = results.projectedProfit.roi > 30 ? 'EXCELLENT' :
                       results.projectedProfit.roi > 15 ? 'GOOD' :
                       results.projectedProfit.roi > 0 ? 'MARGINAL' : 'NEGATIVE';
      console.log(`   ${roiColor} Assessment: ${roiLabel}`);
      
      console.log(`\n🎯 RECOMMENDED TRADES:`);
      const tradeDecisions = results.decisions.filter(d => d.action !== 'SKIP');
      
      tradeDecisions.forEach((decision, i) => {
        console.log(`\n   ${i + 1}. ${decision.symbol} - ${decision.action.replace('_', ' ')}`);
        console.log(`      Entry: $${decision.entryPrice.toFixed(2)} | ${decision.leverage}x leverage`);
        console.log(`      Target: $${decision.takeProfit.toFixed(2)} | Stop: $${decision.stopLoss.toFixed(2)}`);
        console.log(`      💰 Win: +$${decision.projectedWinProfit.toFixed(2)} | Loss: $${decision.projectedLossAmount.toFixed(2)} | R:R ${decision.riskRewardRatio.toFixed(2)}:1`);
      });
    } else {
      console.log(`\n⚠️  NO TRADES RECOMMENDED`);
      console.log(`   Reasons: Insufficient confidence or poor risk/reward on all markets`);
    }
    
    console.log(`\n\n✨ DRY RUN COMPLETE!`);
    console.log(`\n📝 NEXT STEPS:`);
    if (results.projectedProfit.roi > 15) {
      console.log(`   ✅ Strong opportunities detected!`);
      console.log(`   1. Review the recommended trades above`);
      console.log(`   2. Fund your Ethereal account with $${results.potentialCapitalDeployed.toFixed(2)}+ USDe`);
      console.log(`   3. Run live trading to execute (or continue testing on testnet)`);
    } else if (results.projectedProfit.roi > 0) {
      console.log(`   ⚠️  Marginal opportunities - consider waiting`);
      console.log(`   1. Risk/reward is positive but not strong`);
      console.log(`   2. Consider adjusting parameters or waiting for better setups`);
    } else {
      console.log(`   🛑 No profitable opportunities detected`);
      console.log(`   1. Wait for better market conditions`);
      console.log(`   2. Adjust confidence/leverage parameters if needed`);
    }
    console.log(`\n⚠️  DISCLAIMER: Perp trading is high-risk. These are AI projections, not guarantees.`);
    console.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Main dry run execution
   */
  async run(): Promise<DryRunResults> {
    console.log(`\n${'='.repeat(80)}`);
    console.log('🧪 ETHEREAL PERPS DRY RUN MODE');
    console.log(`${'='.repeat(80)}`);
    console.log('\n⚠️  DRY RUN: No real trades will be executed');
    console.log('📊 Analyzing perp markets with AI forecasting...\n');
    console.log(`💰 Position Size: $${this.positionSize} per trade`);
    console.log(`📊 Max Leverage: ${this.maxLeverage}x`);
    console.log(`🎯 Min Confidence: ${(this.minConfidence * 100).toFixed(0)}%`);
    console.log(`📈 Max Trades: ${this.maxTrades}`);

    try {
      // Initialize Ethereal client
      await this.ethereal.initialize();

      // Fetch available products
      const products = await this.ethereal.getProducts();
      console.log(`\n✅ Found ${products.length} available perp markets`);

      // Filter for major pairs using ticker and baseTokenName
      const majorPairs = products.filter(p => {
        const checkStr = (p.ticker || p.baseTokenName || '').toUpperCase();
        return ['BTC', 'ETH', 'SOL', 'ARB', 'USDC'].some(asset => checkStr.includes(asset));
      }).slice(0, Math.min(10, products.length));

      // If no major pairs found, just use first 5 products
      const marketsToAnalyze = majorPairs.length > 0 ? majorPairs : products.slice(0, 5);

      console.log(`📊 Analyzing ${marketsToAnalyze.length} markets...\n`);

      // Fetch prices
      const productIds = marketsToAnalyze.map(p => p.id);
      let prices = await this.ethereal.getMarketPrices(productIds);
      
      // If no prices available (testnet), use mock prices for dry run simulation
      if (prices.length === 0) {
        console.log(`\n⚠️  No live prices available (testnet). Using mock prices for simulation...`);
        prices = marketsToAnalyze.map(p => ({
          productId: p.id,
          indexPrice: this.getMockPrice(p.ticker),
          markPrice: this.getMockPrice(p.ticker),
          lastPrice: this.getMockPrice(p.ticker),
          timestamp: Date.now()
        }));
      }
      
      const priceMap = new Map<string, MarketPrice>();
      prices.forEach(p => priceMap.set(p.productId, p));

      const decisions: PerpTradeDecision[] = [];
      let tradesRecommended = 0;

      // Analyze each market
      for (let i = 0; i < marketsToAnalyze.length && tradesRecommended < this.maxTrades; i++) {
        const product = marketsToAnalyze[i];
        const price = priceMap.get(product.id);

        if (!price) {
          console.log(`⚠️  Skipping ${product.ticker} - no price data`);
          continue;
        }

        console.log(`\n\n${'▬'.repeat(80)}`);
        console.log(`🔍 Analyzing Market ${i + 1}/${marketsToAnalyze.length}`);
        console.log(`${'▬'.repeat(80)}`);
        console.log(`${product.ticker} (${product.baseTokenName}) - $${parseFloat(price.markPrice).toFixed(2)}`);

        try {
          // Generate forecast
          console.log('\n⏳ Generating AI forecast...');
          const forecast = await this.generateForecast(product, price);
          console.log(`✅ Forecast: ${forecast.direction} (confidence: ${(forecast.confidence * 100).toFixed(1)}%)`);

          // Evaluate trade
          const decision = this.evaluateTradeDecision(product, price, forecast);
          decisions.push(decision);

          // Display decision
          this.displayDecision(decision, i);

          if (decision.action !== 'SKIP') {
            tradesRecommended++;
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error: any) {
          console.error(`\n❌ Error analyzing market: ${error.message}`);
          continue;
        }
      }

      // Calculate statistics
      const tradeDecisions = decisions.filter(d => d.action !== 'SKIP');
      const avgConfidence = tradeDecisions.length > 0
        ? (tradeDecisions.reduce((sum, d) => sum + d.confidence, 0) / tradeDecisions.length) * 100
        : 0;
      const avgLeverage = tradeDecisions.length > 0
        ? tradeDecisions.reduce((sum, d) => sum + d.leverage, 0) / tradeDecisions.length
        : 0;

      // Calculate profit projections
      let bestCaseProfit = 0;
      let worstCaseProfit = 0;
      let expectedProfit = 0;
      let totalRisk = 0;
      
      tradeDecisions.forEach(decision => {
        bestCaseProfit += decision.projectedWinProfit;
        worstCaseProfit += decision.projectedLossAmount;
        totalRisk += this.positionSize * decision.leverage;
        
        // Expected: 60% hit target, 40% hit stop (simplified)
        expectedProfit += (0.6 * decision.projectedWinProfit) + (0.4 * decision.projectedLossAmount);
      });
      
      const capitalDeployed = tradesRecommended * this.positionSize;
      const expectedROI = capitalDeployed > 0 ? (expectedProfit / capitalDeployed) * 100 : 0;

      const results: DryRunResults = {
        totalMarketsAnalyzed: decisions.length,
        tradesRecommended,
        tradesSkipped: decisions.length - tradesRecommended,
        avgConfidence,
        avgLeverage,
        potentialCapitalDeployed: capitalDeployed,
        decisions,
        timestamp: new Date().toISOString(),
        projectedProfit: {
          bestCase: bestCaseProfit,
          worstCase: worstCaseProfit,
          expectedCase: expectedProfit,
          roi: expectedROI,
        },
        totalRisk,
        netExpectedProfit: expectedProfit,
      };

      // Generate report
      this.generateReport(results);

      return results;
    } catch (error: any) {
      console.error('\n❌ Fatal error:', error.message);
      throw error;
    }
  }
}

// Main execution
if (require.main === module) {
  const dryRun = new EtherealDryRun({
    groqApiKey: process.env.GROQ_API_KEY || "",
    privateKey: process.env.PRIVATE_KEY || "",
    testnet: true, // Use testnet for safety
    maxTrades: 3, // Analyze multiple markets
  });

  dryRun.run()
    .then((results) => {
      console.log('\n✅ Ethereal dry run completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Ethereal dry run failed:', error);
      process.exit(1);
    });
}

export default EtherealDryRun;
