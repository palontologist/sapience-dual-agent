# 🚀 Ethereal Perps Trading - Complete Setup

## Overview

You now have **AI-powered perpetual futures trading** integrated with your prediction market agent! The Ethereal integration lets you trade BTC, ETH, and other crypto perps with leverage, managed by the same AI that forecasts prediction markets.

## What's New

### 🎯 Key Features

1. **Ethereal API Client** (`src/utils/ethereal-client.ts`)
   - Full Ethereal Exchange API integration
   - EIP712 message signing (same as Sapience)
   - Order placement, position management
   - Works on Arbitrum (your existing wallet)

2. **AI-Powered Perps Trading** (`src/ethereal-dry-run.ts`)
   - AI analyzes crypto markets
   - Recommends LONG/SHORT positions
   - Calculates leverage (1-5x)
   - Sets stop-loss and take-profit
   - Full profit projections

3. **Dry Run Mode** (Test First!)
   - Simulates perp trades without risk
   - Shows profit/loss scenarios
   - Risk/reward analysis
   - Safe testing on testnet

## Quick Start

### 1. Test on Testnet (Recommended First)

```bash
# Run Ethereal perps dry run
pnpm ethereal:dry-run

# or
pnpm perps:dry-run
```

This will:
- ✅ Connect to Ethereal testnet
- ✅ Analyze BTC, ETH, SOL, ARB markets
- ✅ Generate AI trading signals
- ✅ Show profit projections
- ❌ NOT execute real trades

### 2. What You'll See

```
🧪 ETHEREAL PERPS DRY RUN MODE
⚠️  DRY RUN: No real trades will be executed

💰 Position Size: $100 per trade
📊 Max Leverage: 5x
🎯 Min Confidence: 70%

================================================================================
📈 PERP MARKET #1
================================================================================
Symbol: BTC-PERP

💰 PRICING:
   Entry Price: $95,234.50
   Stop Loss: $92,876.00 (-2.48%)
   Take Profit: $98,192.00 (+3.11%)

🎯 DECISION: ✅ OPEN LONG
   Position Size: $100
   Leverage: 5x
   Contracts: 0.0011

💵 PROFIT PROJECTION:
   If TARGET HIT: +$15.55 (15.6% ROI)
   If STOP LOSS: -$12.40 (-12.4% ROI)
   Risk/Reward Ratio: 1.25:1

📊 METRICS:
   Confidence: 78.5%

💭 REASONING:
   Strong bullish momentum with RSI at 62. Breaking above key resistance
   at $95k. Targeting $98k with 3:1 R:R. Stop below support at $92.8k.
```

Summary report shows:
- All analyzed markets
- Recommended trades
- Total capital needed
- Expected profit (best/worst/expected cases)
- ROI assessment

## How It Works

### Trading Strategy

The AI analyzes each perp market and decides:

1. **Direction**: LONG (bullish), SHORT (bearish), or NEUTRAL (skip)
2. **Confidence**: How certain the AI is (0-100%)
3. **Entry Price**: Current market price
4. **Stop Loss**: Risk management exit (2-5% away)
5. **Take Profit**: Target price (5-15% away)
6. **Leverage**: 1-5x based on confidence

### Position Sizing

Default: **$100 per position**
- Low leverage (1-2x) for lower confidence
- Higher leverage (3-5x) for high confidence
- Conservative 5x max (can be adjusted)

### Risk Management

Every trade has:
- **Stop Loss**: Automatic exit if price goes against you
- **Take Profit**: Automatic exit when target reached
- **Risk/Reward Ratio**: Aim for >1.5:1

## Profit Projections

### Per-Trade Example

```
BTC LONG at $95,000
- Position: $100
- Leverage: 5x
- Stop: $92,000 (-3.16%)
- Target: $98,500 (+3.68%)

If WIN: +$18.40 (18.4% ROI)
If LOSE: -$15.80 (-15.8% ROI)
Risk/Reward: 1.16:1
```

### Portfolio Example (5 trades)

```
💵 PROFIT PROJECTIONS:
   📈 Best Case (All Targets Hit): +$78.40
   📉 Worst Case (All Stop Loss): -$62.50
   🎯 Expected Case: +$23.16
   💎 Net Expected Profit: +$23.16
   📊 Expected ROI: +46.3%
   🟢 Assessment: EXCELLENT
```

## Configuration

### Environment Variables

Add to your `.env`:

```env
# Ethereal Settings
ETHEREAL_TESTNET=true          # Use testnet (true) or mainnet (false)
ETHEREAL_POSITION_SIZE=100     # $ per position
ETHEREAL_MAX_LEVERAGE=5        # Maximum leverage (1-50)
ETHEREAL_MIN_CONFIDENCE=0.70   # Minimum AI confidence (0.0-1.0)
ETHEREAL_MAX_TRADES=5          # Max positions at once
```

### In Code (src/ethereal-dry-run.ts)

```typescript
private minConfidence: number = 0.70;  // 70% min confidence
private maxLeverage: number = 5;       // 5x max leverage
private positionSize: number = 100;    // $100 per position
private maxTrades: number = 5;         // 5 positions max
```

