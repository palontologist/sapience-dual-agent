#!/usr/bin/env tsx
/**
 * Ethereal Perps - Optimized Live Trading Runner
 * 
 * Optimized for 5 USDE capital with maximum profitability.
 * 
 * Usage:
 *   pnpm ethereal:trade                 # Dry run (default)
 *   pnpm ethereal:trade:live            # Live trading (requires confirmation)
 *   
 * Environment variables:
 *   TOTAL_CAPITAL=5                     # Your USDE balance
 *   SESSIONS=2                          # Number of trading sessions
 *   TRADES_PER_SESSION=3                # Max trades per session
 *   MIN_CONFIDENCE=72                   # Minimum AI confidence
 *   MAX_RISK_SCORE=45                   # Maximum risk tolerance
 *   DRY_RUN=true                        # Simulation mode (default)
 */

import { EtherealTradingAgent, EtherealAgentConfig } from '../src/agents/ethereal-trading-agent';
import { MarketAnalyzer } from '../src/agents/market-analyzer';
import { EtherealClient } from '../src/clients/ethereal-client';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CONFIGURATION PRESETS
// ============================================================================

const PRESETS = {
  // Ultra conservative - for learning
  conservative: {
    totalCapital: 5,
    maxPositionPercent: 0.20,
    maxConcurrentPositions: 2,
    minConfidence: 78,
    maxRiskScore: 40,
    sessionsPerRun: 1,
    tradesPerSession: 2,
  },
  
  // Balanced - recommended for small accounts
  balanced: {
    totalCapital: 5,
    maxPositionPercent: 0.30,
    maxConcurrentPositions: 3,
    minConfidence: 72,
    maxRiskScore: 45,
    sessionsPerRun: 2,
    tradesPerSession: 3,
  },
  
  // Aggressive - higher risk/reward
  aggressive: {
    totalCapital: 5,
    maxPositionPercent: 0.40,
    maxConcurrentPositions: 4,
    minConfidence: 68,
    maxRiskScore: 55,
    sessionsPerRun: 3,
    tradesPerSession: 4,
  },
  
  // Scalping - quick trades
  scalping: {
    totalCapital: 5,
    maxPositionPercent: 0.25,
    maxConcurrentPositions: 2,
    minConfidence: 75,
    maxRiskScore: 50,
    sessionsPerRun: 4,
    tradesPerSession: 5,
    sessionCooldownMs: 2000,
  },
};

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function main() {
  console.clear();
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   🔮 ETHEREAL PERPETUAL TRADING AGENT                                ║
║   Optimized for Maximum Profitability                                ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
`);

  // Validate API key
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY is required');
    console.log('\nAdd to .env:');
    console.log('  GROQ_API_KEY=your_api_key_here\n');
    process.exit(1);
  }

  // Determine preset
  const presetName = (process.env.PRESET || 'balanced') as keyof typeof PRESETS;
  const preset = PRESETS[presetName] || PRESETS.balanced;
  
  console.log(`📋 Using preset: ${presetName.toUpperCase()}\n`);
  
  // Build configuration
  const config: Partial<EtherealAgentConfig> = {
    groqApiKey: process.env.GROQ_API_KEY,
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    
    // Apply preset, then allow env overrides
    ...preset,
    totalCapital: parseFloat(process.env.TOTAL_CAPITAL || String(preset.totalCapital)),
    maxPositionPercent: parseFloat(process.env.MAX_POSITION_PERCENT || String(preset.maxPositionPercent)),
    maxConcurrentPositions: parseInt(process.env.MAX_CONCURRENT_POSITIONS || String(preset.maxConcurrentPositions)),
    minConfidence: parseInt(process.env.MIN_CONFIDENCE || String(preset.minConfidence)),
    maxRiskScore: parseInt(process.env.MAX_RISK_SCORE || String(preset.maxRiskScore)),
    sessionsPerRun: parseInt(process.env.SESSIONS || String(preset.sessionsPerRun)),
    tradesPerSession: parseInt(process.env.TRADES_PER_SESSION || String(preset.tradesPerSession)),
    sessionCooldownMs: parseInt(process.env.SESSION_COOLDOWN_MS || '5000'),
    
    dryRun: process.env.DRY_RUN !== 'false',
    autoConfirm: process.env.AUTO_CONFIRM === 'true',
  };

  // Show pre-analysis summary
  await showMarketSummary();
  
  // Safety check for live trading
  if (!config.dryRun) {
    console.log('\n⚠️  LIVE TRADING MODE REQUESTED\n');
    
    if (process.env.CONFIRM_LIVE_TRADING !== 'YES_I_UNDERSTAND_THE_RISKS') {
      console.log('❌ Safety check failed!\n');
      console.log('To enable live trading, add to .env:');
      console.log('  DRY_RUN=false');
      console.log('  CONFIRM_LIVE_TRADING=YES_I_UNDERSTAND_THE_RISKS\n');
      console.log('⚠️  WARNING: Live trading uses REAL money!');
      console.log('   Start with dry run to test your strategy first.\n');
      process.exit(1);
    }
    
    if (!process.env.PRIVATE_KEY) {
      console.log('❌ PRIVATE_KEY is required for live trading\n');
      process.exit(1);
    }
  }
  
  // Create and run agent
  const agent = new EtherealTradingAgent(config);
  
  try {
    await agent.run();
  } catch (error) {
    console.error('\n❌ Trading error:', error);
    process.exit(1);
  }
}

/**
 * Show current market conditions before trading
 */
async function showMarketSummary() {
  console.log('📊 Scanning markets...\n');
  
  const ethereal = new EtherealClient();
  const analyzer = new MarketAnalyzer();
  
  try {
    const markets = await ethereal.getMarkets();
    
    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│ Symbol       │ Price          │ 24h Change  │ Volume    │ Signal   │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    
    // Analyze each market
    const opportunities: Array<{
      symbol: string;
      change: number;
      signal: string;
      score: number;
    }> = [];
    
    for (const market of markets.slice(0, 8)) {  // Top 8 markets
      const signals = analyzer.analyzeSignals(market);
      
      const changeStr = `${market.priceChangePercent24h >= 0 ? '+' : ''}${market.priceChangePercent24h.toFixed(2)}%`;
      const volumeStr = `$${(market.volume24h / 1000000).toFixed(1)}M`;
      const signalEmoji = signals.composite.score > 30 ? '🟢' :
                          signals.composite.score < -30 ? '🔴' : '⚪';
      
      console.log(`│ ${market.symbol.padEnd(12)} │ $${market.lastPrice.toLocaleString().padEnd(12)} │ ${changeStr.padEnd(11)} │ ${volumeStr.padEnd(9)} │ ${signalEmoji} ${signals.composite.signal.padEnd(6)} │`);
      
      if (Math.abs(signals.composite.score) > 30) {
        opportunities.push({
          symbol: market.symbol,
          change: market.priceChangePercent24h,
          signal: signals.composite.signal,
          score: signals.composite.score,
        });
      }
    }
    
    console.log('└─────────────────────────────────────────────────────────────────────┘');
    
    if (opportunities.length > 0) {
      console.log(`\n🎯 Top Opportunities: ${opportunities.length} markets with strong signals`);
      opportunities
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
        .slice(0, 3)
        .forEach(opp => {
          const emoji = opp.score > 0 ? '📈' : '📉';
          console.log(`   ${emoji} ${opp.symbol}: ${opp.signal} (score: ${opp.score.toFixed(0)})`);
        });
    } else {
      console.log('\n⚠️  No strong signals detected. Agent will be selective.');
    }
    
    console.log('');
    
  } catch (error) {
    console.log('   Unable to fetch market preview, continuing...\n');
  }
}

// Run
main().catch(console.error);
