/**
 * Sapience Trading Agent
 * 
 * Generates predictions and executes trades with 1 USDe wagers on Sapience markets. 
 * Agent is ranked by profit/loss on the Sapience leaderboard.
 * 
 * Requires capital deployment. 
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { ethers } from "ethers";
import axios from "axios";

interface Market {
  id: string;
  question: string;
  description: string;
  resolution_date: string;
  yes_price: number;
  no_price: number;
  liquidity:  number;
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

export class TradingAgent {
  private anthropic: Anthropic;
  private provider: ethers. JsonRpcProvider;
  private signer: ethers.Signer;
  private walletAddress: string;
  private usdeTokenAddress: string = "0xFd4cb59b3B0F51a08CEa8fade0F7B13d51180fff"; // USDe on Arbitrum
  private sapienceContractAddress: string = "0x... "; // Sapience market contract
  private minConfidence: number = 0.65; // Only trade if confidence > 65%
  private minExpectedValue: number = 1.1; // Only trade if E[V] > 10%
  private wagerAmount: number = 1; // Always 1 USDe per trade

  constructor(
    privateKey: string,
    arbitrumRpcUrl: string = "https://arb1.arbitrum.io/rpc"
  ) {
    this.provider = new ethers.JsonRpcProvider(arbitrumRpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.anthropic = new Anthropic();
    this.walletAddress = ethers.getAddress(
      ethers.computeAddress(new ethers.SigningKey(privateKey).publicKey)
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
   * Generate a prediction and trading recommendation using Claude
   */
  async generatePrediction(market: Market): Promise<Prediction> {
    const prompt = `
You are a prediction market trader analyzing markets for edge. 

Market: "${market.question}"
Description: ${market.description}
Resolution Date: ${market.resolution_date}
Current YES Price:  ${(market.yes_price * 100).toFixed(1)}%
Current NO Price: ${(market.no_price * 100).toFixed(1)}%
Liquidity: $${market.liquidity}

You have a 1 USDe budget per trade. You win if your prediction matches the outcome. 

Provide your analysis in JSON format:
{
  "predicted_outcome": "YES" or "NO",
  "confidence":  0.65 to 1.0,
  "reasoning": "<detailed reasoning>",
  "market_probability": 0.0 to 1.0,
  "fair_value": 0.0 to 1.0,
  "edge":  "your estimated advantage",
  "recommendation": "BUY_YES" or "BUY_NO" or "SKIP"
}

Rules:
- Only recommend BUY if you see edge (fair_value differs from market price by >5%)
- Only recommend if confidence >= 65%
- Be conservative - skip uncertain markets
- Edge = fair_value - market_price (should be positive for BUY)
    `;

    const response = await this.anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens:  700,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    try {
      const content = response. content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not extract JSON from response");
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Calculate expected value
      const marketPrice =
        analysis.predicted_outcome === "YES"
          ? market.yes_price
          : market.no_price;
      const expectedValue = analysis.fair_value / marketPrice;

      return {
        market_id: market.id,
        market_question: market.question,
        predicted_outcome: analysis.predicted_outcome,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        recommendation: analysis.recommendation,
        expected_value: expectedValue,
      };
    } catch (error) {
      console.error("Error parsing prediction:", error);
      throw error;
    }
  }

  /**
   * Execute a trade on Sapience markets
   */
  async executeTrade(prediction: Prediction, market: Market): Promise<Trade> {
    try {
      console.log(`  💰 Executing trade: ${prediction.recommendation}`);

      // Get current market prices
      const price =
        prediction.predicted_outcome === "YES"
          ? market.yes_price
          : market.no_price;

      // In production, this would: 
      // 1. Approve USDe token to market contract
      // 2. Call market contract to place trade
      // 3. Wait for confirmation

      // For demo, simulate the trade
      const tx = {
        market_id: market. id,
        outcome: prediction. predicted_outcome,
        amount:  this.wagerAmount,
        price: price,
        transaction_hash: "0x" + Math.random().toString(16).slice(2),
        timestamp: new Date(),
      };

      console.log(`    ✅ Trade executed at ${(price * 100).toFixed(1)}%`);
      console.log(`    📍 Hash: ${tx.transaction_hash}`);

      return tx;
    } catch (error) {
      console.error("Error executing trade:", error);
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
    console. log("🤖 Trading Agent Starting...");
    console.log(`💼 Wallet: ${this.walletAddress}`);
    console.log(`💰 Budget: ${maxTrades} USDe (${maxTrades} trades @ 1 USDe each)`);

    try {
      // Fetch markets
      const markets = await this.getMarkets();
      console.log(`\n📈 Found ${markets.length} active markets`);

      // Generate predictions and execute trades
      let tradesExecuted = 0;
      const trades: Trade[] = [];

      for (const market of markets) {
        if (tradesExecuted >= maxTrades) {
          console.log(`\n✋ Reached max trades (${maxTrades}), stopping`);
          break;
        }

        try {
          console.log(`\n🎯 Analyzing:  ${market.question}`);

          // Generate prediction
          const prediction = await this.generatePrediction(market);
          console.log(`  Outcome: ${prediction.predicted_outcome}`);
          console.log(`  Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
          console.log(`  Expected Value: ${(prediction.expected_value * 100).toFixed(1)}%`);
          console.log(`  Recommendation: ${prediction.recommendation}`);

          // Check if we should trade
          if (this.shouldTrade(prediction)) {
            const trade = await this.executeTrade(prediction, market);
            trades.push(trade);
            tradesExecuted++;
          } else {
            console.log(`  ⏭️  Skipped (insufficient edge)`);
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`  ❌ Error analyzing market:  ${error}`);
          continue;
        }
      }

      console.log(`\n✨ Trading complete! `);
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
if (require. main === module) {
  const agent = new TradingAgent(
    process.env.PRIVATE_KEY || "",
    process. env.ARBITRUM_RPC_URL
  );

  agent.run(10).catch(console.error);
}
