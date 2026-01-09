import { EtherealClient, EtherealMarket } from '../src/clients/ethereal-client';
import { TradeTracker, TradeResult } from '../src/agents/trade-tracker';
import { ProfitScorer } from '../src/agents/profit-scorer';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const sessions = parseInt(process.env.TRADING_SESSIONS || '3');
const tradesPerSession = parseInt(process.env.TRADES_PER_SESSION || '5');

// Load optimized parameters
const CONFIDENCE_THRESHOLD = parseInt(process.env.CONFIDENCE_THRESHOLD || '65');
const RISK_THRESHOLD = parseInt(process.env.RISK_THRESHOLD || '60');
const HOLD_TIME_MINUTES = parseInt(process.env.HOLD_TIME_MINUTES || '90');
const TAKE_PROFIT_PERCENT = parseFloat(process.env.TAKE_PROFIT_PERCENT || '3');
const STOP_LOSS_PERCENT = parseFloat(process.env.STOP_LOSS_PERCENT || '2');

/**
 * Analyze Ethereal market and generate AI-powered trading decision
 */
async function analyzeMarketWithAI(
  market: EtherealMarket,
  groq: Groq
): Promise<{
  action: 'LONG' | 'SHORT' | 'HOLD';
  confidence: number;
  reasoning: string;
  expectedReturn: number;
  riskScore: number;
}> {
  const prompt = `Analyze this perpetual futures market and provide a trading recommendation:

Market: ${market.symbol}
Current Price: $${market.lastPrice}
24h Change: ${market.priceChangePercent24h.toFixed(2)}%
24h Volume: $${(market.volume24h / 1000000).toFixed(2)}M
Open Interest: $${(market.openInterest / 1000000).toFixed(2)}M
Funding Rate: ${(market.fundingRate * 100).toFixed(4)}%
Leverage Available: ${market.leverage}x

Based on:
1. Price momentum (24h change)
2. Funding rate (indicates long/short bias)
3. Volume and open interest (liquidity)
4. Technical setup

Provide a JSON response with:
{
  "action": "LONG" | "SHORT" | "HOLD",
  "confidence": 0-100,
  "reasoning": "detailed analysis",
  "expectedReturn": 1.0-3.0,
  "riskScore": 0-100
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert crypto trader analyzing perpetual futures markets. Provide concise, data-driven analysis.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || "{}";
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return {
      action: analysis.action || 'HOLD',
      confidence: analysis.confidence || 50,
      reasoning: analysis.reasoning || 'No clear signal',
      expectedReturn: analysis.expectedReturn || 1.0,
      riskScore: analysis.riskScore || 50,
    };
  } catch (error) {
    console.error(`  ⚠️ AI analysis failed, using fallback: ${error}`);
    // Fallback to simple technical analysis
    return analyzeMarketFallback(market);
  }
}

/**
 * Fallback analysis without AI
 */
function analyzeMarketFallback(market: EtherealMarket): {
  action: 'LONG' | 'SHORT' | 'HOLD';
  confidence: number;
  reasoning: string;
  expectedReturn: number;
  riskScore: number;
} {
  const priceChange = market.priceChangePercent24h;
  const fundingRate = market.fundingRate * 100;

  let action: 'LONG' | 'SHORT' | 'HOLD' = 'HOLD';
  let confidence = 50;
  let reasoning = '';
  let riskScore = 50;

  if (priceChange > 2 && fundingRate < 0.01) {
    action = 'LONG';
    confidence = 70 + Math.min(priceChange * 5, 20);
    reasoning = 'Strong upward momentum with low funding rate suggests bullish continuation';
    riskScore = 40;
  } else if (priceChange < -2 && fundingRate > 0.02) {
    action = 'SHORT';
    confidence = 70 + Math.min(Math.abs(priceChange) * 5, 20);
    reasoning = 'Downward momentum with high funding rate suggests bearish pressure';
    riskScore = 40;
  } else if (Math.abs(priceChange) < 0.5) {
    action = 'HOLD';
    confidence = 60;
    reasoning = 'Low volatility - wait for better setup';
    riskScore = 30;
  } else {
    action = 'HOLD';
    confidence = 55;
    reasoning = 'Mixed signals - need clearer price action';
    riskScore = 50;
  }

  const expectedReturn = action !== 'HOLD' ? 1.2 + (confidence - 70) / 100 : 1.0;

  return { action, confidence, reasoning, expectedReturn, riskScore };
}

/**
 * Enhanced trade simulation with stop loss and take profit
 */
function simulateTradeOutcome(
  market: EtherealMarket,
  action: 'LONG' | 'SHORT' | 'HOLD',
  entryPrice: number
): {
  exitPrice: number;
  pnl: number;
  outcome: boolean;
  exitReason: 'take-profit' | 'stop-loss' | 'hold-complete';
  holdTime: number;
} {
  const volatility = Math.abs(market.priceChangePercent24h) / (24 * 60);
  const momentum = market.priceChangePercent24h / (24 * 60);
  
  let currentPrice = entryPrice;
  let exitPrice = entryPrice;
  let exitReason: 'take-profit' | 'stop-loss' | 'hold-complete' = 'hold-complete';
  let actualHoldTime = HOLD_TIME_MINUTES;

  for (let minute = 0; minute < HOLD_TIME_MINUTES; minute++) {
    const randomMove = (Math.random() - 0.5) * volatility * 3;
    const priceChange = (momentum * 0.4 + randomMove);
    currentPrice = currentPrice * (1 + priceChange / 100);

    if (action === 'LONG') {
      const gain = (currentPrice - entryPrice) / entryPrice * 100;
      if (gain >= TAKE_PROFIT_PERCENT) {
        exitPrice = currentPrice;
        exitReason = 'take-profit';
        actualHoldTime = minute + 1;
        break;
      }
      if (gain <= -STOP_LOSS_PERCENT) {
        exitPrice = currentPrice;
        exitReason = 'stop-loss';
        actualHoldTime = minute + 1;
        break;
      }
    } else if (action === 'SHORT') {
      const gain = (entryPrice - currentPrice) / entryPrice * 100;
      if (gain >= TAKE_PROFIT_PERCENT) {
        exitPrice = currentPrice;
        exitReason = 'take-profit';
        actualHoldTime = minute + 1;
        break;
      }
      if (gain <= -STOP_LOSS_PERCENT) {
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

  return { exitPrice, pnl, outcome: pnl > 0, exitReason, holdTime: actualHoldTime };
}

async function testEtherealDryRun() {
  console.log('🔮 Ethereal Trading Agent - Dry Run with Outcome Simulation\n');

  if (!process.env.GROQ_API_KEY) {
    throw new Error('❌ GROQ_API_KEY is required for AI analysis');
  }

  const ethereal = new EtherealClient();
  const tracker = new TradeTracker('./trade-results/ethereal');
  const scorer = new ProfitScorer();
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    console.log('📊 Fetching Ethereal markets...\n');
    const markets = await ethereal.getMarkets();

    console.log(`Found ${markets.length} markets. Running AI analysis...\n`);

    let tradesExecuted = 0;
    const maxTrades = 5;

    for (const market of markets) {
      if (tradesExecuted >= maxTrades) {
        console.log(`\n✋ Reached max trades (${maxTrades}), stopping\n`);
        break;
      }

      console.log(`🎯 ${market.symbol}`);
      console.log(`   Price: $${market.lastPrice.toLocaleString()}`);
      console.log(`   24h: ${market.priceChangePercent24h >= 0 ? '+' : ''}${market.priceChangePercent24h.toFixed(2)}%`);

      // Get AI analysis
      const analysis = await analyzeMarketWithAI(market, groq);

      console.log(`   Signal: ${analysis.action} (${analysis.confidence.toFixed(0)}% confidence)`);
      console.log(`   Risk Score: ${analysis.riskScore.toFixed(0)}/100`);
      console.log(`   Expected Return: ${analysis.expectedReturn.toFixed(2)}x`);
      console.log(`   Reasoning: ${analysis.reasoning}`);

      // Execute trade if signal is strong enough
      if (analysis.action !== 'HOLD' && analysis.confidence >= 65 && analysis.riskScore < 60) {
        tradesExecuted++;
        const entryPrice = market.lastPrice;

        // Simulate trade outcome
        const outcome = simulateTradeOutcome(market, analysis.action, entryPrice);

        console.log(`   ✅ [DRY RUN] Trade executed!`);
        console.log(`   Entry: $${entryPrice.toLocaleString()}`);
        console.log(`   Exit: $${outcome.exitPrice.toLocaleString()}`);
        console.log(`   PnL: ${outcome.pnl >= 0 ? '+' : ''}${(outcome.pnl * 100).toFixed(2)}%`);
        console.log(`   Outcome: ${outcome.outcome ? '✅ WIN' : '❌ LOSS'}`);

        // Save trade with outcome
        const tradeResult: TradeResult = {
          tradeId: `${market.symbol}-${Date.now()}`,
          marketId: market.symbol,
          question: `${market.symbol} ${analysis.action} @ $${entryPrice.toLocaleString()}`,
          action: analysis.action === 'LONG' ? 'buy' : 'sell',
          entryPrice: entryPrice,
          size: (analysis.confidence / 100) * 0.1, // 10% max position
          confidence: analysis.confidence / 100,
          expectedReturn: analysis.expectedReturn,
          riskScore: analysis.riskScore / 100,
          timestamp: Date.now(),
          reasoning: analysis.reasoning,
          actualOutcome: outcome.outcome,
          exitPrice: outcome.exitPrice,
          pnl: outcome.pnl,
          resolved: true,
          resolutionDate: Date.now(),
        };

        tracker.saveTrade(tradeResult);
      } else {
        console.log(`   ⏭️  Skipped (${analysis.action === 'HOLD' ? 'no signal' : 'insufficient confidence or high risk'})`);
      }

      console.log('');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate and display profit metrics
    console.log('\n' + '='.repeat(60));
    console.log('📊 TRADING SESSION RESULTS');
    console.log('='.repeat(60) + '\n');

    const allTrades = tracker.loadTrades();
    const sessionTrades = allTrades.filter(t => t.timestamp > Date.now() - 3600000); // Last hour

    console.log(`Total trades executed: ${tradesExecuted}`);
    console.log(`Total markets analyzed: ${markets.length}\n`);

    // Score the agent
    const metrics = scorer.calculateMetrics(allTrades);
    scorer.printReport(metrics);

    // Show individual trade breakdown
    if (sessionTrades.length > 0) {
      console.log('📋 Trade Breakdown:\n');
      sessionTrades.forEach((trade, idx) => {
        const emoji = (trade.pnl || 0) > 0 ? '✅' : '❌';
        console.log(`${idx + 1}. ${emoji} ${trade.marketId}`);
        console.log(`   Action: ${trade.action.toUpperCase()}`);
        console.log(`   Entry: $${trade.entryPrice.toLocaleString()}`);
        console.log(`   Exit: $${trade.exitPrice?.toLocaleString() || 'N/A'}`);
        console.log(`   PnL: ${(trade.pnl || 0) >= 0 ? '+' : ''}${((trade.pnl || 0) * 100).toFixed(2)}%`);
        console.log(`   Confidence: ${(trade.confidence * 100).toFixed(0)}%\n`);
      });
    }

    // Export results
    tracker.exportToCSV();
    console.log('\n✅ Dry run complete! Results saved to ./trade-results/ethereal/\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function testEtherealMultiSession() {
  console.log('🔮 Ethereal Trading Agent - Multi-Session Dry Run\n');
  console.log('📊 Optimized Parameters:');
  console.log(`   Confidence Threshold: ${CONFIDENCE_THRESHOLD}%`);
  console.log(`   Risk Threshold: ${RISK_THRESHOLD}`);
  console.log(`   Hold Time: ${HOLD_TIME_MINUTES} minutes`);
  console.log(`   Take Profit: ${TAKE_PROFIT_PERCENT}%`);
  console.log(`   Stop Loss: ${STOP_LOSS_PERCENT}%\n`);

  if (!process.env.GROQ_API_KEY) {
    throw new Error('❌ GROQ_API_KEY is required for AI analysis');
  }

  const ethereal = new EtherealClient();
  const tracker = new TradeTracker('./trade-results/ethereal');
  const scorer = new ProfitScorer();
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    console.log(`📊 Running ${sessions} trading sessions with up to ${tradesPerSession} trades each\n`);

    for (let sessionNum = 1; sessionNum <= sessions; sessionNum++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📈 SESSION ${sessionNum}/${sessions}`);
      console.log('='.repeat(60) + '\n');

      const markets = await ethereal.getMarkets();
      console.log(`Found ${markets.length} markets\n`);

      let tradesExecuted = 0;

      for (const market of markets) {
        if (tradesExecuted >= tradesPerSession) {
          break;
        }

        console.log(`🎯 ${market.symbol} - $${market.lastPrice.toLocaleString()} (${market.priceChangePercent24h >= 0 ? '+' : ''}${market.priceChangePercent24h.toFixed(2)}%)`);

        const analysis = await analyzeMarketWithAI(market, groq);

        console.log(`   ${analysis.action} | Confidence: ${analysis.confidence.toFixed(0)}% | Risk: ${analysis.riskScore.toFixed(0)}/100`);

        // Use optimized thresholds
        if (analysis.action !== 'HOLD' && analysis.confidence >= CONFIDENCE_THRESHOLD && analysis.riskScore < RISK_THRESHOLD) {
          tradesExecuted++;
          const entryPrice = market.lastPrice;
          const outcome = simulateTradeOutcome(market, analysis.action, entryPrice);

          const emoji = outcome.outcome ? '✅ WIN' : '❌ LOSS';
          console.log(`   ${emoji} | Entry: $${entryPrice.toLocaleString()} → Exit: $${outcome.exitPrice.toLocaleString()} | PnL: ${outcome.pnl >= 0 ? '+' : ''}${(outcome.pnl * 100).toFixed(2)}%`);
          console.log(`   Exit: ${outcome.exitReason} after ${outcome.holdTime}min`);

          const tradeResult: TradeResult = {
            tradeId: `${market.symbol}-${Date.now()}`,
            marketId: market.symbol,
            question: `${market.symbol} ${analysis.action} @ $${entryPrice.toLocaleString()}`,
            action: analysis.action === 'LONG' ? 'buy' : 'sell',
            entryPrice: entryPrice,
            size: (analysis.confidence / 100) * 0.1,
            confidence: analysis.confidence / 100,
            expectedReturn: analysis.expectedReturn,
            riskScore: analysis.riskScore / 100,
            timestamp: Date.now(),
            reasoning: `${analysis.reasoning} | Exit: ${outcome.exitReason} @ ${outcome.holdTime}min`,
            actualOutcome: outcome.outcome,
            exitPrice: outcome.exitPrice,
            pnl: outcome.pnl,
            resolved: true,
            resolutionDate: Date.now(),
          };

          tracker.saveTrade(tradeResult);
        } else {
          console.log(`   ⏭️  SKIP | ${analysis.action === 'HOLD' ? 'No signal' : 'Low confidence'}`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`\n✅ Session ${sessionNum} complete: ${tradesExecuted} trades executed`);
      
      // Simulate time between sessions
      if (sessionNum < sessions) {
        console.log(`⏳ Waiting before next session...\n`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final comprehensive report
    console.log('\n\n' + '='.repeat(60));
    console.log('🏆 FINAL PERFORMANCE REPORT');
    console.log('='.repeat(60) + '\n');

    const allTrades = tracker.loadTrades();
    const metrics = scorer.calculateMetrics(allTrades);

    console.log(`📊 Overall Statistics:`);
    console.log(`  Sessions Completed: ${sessions}`);
    console.log(`  Total Markets Analyzed: ${sessions * 12}`);
    console.log(`  Total Trades Executed: ${allTrades.length}`);
    console.log(`  Trade Execution Rate: ${((allTrades.length / (sessions * 12)) * 100).toFixed(1)}%\n`);

    scorer.printReport(metrics);

    // Best and worst trades
    if (allTrades.length > 0) {
      const sortedByPnL = [...allTrades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
      
      console.log('🏆 Best Trade:');
      const best = sortedByPnL[0];
      console.log(`  ${best.marketId} | ${best.action.toUpperCase()}`);
      console.log(`  Entry: $${best.entryPrice.toLocaleString()} → Exit: $${best.exitPrice?.toLocaleString()}`);
      console.log(`  PnL: ${(best.pnl || 0) >= 0 ? '+' : ''}${((best.pnl || 0) * 100).toFixed(2)}%\n`);

      console.log('📉 Worst Trade:');
      const worst = sortedByPnL[sortedByPnL.length - 1];
      console.log(`  ${worst.marketId} | ${worst.action.toUpperCase()}`);
      console.log(`  Entry: $${worst.entryPrice.toLocaleString()} → Exit: $${worst.exitPrice?.toLocaleString()}`);
      console.log(`  PnL: ${(worst.pnl || 0) >= 0 ? '+' : ''}${((worst.pnl || 0) * 100).toFixed(2)}%\n`);

      // Market performance breakdown
      const marketStats = new Map<string, { wins: number; losses: number; totalPnL: number }>();
      allTrades.forEach(trade => {
        const stats = marketStats.get(trade.marketId) || { wins: 0, losses: 0, totalPnL: 0 };
        if ((trade.pnl || 0) > 0) stats.wins++;
        else stats.losses++;
        stats.totalPnL += trade.pnl || 0;
        marketStats.set(trade.marketId, stats);
      });

      console.log('📊 Performance by Market:\n');
      Array.from(marketStats.entries())
        .sort((a, b) => b[1].totalPnL - a[1].totalPnL)
        .slice(0, 5)
        .forEach(([market, stats]) => {
          const winRate = stats.wins / (stats.wins + stats.losses) * 100;
          console.log(`  ${market.padEnd(12)} | W: ${stats.wins} L: ${stats.losses} | Win Rate: ${winRate.toFixed(0)}% | PnL: ${stats.totalPnL >= 0 ? '+' : ''}${(stats.totalPnL * 100).toFixed(2)}%`);
        });
    }

    tracker.exportToCSV();
    console.log(`\n💾 Results saved to: ./trade-results/ethereal/`);
    console.log(`   - trades.json (full history)`);
    console.log(`   - trades.csv (spreadsheet format)\n`);
    console.log('✅ Multi-session dry run complete!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testEtherealMultiSession();
