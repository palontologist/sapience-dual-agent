/**
 * Sapience Forecasting Agent
 * 
 * Generates predictions and publishes forecasts to the Ethereum Attestation Service (EAS)
 * on Arbitrum. Predictions are ranked by accuracy on the Sapience leaderboard.
 * 
 * No trading capital required - pure forecasting. 
 */

import Groq from 'groq-sdk';
import { ethers } from "ethers";
import axios from "axios";

interface Market {
  id: string;
  question: string;
  description: string;
  platform?: string;
  currentPrice?: number;
  volume?: number;
  closeTime?: number;
  resolution_date?: string;
  yes_price?: number;
  no_price?: number;
  liquidity?: number;
}

interface Forecast {
  marketId: string;
  probability: number;
  confidence: number;
  reasoning: string;
  expectedValue?: number;
  recommendation?: string;
  timestamp: number;
  modelUsed?: string;
}

interface EASAttestation {
  uid: string;
  schema_uid: string;
  transaction_hash: string;
  block_number: number;
}

interface Config {
  privateKey: string;
  arbitrumRpcUrl: string;
  easSchemaUID: string;
  groqApiKey: string;
}

export class ForecastingAgent {
  private groq: Groq;
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer;
  private easContractAddress: string;
  private easSchemaUID: string;
  private walletAddress: string;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.groq = new Groq({
      apiKey: config.groqApiKey,
    });
    this.provider = new ethers.JsonRpcProvider(config.arbitrumRpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
    this.walletAddress = ethers.getAddress(
      ethers.computeAddress(new ethers.SigningKey(config.privateKey).publicKey)
    );
    this.easSchemaUID = config.easSchemaUID;
    this.easContractAddress = "0xA1207F3BBa224E02c159c0dFpF493b4e5C10e6B9"; // EAS on Arbitrum
  }

  /**
   * Fetch active markets from Sapience
   */
  async getMarkets(): Promise<Market[]> {
    try {
      const response = await axios.get("https://api.sapience.xyz/markets", {
        params: {
          status: "active",
          limit:  50,
        },
      });

      return response.data.markets;
    } catch (error) {
      console.error("Error fetching markets:", error);
      return [];
    }
  }

