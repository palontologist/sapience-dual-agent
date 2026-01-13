#!/usr/bin/env tsx
/**
 * Trading Orchestrator Runner
 * 
 * Parallel analysis and execution system for maximum efficiency.
 * 
 * Architecture:
 * - Market Monitor: Continuously fetches market data (every 5s)
 * - Analysis Engine: Deep analysis on opportunities (every 15s)
 * - Position Manager: Monitors and manages open trades (every 3s)
 * 
 * Benefits:
 * - Accumulated market intelligence for better decisions
 * - Real-time position management with dynamic exits
 * - Parallel processing for faster response
 * 
 * Usage:
 *   pnpm orchestrator                # Run for 2 minutes (default)
 *   pnpm orchestrator:long           # Run for 10 minutes
 *   DURATION_SEC=300 pnpm orchestrator  # Custom duration
 */

import { TradingOrchestrator, OrchestratorConfig } from '../src/agents/trading-orchestrator';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY is required');
    console.log('\nAdd to .env:');
    console.log('  GROQ_API_KEY=your_api_key_here\n');
    process.exit(1);
  }

  const config: Partial<OrchestratorConfig> = {
    groqApiKey: process.env.GROQ_API_KEY,
    
    // Capital
    totalCapital: parseFloat(process.env.TOTAL_CAPITAL || '5'),
    maxPositionPercent: parseFloat(process.env.MAX_POSITION_PERCENT || '0.30'),
    maxConcurrentPositions: parseInt(process.env.MAX_CONCURRENT_POSITIONS || '3'),
    
    // Thresholds
    minConfidence: parseInt(process.env.MIN_CONFIDENCE || '70'),
    maxRiskScore: parseInt(process.env.MAX_RISK_SCORE || '60'),
    
    // Timing (milliseconds)
    marketUpdateIntervalMs: parseInt(process.env.MARKET_UPDATE_MS || '5000'),
    analysisIntervalMs: parseInt(process.env.ANALYSIS_INTERVAL_MS || '15000'),
    positionCheckIntervalMs: parseInt(process.env.POSITION_CHECK_MS || '3000'),
    
    // Signal management
    signalExpiryMs: parseInt(process.env.SIGNAL_EXPIRY_MS || '120000'),
    minSignalAge: parseInt(process.env.MIN_SIGNAL_AGE_MS || '10000'),
    
    dryRun: process.env.DRY_RUN !== 'false',
  };

  // Duration in seconds (default 2 minutes)
  const durationSec = parseInt(process.env.DURATION_SEC || '120');
  
  console.log(`\n⏱️  Running orchestrator for ${durationSec} seconds...\n`);
  
  const orchestrator = new TradingOrchestrator(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Shutting down gracefully...');
    await orchestrator.stop();
    process.exit(0);
  });
  
  await orchestrator.start(durationSec * 1000);
}

main().catch(console.error);
