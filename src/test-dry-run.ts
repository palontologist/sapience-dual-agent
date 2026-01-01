/**
 * Quick test of the dry run functionality
 * Analyzes just 1-2 markets for rapid testing
 */

import TradingDryRun from './trading-dry-run';
import * as dotenv from 'dotenv';

dotenv.config();

async function quickTest() {
  console.log('🧪 Quick Dry Run Test\n');
  console.log('Testing trading agent with minimal markets...\n');

  // Check environment variables
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY not set in .env');
    process.exit(1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  console.log('✅ Environment variables configured\n');

  try {
    // Create dry run instance with minimal settings
    const dryRun = new TradingDryRun({
      groqApiKey: process.env.GROQ_API_KEY,
      privateKey: process.env.PRIVATE_KEY,
      arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
      maxTrades: 2, // Only analyze 2 markets for quick test
    });

    console.log('🚀 Starting quick dry run...\n');
    
    const startTime = Date.now();
    const results = await dryRun.run();
    const duration = Date.now() - startTime;

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ QUICK TEST COMPLETED');
    console.log('='.repeat(80));
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Markets Analyzed: ${results.totalMarketsAnalyzed}`);
    console.log(`Trades Recommended: ${results.tradesRecommended}`);
    console.log(`\n💡 Everything is working! Run 'pnpm dry-run' for full analysis.`);
    console.log('='.repeat(80) + '\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nDebug info:');
    console.error('- Check your .env file has GROQ_API_KEY and PRIVATE_KEY');
    console.error('- Ensure you have internet connection');
    console.error('- Verify Sapience API is accessible\n');
    process.exit(1);
  }
}

// Run the test
quickTest();
