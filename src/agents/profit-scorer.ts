import { TradeResult } from './trade-tracker';

export interface ProfitMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  score: number; // 0-100
}

export class ProfitScorer {
  /**
   * Calculate comprehensive profit metrics
   */
  calculateMetrics(trades: TradeResult[]): ProfitMetrics {
    const resolvedTrades = trades.filter(t => t.resolved);
    
    if (resolvedTrades.length === 0) {
      return this.getEmptyMetrics();
    }

    const winningTrades = resolvedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = resolvedTrades.filter(t => (t.pnl || 0) < 0);
    
    const totalPnL = resolvedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgPnL = totalPnL / resolvedTrades.length;
    
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
    
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    
    const sharpeRatio = this.calculateSharpe(resolvedTrades);
    const maxDrawdown = this.calculateMaxDrawdown(resolvedTrades);
    
    const score = this.calculateScore({
      winRate: winningTrades.length / resolvedTrades.length,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      totalPnL,
    });

    return {
      totalTrades: resolvedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: winningTrades.length / resolvedTrades.length,
      totalPnL,
      avgPnL,
      avgWin,
      avgLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      score,
    };
  }

  /**
   * Calculate Sharpe Ratio (risk-adjusted returns)
   */
  private calculateSharpe(trades: TradeResult[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => t.pnl || 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    // Annualized Sharpe (assuming daily trades)
    return (avgReturn / stdDev) * Math.sqrt(365);
  }

  /**
   * Calculate Maximum Drawdown
   */
  private calculateMaxDrawdown(trades: TradeResult[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      runningPnL += trade.pnl || 0;
      
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate overall profitability score (0-100)
   */
  private calculateScore(metrics: {
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalPnL: number;
  }): number {
    // Win Rate: 0-30 points
    const winRateScore = Math.min(metrics.winRate * 50, 30);
    
    // Profit Factor: 0-25 points
    const pfScore = Math.min((metrics.profitFactor / 3) * 25, 25);
    
    // Sharpe Ratio: 0-25 points
    const sharpeScore = Math.min((Math.max(metrics.sharpeRatio, 0) / 2) * 25, 25);
    
    // Max Drawdown penalty: 0-20 points (lower is better)
    const drawdownScore = Math.max(20 - (metrics.maxDrawdown * 2), 0);
    
    // Total PnL bonus: 0-10 points
    const pnlScore = Math.min((Math.max(metrics.totalPnL, 0) / 10) * 10, 10);
    
    return Math.min(winRateScore + pfScore + sharpeScore + drawdownScore + pnlScore, 100);
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): ProfitMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      avgPnL: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      score: 0,
    };
  }

  /**
   * Print detailed profit report
   */
  printReport(metrics: ProfitMetrics): void {
    console.log('\n' + '='.repeat(60));
    console.log('💰 PROFIT SCORING REPORT');
    console.log('='.repeat(60));
    
    console.log('\n📊 Trade Statistics:');
    console.log(`  Total Trades: ${metrics.totalTrades}`);
    console.log(`  Winning: ${metrics.winningTrades} | Losing: ${metrics.losingTrades}`);
    console.log(`  Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
    
    console.log('\n💵 P&L Analysis:');
    console.log(`  Total PnL: ${metrics.totalPnL >= 0 ? '+' : ''}${metrics.totalPnL.toFixed(2)} USDe`);
    console.log(`  Average PnL: ${metrics.avgPnL >= 0 ? '+' : ''}${metrics.avgPnL.toFixed(3)} USDe`);
    console.log(`  Average Win: +${metrics.avgWin.toFixed(3)} USDe`);
    console.log(`  Average Loss: -${metrics.avgLoss.toFixed(3)} USDe`);
    
    console.log('\n📈 Performance Metrics:');
    console.log(`  Profit Factor: ${metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}`);
    console.log(`  Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown: ${metrics.maxDrawdown.toFixed(2)} USDe`);
    
    console.log('\n⭐ Overall Score:');
    const scoreEmoji = metrics.score >= 80 ? '🏆' : metrics.score >= 60 ? '🥇' : metrics.score >= 40 ? '🥈' : '🥉';
    console.log(`  ${scoreEmoji} ${metrics.score.toFixed(1)}/100`);
    
    if (metrics.score >= 80) {
      console.log('  Grade: Excellent - Strong profitability');
    } else if (metrics.score >= 60) {
      console.log('  Grade: Good - Profitable with room for improvement');
    } else if (metrics.score >= 40) {
      console.log('  Grade: Fair - Break-even to slightly profitable');
    } else {
      console.log('  Grade: Poor - Needs optimization');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
}
