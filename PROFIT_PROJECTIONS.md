# Trading Agent Profit Projections Explained

## Overview

The dry run now includes **detailed profit projections** that show you exactly how much money you could make (or lose) if you execute the recommended trades. This helps you make informed decisions about whether to proceed with live trading.

## Profit Calculation Methodology

### Per-Trade Calculations

For each recommended trade, we calculate:

#### 1. **Entry Price**
The current market price when you would buy the position.

Example: If YES is trading at 47%, your entry price is 0.47

#### 2. **Win Profit**
How much you profit if the trade resolves in your favor.

**Formula**: 
- For YES: `(Wager ÷ Entry Price) - Wager`
- For NO: `(Wager ÷ (1 - Entry Price)) - Wager`

**Example** (YES at 47%):
- Wager: $1
- Payout if win: $1 ÷ 0.47 = $2.13
- Profit: $2.13 - $1 = **$1.13**
- ROI: 113%

**Example** (NO at 35%):
- Wager: $1
- Payout if win: $1 ÷ (1 - 0.35) = $1 ÷ 0.65 = $1.54
- Profit: $1.54 - $1 = **$0.54**
- ROI: 54%

#### 3. **Loss Amount**
How much you lose if the trade resolves against you.

**Formula**: `-Wager Amount`

**Example**: 
- Wager: $1
- Loss if wrong: **-$1.00**
- ROI: -100%

#### 4. **Break-Even Price**
The market price at which your expected value is zero.

**Formula**:
- For YES: `1 ÷ (1 + Win Profit ÷ Wager)`
- For NO: `1 - (1 ÷ (1 + Win Profit ÷ Wager))`

**Example** (YES bought at 47%, win profit $1.13):
- Break-even: 1 ÷ (1 + 1.13 / 1) = 1 ÷ 2.13 = **47%**
- (Same as entry price in prediction markets)

## Portfolio-Level Calculations

### Best Case Scenario
**All trades win**

```
Best Case Profit = Sum of all Win Profits
```

**Example** (3 trades):
- Trade 1: +$1.13
- Trade 2: +$0.85
- Trade 3: +$1.42
- **Total: +$3.40**

### Worst Case Scenario
**All trades lose**

```
Worst Case Profit = Sum of all Loss Amounts
```

**Example** (3 trades at $1 each):
- Trade 1: -$1.00
- Trade 2: -$1.00
- Trade 3: -$1.00
- **Total: -$3.00**

### Expected Case (Most Realistic)
**Probability-weighted outcome**

```
Expected Profit = Sum of (Probability × Win Profit + (1 - Probability) × Loss Amount)
```

**Example** (Trade 1: YES at 47%, AI forecast 58%):
- Win probability: 58%
- Win profit: +$1.13
- Loss amount: -$1.00
- Expected value: (0.58 × $1.13) + (0.42 × -$1.00)
- Expected value: $0.655 - $0.42 = **+$0.235**

**Portfolio** (3 trades):
- Trade 1 EV: +$0.235
- Trade 2 EV: +$0.180
- Trade 3 EV: +$0.295
- **Total Expected: +$0.71**

### Gas Costs
Estimated transaction fees on Arbitrum.

```
Gas Cost = Number of Trades × $0.50
```

**Example** (3 trades):
- 3 × $0.50 = **$1.50** total gas

### Net Expected Profit
Your actual expected profit after costs.

```
Net Expected Profit = Expected Profit - Gas Costs
```

**Example**:
- Expected profit: +$0.71
- Gas costs: -$1.50
- **Net: -$0.79**

### Expected ROI
Return on investment as a percentage.

```
Expected ROI = (Net Expected Profit ÷ Capital Deployed) × 100
```

**Example**:
- Net expected profit: -$0.79
- Capital deployed: $3.00
- **ROI: -26.3%**

## Real Dry Run Example

Let's walk through actual output:

```
💵 PROFIT PROJECTIONS:
   📈 Best Case (All Win): +$3.40
   📉 Worst Case (All Lose): -$3.00
   🎯 Expected Case: +$0.71
   ⛽ Gas Costs: -$1.50
   💎 Net Expected Profit: -$0.79
   📊 Expected ROI: -26.3%
   🔴 Assessment: NEGATIVE
```

### What This Tells You:

1. **Best Case (+$3.40)**: If you're right on all 3 trades
2. **Worst Case (-$3.00)**: If you're wrong on all 3 trades
3. **Expected (+$0.71)**: Probability-weighted average outcome
4. **After Gas (-$0.79)**: Your realistic expectation including costs
5. **ROI (-26.3%)**: You're expected to lose 26% of your capital

**Decision**: ❌ **DO NOT TRADE** - Negative expected value

## Interpreting the Results

### 🟢 Excellent (ROI > 20%)
```
Net Expected Profit: +$2.50
Expected ROI: +83%
Assessment: EXCELLENT
```
✅ **Strong recommendation to trade**
- High probability of profit
- Good risk/reward ratio
- Gas costs well covered

### 🟡 Good (ROI 10-20%)
```
Net Expected Profit: +$0.45
Expected ROI: +15%
Assessment: GOOD
```
✅ **Consider trading**
- Positive expected value
- Reasonable returns
- Monitor closely

