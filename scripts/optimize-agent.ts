import { EtherealClient, EtherealMarket } from '../src/clients/ethereal-client';
import { TradeTracker, TradeResult } from '../src/agents/trade-tracker';
import { ProfitScorer } from '../src/agents/profit-scorer';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

interface OptimizationConfig {
  confidenceThreshold: number;
  riskThreshold: number;
  holdTimeMinutes: number;
  takeProfitPercent: number;
  stopLossPercent: number;
}

interface OptimizationResult {
  config: OptimizationConfig;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalPnL: number;
  score: number;
}

/**
 * Advanced trade outcome simulation with hold time optimization
 */
function simulateTradeWithTiming(
  market: EtherealMarket,
  action: 'LONG' | 'SHORT',
  entryPrice: number,
  holdTimeMinutes: number,
  takeProfitPercent: number,
  stopLossPercent: number
): {
  exitPrice: number;
  pnl: number;
  outcome: boolean;
  exitReason: 'take-profit' | 'stop-loss' | 'hold-complete';
  holdTime: number;
} {
  const volatility = Math.abs(market.priceChangePercent24h) / (24 * 60); // per minute
  const momentum = market.priceChangePercent24h / (24 * 60); // per minute
  
  let currentPrice = entryPrice;
  let exitPrice = entryPrice;
  let exitReason: 'take-profit' | 'stop-loss' | 'hold-complete' = 'hold-complete';
  let actualHoldTime = holdTimeMinutes;

  // Simulate price movement minute by minute
  for (let minute = 0; minute < holdTimeMinutes; minute++) {
    // Random walk with momentum bias
    const randomMove = (Math.random() - 0.5) * volatility * 3;
    const priceChange = (momentum * 0.4 + randomMove);
    currentPrice = currentPrice * (1 + priceChange / 100);

    // Check take profit
    if (action === 'LONG') {
      const gain = (currentPrice - entryPrice) / entryPrice * 100;
      if (gain >= takeProfitPercent) {
        exitPrice = currentPrice;
        exitReason = 'take-profit';
        actualHoldTime = minute + 1;
        break;
      }
      if (gain <= -stopLossPercent) {
        exitPrice = currentPrice;
        exitReason = 'stop-loss';
        actualHoldTime = minute + 1;
        break;
      }
    } else if (action === 'SHORT') {
      const gain = (entryPrice - currentPrice) / entryPrice * 100;
      if (gain >= takeProfitPercent) {
        exitPrice = currentPrice;
        exitReason = 'take-profit';
        actualHoldTime = minute + 1;
        break;
      }
      if (gain <= -stopLossPercent) {
        exitPrice = currentPrice;
        exitReason = 'stop-loss';
        actualHoldTime = minute + 1;
        break;
      }
    }
  }

  if (exitReason === 'hold-complete') {
    exitPrice = currentPrice;
  }

  let pnl = 0;
  if (action === 'LONG') {
    pnl = (exitPrice - entryPrice) / entryPrice;
  } else if (action === 'SHORT') {
    pnl = (entryPrice - exitPrice) / entryPrice;
  }

  return {
    exitPrice,
    pnl,
    outcome: pnl > 0,
    exitReason,
    holdTime: actualHoldTime,
  };
}

/**
 * Analyze market with AI (existing function)
 */
