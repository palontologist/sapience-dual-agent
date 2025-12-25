/**
 * Test script to fetch markets from DomeAPI SDK and forecast with Groq
 */

import { DomeClient } from '@dome-api/sdk';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

interface Market {
  id: string;
  title: string;
  description: string;
  platform: 'kalshi' | 'polymarket';
  yes_price: number;
  no_price: number;
  volume?: number;
  close_date?: string;
  slug?: string;
}

interface Forecast {
  market: Market;
  probability: number;
  confidence: number;
  reasoning: string;
  recommendation: 'BUY_YES' | 'BUY_NO' | 'SKIP';
  expected_value: number;
}

class DomeGroqTester {
  private dome: DomeClient;
  private groq: Groq;

  constructor() {
    this.dome = new DomeClient({
      apiKey: process.env.DOME_API_KEY || '',
    });
    
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });
  }

  /**
   * Fetch markets from Polymarket via Dome SDK
   */
  async fetchPolymarketMarkets(limit: number = 5): Promise<Market[]> {
    try {
      console.log('\n📊 Fetching Polymarket markets via Dome SDK...');
      
      const response = await this.dome.polymarket.markets.getMarkets({
        limit,
      });

      // Dome SDK returns { markets: [...], pagination: {...} }
      const marketsData = (response as any).markets || response;
      const marketsArray = Array.isArray(marketsData) ? marketsData : [marketsData];
      
      const markets: Market[] = marketsArray.slice(0, limit).map((market: any) => ({
        id: market.condition_id || market.conditionId || market.id,
        title: market.title || market.question,
        description: market.description || '',
        platform: 'polymarket' as const,
        yes_price: parseFloat(market.outcome_prices?.[0] || market.outcomePrices?.[0] || '0.5'),
        no_price: parseFloat(market.outcome_prices?.[1] || market.outcomePrices?.[1] || '0.5'),
        volume: parseFloat(market.volume_total || market.volume || '0'),
        close_date: market.end_time ? new Date(market.end_time * 1000).toISOString() : (market.end_date || market.endDate),
        slug: market.market_slug || market.slug,
      }));

      console.log(`✅ Fetched ${markets.length} Polymarket markets`);
      return markets;
    } catch (error: any) {
      console.error('❌ Error fetching Polymarket markets:', error.message);
      console.error('   Details:', error.response?.data || error);
      return [];
    }
  }

  /**
   * Fetch specific Polymarket market by slug
   */
  async fetchPolymarketMarketBySlug(slug: string): Promise<Market | null> {
    try {
      console.log(`\n📊 Fetching Polymarket market: ${slug}...`);
      
      const response = await this.dome.polymarket.markets.getMarkets({
        market_slug: [slug],
        limit: 1,
      });

      console.log('Raw response:', JSON.stringify(response, null, 2));

      // Dome SDK returns { markets: [...], pagination: {...} }
      const marketsData = (response as any).markets || response;
      const marketData = Array.isArray(marketsData) ? marketsData[0] : marketsData;
      
      if (!marketData) {
        console.error('❌ No market data returned');
        return null;
      }

      const formattedMarket: Market = {
        id: marketData.condition_id || marketData.conditionId || marketData.id || 'unknown',
        title: marketData.title || marketData.question || 'Unknown market',
        description: marketData.description || '',
        platform: 'polymarket' as const,
        yes_price: parseFloat(marketData.outcome_prices?.[0] || marketData.outcomePrices?.[0] || '0.5'),
        no_price: parseFloat(marketData.outcome_prices?.[1] || marketData.outcomePrices?.[1] || '0.5'),
        volume: parseFloat(marketData.volume_total || marketData.volume || '0'),
        close_date: marketData.end_time ? new Date(marketData.end_time * 1000).toISOString() : (marketData.end_date || marketData.endDate),
        slug: marketData.market_slug || marketData.slug || slug,
      };

      console.log(`✅ Fetched market: ${formattedMarket.title}`);
      return formattedMarket;
    } catch (error: any) {
      console.error('❌ Error fetching Polymarket market:', error.message);
      console.error('   Full error:', error);
      return null;
    }
  }

  /**
   * Fetch markets from Kalshi via Dome SDK
   */
  async fetchKalshiMarkets(limit: number = 5): Promise<Market[]> {
    try {
      console.log('\n📊 Fetching Kalshi markets via Dome SDK...');
      
      const response = await this.dome.kalshi.markets.getMarkets({
        limit,
        status: 'open',
      });

      // Dome SDK returns { markets: [...], ... } similar to Polymarket
      const marketsData = (response as any).markets || response;
      const marketsArray = Array.isArray(marketsData) ? marketsData : [marketsData];
      
      const markets: Market[] = marketsArray.slice(0, limit).map((market: any) => ({
        id: market.ticker || market.id,
        title: market.title || market.question,
        description: market.subtitle || market.description || '',
        platform: 'kalshi' as const,
        yes_price: market.yes_bid ? market.yes_bid / 100 : (market.last_price ? market.last_price / 100 : 0.5),
        no_price: market.no_bid ? market.no_bid / 100 : (market.last_price ? (100 - market.last_price) / 100 : 0.5),
        volume: market.volume,
        close_date: market.close_time || market.end_date,
      }));

      console.log(`✅ Fetched ${markets.length} Kalshi markets`);
      return markets;
    } catch (error: any) {
      console.error('❌ Error fetching Kalshi markets:', error.message);
      console.error('   Details:', error.response?.data || error);
      return [];
    }
  }

  /**
   * Generate forecast using Groq with Moonshot AI model
   */
  async generateForecast(market: Market): Promise<Forecast> {
    console.log(`\n🤖 Generating forecast for: ${market.title}`);

    // Validate market data
    if (!market.title || market.title === 'Unknown market' || market.title === 'undefined') {
      throw new Error('Invalid market data - title is missing');
    }

    const systemContext = `You are an expert prediction market analyst who uses statistical methods and market microstructure analysis to forecast outcomes. You understand order-book dynamics, calibration curves, and risk management principles.`;

    const userPrompt = `Analyze this prediction market and provide a statistical forecast:

Market Information:
- Question: "${market.title}"
- Description: ${market.description}
- Platform: ${market.platform.toUpperCase()}
- Current YES Price: ${(market.yes_price * 100).toFixed(1)}%
- Current NO Price: ${(market.no_price * 100).toFixed(1)}%
- Volume: $${market.volume?.toLocaleString() || 'N/A'}
- Close Date: ${market.close_date || 'N/A'}

Using your statistical forecasting methodology, analyze if the market is efficiently priced or if there's an edge. Provide your analysis in JSON format:
{
  "probability": <number 0-100>,
  "confidence": <number 0-100>,
  "reasoning": "<detailed reasoning using market microstructure, historical patterns, and statistical analysis>",
  "fair_value": <number 0-100>,
  "edge": <number>,
  "recommendation": "BUY_YES" or "BUY_NO" or "SKIP"
}

Rules:
- probability: Your calibrated probability estimate for YES outcome (0-100)
- confidence: How confident you are in your estimate (0-100)
- fair_value: What you think the fair market price should be (0-100)
- edge: Difference between fair_value and current market price in percentage points
- recommendation: BUY_YES if edge > 5% favoring yes, BUY_NO if edge > 5% favoring no, SKIP if fairly priced
- Only recommend BUY if |edge| > 5% and confidence > 65%
- Apply market microstructure analysis: consider spread, volume, and price efficiency`;

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
            content: "I can show you how to turn raw prediction-market data into statistically-driven forecasts. I use market microstructure analysis (order-book snapshots, bid-ask spreads, order-flow imbalance), calibrated probabilistic models, and proper risk management to detect when market prices drift from the best statistical estimate of underlying events. This approach systematically identifies edges while accounting for fees, spreads, and capital costs."
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
    if (forecast.market.slug) console.log(`🔗 Slug: ${forecast.market.slug}`);
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
    console.log('🚀 Dome SDK + Groq Test Starting...\n');
    console.log('Configuration:');
    console.log(`  - Groq Model: ${process.env.AGENT_MODEL}`);
    console.log(`  - Dome API Key: ${process.env.DOME_API_KEY?.substring(0, 8)}...`);
    console.log(`  - Temperature: ${process.env.AGENT_TEMPERATURE}`);

    try {
      // Test specific Polymarket market
      console.log('\n' + '═'.repeat(80));
      console.log('TESTING SPECIFIC POLYMARKET MARKET');
      console.log('═'.repeat(80));
      
      const specificMarket = await this.fetchPolymarketMarketBySlug(
        'will-gavin-newsom-win-the-2028-us-presidential-election'
      );
      
      if (specificMarket && specificMarket.title && specificMarket.title !== 'Unknown market') {
        try {
          const specificForecast = await this.generateForecast(specificMarket);
          this.displayForecast(specificForecast);
        } catch (error: any) {
          console.error('⚠️  Failed to generate forecast:', error.message);
          if (error.message.includes('403')) {
            console.log('\n💡 Tip: Groq 403 error may be due to:');
            console.log('   - VPN/proxy blocking the request');
            console.log('   - Firewall restrictions');
            console.log('   - Invalid API key');
            console.log('   - Network configuration issues');
            console.log('\n   Try: Turn off VPN, check firewall, or verify API key\n');
          }
        }
      } else {
        console.log('⚠️  Could not fetch specific market or invalid market data');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test Polymarket markets list
      console.log('\n' + '═'.repeat(80));
      console.log('TESTING POLYMARKET (Dome SDK)');
      console.log('═'.repeat(80));
      
      const polymarketMarkets = await this.fetchPolymarketMarkets(3);
      if (polymarketMarkets.length > 0) {
        const polymarketMarket = polymarketMarkets[0];
        try {
          const polymarketForecast = await this.generateForecast(polymarketMarket);
          this.displayForecast(polymarketForecast);
        } catch (error: any) {
          console.error('⚠️  Failed to generate forecast:', error.message);
        }
      } else {
        console.log('⚠️  No Polymarket markets available');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test Kalshi
      console.log('\n' + '═'.repeat(80));
      console.log('TESTING KALSHI (Dome SDK)');
      console.log('═'.repeat(80));
      
      const kalshiMarkets = await this.fetchKalshiMarkets(3);
      if (kalshiMarkets.length > 0) {
        const kalshiMarket = kalshiMarkets[0];
        try {
          const kalshiForecast = await this.generateForecast(kalshiMarket);
          this.displayForecast(kalshiForecast);
        } catch (error: any) {
          console.error('⚠️  Failed to generate forecast:', error.message);
        }
      } else {
        console.log('⚠️  No Kalshi markets available');
      }

      console.log('\n✨ Test complete!\n');
      console.log('📊 Summary:');
      console.log(`  - Polymarket markets fetched: ${polymarketMarkets.length}`);
      console.log(`  - Kalshi markets fetched: ${kalshiMarkets.length}`);

    } catch (error: any) {
      console.error('\n❌ Test error:', error.message);
      if (!error.message.includes('403')) {
        console.error(error.stack);
      }
    }
  }
}

// Run the test
if (require.main === module) {
  const tester = new DomeGroqTester();
  tester.run().catch(console.error);
}

export default DomeGroqTester;