  /**
   * Generate a forecast using Groq with Kimi model
   */
  async generateForecast(market: Market): Promise<Forecast> {
    console.log(`\n🤖 Generating forecast for: ${market.question}`);

    const systemContext = `You are an expert prediction market analyst who uses statistical methods and market microstructure analysis to forecast outcomes. You understand order-book dynamics, calibration curves, and risk management principles.`;

    const currentPrice = market.currentPrice || market.yes_price || 0.5;
    const platform = market.platform || 'Unknown';
    const volume = market.volume || 0;
    const closeTime = market.closeTime || (market.resolution_date ? new Date(market.resolution_date).getTime() : null);

    const userPrompt = `Analyze this prediction market and provide a statistical forecast:

Market Information:
- Question: "${market.question}"
- Platform: ${platform.toUpperCase()}
- Current Price: ${(currentPrice * 100).toFixed(1)}%
- Volume: $${volume.toLocaleString()}
- Close Date: ${closeTime ? new Date(closeTime).toISOString() : 'N/A'}

Using your statistical forecasting methodology, analyze if the market is efficiently priced or if there's an edge. Provide your analysis in JSON format:
{
  "probability": <number 0-100>,
  "confidence": <number 0-100>,
  "reasoning": "<detailed reasoning using market microstructure, historical patterns, and statistical analysis>",
  "expectedValue": <number>,
  "recommendation": "BUY" or "SELL" or "HOLD"
}

Rules:
- probability: Your calibrated probability estimate (0-100)
- confidence: How confident you are in your estimate (0-100)
- expectedValue: Expected value considering fees and spreads
- recommendation: BUY if edge > 5%, SELL if edge < -5%, HOLD if fairly priced
- Only recommend BUY/SELL if confidence > 65%`;

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: systemContext,
          },
          {
            role: "user",
            content: "Can you forecast future trades on prediction markets based on real data?"
          },
          {
            role: "assistant",
            content: "I can show you how to turn raw prediction-market data into statistically-driven forecasts. I use market microstructure analysis (order-book snapshots, bid-ask spreads, order-flow imbalance), calibrated probabilistic models, and proper risk management to detect when market prices drift from the best statistical estimate of underlying events."
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        model: 'moonshotai/kimi-k2-instruct-0905',
        temperature: 0.6,
        max_completion_tokens: 4096,
        top_p: 1,
        stream: false,
      });

      const content = chatCompletion.choices[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from model response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      const forecast: Forecast = {
        marketId: market.id,
        probability: analysis.probability / 100,
        confidence: analysis.confidence / 100,
        reasoning: analysis.reasoning,
        expectedValue: analysis.expectedValue || 0,
        recommendation: analysis.recommendation === 'BUY' ? 'buy' : analysis.recommendation === 'SELL' ? 'sell' : 'hold',
        timestamp: Date.now(),
        modelUsed: 'moonshotai/kimi-k2-instruct-0905',
      };

      return forecast;
    } catch (error: any) {
      console.error('❌ Error generating forecast:', error.message);
      throw error;
    }
  }

  /**
   * Attest forecast onchain via EAS
   */
  async attestForecast(forecast: Forecast): Promise<EASAttestation> {
    try {
      // Import EAS SDK (lite version - would use full SDK in production)
      const easABI = [
        "function attest(tuple(bytes32 schema, tuple(address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data) data)) external payable returns (bytes32)",
      ];

      const easContract = new ethers.Contract(
        this.easContractAddress,
        easABI,
        this.signer
      );

      // Encode attestation data
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const encodedData = abiCoder.encode(
        [
          "string", // marketId
          "uint256", // probability (0-10000 for precision)
          "uint256", // confidence
          "string", // reasoning
          "uint64", // timestamp
        ],
        [
          forecast.marketId,
          Math.round(forecast.probability * 10000),
          Math.round(forecast.confidence * 10000),
          forecast.reasoning,
          Math.floor(forecast.timestamp / 1000),
        ]
      );

      // Create attestation
      const tx = await easContract.attest({
        schema: this.easSchemaUID,
        data: {
          recipient: this.walletAddress,
          expirationTime: 0, // No expiration
          revocable:  true,
          refUID: 
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          data: encodedData,
        },
      });

      // Wait for confirmation
      const receipt = await tx. wait();

      // Extract attestation UID from logs
      // (In production, would properly parse events)
      const attestationUID = receipt.logs[0]?.topics?.[1] || "0x";

      return {
        uid:  attestationUID,
        schema_uid: this.easSchemaUID,
        transaction_hash: receipt.hash,
        block_number: receipt.blockNumber,
      };
    } catch (error) {
      console.error("Error attesting forecast:", error);
      throw error;
    }
  }

  /**
   * Main forecasting loop
   */
  async run(maxForecasts: number = 10): Promise<void> {
    console.log("🤖 Forecasting Agent Starting...");
    console.log(`📊 Wallet: ${this.walletAddress}`);
    console.log(`🏗️  Schema: ${this.easSchemaUID}`);

    try {
      // Fetch markets
      const markets = await this.getMarkets();
      console.log(`\n📈 Found ${markets. length} active markets`);

      // Generate forecasts for top markets
      const selectedMarkets = markets.slice(0, maxForecasts);

      for (const market of selectedMarkets) {
        try {
          console.log(`\n🎯 Forecasting:  ${market.question}`);

          // Generate forecast
          const forecast = await this.generateForecast(market);
          console.log(`  Probability: ${(forecast.probability * 100).toFixed(1)}%`);
          console.log(`  Confidence: ${(forecast.confidence * 100).toFixed(1)}%`);
          console.log(`  Reasoning: ${forecast.reasoning}`);

          // Attest onchain
          console.log(`  📝 Attesting onchain...`);
          const attestation = await this.attestForecast(forecast);
          console. log(`  ✅ Attestation UID: ${attestation.uid}`);
          console.log(`  📍 Tx Hash: ${attestation.transaction_hash}`);

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`  ❌ Error forecasting market:  ${error}`);
          continue;
        }
      }

      console.log(`\n✨ Forecasting complete! View results at https://sapience.xyz/forecasts`);
    } catch (error) {
      console.error("Fatal error:", error);
      throw error;
    }
  }
}

// Main execution
if (require.main === module) {
  const config: Config = {
    privateKey: process.env.PRIVATE_KEY || "",
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL || "",
    easSchemaUID: process.env.EAS_SCHEMA_UID || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
  };

  const agent = new ForecastingAgent(config);

  agent.run(10).catch(console.error);
}
