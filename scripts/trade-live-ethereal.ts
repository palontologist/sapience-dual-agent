import { EtherealClient, EtherealMarket } from '../src/clients/ethereal-client';
import { TradeTracker, TradeResult } from '../src/agents/trade-tracker';
import { ProfitScorer } from '../src/agents/profit-scorer';
import Groq from 'groq-sdk';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Load optimized parameters
const CONFIDENCE_THRESHOLD = parseInt(process.env.CONFIDENCE_THRESHOLD || '70');
const RISK_THRESHOLD = parseInt(process.env.RISK_THRESHOLD || '50');
const MAX_POSITION_SIZE = parseFloat(process.env.MAX_POSITION_SIZE || '100'); // Max USD per trade
const TOTAL_CAPITAL = parseFloat(process.env.TOTAL_CAPITAL || '1000'); // Total trading capital

/**
 * Check wallet balance
 */
async function checkWalletBalance(
  provider: ethers.JsonRpcProvider,
  address: string
): Promise<{
  ethBalance: number;
  usdeBalance: number;
}> {
  const ethBalance = await provider.getBalance(address);
  
  // USDe token address on Arbitrum (example - replace with actual)
  const USDE_ADDRESS = '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34'; // ENA token as example
  const usdeContract = new ethers.Contract(
    USDE_ADDRESS,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  let usdeBalance = 0;
  try {
    const balance = await usdeContract.balanceOf(address);
    usdeBalance = parseFloat(ethers.formatUnits(balance, 18));
  } catch (error) {
    console.log('   ⚠️ Could not fetch USDe balance, using 0');
  }

  return {
    ethBalance: parseFloat(ethers.formatEther(ethBalance)),
    usdeBalance,
  };
}

/**
 * Analyze market with AI
 */
async function analyzeMarketWithAI(market: EtherealMarket, groq: Groq): Promise<any> {
  // ...existing code...
  const prompt = `Analyze this perpetual futures market and provide a trading recommendation:

Market: ${market.symbol}
Current Price: $${market.lastPrice}
24h Change: ${market.priceChangePercent24h.toFixed(2)}%
24h Volume: $${(market.volume24h / 1000000).toFixed(2)}M

Provide JSON: {"action": "LONG"|"SHORT"|"HOLD", "confidence": 0-100, "reasoning": "...", "riskScore": 0-100}`;

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
      riskScore: analysis.riskScore || 50,
    };
  } catch (error) {
    return { action: 'HOLD', confidence: 50, reasoning: 'Error', riskScore: 50 };
  }
}

/**
 * Execute live trade on Ethereal
 */
