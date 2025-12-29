import 'dotenv/config';
import Groq from 'groq-sdk';
import { gql } from 'graphql-request';
import { graphqlRequest, } from '@sapience/sdk';
import { SAPIENCE_CONFIG } from '../config';

interface Condition {
  id: string;
  question: string;
  shortName?: string;
  endTime: number;
}

interface Forecast {
  conditionId: string;
  probability: number;
  reasoning: string;
}

interface ForecastWithConfidence extends Forecast {
  confidence: number;
  edge: number; // Absolute difference from 50% (market uncertainty)
}

interface Config {
  privateKey: string;
  groqApiKey: string;
}

export class ForecastingAgent {
  private groq: Groq;
  private privateKey: string;

  constructor(config: Config) {
    this.groq = new Groq({ apiKey: config.groqApiKey });
    this.privateKey = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`;
  }

  async getConditions(limit: number = 20): Promise<Condition[]> {
    const nowSec = Math.floor(Date.now() / 1000);
    const query = gql`
      query Conditions($nowSec: Int, $limit: Int) {
        conditions(
          where: { 
            public: { equals: true }
            endTime: { gt: $nowSec }
          }
          take: $limit
        ) {
          id
          question
          shortName
          endTime
        }
      }
    `;
    
    const { conditions } = await graphqlRequest<{ conditions: any[] }>(query, {
      nowSec,
      limit,
    });

    console.log(`✅ Fetched ${conditions.length} active conditions`);
    
    return conditions;
  }

  async generateForecast(condition: Condition): Promise<ForecastWithConfidence> {
    const question = condition.shortName || condition.question;
    console.log(`\n🤖 Forecasting: ${question.substring(0, 80)}...`);

    const response = await this.groq.chat.completions.create({
      messages: [{
        role: 'system',
        content: `You are a professional forecaster. Analyze prediction markets using:
1. Base-rate analysis (historical precedent)
2. Conditional probabilities 
3. Specific quantitative evidence
4. Market structure/liquidity analysis
5. Bayesian reasoning

Format: [probability]% | confidence:[0-100] | [reasoning with specific numbers and logic]`
      }, {
        role: 'user',
        content: `Forecast this binary outcome (0-100%): "${question}"

Provide:
- Probability estimate (0-100)
- Confidence score (0-100) - how certain you are based on available evidence
- Base rates from similar historical events with specific percentages
- Key conditional factors with quantitative estimates
- Specific numerical justifications (e.g., "Historical rate: 23%, adjusted +15% for X factor")
- Market inefficiency analysis if applicable

Format: [probability]% | confidence:[score] | [reasoning]
Keep reasoning under 280 chars but be specific with numbers.`
      }],
      model: SAPIENCE_CONFIG.GROQ_MODEL,
      temperature: SAPIENCE_CONFIG.GROQ_TEMPERATURE,
      max_tokens: SAPIENCE_CONFIG.GROQ_MAX_TOKENS,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    
    // Extract probability
    const probMatch = content.match(/(\d{1,3})%/);
    const probability = probMatch ? Math.max(0, Math.min(100, parseInt(probMatch[1]))) : 50;
    
    // Extract confidence score
    const confMatch = content.match(/confidence:\s*(\d{1,3})/i);
    const confidence = confMatch ? Math.max(0, Math.min(100, parseInt(confMatch[1]))) : 50;
    
    // Extract reasoning (remove probability and confidence)
    const reasoning = content
      .replace(/^\d{1,3}%\s*\|?\s*/, '') // Remove leading "XX% |"
      .replace(/confidence:\s*\d{1,3}\s*\|?\s*/i, '') // Remove confidence score
      .trim()
      .substring(0, 280); // Leave room for encoding

    console.log(`   Probability: ${probability}%`);
    console.log(`   Confidence: ${confidence}%`);
    console.log(`   Reasoning: ${reasoning}`);

    // Calculate edge (distance from 50% = strength of conviction)
    const edge = Math.abs(probability - 50);

    return {
      conditionId: condition.id,
      probability,
      confidence,
      edge,
      reasoning: reasoning || `Base rate ${probability}% from similar historical outcomes`,
    };
  }

  async submitForecastToSapience(forecast: Forecast): Promise<string> {
    console.log(`📤 Submitting ${forecast.probability}% → ${forecast.conditionId.slice(0, 10)}...`);
    
    try {
      // The SDK expects the condition to be submitted via submitTransaction
      // with the EAS contract directly
      const { submitTransaction } = await import('@sapience/sdk');
      const { encodeAbiParameters, encodeFunctionData, parseAbiParameters } = await import('viem');
      
      // EAS contract address on Arbitrum
      const EAS_ADDRESS = '0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458';
      const SCHEMA_ID = '0x7df55bcec6eb3b17b25c503cc318a36d33b0a9bbc2d6bc0d9788f9bd61980d49';
      
      // Encode the attestation data
      const encodedData = encodeAbiParameters(
        parseAbiParameters('address resolver, bytes condition, uint256 forecast, string comment'),
        [
          '0x0000000000000000000000000000000000000000', // resolver (zero address)
          forecast.conditionId as `0x${string}`, // condition as bytes32
          BigInt(forecast.probability) * BigInt(10 ** 18), // Convert to D18 format
          forecast.reasoning
        ]
      );

      // Build EAS attest call
      const attestationData = encodeFunctionData({
        abi: [{
          name: 'attest',
          type: 'function',
          inputs: [{
            name: 'request',
            type: 'tuple',
            components: [
              { name: 'schema', type: 'bytes32' },
              {
                name: 'data',
                type: 'tuple',
                components: [
                  { name: 'recipient', type: 'address' },
                  { name: 'expirationTime', type: 'uint64' },
                  { name: 'revocable', type: 'bool' },
                  { name: 'refUID', type: 'bytes32' },
                  { name: 'data', type: 'bytes' },
                  { name: 'value', type: 'uint256' },
                ],
              },
            ],
          }],
          outputs: [{ name: '', type: 'bytes32' }],
          stateMutability: 'payable',
        }],
        functionName: 'attest',
        args: [{
          schema: SCHEMA_ID,
          data: {
            recipient: '0x0000000000000000000000000000000000000000',
            expirationTime: 0n,
            revocable: false,
            refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
            data: encodedData,
            value: 0n,
          },
        }],
      });

      // Submit the transaction
      const { hash } = await submitTransaction({
        rpc: 'https://arb1.arbitrum.io/rpc',
        privateKey: this.privateKey as `0x${string}`,
        tx: {
          to: EAS_ADDRESS as `0x${string}`,
          data: attestationData as `0x${string}`,
          value: '0',
        },
      });

      console.log(`✅ TX: https://arbiscan.io/tx/${hash}`);
      return hash;
    } catch (error: any) {
      console.error(`❌ Attestation failed: ${error.message}`);
      throw error;
    }
  }

  // ONE-SHOT: 5 forecasts max (your gas budget)
  async runOneShot(): Promise<void> {
    console.log("🚀 ONE-SHOT MODE: 5 forecasts for leaderboard");
    
    const conditions = await this.getConditions(20);
    if (conditions.length === 0) throw new Error('No conditions');

    // Pick 5 random long-horizon conditions (better Brier scores)
    const longHorizon = conditions
      .filter(c => c.endTime > Date.now() / 1000 + 7 * 86400) // >7 days
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    let success = 0;
    for (const condition of longHorizon) {
      try {
        const forecast = await this.generateForecast(condition);
        await this.submitForecastToSapience(forecast);
        success++;
        
        // Gas-saving delay
        await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        console.error(`❌ Skip: ${e}`);
      }
    }

    console.log(`\n🎉 COMPLETE: ${success}/5 forecasts submitted`);
    console.log(`📊 Check: https://sapience.xyz/leaderboard#accuracy`);
  }

  /**
   * Main forecasting loop - generates forecasts and submits the most confident one
   */
  async run(maxForecasts: number = 2): Promise<void> {
    console.log("🤖 Forecasting Agent Starting...");
    console.log(`📊 Strategy: Submit ${maxForecasts} forecasts (1 highest confidence + 1 highest edge)\n`);

    try {
      // Fetch active conditions
      const conditions = await this.getConditions(50);
      
      if (conditions.length === 0) {
        console.log('⚠️  No active conditions found');
        return;
      }

      console.log(`\n📈 Found ${conditions.length} active conditions`);

      // Generate forecasts for ALL conditions to find the best ones
      console.log('\n🔍 Evaluating all conditions...\n');
      
      const allForecasts: ForecastWithConfidence[] = [];
      
      for (const condition of conditions) {
        try {
          const forecast = await this.generateForecast(condition);
          allForecasts.push(forecast);
          
          // Rate limiting between API calls
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (error) {
          console.error(`  ⚠️  Skipped condition: ${error}`);
          continue;
        }
      }

      if (allForecasts.length === 0) {
        console.log('❌ No forecasts generated');
        return;
      }

      // Strategy: Pick 1 highest confidence + 1 highest edge (different forecasts)
      const byConfidence = [...allForecasts].sort((a, b) => b.confidence - a.confidence);
      const byEdge = [...allForecasts].sort((a, b) => b.edge - a.edge);
      
      const selectedForecasts: ForecastWithConfidence[] = [];
      
      // Add highest confidence forecast
      if (byConfidence.length > 0) {
        selectedForecasts.push(byConfidence[0]);
      }
      
      // Add highest edge forecast (if different from highest confidence)
      if (byEdge.length > 0 && byEdge[0].conditionId !== byConfidence[0]?.conditionId) {
        selectedForecasts.push(byEdge[0]);
      } else if (byConfidence.length > 1) {
        // If same forecast, add second highest confidence
        selectedForecasts.push(byConfidence[1]);
      }

      // Limit to maxForecasts
      const finalForecasts = selectedForecasts.slice(0, maxForecasts);
      
      console.log(`\n📊 Generated ${allForecasts.length} forecasts`);
      console.log(`\n🎯 Selected ${finalForecasts.length} for submission:`);
      finalForecasts.forEach((f, i) => {
        const question = conditions.find(c => c.id === f.conditionId)?.shortName || 'Unknown';
        console.log(`   ${i + 1}. ${question.substring(0, 50)}`);
        console.log(`      Probability: ${f.probability}% | Confidence: ${f.confidence}% | Edge: ${f.edge.toFixed(1)}%`);
      });
      
      console.log(`\n📤 Submitting ${finalForecasts.length} forecast(s)...\n`);

      let successCount = 0;
      let failCount = 0;
      let totalGasCost = 0;

      for (const forecast of finalForecasts) {
        try {
          const question = conditions.find(c => c.id === forecast.conditionId)?.shortName || 'Unknown';
          console.log(`\n🎯 ${question.substring(0, 60)}`);
          console.log(`   ${forecast.probability}% (confidence: ${forecast.confidence}%, edge: ${forecast.edge.toFixed(1)}%)`);
          
          await this.submitForecastToSapience(forecast);
          successCount++;
          totalGasCost += 0.0015; // Approximate gas cost per tx

          // Rate limiting between transactions
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (error) {
          console.error(`  ❌ Submission failed: ${error}`);
          failCount++;
          continue;
        }
      }

      console.log(`\n✨ Forecasting complete!`);
      console.log(`  📊 Successful: ${successCount}/${finalForecasts.length}`);
      if (failCount > 0) {
        console.log(`  ❌ Failed: ${failCount}/${finalForecasts.length}`);
      }
      console.log(`  ⛽ Estimated gas cost: ~$${(totalGasCost * 3000).toFixed(2)} (at $3000/ETH)`);
      console.log(`  📍 View results: https://sapience.xyz/leaderboard#accuracy`);
    } catch (error) {
      console.error("Fatal error:", error);
      throw error;
    }
  }
}
