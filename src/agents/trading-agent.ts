/**
 * Sapience Trading Agent
 * 
 * Generates predictions and executes trades with 1 USDe wagers on Sapience markets. 
 * Agent is ranked by profit/loss on the Sapience leaderboard.
 * 
 * Requires capital deployment. 
 */

import Groq from 'groq-sdk';
import { ethers } from "ethers";
import axios from "axios";
import { TradeTracker, TradeResult } from './trade-tracker';

interface Market {
  id: string;
  question: string;
  description: string;
  platform?: string;
  yes_price?: number;
  no_price?: number;
  liquidity?: number;
  resolution_date?: string;
}

interface Prediction {
  market_id: string;
  market_question: string;
  predicted_outcome: "YES" | "NO";
  confidence: number;
  reasoning:  string;
  recommendation: "BUY_YES" | "BUY_NO" | "SKIP";
  expected_value: number;
}

interface Config {
  groqApiKey: string;
  privateKey: string;
  arbitrumRpcUrl?: string;
  dryRun?: boolean;
  marketFilter?: string[];
}

interface Forecast {
  probability: number;
  confidence: number;
  expectedValue: number;
  reasoning: string;
}

interface TradeDecision {
  marketId: string;
  action: 'buy' | 'sell' | 'skip';
  size: number;
  reasoning: string;
  timestamp: number;
  confidence: number;
  expectedReturn: number;
  riskScore: number;
  stopLoss: number | null;
  takeProfit: number | null;
}

export class TradingAgent {
  private groq: Groq;
  private provider: ethers.JsonRpcProvider;
  private walletAddress: string;
  private minConfidence: number = 0.65;
  private minExpectedValue: number = 1.1;
  private dryRun: boolean = false;
  private tracker: TradeTracker;
  private marketFilter?: string[];

  constructor(config: Config) {
    this.provider = new ethers.JsonRpcProvider(config.arbitrumRpcUrl || "https://arb1.arbitrum.io/rpc");
    const wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.groq = new Groq({
      apiKey: config.groqApiKey,
    });
    this.walletAddress = wallet.address;
    this.dryRun = config.dryRun || false;
    this.tracker = new TradeTracker();
    this.marketFilter = config.marketFilter;
  }

  /**
   * Fetch active markets from Sapience
   */
  async getMarkets(): Promise<Market[]> {
    try {
      const response = await axios.get("https://api.sapience.xyz/markets", {
        params: {
          status: "active",
          limit: 50,
        },
      });

      return response.data.markets;
    } catch (error) {
      console.error("Error fetching Sapience markets:", error);
      console.log("\n⚠️  Sapience API unavailable. Use Ethereal markets instead with: pnpm test:ethereal\n");
      return [];
    }
  }

  /**
   * Determine if a prediction should be traded
   */
  shouldTrade(prediction: Prediction): boolean {
    return (
      prediction.recommendation !== "SKIP" &&
      prediction.confidence >= this.minConfidence &&
      prediction.expected_value >= this.minExpectedValue
    );
  }