### 🔵 Marginal (ROI 0-10%)
```
Net Expected Profit: +$0.15
Expected ROI: +5%
Assessment: MARGINAL
```
⚠️ **Proceed with caution**
- Small edge
- Gas costs significant
- One bad trade turns negative

### 🔴 Negative (ROI < 0%)
```
Net Expected Profit: -$0.50
Expected ROI: -16.7%
Assessment: NEGATIVE
```
❌ **DO NOT TRADE**
- Expected to lose money
- Gas costs too high relative to edge
- Wait for better opportunities

## Understanding the Summary Table

```
📊 PROFIT SUMMARY TABLE:
────────────────────────────────────────────────────────────────────────────────
   Scenario              │ Gross P/L │ Gas Cost │ Net P/L   │ ROI
────────────────────────────────────────────────────────────────────────────────
   Best Case (All Win)   │ +$3.40    │ -$1.50   │ +$1.90    │ +63.3%
   Expected Case         │ +$0.71    │ -$1.50   │ -$0.79    │ -26.3%
   Worst Case (All Lose) │ -$3.00    │ -$1.50   │ -$4.50    │ -150.0%
────────────────────────────────────────────────────────────────────────────────
```

### Reading the Table:

- **Gross P/L**: Profit/Loss before gas costs
- **Gas Cost**: Transaction fees (constant regardless of outcome)
- **Net P/L**: Your actual profit/loss after all costs
- **ROI**: Return as % of capital deployed

### Key Insights:

1. **Gas costs are fixed** - You pay them win or lose
2. **Expected case most realistic** - Based on AI probabilities
3. **Worst case > -100%** - Because of gas costs
4. **Need high edge** - To overcome gas costs

## When to Trade Based on Projections

### ✅ Green Light Indicators:

- [ ] Net Expected Profit > $1.00
- [ ] Expected ROI > 15%
- [ ] Best Case ROI > 50%
- [ ] At least 3 recommended trades
- [ ] Average confidence > 70%
- [ ] Average edge > 8%

### ⚠️ Yellow Light (Caution):

- [ ] Net Expected Profit: $0.25 - $1.00
- [ ] Expected ROI: 5% - 15%
- [ ] Gas costs are 30-50% of expected profit
- [ ] 1-2 recommended trades only
- [ ] Consider waiting for more opportunities

### 🛑 Red Light (Don't Trade):

- [x] Net Expected Profit < $0
- [x] Expected ROI < 0%
- [x] No trades recommended
- [x] Gas costs exceed expected profit
- [x] High risk scores across markets

## Tips for Maximizing Profit

1. **Trade More Positions**: Gas costs are per-trade, so more trades amortize the cost
   - 1 trade: $0.50 gas = 50% of $1 wager
   - 10 trades: $5 gas = 5% of $10 wagers

2. **Seek Higher Edge**: Target markets with >10% edge
   - 5% edge → marginal after gas
   - 10% edge → good after gas
   - 15%+ edge → excellent after gas

3. **Increase Wager Size**: Larger wagers make gas costs relatively smaller
   - $1 wager, $0.50 gas = 50% overhead
   - $5 wager, $0.50 gas = 10% overhead
   - ⚠️ But increases risk!

4. **Wait for High Confidence**: Only trade when AI is 70%+ confident
   - Higher win probability
   - Better expected value
   - Less variance

5. **Batch Trades**: Execute multiple trades in one session
   - Analyze 10+ markets
   - Pick top 5-8 trades
   - Execute all at once

## Example: Good vs Bad Opportunity

### ❌ Bad Opportunity
```
3 trades × $1 = $3 capital
Expected profit: +$0.45
Gas costs: -$1.50
Net: -$1.05 (-35% ROI)
```
**Don't trade** - Expected to lose money

### ✅ Good Opportunity
```
8 trades × $1 = $8 capital
Expected profit: +$3.20
Gas costs: -$4.00
Net: -$0.80 (-10% ROI)
```
**Still not good enough!** Need more edge.

### ✅✅ Excellent Opportunity
```
10 trades × $1 = $10 capital
Expected profit: +$7.50
Gas costs: -$5.00
Net: +$2.50 (+25% ROI)
```
**Trade this!** Strong positive expectation.

## Limitations & Disclaimers

### Important Notes:

1. **AI Predictions Uncertain**: The forecasts are probabilistic, not guaranteed
2. **Market Conditions Change**: Prices move between analysis and execution
3. **Slippage Not Included**: Actual execution prices may differ
4. **Resolution Uncertainty**: Markets may resolve unexpectedly
5. **Gas Price Volatility**: Actual gas costs may vary

### These Are Projections, Not Guarantees:

- Historical accuracy doesn't predict future results
- Markets are inherently uncertain
- Unexpected events can change outcomes
- Use projections for decision support only
- Always do your own research

## Summary

The profit projections give you:

✅ **Realistic expectations** of potential returns  
✅ **Risk assessment** (best/worst/expected cases)  
✅ **Cost awareness** (gas fees impact)  
✅ **Decision support** (ROI assessment)  
✅ **Confidence** before deploying capital  

Use them to:
- Decide whether to trade
- Size your positions
- Set profit expectations
- Manage risk
- Learn the system

**Remember**: Only trade when Expected ROI is positive and you understand all the risks!

---

*Generated by Sapience Trading Agent Dry Run System*
