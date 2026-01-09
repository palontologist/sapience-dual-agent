import fs from 'fs';
import path from 'path';

export interface TradeResult {
  tradeId: string;
  marketId: string;
  question: string;
  action: 'buy' | 'sell' | 'skip';
  entryPrice: number;
  size: number;
  confidence: number;
  expectedReturn: number;
  riskScore: number;
  timestamp: number;
  reasoning: string;
  
  // Oracle data for outcome verification
  actualOutcome?: boolean;
  exitPrice?: number;
  pnl?: number;
  resolved?: boolean;
  resolutionDate?: number;
}

export class TradeTracker {
  private resultsDir: string;
  private resultsFile: string;

  constructor(resultsDir: string = './trade-results') {
    this.resultsDir = resultsDir;
    this.resultsFile = path.join(resultsDir, 'trades.json');
    this.ensureResultsDir();
  }

  private ensureResultsDir(): void {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Save a trade result
   */
  saveTrade(trade: TradeResult): void {
    const trades = this.loadTrades();
    trades.push(trade);
    fs.writeFileSync(this.resultsFile, JSON.stringify(trades, null, 2));
    console.log(`💾 Trade saved: ${trade.tradeId}`);
  }

  /**
   * Load all trades
   */
  loadTrades(): TradeResult[] {
    if (!fs.existsSync(this.resultsFile)) {
      return [];
    }
    const data = fs.readFileSync(this.resultsFile, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Update trade with actual outcome (for oracle)
   */
  updateTradeOutcome(
    tradeId: string,
    actualOutcome: boolean,
    exitPrice: number
  ): void {
    const trades = this.loadTrades();
    const trade = trades.find(t => t.tradeId === tradeId);
    
    if (trade) {
      trade.actualOutcome = actualOutcome;
      trade.exitPrice = exitPrice;
      trade.resolved = true;
      trade.resolutionDate = Date.now();
      
      // Calculate PnL
      if (trade.action === 'buy') {
        trade.pnl = actualOutcome ? (1 - trade.entryPrice) : -trade.entryPrice;
      } else if (trade.action === 'sell') {
        trade.pnl = actualOutcome ? -trade.entryPrice : (1 - trade.entryPrice);
      }
      
      fs.writeFileSync(this.resultsFile, JSON.stringify(trades, null, 2));
      console.log(`✅ Trade outcome updated: ${tradeId}`);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    totalTrades: number;
    resolvedTrades: number;
    winRate: number;
    avgPnL: number;
    totalPnL: number;
    avgConfidence: number;
  } {
    const trades = this.loadTrades();
    const resolvedTrades = trades.filter(t => t.resolved);
    
    const wins = resolvedTrades.filter(t => (t.pnl || 0) > 0).length;
    const totalPnL = resolvedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgConfidence = trades.length > 0 
      ? trades.reduce((sum, t) => sum + t.confidence, 0) / trades.length 
      : 0;
    
    return {
      totalTrades: trades.length,
      resolvedTrades: resolvedTrades.length,
      winRate: resolvedTrades.length > 0 ? wins / resolvedTrades.length : 0,
      avgPnL: resolvedTrades.length > 0 ? totalPnL / resolvedTrades.length : 0,
      totalPnL,
      avgConfidence,
    };
  }

  /**
   * Export trades to CSV for analysis
   */
  exportToCSV(outputPath?: string): void {
    const trades = this.loadTrades();
    const csvPath = outputPath || path.join(this.resultsDir, 'trades.csv');
    
    const headers = [
      'tradeId', 'marketId', 'question', 'action', 'entryPrice', 'size',
      'confidence', 'expectedReturn', 'riskScore', 'timestamp', 'resolved',
      'actualOutcome', 'exitPrice', 'pnl'
    ];
    
    const rows = trades.map(t => [
      t.tradeId, t.marketId, `"${t.question}"`, t.action, t.entryPrice, t.size,
      t.confidence, t.expectedReturn, t.riskScore, t.timestamp, t.resolved || false,
      t.actualOutcome || '', t.exitPrice || '', t.pnl || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    fs.writeFileSync(csvPath, csv);
    console.log(`📊 Trades exported to: ${csvPath}`);
  }
}
