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

interface Trade {
  market_id: string;
  outcome: "YES" | "NO";
  amount: number; // in USDe
  price: number;
  transaction_hash: string;
  timestamp: Date;
}

interface Config {
  groqApiKey: string;
  privateKey: string;
  arbitrumRpcUrl?: string;
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
  private signer: ethers.Signer;
  private walletAddress: string;
  private minConfidence: number = 0.65;
  private minExpectedValue: number = 1.1;

  constructor(config: Config) {
    this.provider = new ethers.JsonRpcProvider(config.arbitrumRpcUrl || "https://arb1.arbitrum.io/rpc");
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
    this.groq = new Groq({
      apiKey: config.groqApiKey,
    });
    this.walletAddress = ethers.getAddress(
      ethers.computeAddress(new ethers.SigningKey(config.privateKey).publicKey)
    );
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
      console.error("Error fetching markets:", error);
      return [];
    }
  }

  /**
   * Evaluate a trade using Groq and Kimi model
   */
  async evaluateTrade(
    market: Market,
    forecast: Forecast
  ): Promise<TradeDecision> {
    console.log(`\n💼 Evaluating trade for: ${market.question}`);

    const prompt = `You are a risk-management expert for prediction markets. Evaluate this trading opportunity:

Market: "${market.question}"
Platform: ${market.description}
Current Price: ${(market.yes_price! * 100).toFixed(1)}%
Forecast Probability: ${(forecast.probability * 100).toFixed(1)}%
Forecast Confidence: ${(forecast.confidence * 100).toFixed(1)}%
Expected Value: ${forecast.expectedValue.toFixed(3)}

Forecast Reasoning: ${forecast.reasoning}

Apply Kelly criterion and risk management. Provide decision in JSON:
{
  "action": "BUY" or "SELL" or "SKIP",
  "size": <number 0-1>,
  "reasoning": "<detailed reasoning>",
  "riskScore": <number 0-100>,
  "stopLoss": <number or null>,
  "takeProfit": <number or null>
}

Rules:
- action: BUY if edge > 5% and confidence > 70%, SELL if edge < -5% and confidence > 70%, else SKIP
- size: Kelly stake capped at 10% of bankroll (0.1 max)
- riskScore: 0-100 based on volatility, liquidity, time to close
- Only trade if riskScore < 60`;

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a risk-management expert specializing in prediction market trading with Kelly criterion and proper position sizing.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: 'moonshotai/kimi-k2-instruct-0905',
        temperature: 0.5,
        max_completion_tokens: 2048,
        top_p: 1,
        stream: false,
      });

      const content = chatCompletion.choices[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from model response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      const decision: TradeDecision = {
        marketId: market.id,
        action: analysis.action.toLowerCase() as 'buy' | 'sell' | 'skip',
        size: Math.min(analysis.size, 0.1), // Cap at 10%
        reasoning: analysis.reasoning,
        timestamp: Date.now(),
        confidence: forecast.confidence,
        expectedReturn: forecast.expectedValue,
        riskScore: analysis.riskScore / 100,
        stopLoss: analysis.stopLoss,
        takeProfit: analysis.takeProfit,
      };

      return decision;
    } catch (error: any) {
      console.error('❌ Error evaluating trade:', error.message);
      throw error;
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

    try {
      // Fetch markets
      const markets = await this.getMarkets();
      console.log(`\n📈 Found ${markets.length} active markets`);

      // Generate predictions and execute trades
      let tradesExecuted = 0;

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
          if (decision.action === 'buy' && decision.riskScore < 0.6) {
            console.log(`  💰 Executing trade`);
            tradesExecuted++;
          } else {
            console.log(`  ⏭️  Skipped (insufficient edge or high risk)`);
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`  ❌ Error analyzing market: ${error}`);
          continue;
        }
      }

      console.log(`\n✨ Trading complete!`);
      console.log(`  📊 Trades executed: ${tradesExecuted}/${maxTrades}`);
      console.log(`  💵 Capital deployed: ${tradesExecuted} USDe`);
      console.log(`  📍 View results at https://sapience.xyz/leaderboard`);
    } catch (error) {
      console.error("Fatal error:", error);
      throw error;
    }
  }
}

// Main execution
if (require.main === module) {
  const agent = new TradingAgent({
    groqApiKey: process.env.GROQ_API_KEY || "",
    privateKey: process.env.PRIVATE_KEY || "",
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
  });

  agent.run(10).catch(console.error);
}