Adjust these based on your risk tolerance!

## Going Live (After Testing)

### Step 1: Fund Ethereal Account

```bash
# Get USDe on Arbitrum
# Bridge to Ethereal (via their UI)
```

You'll need:
- USDe for trading capital
- ETH for gas fees (~$0.50 per trade)

### Step 2: Switch to Mainnet

In `.env`:
```env
ETHEREAL_TESTNET=false
```

Or in code:
```typescript
const dryRun = new EtherealDryRun({
  groqApiKey: process.env.GROQ_API_KEY,
  privateKey: process.env.PRIVATE_KEY,
  testnet: false,  // Use mainnet
  maxTrades: 5,
});
```

### Step 3: Live Trading (When Ready)

Create `src/ethereal-live.ts` (I can build this) that:
- Actually executes orders (not dry run)
- Monitors positions
- Manages stop-loss/take-profit
- Tracks P&L

## Hybrid Strategy: Predictions + Perps

Combine both strategies for maximum edge:

### Scenario 1: Prediction Market Signal → Perp Trade

```
Sapience: "Will BTC hit $100k?" 
├─ AI Forecast: 75% YES (high confidence)
├─ Edge: 12% (market at 63%)
└─ Action: Open BTC LONG perp with 3x leverage
    ├─ If prediction wins: Profit on both
    ├─ Perp provides instant liquidity
    └─ Prediction provides long-term validation
```

### Scenario 2: Diversified Portfolio

```
Capital: $1,000
├─ $500 → Sapience Predictions (5 markets @ $100 each)
│   └─ 30-90 day hold times, high conviction bets
└─ $500 → Ethereal Perps (5 positions @ $100 each)
    └─ 1-7 day trades, active management
```

## Risk Warning ⚠️

### Perps Are High Risk

- **Leverage amplifies losses**: 5x leverage = 5x losses
- **Liquidation risk**: Price moves against you = lose entire position
- **Funding fees**: Pay/receive fees every 8 hours
- **Volatile markets**: Crypto can move 10%+ in minutes

### Best Practices

1. **Start small**: $50-100 positions max
2. **Low leverage**: 2-3x until experienced
3. **Always use stops**: Never trade without stop-loss
4. **Test extensively**: Run dry runs for days before live
5. **Don't overtrade**: Max 3-5 positions at once
6. **Only risk capital**: Money you can afford to lose

## Comparison: Prediction Markets vs Perps

| Feature | Prediction Markets | Perps Trading |
|---------|-------------------|---------------|
| **Liquidity** | Locked until resolution | Exit anytime |
| **Timeline** | Days to months | Minutes to weeks |
| **Leverage** | None (1x) | Up to 50x |
| **Risk** | Lose wager only | Can lose more than wager |
| **Profit Speed** | Slow (event resolution) | Fast (price movements) |
| **Complexity** | Simple | Complex |
| **Best For** | Long-term forecasts | Short-term trading |

## Commands Reference

```bash
# Dry Runs
pnpm ethereal:dry-run      # Test Ethereal perps
pnpm dry-run               # Test Sapience predictions

# Development
pnpm dev                   # Start Next.js app
pnpm test                  # Run tests

# Combined Strategy (future)
pnpm hybrid:dry-run        # Test both strategies
```

## Next Steps

1. **Run dry run**:
   ```bash
   pnpm ethereal:dry-run
   ```

2. **Review results**: Check profit projections and confidence levels

3. **Adjust parameters**: Tune leverage, position size, confidence

4. **Test extensively**: Run multiple dry runs over several days

5. **Start on testnet**: Get Ethereal testnet tokens and try live (but fake money)

6. **Go live slowly**: Start with $50-100 positions, 2x leverage max

7. **Monitor closely**: Check positions daily, adjust stops

8. **Scale gradually**: Only increase size after consistent wins

## Troubleshooting

### "Failed to initialize Ethereal client"
- Check internet connection
- Verify Ethereal API is online
- Try testnet first

### "Error placing order"
- Ensure sufficient balance
- Check position size is within limits
- Verify signature is valid

### All trades skipped
- Markets may not meet confidence threshold
- Try lowering `minConfidence` to 0.65
- Check if AI has strong directional bias

### "Liquidation" (in live trading)
- Position moved against you beyond margin
- Use lower leverage next time
- Set tighter stop-losses

## Support

- **Ethereal Docs**: https://docs.ethereal.trade/
- **Discord**: Join Ethereal community
- **API Status**: Check status.ethereal.trade

## What's Next?

Would you like me to build:

1. **Live trading agent** - Actually execute perp trades (after testing)
2. **Hybrid strategy** - Combine predictions + perps intelligently
3. **Position monitor** - Track open positions, P&L, alerts
4. **Dashboard** - Visual interface for both strategies

Let me know and I'll build it!

---

**Built for sophisticated traders who want AI-powered perpetual futures** 🚀

**Always test extensively before using real money!**
