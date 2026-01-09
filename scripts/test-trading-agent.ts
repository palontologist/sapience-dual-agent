import { TradingAgent } from '../src/agents/trading-agent';
import dotenv from 'dotenv';

dotenv.config();

async function testTradingAgent() {
  console.log('🧪 Testing Trading Agent in Dry Run Mode\n');

  // Verify environment variables
  if (!process.env.GROQ_API_KEY) {
    throw new Error('❌ GROQ_API_KEY is required in .env file');
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error('❌ PRIVATE_KEY is required in .env file');
  }

  // Validate private key format
  const privateKey = process.env.PRIVATE_KEY.replace('0x', '');
  if (privateKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('❌ PRIVATE_KEY must be a valid 64-character hex string (without 0x prefix)');
  }

  if (privateKey.includes('your_private_key_here')) {
    throw new Error('❌ Please replace the placeholder PRIVATE_KEY in your .env file with an actual private key');
  }

  console.log('✅ Environment variables loaded');
  console.log('✅ Private key format validated');
  console.log('✅ Starting trading agent analysis...\n');

  // Filter for crypto markets (optional)
  const marketFilter = process.env.MARKET_FILTER 
    ? process.env.MARKET_FILTER.split(',').map(s => s.trim())
    : undefined;

  const agent = new TradingAgent({
    groqApiKey: process.env.GROQ_API_KEY,
    privateKey: privateKey,
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
    dryRun: true,
    marketFilter,
  });

  try {
    // Test with a small number of trades
    await agent.run(5);
    
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testTradingAgent();