async function analyzeMarketWithAI(market: EtherealMarket, groq: Groq): Promise<any> {
  // ...use existing implementation from test-ethereal-dry-run.ts
  const prompt = `Analyze this perpetual futures market and provide a trading recommendation:

Market: ${market.symbol}
Current Price: $${market.lastPrice}
24h Change: ${market.priceChangePercent24h.toFixed(2)}%
24h Volume: $${(market.volume24h / 1000000).toFixed(2)}M
Open Interest: $${(market.openInterest / 1000000).toFixed(2)}M
Funding Rate: ${(market.fundingRate * 100).toFixed(4)}%

Provide a JSON response with:
{
  "action": "LONG" | "SHORT" | "HOLD",
  "confidence": 0-100,
  "reasoning": "analysis",
  "expectedReturn": 1.0-3.0,
  "riskScore": 0-100
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are an expert crypto trader. Be concise." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || "{}";
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    
    return {
      action: analysis.action || 'HOLD',
      confidence: analysis.confidence || 50,
      reasoning: analysis.reasoning || 'No signal',
      expectedReturn: analysis.expectedReturn || 1.0,
      riskScore: analysis.riskScore || 50,
    };
  } catch (error) {
    return { action: 'HOLD', confidence: 50, reasoning: 'Error', expectedReturn: 1.0, riskScore: 50 };
  }
}

/**
 * Test a specific configuration
 */
async function testConfiguration(
  config: OptimizationConfig,
  markets: EtherealMarket[],
  groq: Groq,
  sessionsToTest: number = 2
): Promise<OptimizationResult> {
  const tempTracker = new TradeTracker(`./trade-results/optimization/temp-${Date.now()}`);
  let totalTrades = 0;

  for (let session = 0; session < sessionsToTest; session++) {
    for (const market of markets) {
      if (totalTrades >= 10) break; // Limit for faster testing

      const analysis = await analyzeMarketWithAI(market, groq);

      if (
        analysis.action !== 'HOLD' &&
        analysis.confidence >= config.confidenceThreshold &&
        analysis.riskScore < config.riskThreshold
      ) {
        const outcome = simulateTradeWithTiming(
          market,
          analysis.action,
          market.lastPrice,
          config.holdTimeMinutes,
          config.takeProfitPercent,
          config.stopLossPercent
        );

        const trade: TradeResult = {
          tradeId: `${market.symbol}-${Date.now()}-${totalTrades}`,
          marketId: market.symbol,
          question: `${market.symbol} ${analysis.action}`,
          action: analysis.action === 'LONG' ? 'buy' : 'sell',
          entryPrice: market.lastPrice,
          size: 0.1,
          confidence: analysis.confidence / 100,
          expectedReturn: analysis.expectedReturn,
          riskScore: analysis.riskScore / 100,
          timestamp: Date.now(),
          reasoning: `${analysis.reasoning} | Exit: ${outcome.exitReason}`,
          actualOutcome: outcome.outcome,
          exitPrice: outcome.exitPrice,
          pnl: outcome.pnl,
          resolved: true,
          resolutionDate: Date.now(),
        };

        tempTracker.saveTrade(trade);
        totalTrades++;
      }

      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
    }
  }

  const scorer = new ProfitScorer();
  const trades = tempTracker.loadTrades();
  const metrics = scorer.calculateMetrics(trades);

  return {
    config,
    totalTrades: metrics.totalTrades,
    winRate: metrics.winRate,
    profitFactor: metrics.profitFactor === Infinity ? 99 : metrics.profitFactor,
    sharpeRatio: metrics.sharpeRatio,
    totalPnL: metrics.totalPnL,
    score: metrics.score,
  };
}

/**
 * Main optimization function
 */
async function optimizeAgent() {
  console.log('🔧 Agent Optimization Suite\n');
  console.log('Testing different configurations to maximize profit...\n');

  if (!process.env.GROQ_API_KEY) {
    throw new Error('❌ GROQ_API_KEY required');
  }

  const ethereal = new EtherealClient();
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const markets = await ethereal.getMarkets();

  console.log(`📊 Using ${markets.length} markets for testing\n`);

  // Define parameter grid to test
  const configurations: OptimizationConfig[] = [
    // Conservative
    { confidenceThreshold: 70, riskThreshold: 50, holdTimeMinutes: 60, takeProfitPercent: 2, stopLossPercent: 1 },
    { confidenceThreshold: 70, riskThreshold: 50, holdTimeMinutes: 120, takeProfitPercent: 3, stopLossPercent: 1.5 },
    
    // Balanced
    { confidenceThreshold: 65, riskThreshold: 60, holdTimeMinutes: 60, takeProfitPercent: 2.5, stopLossPercent: 1.5 },
    { confidenceThreshold: 65, riskThreshold: 60, holdTimeMinutes: 90, takeProfitPercent: 3, stopLossPercent: 2 },
    { confidenceThreshold: 60, riskThreshold: 65, holdTimeMinutes: 120, takeProfitPercent: 4, stopLossPercent: 2 },
    
    // Aggressive
    { confidenceThreshold: 60, riskThreshold: 65, holdTimeMinutes: 30, takeProfitPercent: 1.5, stopLossPercent: 1 },
    { confidenceThreshold: 55, riskThreshold: 70, holdTimeMinutes: 60, takeProfitPercent: 2, stopLossPercent: 1.5 },
    { confidenceThreshold: 55, riskThreshold: 70, holdTimeMinutes: 180, takeProfitPercent: 5, stopLossPercent: 3 },
  ];

  const results: OptimizationResult[] = [];

  for (let i = 0; i < configurations.length; i++) {
    const config = configurations[i];
    console.log(`\n🧪 Testing Configuration ${i + 1}/${configurations.length}`);
    console.log(`   Confidence: ≥${config.confidenceThreshold}% | Risk: <${config.riskThreshold}`);
    console.log(`   Hold Time: ${config.holdTimeMinutes}min | TP: ${config.takeProfitPercent}% | SL: ${config.stopLossPercent}%`);

    const result = await testConfiguration(config, markets, groq, 2);
    results.push(result);

    console.log(`   📊 Results: ${result.totalTrades} trades | ${(result.winRate * 100).toFixed(1)}% WR | Score: ${result.score.toFixed(1)}/100`);
  }

  // Find best configuration
  console.log('\n\n' + '='.repeat(80));
  console.log('🏆 OPTIMIZATION RESULTS');
  console.log('='.repeat(80) + '\n');

  const sortedByScore = [...results].sort((a, b) => b.score - a.score);
  const bestOverall = sortedByScore[0];

  const sortedByWinRate = [...results].sort((a, b) => b.winRate - a.winRate);
  const bestWinRate = sortedByWinRate[0];

  const sortedByPnL = [...results].sort((a, b) => b.totalPnL - a.totalPnL);
  const bestPnL = sortedByPnL[0];

  console.log('🥇 Best Overall Score:\n');
  printConfig(bestOverall);

  console.log('\n📈 Best Win Rate:\n');
  printConfig(bestWinRate);

  console.log('\n💰 Best Total PnL:\n');
  printConfig(bestPnL);

  // Generate recommendations
  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(80) + '\n');

  console.log('Optimal Parameters:');
  console.log(`  CONFIDENCE_THRESHOLD=${bestOverall.config.confidenceThreshold}`);
  console.log(`  RISK_THRESHOLD=${bestOverall.config.riskThreshold}`);
  console.log(`  HOLD_TIME_MINUTES=${bestOverall.config.holdTimeMinutes}`);
  console.log(`  TAKE_PROFIT_PERCENT=${bestOverall.config.takeProfitPercent}`);
  console.log(`  STOP_LOSS_PERCENT=${bestOverall.config.stopLossPercent}`);

  console.log('\nAdd these to your .env file for production use.\n');

  // Save results to file
  const report = {
    timestamp: new Date().toISOString(),
    bestOverall,
    bestWinRate,
    bestPnL,
    allResults: results,
  };

  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join('./trade-results', 'optimization-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`📄 Full report saved: ${outputPath}\n`);
}

function printConfig(result: OptimizationResult) {
  console.log(`  Confidence: ≥${result.config.confidenceThreshold}% | Risk: <${result.config.riskThreshold}`);
  console.log(`  Hold Time: ${result.config.holdTimeMinutes}min`);
  console.log(`  Take Profit: ${result.config.takeProfitPercent}% | Stop Loss: ${result.config.stopLossPercent}%`);
  console.log(`  \n  Results:`);
  console.log(`    Trades: ${result.totalTrades}`);
  console.log(`    Win Rate: ${(result.winRate * 100).toFixed(1)}%`);
  console.log(`    Profit Factor: ${result.profitFactor.toFixed(2)}`);
  console.log(`    Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);
  console.log(`    Total PnL: ${(result.totalPnL * 100).toFixed(2)}%`);
  console.log(`    Score: ${result.score.toFixed(1)}/100`);
}

optimizeAgent().catch(console.error);
