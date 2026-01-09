import { TradeTracker } from '../src/agents/trade-tracker';
import { ProfitScorer } from '../src/agents/profit-scorer';
import axios from 'axios';

async function verifyTrades() {
  console.log('🔮 Oracle: Verifying trade outcomes...\n');

  const tracker = new TradeTracker();
  const scorer = new ProfitScorer();
  const trades = tracker.loadTrades();
  const unresolvedTrades = trades.filter(t => !t.resolved);

  console.log(`📊 Found ${unresolvedTrades.length} unresolved trades`);

  for (const trade of unresolvedTrades) {
    try {
      // Fetch current market data
      const response = await axios.get(
        `https://api.sapience.xyz/markets/${trade.marketId}`
      );

      const market = response.data;

      // Check if market is resolved
      if (market.status === 'RESOLVED') {
        const actualOutcome = market.outcome === 'YES';
        const exitPrice = actualOutcome ? 1.0 : 0.0;

        tracker.updateTradeOutcome(trade.tradeId, actualOutcome, exitPrice);
        
        console.log(`✅ ${trade.question}`);
        console.log(`   Outcome: ${actualOutcome ? 'YES' : 'NO'}`);
        console.log(`   PnL: ${trade.pnl?.toFixed(3)} USDe\n`);
      }
    } catch (error) {
      console.log(`⏳ ${trade.question} - Not yet resolved\n`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print updated stats
  const allTrades = tracker.loadTrades();
  const metrics = scorer.calculateMetrics(allTrades);
  
  console.log(`\n📈 Updated Performance:`);
  console.log(`  Total Trades: ${metrics.totalTrades}`);
  console.log(`  Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
  console.log(`  Total PnL: ${metrics.totalPnL >= 0 ? '+' : ''}${metrics.totalPnL.toFixed(2)} USDe`);
  console.log(`  Profit Score: ${metrics.score.toFixed(1)}/100\n`);
  
  tracker.exportToCSV();
  console.log('✅ Verification complete!\n');
}

verifyTrades();
