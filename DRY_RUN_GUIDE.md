# Trading Agent Dry Run Guide

## Overview

The Trading Agent Dry Run mode allows you to test the trading agent with **real market data** without spending any money. It simulates the entire trading process, showing you exactly what trades the agent would make, including:

- Market analysis and forecasts
- Trade decisions (BUY/SKIP)
- Risk assessment
- Position sizing
- Expected returns
- Edge calculations

## Quick Start

### Option 1: Run via Command Line (Recommended)

```bash
# Full dry run (analyzes up to 10 markets)
pnpm dry-run

# Quick dry run (analyzes only 3 markets for faster testing)
pnpm dry-run:quick
```

### Option 2: Run via API

```bash
# Start the development server
pnpm dev

# In another terminal, make a POST request
curl -X POST http://localhost:3000/api/dry-run \
  -H "Content-Type: application/json" \
  -d '{"maxTrades": 5}'
```

### Option 3: Run Programmatically

```typescript
import TradingDryRun from './src/trading-dry-run';

const dryRun = new TradingDryRun({
  groqApiKey: process.env.GROQ_API_KEY || "",
  privateKey: process.env.PRIVATE_KEY || "",
  arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
  maxTrades: 10,
});

const results = await dryRun.run();
console.log(results);
```

## What You'll See

### 1. Market Analysis
For each market, you'll see:
- Question/description
- Current market prices (YES/NO)
- Liquidity and volume
- AI-generated forecast
- Confidence level

### 2. Trade Decision
- **Action**: BUY or SKIP
- **Side**: YES or NO (if buying)
- **Size**: Percentage of bankroll to risk
- **Amount**: USDe to wager
- **Edge**: Difference between fair value and market price
- **Risk Score**: Overall risk assessment (0-100%)

### 3. Risk Management
- Stop loss levels (if applicable)
- Take profit targets (if applicable)
- Detailed reasoning for the decision

### 4. Summary Report
At the end, you'll get:
- Total markets analyzed
- Number of trades recommended
- Average confidence and edge
- Total capital required
- List of all recommended trades

## Example Output

```
================================================================================
📊 MARKET #1
================================================================================
Question: Will Donald Trump win the 2024 Presidential Election?

💰 PRICING:
   Market Price: 47.5%
   Fair Value: 58.2%
   Edge: 🟢 10.7%

🎯 DECISION: ✅ BUY
   Side: YES
   Size: 8.5% of bankroll
   Amount: 1 USDe
   Stop Loss: 42.0%
   Take Profit: 65.0%

📊 METRICS:
   Confidence: 72.3%
   Expected Return: 1.185x
   Risk Score: 45.2%

💭 REASONING:
   Strong polling momentum in key swing states. Historical precedent shows
   incumbents lose when approval < 45%. Market appears to undervalue recent
   shifts. Liquidity sufficient for entry/exit.
```

## Configuration

You can adjust the following parameters in your `.env` file:

```env
# Maximum number of trades to analyze
MAX_TRADES=10

# Minimum confidence to recommend a trade (0.0-1.0)
MIN_CONFIDENCE=0.65

# Minimum edge to recommend a trade (0.0-1.0)
MIN_EDGE=0.05

# Wager amount per trade (in USDe)
WAGER_AMOUNT=1
```

## Understanding the Metrics

### Edge
- **Definition**: Difference between your estimated fair value and market price
- **Green (>10%)**: Strong mispricing, high potential value
- **Yellow (5-10%)**: Moderate mispricing, decent opportunity
- **Red (<5%)**: Minimal mispricing, likely skip

### Confidence
- **>80%**: Very high confidence in forecast
- **65-80%**: Good confidence, typical for recommended trades
- **50-65%**: Moderate confidence, usually skipped
- **<50%**: Low confidence, always skipped

### Risk Score
- **<40%**: Low risk, favorable conditions
- **40-60%**: Moderate risk, acceptable
- **>60%**: High risk, usually skipped unless exceptional edge

### Expected Return
- **>1.2x**: Excellent value
- **1.1-1.2x**: Good value
- **1.0-1.1x**: Marginal value
- **<1.0x**: Negative expected value, always skipped

## Safety Features

The dry run mode includes multiple safety checks:

1. **No Real Transactions**: Never submits actual trades to blockchain
2. **Read-Only**: Only fetches market data, doesn't modify anything
3. **Error Handling**: Continues even if individual markets fail
4. **Rate Limiting**: Respects API rate limits automatically
5. **Validation**: Checks all inputs and configurations

## Interpreting Results

### When to Proceed with Live Trading
✅ Multiple trades with high confidence (>70%)
✅ Consistent positive edge (>7%)
✅ Low risk scores (<50%)
✅ Clear, logical reasoning
✅ Sufficient liquidity in markets

### When to Wait or Adjust
⚠️ No trades recommended
⚠️ Low confidence across all markets
⚠️ High risk scores (>70%)
⚠️ Minimal edge (<5%)
⚠️ Unclear or contradictory reasoning

## Comparing to Live Trading

| Feature | Dry Run | Live Trading |
|---------|---------|--------------|
| Fetches market data | ✅ Yes | ✅ Yes |
| Generates forecasts | ✅ Yes | ✅ Yes |
| Analyzes trades | ✅ Yes | ✅ Yes |
| Calculates risk | ✅ Yes | ✅ Yes |
| Submits transactions | ❌ No | ✅ Yes |
| Spends money | ❌ No | ✅ Yes |
| Updates leaderboard | ❌ No | ✅ Yes |

## Tips for Best Results

1. **Run Multiple Times**: Market conditions change, so run multiple dry runs
2. **Compare Results**: Look for consistency in recommendations
3. **Start Small**: Begin with 3-5 markets to get quick feedback
4. **Review Reasoning**: Always read the AI's reasoning carefully
5. **Check Liquidity**: Ensure markets have enough liquidity for your trades
6. **Time Horizon**: Prefer markets with longer time until resolution
7. **Diversify**: Don't put all capital in correlated markets

## Troubleshooting

### "No markets available"
- Sapience API might be down
- Check your internet connection
- Try again in a few minutes

### "Error generating forecast"
- Groq API rate limit reached
- Invalid API key in `.env`
- Wait 60 seconds and try again

### "Could not extract JSON from model response"
- AI model returned unexpected format
- Usually transient, try again
- Check Groq API status

### All trades skipped
- Markets might be efficiently priced
- Try adjusting `MIN_CONFIDENCE` or `MIN_EDGE` in code
- Normal if market conditions are unfavorable

## Next Steps

After reviewing your dry run results:

1. **If satisfied**: Fund your wallet with the recommended capital
2. **Run live agent**: Use the regular trading agent to execute
3. **Monitor results**: Check Sapience leaderboard regularly
4. **Adjust parameters**: Fine-tune based on performance
5. **Scale gradually**: Increase capital as you gain confidence

## Support

For issues or questions:
- Check the main README.md
- Review the code in `src/trading-dry-run.ts`
- Open an issue on GitHub

## Disclaimer

⚠️ **IMPORTANT**: 

- This is a simulation using AI predictions
- Past performance does not guarantee future results
- Markets are inherently uncertain
- Only risk capital you can afford to lose
- The dry run is for educational and testing purposes
- Always do your own research before trading