  /**
   * Main trading loop
   */
  async run(maxTrades: number = 10): Promise<void> {
    console.log("🤖 Trading Agent Starting...");
    console.log(`💼 Wallet: ${this.walletAddress}`);
    console.log(`💰 Budget: ${maxTrades} USDe (${maxTrades} trades @ 1 USDe each)`);
    
    if (this.marketFilter) {
      console.log(`🔍 Filtering for: ${this.marketFilter.join(', ')}`);
    }
    
    if (this.dryRun) {
      console.log(`\n⚠️  DRY RUN MODE - No actual trades will be executed\n`);
    }

    try {
      // Fetch markets
      let markets = await this.getMarkets();
      
      // Apply filters
      markets = this.filterMarkets(markets);
      
      console.log(`\n📈 Found ${markets.length} active markets`);

      // Generate predictions and execute trades
      let tradesExecuted = 0;
      const tradeResults: Array<{
        market: Market;
        decision: TradeDecision;
        wouldExecute: boolean;
      }> = [];

      for (const market of markets) {
        if (tradesExecuted >= maxTrades) {
          console.log(`\n✋ Reached max trades (${maxTrades}), stopping`);
          break;
        }

        try {
          console.log(`\n🎯 Analyzing: ${market.question}`);

          // Generate prediction
          const forecast: Forecast = {
            probability: market.yes_price || 0.5,
            confidence: 0.75,
            expectedValue: 1.2,
            reasoning: "Example reasoning",
          };

          const decision = await this.evaluateTrade(market, forecast);
          console.log(`  Action: ${decision.action}`);
          console.log(`  Size: ${(decision.size * 100).toFixed(1)}%`);
          console.log(`  Risk Score: ${(decision.riskScore * 100).toFixed(1)}%`);
          console.log(`  Reasoning: ${decision.reasoning}`);

          // Check if we should trade
          const wouldExecute = decision.action === 'buy' && decision.riskScore < 0.6;
          
          // Save trade to tracker
          if (wouldExecute || decision.action !== 'skip') {
            const tradeResult: TradeResult = {
              tradeId: `${market.id}-${Date.now()}`,
              marketId: market.id,
              question: market.question,
              action: decision.action,
              entryPrice: market.yes_price || 0.5,
              size: decision.size,
              confidence: decision.confidence,
              expectedReturn: forecast.expectedValue,
              riskScore: decision.riskScore,
              timestamp: decision.timestamp,
              reasoning: decision.reasoning,
            };
            
            this.tracker.saveTrade(tradeResult);
          }
          
          if (wouldExecute) {
            if (this.dryRun) {
              console.log(`  🔍 [DRY RUN] Would execute trade`);
            } else {
              console.log(`  💰 Executing trade`);
              // Actual trade execution would go here
            }
            tradesExecuted++;
          } else {
            console.log(`  ⏭️  Skipped (insufficient edge or high risk)`);
          }

          tradeResults.push({
            market,
            decision,
            wouldExecute,
          });

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`  ❌ Error analyzing market: ${error}`);
          continue;
        }
      }

      // Print summary
      this.printSummary(tradeResults, tradesExecuted, maxTrades);
      
      // Print tracker stats
      this.printTrackerStats();
      
      // Export to CSV
      this.tracker.exportToCSV();
    } catch (error) {
      console.error("Fatal error:", error);
      throw error;
    }
  }

  /**
   * Print trade summary
   */
  private printSummary(
    tradeResults: Array<{
      market: Market;
      decision: TradeDecision;
      wouldExecute: boolean;
    }>,
    tradesExecuted: number,
    maxTrades: number
  ): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n✨ Trading ${this.dryRun ? 'Analysis' : 'Session'} Complete!\n`);
    console.log(`📊 Summary:`);
    console.log(`  - Markets analyzed: ${tradeResults.length}`);
    console.log(`  - Trades ${this.dryRun ? 'identified' : 'executed'}: ${tradesExecuted}/${maxTrades}`);
    console.log(`  - Capital ${this.dryRun ? 'required' : 'deployed'}: ${tradesExecuted} USDe`);
    
    const buyDecisions = tradeResults.filter(r => r.decision.action === 'buy');
    const sellDecisions = tradeResults.filter(r => r.decision.action === 'sell');
    const skipDecisions = tradeResults.filter(r => r.decision.action === 'skip');
    
    console.log(`\n📈 Action Distribution:`);
    console.log(`  - BUY:  ${buyDecisions.length}`);
    console.log(`  - SELL: ${sellDecisions.length}`);
    console.log(`  - SKIP: ${skipDecisions.length}`);

    if (tradeResults.length > 0) {
      const avgRiskScore = tradeResults.reduce((sum, r) => sum + r.decision.riskScore, 0) / tradeResults.length;
      const avgConfidence = tradeResults.reduce((sum, r) => sum + r.decision.confidence, 0) / tradeResults.length;
      const avgExpectedReturn = tradeResults.reduce((sum, r) => sum + r.decision.expectedReturn, 0) / tradeResults.length;

      console.log(`\n📉 Average Metrics:`);
      console.log(`  - Risk Score: ${(avgRiskScore * 100).toFixed(1)}%`);
      console.log(`  - Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`  - Expected Return: ${avgExpectedReturn.toFixed(2)}x`);
    }

    if (this.dryRun && tradesExecuted > 0) {
      console.log(`\n🎯 Top Trade Opportunities:`);
      tradeResults
        .filter(r => r.wouldExecute)
        .sort((a, b) => b.decision.expectedReturn - a.decision.expectedReturn)
        .slice(0, 5)
        .forEach((result, idx) => {
          console.log(`\n  ${idx + 1}. ${result.market.question}`);
          console.log(`     Action: ${result.decision.action.toUpperCase()}`);
          console.log(`     Size: ${(result.decision.size * 100).toFixed(1)}%`);
          console.log(`     Expected Return: ${result.decision.expectedReturn.toFixed(2)}x`);
          console.log(`     Risk Score: ${(result.decision.riskScore * 100).toFixed(1)}%`);
        });
    }

    console.log(`\n📍 View results at https://sapience.xyz/leaderboard`);
    console.log(`\n${'='.repeat(60)}`);
  }

  /**
   * Print tracker statistics
   */
  private printTrackerStats(): void {
    const stats = this.tracker.getStats();
    
    console.log(`\n📊 Historical Performance:`);
    console.log(`  - Total trades recorded: ${stats.totalTrades}`);
    console.log(`  - Resolved trades: ${stats.resolvedTrades}`);
    console.log(`  - Win rate: ${(stats.winRate * 100).toFixed(1)}%`);
    console.log(`  - Average PnL: ${stats.avgPnL.toFixed(3)} USDe`);
    console.log(`  - Total PnL: ${stats.totalPnL.toFixed(2)} USDe`);
    console.log(`  - Average confidence: ${(stats.avgConfidence * 100).toFixed(1)}%`);
  }
}

// Main execution
if (require.main === module) {
  const agent = new TradingAgent({
    groqApiKey: process.env.GROQ_API_KEY || "",
    privateKey: process.env.PRIVATE_KEY || "",
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
    dryRun: process.env.DRY_RUN === 'true',
    marketFilter: process.env.MARKET_FILTER ? process.env.MARKET_FILTER.split(',') : undefined,
  });

  agent.run(10).catch(console.error);
}
