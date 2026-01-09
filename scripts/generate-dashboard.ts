import { TradeTracker } from '../src/agents/trade-tracker';
import { ProfitScorer } from '../src/agents/profit-scorer';
import fs from 'fs';
import path from 'path';

interface MarketStats {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  bestTrade: number;
  worstTrade: number;
}

async function generateDashboard() {
  console.log('📊 Generating Trading Performance Dashboard\n');

  const tracker = new TradeTracker('./trade-results/ethereal');
  const scorer = new ProfitScorer();
  const trades = tracker.loadTrades();

  if (trades.length === 0) {
    console.log('❌ No trades found. Run dry-run first: pnpm test:ethereal:dry-run\n');
    return;
  }

  const metrics = scorer.calculateMetrics(trades);

  // Generate detailed market breakdown
  const marketStats = new Map<string, MarketStats>();
  
  trades.forEach(trade => {
    const symbol = trade.marketId;
    const stats = marketStats.get(symbol) || {
      symbol,
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnL: 0,
      avgPnL: 0,
      bestTrade: -Infinity,
      worstTrade: Infinity,
    };

    stats.trades++;
    if ((trade.pnl || 0) > 0) stats.wins++;
    else stats.losses++;
    stats.totalPnL += trade.pnl || 0;
    stats.bestTrade = Math.max(stats.bestTrade, trade.pnl || 0);
    stats.worstTrade = Math.min(stats.worstTrade, trade.pnl || 0);

    marketStats.set(symbol, stats);
  });

  // Calculate averages
  marketStats.forEach(stats => {
    stats.winRate = (stats.wins / stats.trades) * 100;
    stats.avgPnL = stats.totalPnL / stats.trades;
  });

  // Generate HTML dashboard
  const html = generateHTML(metrics, trades, marketStats);
  const outputPath = path.join('./trade-results/ethereal', 'dashboard.html');
  fs.writeFileSync(outputPath, html);

  console.log('✅ Dashboard generated!\n');
  console.log(`📂 Open: ${outputPath}\n`);
  console.log('📊 Summary:');
  console.log(`   Total Trades: ${metrics.totalTrades}`);
  console.log(`   Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
  console.log(`   Profit Score: ${metrics.score.toFixed(1)}/100`);
  console.log(`   Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}\n`);
}

function generateHTML(metrics: any, trades: any[], marketStats: Map<string, MarketStats>): string {
  const marketRows = Array.from(marketStats.values())
    .sort((a, b) => b.totalPnL - a.totalPnL)
    .map(stats => `
      <tr>
        <td>${stats.symbol}</td>
        <td>${stats.trades}</td>
        <td class="${stats.wins > 0 ? 'positive' : ''}">${stats.wins}</td>
        <td class="${stats.losses > 0 ? 'negative' : ''}">${stats.losses}</td>
        <td>${stats.winRate.toFixed(1)}%</td>
        <td class="${stats.totalPnL >= 0 ? 'positive' : 'negative'}">${(stats.totalPnL * 100).toFixed(2)}%</td>
        <td>${(stats.avgPnL * 100).toFixed(2)}%</td>
        <td class="positive">${(stats.bestTrade * 100).toFixed(2)}%</td>
        <td class="negative">${(stats.worstTrade * 100).toFixed(2)}%</td>
      </tr>
    `).join('');

  const recentTrades = trades
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)
    .map(trade => `
      <tr>
        <td>${new Date(trade.timestamp).toLocaleString()}</td>
        <td>${trade.marketId}</td>
        <td class="${trade.action === 'buy' ? 'positive' : 'negative'}">${trade.action.toUpperCase()}</td>
        <td>$${trade.entryPrice.toLocaleString()}</td>
        <td>$${trade.exitPrice?.toLocaleString() || 'N/A'}</td>
        <td class="${(trade.pnl || 0) >= 0 ? 'positive' : 'negative'}">${((trade.pnl || 0) * 100).toFixed(2)}%</td>
        <td>${(trade.confidence * 100).toFixed(0)}%</td>
      </tr>
    `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ethereal Trading Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #333;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: white;
      padding: 30px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      margin-bottom: 20px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .score {
      font-size: 4em;
      font-weight: bold;
      color: #667eea;
      margin: 20px 0;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .metric-card h3 {
      color: #666;
      font-size: 0.9em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .metric-card .value {
      font-size: 2em;
      font-weight: bold;
      color: #333;
    }
    .metric-card .value.positive { color: #10b981; }
    .metric-card .value.negative { color: #ef4444; }
    .section {
      background: white;
      padding: 30px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      margin-bottom: 20px;
    }
    .section h2 {
      margin-bottom: 20px;
      color: #667eea;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      font-size: 0.85em;
    }
    tr:hover { background: #f8f9fa; }
    .positive { color: #10b981; font-weight: 600; }
    .negative { color: #ef4444; font-weight: 600; }
    .grade {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: bold;
      margin-top: 10px;
    }
    .grade-excellent { background: #10b981; color: white; }
    .grade-good { background: #3b82f6; color: white; }
    .grade-fair { background: #f59e0b; color: white; }
    .grade-poor { background: #ef4444; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔮 Ethereal Trading Dashboard</h1>
      <div class="score">${metrics.score.toFixed(1)}/100</div>
      <div class="grade ${getGradeClass(metrics.score)}">
        ${getGradeText(metrics.score)}
      </div>
      <p style="margin-top: 10px; color: #666;">Generated: ${new Date().toLocaleString()}</p>
    </div>

    <div class="metrics">
      <div class="metric-card">
        <h3>Total Trades</h3>
        <div class="value">${metrics.totalTrades}</div>
      </div>
      <div class="metric-card">
        <h3>Win Rate</h3>
        <div class="value positive">${(metrics.winRate * 100).toFixed(1)}%</div>
      </div>
      <div class="metric-card">
        <h3>Profit Factor</h3>
        <div class="value ${metrics.profitFactor >= 1.5 ? 'positive' : 'negative'}">
          ${metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
        </div>
      </div>
      <div class="metric-card">
        <h3>Sharpe Ratio</h3>
        <div class="value ${metrics.sharpeRatio >= 1 ? 'positive' : 'negative'}">
          ${metrics.sharpeRatio.toFixed(2)}
        </div>
      </div>
      <div class="metric-card">
        <h3>Total PnL</h3>
        <div class="value ${metrics.totalPnL >= 0 ? 'positive' : 'negative'}">
          ${(metrics.totalPnL * 100).toFixed(2)}%
        </div>
      </div>
      <div class="metric-card">
        <h3>Avg PnL</h3>
        <div class="value ${metrics.avgPnL >= 0 ? 'positive' : 'negative'}">
          ${(metrics.avgPnL * 100).toFixed(2)}%
        </div>
      </div>
      <div class="metric-card">
        <h3>Max Drawdown</h3>
        <div class="value negative">${(metrics.maxDrawdown * 100).toFixed(2)}%</div>
      </div>
      <div class="metric-card">
        <h3>Winning Trades</h3>
        <div class="value positive">${metrics.winningTrades}</div>
      </div>
    </div>

    <div class="section">
      <h2>📊 Performance by Market</h2>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Trades</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Win Rate</th>
            <th>Total PnL</th>
            <th>Avg PnL</th>
            <th>Best</th>
            <th>Worst</th>
          </tr>
        </thead>
        <tbody>${marketRows}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>📋 Recent Trades</h2>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Market</th>
            <th>Action</th>
            <th>Entry</th>
            <th>Exit</th>
            <th>PnL</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>${recentTrades}</tbody>
      </table>
    </div>
  </div>
</body>
</html>
`;
}

function getGradeClass(score: number): string {
  if (score >= 80) return 'grade-excellent';
  if (score >= 60) return 'grade-good';
  if (score >= 40) return 'grade-fair';
  return 'grade-poor';
}

function getGradeText(score: number): string {
  if (score >= 80) return '🏆 Excellent - Strong Profitability';
  if (score >= 60) return '🥇 Good - Profitable Performance';
  if (score >= 40) return '🥈 Fair - Room for Improvement';
  return '🥉 Poor - Needs Optimization';
}

generateDashboard();
