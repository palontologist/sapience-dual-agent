# 🔮 Ethereal Trading Agent - Complete Guide

## Overview

This optimized trading agent is designed for **perpetual futures trading on Ethereal** with a **5 USDE** starting capital. It uses AI-powered market analysis with adaptive hold times for maximum profitability.

## Quick Start

```bash
# Run dry-run simulation (default - no real money)
pnpm ethereal:trade

# Run with specific preset
pnpm ethereal:conservative    # Low risk, learning mode
pnpm ethereal:balanced        # Recommended for small accounts
pnpm ethereal:aggressive      # Higher risk/reward
pnpm ethereal:scalping        # Quick trades, multiple sessions
```

## How It Works

### 1. Market Analysis

The agent analyzes each Ethereal market using:

- **Momentum Analysis**: Price direction, strength, and acceleration
- **Funding Rate Analysis**: Contrarian and trend-follow opportunities
- **Volume Analysis**: Conviction and liquidity assessment
- **Volatility Analysis**: Optimal hold times and price targets

### 2. Adaptive Hold Times

Unlike fixed hold times, this agent calculates optimal durations:

| Volatility | Hold Time | Strategy |
|------------|-----------|----------|
| LOW        | 120 min   | Wait for bigger moves |
| MEDIUM     | 90 min    | Standard swing trade |
| HIGH       | 60 min    | Capture quick momentum |
| EXTREME    | 30 min    | Fast scalp, exit quickly |

### 3. Dynamic Position Sizing

Uses modified Kelly Criterion for optimal sizing:

```
Kelly Fraction = (win_prob × win_amount - loss_prob × loss_amount) / win_amount
Actual Size = Kelly × 0.25 × confidence_multiplier  # Quarter Kelly for safety
```

For your $5 capital:
- Strong signal (85%+ confidence): Up to $1.50 per trade
- Medium signal (75-85%): Up to $1.05 per trade
- Lower signal (70-75%): Up to $0.75 per trade

### 4. Smart Leverage

Leverage is automatically adjusted based on:

| Confidence | Volatility | Leverage |
|------------|------------|----------|
| >85%       | LOW        | 5x       |
| >80%       | MEDIUM     | 4x       |
| >75%       | HIGH       | 3x       |
| >70%       | EXTREME    | 2x       |

## Trading Presets

### Conservative (Learning Mode)
```env
PRESET=conservative
```
- 1 session, 2 trades max
- 78% minimum confidence
- 20% max position size
- Best for: Learning the system

### Balanced (Recommended)
```env
PRESET=balanced
```
- 2 sessions, 3 trades each
- 72% minimum confidence
- 30% max position size
- Best for: Small accounts ($5-20)

### Aggressive (Higher Risk)
```env
PRESET=aggressive
```
- 3 sessions, 4 trades each
- 68% minimum confidence
- 40% max position size
- Best for: Experienced traders

### Scalping (Quick Trades)
```env
PRESET=scalping
```
- 4 sessions, 5 trades each
- 75% minimum confidence
- 25% max position size
- Best for: Active monitoring

## Environment Configuration

Add to your `.env` file:

```env
# Required
GROQ_API_KEY=your_groq_api_key

# Trading Settings (adjust these)
TOTAL_CAPITAL=5
PRESET=balanced
DRY_RUN=true

# Optional Overrides
MIN_CONFIDENCE=72
MAX_RISK_SCORE=45
SESSIONS=2
TRADES_PER_SESSION=3
```

## Running Live Trades

⚠️ **WARNING**: Live trading uses REAL money!

### Step 1: Test with Dry Run
```bash
# Run many simulations first
pnpm ethereal:trade
pnpm ethereal:trade
pnpm ethereal:trade
```

### Step 2: Review Performance
Check `./trade-results/ethereal-live/` for:
- `trades.json` - Full trade history
- `trades.csv` - Spreadsheet export

### Step 3: Enable Live Trading
Add to `.env`:
```env
DRY_RUN=false
CONFIRM_LIVE_TRADING=YES_I_UNDERSTAND_THE_RISKS
PRIVATE_KEY=your_wallet_private_key
```

### Step 4: Run Live
```bash
pnpm ethereal:trade:live
```

## Signal Types

### Strong Signals (High Probability)
- **STRONG_LONG**: Score > +60, momentum aligned with low funding
- **STRONG_SHORT**: Score < -60, bearish momentum with overcrowded longs

### Standard Signals
- **LONG**: Score +35 to +60, bullish setup
- **SHORT**: Score -35 to -60, bearish setup

### Weak/Skip Signals
- **WEAK_LONG/SHORT**: Score +15 to +35 / -15 to -35
- **NEUTRAL**: Score -15 to +15, no clear direction

## Exit Strategies

Each trade has automatic exit conditions:

1. **Take Profit**: Exit at target price (1.5-5% based on volatility)
2. **Stop Loss**: Exit at stop price (0.8-2.5% based on volatility)
3. **Trailing Stop**: Lock in profits if price moves 2%+ then retraces
4. **Time Exit**: Exit at end of hold time if no target hit

## Expected Performance

Based on the agent's configuration:

### Win Rate
- Conservative: 55-65% expected
- Balanced: 50-60% expected
- Aggressive: 45-55% expected

### Risk/Reward
- Average target: 2-3% profit per trade
- Average stop: 1-2% loss per trade
- Typical R:R ratio: 1.3:1 to 2:1

### Profit Projections (5 USDE, Balanced Mode)

| Scenario | Trades | Win Rate | PnL |
|----------|--------|----------|-----|
| Best     | 6      | 70%      | +$0.45 to +$0.80 |
| Expected | 6      | 55%      | +$0.15 to +$0.35 |
| Worst    | 6      | 35%      | -$0.20 to -$0.40 |

## Troubleshooting

### "All trades skipped"
- Markets may not meet confidence threshold
- Try lowering `MIN_CONFIDENCE` to 68
- Wait for more volatile market conditions

### "Position size too small"
- Increase `MAX_POSITION_PERCENT`
- Or increase `TOTAL_CAPITAL`

### "No strong signals"
- Normal during low volatility
- Agent is being properly selective
- Wait for better opportunities

### API Rate Limits
- Agent includes 500ms-1000ms delays between requests
- Increase `SESSION_COOLDOWN_MS` if needed

## Architecture

```
scripts/ethereal-trade.ts           # Main runner with presets
src/agents/
  ├── ethereal-trading-agent.ts     # Core trading agent
  ├── market-analyzer.ts            # Signal analysis
  ├── trade-tracker.ts              # Trade history
  └── profit-scorer.ts              # Performance metrics
src/clients/
  └── ethereal-client.ts            # Ethereal API client
```

## Tips for Success

1. **Start Small**: Begin with conservative preset
2. **Test Extensively**: Run 10+ dry runs before live trading
3. **Monitor Performance**: Check win rate and PnL after each session
4. **Adjust Parameters**: Tune based on your results
5. **Don't Overtrade**: Quality over quantity
6. **Manage Risk**: Never risk more than you can afford to lose

## Next Steps

1. Run `pnpm ethereal:trade` to test
2. Review results in `./trade-results/ethereal-live/`
3. Adjust preset/parameters as needed
4. When confident, enable live trading

---

*Built for profitable perpetual futures trading on Ethereal* 🚀
