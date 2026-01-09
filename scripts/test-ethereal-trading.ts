import { EtherealClient } from '../src/clients/ethereal-client';
import { TradeTracker } from '../src/agents/trade-tracker';
import { ProfitScorer } from '../src/agents/profit-scorer';
import dotenv from 'dotenv';

dotenv.config();

async function testEtherealTrading() {
  console.log('🔮 Testing Ethereal Markets\n');

  const ethereal = new EtherealClient();
  const tracker = new TradeTracker('./trade-results/ethereal');
  const scorer = new ProfitScorer();

  try {
    // Fetch all markets
    console.log('📊 Fetching Ethereal markets...\n');
    const markets = await ethereal.getMarkets();

    console.log(`Found ${markets.length} markets:\n`);

    // Display markets with analysis
    for (const market of markets) {
      const liquidityScore = ethereal.calculateLiquidityScore(market);
      const priceChangeEmoji = market.priceChangePercent24h >= 0 ? '📈' : '📉';
      
      console.log(`${priceChangeEmoji} ${market.symbol}`);
      console.log(`   Price: $${market.lastPrice.toLocaleString()}`);
      console.log(`   24h Change: ${market.priceChangePercent24h >= 0 ? '+' : ''}${market.priceChangePercent24h.toFixed(2)}%`);
      console.log(`   Volume: $${(market.volume24h / 1000000).toFixed(2)}M`);
      console.log(`   Leverage: ${market.leverage}x`);
      console.log(`   Funding Rate: ${(market.fundingRate * 100).toFixed(4)}%`);
      console.log(`   Liquidity Score: ${liquidityScore.toFixed(1)}/100`);
      
      // Simulated trading signal
      const signal = analyzeMarket(market);
      console.log(`   Signal: ${signal.action} (${signal.confidence.toFixed(0)}% confidence)`);
      console.log(`   Reasoning: ${signal.reasoning}\n`);
    }

    // Filter for BTC-USD as requested
    console.log('\n🎯 Detailed Analysis: BTC-USD\n');
    const btcMarket = markets.find(m => m.symbol === 'BTC-USD');
    
    if (btcMarket) {
      const signal = analyzeMarket(btcMarket);
      const liquidityScore = ethereal.calculateLiquidityScore(btcMarket);

      console.log('Market Overview:');
      console.log(`  Current Price: $${btcMarket.lastPrice.toLocaleString()}`);
      console.log(`  24h Change: ${btcMarket.priceChangePercent24h.toFixed(2)}%`);
      console.log(`  24h Volume: $${(btcMarket.volume24h / 1000000).toFixed(2)}M`);
      console.log(`  Open Interest: $${(btcMarket.openInterest / 1000000).toFixed(2)}M`);
      console.log(`  Funding Rate: ${(btcMarket.fundingRate * 100).toFixed(4)}%`);
      console.log(`  Max Leverage: ${btcMarket.leverage}x`);
      console.log(`  Liquidity Score: ${liquidityScore.toFixed(1)}/100\n`);

      console.log('Trading Signal:');
      console.log(`  Action: ${signal.action}`);
      console.log(`  Confidence: ${signal.confidence.toFixed(1)}%`);
      console.log(`  Position Size: ${signal.size.toFixed(2)}%`);
      console.log(`  Entry: $${btcMarket.lastPrice.toLocaleString()}`);
      console.log(`  Stop Loss: $${signal.stopLoss?.toLocaleString() || 'N/A'}`);
      console.log(`  Take Profit: $${signal.takeProfit?.toLocaleString() || 'N/A'}`);
      console.log(`  Risk/Reward: ${signal.riskReward.toFixed(2)}\n`);
      console.log(`  Reasoning: ${signal.reasoning}\n`);
    }

    // Show profit scoring for historical trades
    console.log('📊 Historical Performance Analysis\n');
    const trades = tracker.loadTrades();
    const metrics = scorer.calculateMetrics(trades);
    scorer.printReport(metrics);

    // Market Rankings
    console.log('\n🏆 Top Markets by Liquidity:\n');
    const rankedMarkets = markets
      .map(m => ({
        symbol: m.symbol,
        score: ethereal.calculateLiquidityScore(m),
        volume: m.volume24h,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    rankedMarkets.forEach((m, idx) => {
      console.log(`  ${idx + 1}. ${m.symbol.padEnd(12)} Score: ${m.score.toFixed(1)}/100  Vol: $${(m.volume / 1000000).toFixed(2)}M`);
    });

    console.log('\n✅ Test completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

/**
 * Analyze market and generate trading signal
 */
function analyzeMarket(market: any): {
  action: 'LONG' | 'SHORT' | 'HOLD';
  confidence: number;
  size: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number;
  reasoning: string;
} {
  const priceChange = market.priceChangePercent24h;
  const fundingRate = market.fundingRate * 100;
  const volume = market.volume24h;

  // Simple momentum + funding rate strategy
  let action: 'LONG' | 'SHORT' | 'HOLD' = 'HOLD';
  let confidence = 50;
  let reasoning = '';

  if (priceChange > 2 && fundingRate < 0.01) {
    action = 'LONG';
    confidence = 70 + Math.min(priceChange * 5, 20);
    reasoning = 'Strong upward momentum with low funding rate suggests bullish continuation';
  } else if (priceChange < -2 && fundingRate > 0.02) {
    action = 'SHORT';
    confidence = 70 + Math.min(Math.abs(priceChange) * 5, 20);
    reasoning = 'Downward momentum with high funding rate suggests bearish pressure';
  } else if (Math.abs(priceChange) < 0.5) {
    action = 'HOLD';
    confidence = 60;
    reasoning = 'Low volatility and no clear directional bias - wait for better setup';
  } else {
    action = 'HOLD';
    confidence = 55;
    reasoning = 'Mixed signals - need clearer price action';
  }

  // Position sizing based on confidence
  const size = (confidence / 100) * 5; // Max 5% of capital

  // Stop loss and take profit (2% and 6% respectively)
  const stopLoss = action === 'LONG' 
    ? market.lastPrice * 0.98 
    : action === 'SHORT' 
    ? market.lastPrice * 1.02 
    : null;

  const takeProfit = action === 'LONG'
    ? market.lastPrice * 1.06
    : action === 'SHORT'
    ? market.lastPrice * 0.94
    : null;

  const riskReward = 3.0; // 6% profit / 2% stop = 3:1

  return {
    action,
    confidence,
    size,
    stopLoss,
    takeProfit,
    riskReward,
    reasoning,
  };
}

testEtherealTrading();
