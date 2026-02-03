/**
 * Test script to fetch markets from DomeAPI (Kalshi/Polymarket) and forecast with Groq
 */

import axios from 'axios';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

interface DomeMarket {
  id: string;
  title: string;
  description: string;
  platform: 'kalshi' | 'polymarket';
  yes_price: number;
  no_price: number;
  volume?: number;
  close_date?: string;
  liquidity?: number;
}

interface Forecast {
  market: DomeMarket;
  probability: number;
  confidence: number;
  reasoning: string;
  recommendation: 'BUY_YES' | 'BUY_NO' | 'SKIP';
  expected_value: number;
}

class DomeGroqTester {
  private groq: Groq;
  private domeApiKey: string;
  private domeApiUrl: string;

  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });
    this.domeApiKey = process.env.DOME_API_KEY || '';
    this.domeApiUrl = process.env.DOME_API_URL || 'https://api.domeapi.com';
  }

  /**
   * Fetch markets from Kalshi via DomeAPI
   */
  async fetchKalshiMarkets(limit: number = 5): Promise<DomeMarket[]> {
    try {
      console.log('\n📊 Fetching Kalshi markets via DomeAPI...');
      
      const response = await axios.get(`${this.domeApiUrl}/v1/kalshi/markets`, {
        headers: {
          'Authorization': `Bearer ${this.domeApiKey}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit,
          status: 'active',
        },
      });

      const markets: DomeMarket[] = response.data.markets.map((market: any) => ({
        id: market.ticker || market.id,
        title: market.title || market.question,
        description: market.subtitle || market.description || '',
        platform: 'kalshi' as const,
        yes_price: market.yes_price || (market.yes_bid ? market.yes_bid / 100 : 0.5),
        no_price: market.no_price || (market.no_bid ? market.no_bid / 100 : 0.5),
        volume: market.volume,
        close_date: market.close_time || market.end_date,
        liquidity: market.liquidity,
      }));

      console.log(`✅ Fetched ${markets.length} Kalshi markets`);
      return markets;
    } catch (error: any) {
      console.error('❌ Error fetching Kalshi markets:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Fetch markets from Polymarket via DomeAPI
   */
  async fetchPolymarketMarkets(limit: number = 5): Promise<DomeMarket[]> {
    try {
      console.log('\n📊 Fetching Polymarket markets via DomeAPI...');
      
      const response = await axios.get(`${this.domeApiUrl}/v1/polymarket/markets`, {
        headers: {
          'Authorization': `Bearer ${this.domeApiKey}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit,
          closed: false,
        },
      });

      const markets: DomeMarket[] = response.data.markets.map((market: any) => ({
        id: market.condition_id || market.id,
        title: market.question || market.title,
        description: market.description || '',
        platform: 'polymarket' as const,
        yes_price: parseFloat(market.outcome_prices?.[0] || market.yes_price || '0.5'),
        no_price: parseFloat(market.outcome_prices?.[1] || market.no_price || '0.5'),
        volume: parseFloat(market.volume || '0'),
        close_date: market.end_date_iso || market.close_date,
        liquidity: market.liquidity,
      }));

      console.log(`✅ Fetched ${markets.length} Polymarket markets`);
      return markets;
    } catch (error: any) {
      console.error('❌ Error fetching Polymarket markets:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Generate forecast using Groq
   */
  async generateForecast(market: DomeMarket): Promise<Forecast> {
    console.log(`\n🤖 Generating forecast for: ${market.title}`);

    const prompt = `You are an expert prediction market analyst. Analyze this market and provide a forecast.

Market Information:
- Question: "${market.title}"
- Description: ${market.description}
- Platform: ${market.platform.toUpperCase()}
- Current YES Price: ${(market.yes_price * 100).toFixed(1)}%
- Current NO Price: ${(market.no_price * 100).toFixed(1)}%
- Volume: $${market.volume?.toLocaleString() || 'N/A'}
- Close Date: ${market.close_date || 'N/A'}

Provide your analysis in JSON format:
{
  "probability": <number 0-100>,
  "confidence": <number 0-100>,
  "reasoning": "<detailed reasoning>",
  "fair_value": <number 0-100>,
  "edge": <number>,
  "recommendation": "BUY_YES" or "BUY_NO" or "SKIP"
}

Rules:
- probability: Your estimated probability for YES outcome (0-100)
- confidence: How confident you are in your estimate (0-100)
- fair_value: What you think the fair market price should be (0-100)
- edge: Difference between fair_value and current market price
- recommendation: BUY_YES if market underprices, BUY_NO if overprices, SKIP if fairly priced
- Only recommend BUY if edge > 5% and confidence > 65%
- Provide detailed reasoning based on available information`;

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: process.env.AGENT_MODEL || 'llama-3.1-70b-versatile',
        temperature: parseFloat(process.env.AGENT_TEMPERATURE || '0.7'),
        max_tokens: parseInt(process.env.AGENT_MAX_TOKENS || '2000'),
      });

      const content = completion.choices[0]?.message?.content || '';
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from Groq response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      const forecast: Forecast = {
        market,
        probability: analysis.probability / 100,
        confidence: analysis.confidence / 100,
        reasoning: analysis.reasoning,
        recommendation: analysis.recommendation,
        expected_value: analysis.fair_value / (market.yes_price * 100),
      };

      return forecast;
    } catch (error: any) {
      console.error('❌ Error generating forecast:', error.message);
      throw error;
    }
  }

  /**
   * Display forecast results
   */
  displayForecast(forecast: Forecast): void {
    console.log('\n' + '='.repeat(80));
    console.log(`📈 FORECAST RESULTS`);
    console.log('='.repeat(80));
    console.log(`\n🎯 Market: ${forecast.market.title}`);
    console.log(`📍 Platform: ${forecast.market.platform.toUpperCase()}`);
    console.log(`🆔 Market ID: ${forecast.market.id}`);
    console.log(`💰 Current Prices: YES ${(forecast.market.yes_price * 100).toFixed(1)}% | NO ${(forecast.market.no_price * 100).toFixed(1)}%`);
    console.log(`📊 Volume: $${forecast.market.volume?.toLocaleString() || 'N/A'}`);
    console.log(`📅 Close Date: ${forecast.market.close_date || 'N/A'}`);
    console.log(`\n🔮 AI Forecast (Groq ${process.env.AGENT_MODEL}):`);
    console.log(`   Probability (YES): ${(forecast.probability * 100).toFixed(1)}%`);
    console.log(`   Confidence: ${(forecast.confidence * 100).toFixed(1)}%`);
    console.log(`   Expected Value: ${forecast.expected_value.toFixed(2)}x`);
    console.log(`   Recommendation: ${forecast.recommendation}`);
    console.log(`\n💭 Reasoning:`);
    console.log(`   ${forecast.reasoning}`);
    console.log('\n' + '='.repeat(80));
  }

  /**
   * Run the test
   */
  async run(): Promise<void> {
    console.log('🚀 DomeAPI + Groq Test Starting...\n');
    console.log('Configuration:');
    console.log(`  - Groq Model: ${process.env.AGENT_MODEL}`);
    console.log(`  - DomeAPI Key: ${this.domeApiKey.substring(0, 8)}...`);
    console.log(`  - Temperature: ${process.env.AGENT_TEMPERATURE}`);

    try {
      // Test Kalshi
      console.log('\n' + '═'.repeat(80));
      console.log('TESTING KALSHI via DomeAPI');
      console.log('═'.repeat(80));
      
      const kalshiMarkets = await this.fetchKalshiMarkets(3);
      if (kalshiMarkets.length > 0) {
        const kalshiMarket = kalshiMarkets[0];
        const kalshiForecast = await this.generateForecast(kalshiMarket);
        this.displayForecast(kalshiForecast);
      } else {
        console.log('⚠️  No Kalshi markets available');
      }

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test Polymarket
      console.log('\n' + '═'.repeat(80));
      console.log('TESTING POLYMARKET via DomeAPI');
      console.log('═'.repeat(80));
      
      const polymarketMarkets = await this.fetchPolymarketMarkets(3);
      if (polymarketMarkets.length > 0) {
        const polymarketMarket = polymarketMarkets[0];
        const polymarketForecast = await this.generateForecast(polymarketMarket);
        this.displayForecast(polymarketForecast);
      } else {
        console.log('⚠️  No Polymarket markets available');
      }

      console.log('\n✨ Test complete!\n');
      console.log('📊 Summary:');
      console.log(`  - Kalshi markets fetched: ${kalshiMarkets.length}`);
      console.log(`  - Polymarket markets fetched: ${polymarketMarkets.length}`);
      console.log(`  - Total forecasts generated: ${kalshiMarkets.length > 0 ? 1 : 0 + polymarketMarkets.length > 0 ? 1 : 0}`);

    } catch (error: any) {
      console.error('\n❌ Test error:', error.message);
      process.exit(1);
    }
  }
}

// Run the test
if (require.main === module) {
  const tester = new DomeGroqTester();
  tester.run().catch(console.error);
}

export default DomeGroqTester;