async function executeTrade(
  market: EtherealMarket,
  action: 'LONG' | 'SHORT',
  sizeUSD: number,
  leverage: number,
  wallet: ethers.Wallet
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  console.log(`   📝 Preparing to execute ${action} trade...`);
  console.log(`   Position: $${sizeUSD} with ${leverage}x leverage`);

  try {
    // NOTE: This is a placeholder - actual Ethereal integration needed
    // You'll need to:
    // 1. Get Ethereal contract address
    // 2. Approve USDe spending
    // 3. Open position via contract call
    
    // Example structure:
    // const etherealContract = new ethers.Contract(
    //   ETHEREAL_ADDRESS,
    //   ETHEREAL_ABI,
    //   wallet
    // );
    
    // const tx = await etherealContract.openPosition(
    //   market.symbol,
    //   action === 'LONG',
    //   ethers.parseUnits(sizeUSD.toString(), 18),
    //   leverage
    // );
    
    // await tx.wait();
    
    console.log(`   ⚠️  LIVE TRADING NOT YET IMPLEMENTED`);
    console.log(`   💡 This would execute: ${action} ${market.symbol} $${sizeUSD} @ ${leverage}x`);
    
    return {
      success: false,
      error: 'Trading contract integration pending'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Live trading session
 */
async function runLiveTrading() {
  console.log('💰 Ethereal LIVE Trading Mode\n');
  console.log('⚠️  WARNING: This will execute REAL trades with REAL money!\n');

  if (!process.env.GROQ_API_KEY || !process.env.PRIVATE_KEY) {
    throw new Error('❌ GROQ_API_KEY and PRIVATE_KEY required');
  }

  // Safety check
  const confirmLive = process.env.CONFIRM_LIVE_TRADING;
  if (confirmLive !== 'YES_I_UNDERSTAND_THE_RISKS') {
    console.log('❌ Safety check failed!');
    console.log('\nTo enable live trading, add to .env:');
    console.log('CONFIRM_LIVE_TRADING=YES_I_UNDERSTAND_THE_RISKS\n');
    console.log('📚 Please review the code and understand the risks before trading live.\n');
    return;
  }

  const provider = new ethers.JsonRpcProvider(
    process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
  );
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const ethereal = new EtherealClient();
  const tracker = new TradeTracker('./trade-results/live');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  console.log('💼 Wallet:', wallet.address);

  // Check balance
  const balance = await checkWalletBalance(provider, wallet.address);
  console.log(`💵 ETH Balance: ${balance.ethBalance.toFixed(4)} ETH`);
  console.log(`💵 USDe Balance: $${balance.usdeBalance.toFixed(2)}`);

  if (balance.ethBalance < 0.001) {
    console.log('\n❌ Insufficient ETH for gas fees. Need at least 0.001 ETH.\n');
    return;
  }

  if (balance.usdeBalance < MAX_POSITION_SIZE) {
    console.log(`\n⚠️  Warning: USDe balance ($${balance.usdeBalance.toFixed(2)}) is less than max position size ($${MAX_POSITION_SIZE})\n`);
  }

  console.log(`\n📊 Trading Parameters:`);
  console.log(`   Confidence Threshold: ${CONFIDENCE_THRESHOLD}%`);
  console.log(`   Risk Threshold: ${RISK_THRESHOLD}`);
  console.log(`   Max Position Size: $${MAX_POSITION_SIZE}`);
  console.log(`   Total Capital: $${TOTAL_CAPITAL}\n`);

  const maxTrades = parseInt(process.env.MAX_LIVE_TRADES || '3');
  console.log(`📈 Starting live session (max ${maxTrades} trades)\n`);

  try {
    const markets = await ethereal.getMarkets();
    let tradesExecuted = 0;

    for (const market of markets) {
      if (tradesExecuted >= maxTrades) {
        console.log(`\n✋ Reached max trades (${maxTrades})\n`);
        break;
      }

      console.log(`\n🎯 Analyzing: ${market.symbol} - $${market.lastPrice.toLocaleString()}`);

      const analysis = await analyzeMarketWithAI(market, groq);
      console.log(`   Signal: ${analysis.action} (${analysis.confidence}% confidence, ${analysis.riskScore} risk)`);
      console.log(`   Reasoning: ${analysis.reasoning}`);

      if (
        analysis.action !== 'HOLD' &&
        analysis.confidence >= CONFIDENCE_THRESHOLD &&
        analysis.riskScore < RISK_THRESHOLD
      ) {
        // Calculate position size (Kelly criterion scaled)
        const edge = (analysis.confidence - 50) / 100;
        const kellyFraction = Math.max(0, Math.min(edge * 0.5, 0.1)); // Max 10% of capital
        const positionSize = Math.min(
          TOTAL_CAPITAL * kellyFraction,
          MAX_POSITION_SIZE,
          balance.usdeBalance
        );

        if (positionSize < 10) {
          console.log(`   ⏭️  Position size too small ($${positionSize.toFixed(2)})`);
          continue;
        }

        console.log(`\n   💰 Position Size: $${positionSize.toFixed(2)}`);
        console.log(`   🎚️  Leverage: ${market.leverage}x`);

        // Ask for confirmation
        console.log(`\n   ⚠️  CONFIRM: Execute ${analysis.action} ${market.symbol}?`);
        console.log(`   (Set AUTO_CONFIRM=true in .env to skip confirmations)\n`);

        const autoConfirm = process.env.AUTO_CONFIRM === 'true';
        
        if (autoConfirm) {
          console.log(`   ✅ Auto-confirmed`);
          
          const result = await executeTrade(
            market,
            analysis.action,
            positionSize,
            market.leverage,
            wallet
          );

          if (result.success) {
            console.log(`   ✅ Trade executed! TX: ${result.txHash}`);
            tradesExecuted++;

            // Save trade record
            const trade: TradeResult = {
              tradeId: result.txHash || `${market.symbol}-${Date.now()}`,
              marketId: market.symbol,
              question: `${market.symbol} ${analysis.action} @ $${market.lastPrice}`,
              action: analysis.action === 'LONG' ? 'buy' : 'sell',
              entryPrice: market.lastPrice,
              size: positionSize / TOTAL_CAPITAL,
              confidence: analysis.confidence / 100,
              expectedReturn: 1.5,
              riskScore: analysis.riskScore / 100,
              timestamp: Date.now(),
              reasoning: analysis.reasoning,
              resolved: false,
            };

            tracker.saveTrade(trade);
          } else {
            console.log(`   ❌ Trade failed: ${result.error}`);
          }
        } else {
          console.log(`   ⏭️  Skipped (confirmation required - set AUTO_CONFIRM=true)`);
        }
      } else {
        console.log(`   ⏭️  Skip (${analysis.action === 'HOLD' ? 'no signal' : 'insufficient confidence'})`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n✅ Live trading session complete!`);
    console.log(`   Trades executed: ${tradesExecuted}/${maxTrades}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

runLiveTrading().catch(console.error);