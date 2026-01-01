# Trading Agent: Dry Run vs Live Trading

## Quick Comparison

| Feature | Dry Run Mode | Live Trading Mode |
|---------|--------------|-------------------|
| **Command** | `pnpm dry-run` | `pnpm cli` or via API |
| **Market Data** | ✅ Real data (or demo) | ✅ Real data |
| **AI Forecasts** | ✅ Generated | ✅ Generated |
| **Risk Analysis** | ✅ Calculated | ✅ Calculated |
| **Trade Decisions** | ✅ Shown | ✅ Executed |
| **Blockchain TXs** | ❌ Simulated | ✅ Real |
| **Costs Money** | ❌ Free | ✅ Yes (USDe + gas) |
| **Gas Fees** | ❌ No | ✅ ~$0.50 per trade |
| **Leaderboard** | ❌ No | ✅ Yes |
| **Refundable** | N/A | ❌ No |
| **Best For** | Testing, learning | Profit, competition |

## When to Use Each Mode

### 🧪 Use Dry Run When:

1. **First time setup**
   - Testing if everything works
   - Verifying API connections
   - Understanding the agent's logic

2. **Learning the system**
   - Understanding risk metrics
   - Seeing how the AI thinks
   - Evaluating trading strategies

3. **Parameter tuning**
   - Testing different confidence thresholds
   - Adjusting risk parameters
   - Optimizing trade selection

4. **Market research**
   - Analyzing current opportunities
   - Comparing market efficiency
   - Identifying trends

5. **No money yet**
   - Don't have USDe
   - Waiting to fund wallet
   - Planning capital allocation

### 💰 Use Live Trading When:

1. **Confident in system**
   - Ran multiple successful dry runs
   - Understand all metrics
   - Comfortable with risk

2. **Found good opportunities**
   - Dry run shows high-confidence trades
   - Multiple markets with edge >7%
   - Low risk scores

3. **Ready to compete**
   - Want to appear on leaderboard
   - Ready to manage positions
   - Have capital allocated

4. **Comfortable with costs**
   - Willing to pay gas fees
   - Accept risk of loss
   - Capital is patient money

## Workflow Recommendation

```
1. Run Dry Run (Quick Test)
   ↓
2. Review Results
   ↓
3. Adjust Parameters (if needed)
   ↓
4. Run Full Dry Run
   ↓
5. Analyze Recommendations
   ↓
6. Fund Wallet with USDe
   ↓
7. Run Live Trading (Small)
   ↓
8. Monitor Results
   ↓
9. Scale Up Gradually
```

## Example Scenario

### Day 1: Learning
```bash
# Quick test
pnpm test:dry-run

# Read the output, understand metrics
# Review DRY_RUN_GUIDE.md

# Full dry run
pnpm dry-run

# Analyze all recommendations
# Take notes on reasoning
```

### Day 2-3: Testing
```bash
# Run multiple dry runs at different times
pnpm dry-run  # Morning
pnpm dry-run  # Evening

# Compare results, look for patterns
# Adjust confidence/edge thresholds if needed
```

### Day 4: Going Live (if confident)
```bash
# Fund wallet with small amount (5-10 USDe)
# Set MAX_TRADES=2 for first live run
# Execute live trading
# Monitor closely
```

### Day 5+: Scaling
```bash
# If successful, increase capital
# Run more frequent trades
# Monitor leaderboard position
# Refine strategy based on results
```

## Cost Analysis

### Dry Run Costs
- **Money**: $0
- **Time**: ~5-10 minutes
- **API calls**: Free (Groq free tier)
- **Risk**: None

### Live Trading Costs (per trade)
- **Wager**: 1 USDe (~$1)
- **Gas fee**: ~$0.50 (Arbitrum)
- **Total**: ~$1.50 per trade
- **Risk**: Can lose entire wager

### Break-Even Analysis

If the agent recommends trades with:
- Average edge: 10%
- Win rate: 60%
- 10 trades

**Expected result**:
- Wins: 6 trades × $1 × 1.10 = $6.60 profit
- Losses: 4 trades × $1 = -$4.00 loss
- Gas: 10 × $0.50 = -$5.00
- **Net**: -$2.40 loss

This shows you need:
- Higher edge (>15%)
- Better win rate (>70%)
- More trades (to amortize gas)
- Larger wagers (but more risk)

## Safety Checklist

Before going live, ensure:

- [ ] Ran at least 3 dry runs
- [ ] Understand all metrics (edge, confidence, risk)
- [ ] Read and understand AI reasoning
- [ ] Reviewed recommended trades
- [ ] Checked market liquidity
- [ ] Funded wallet with small test amount
- [ ] Have stop-loss strategy
- [ ] Comfortable with potential losses
- [ ] Set position limits (MAX_TRADES)
- [ ] Understand gas costs
- [ ] Know how to monitor positions
- [ ] Have exit strategy

## Red Flags (Don't Trade)

🚨 **Stop and reconsider if**:

- Dry run shows no recommended trades
- All confidence scores <65%
- High risk scores (>60%) across markets
- AI reasoning is unclear or contradictory
- Low liquidity markets (<$10k)
- You don't understand the metrics
- You're uncomfortable with losses
- Testing with money you need
- Haven't read the documentation

## Green Lights (Proceed with Caution)

✅ **Consider live trading if**:

- Multiple dry runs show consistent results
- 3+ trades with confidence >70%
- Average edge >7%
- Risk scores <50%
- Clear, logical AI reasoning
- Good liquidity (>$50k)
- You understand all decisions
- Using only risk capital
- Have monitored dry runs for 2-3 days
- Comfortable with system

## Tips for Success

1. **Start with dry runs** - Always
2. **Be patient** - Don't rush to live trading
3. **Understand first** - Read all docs
4. **Start small** - 2-3 trades maximum initially
5. **Monitor closely** - Check positions daily
6. **Learn from results** - Both wins and losses
7. **Adjust gradually** - Fine-tune based on data
8. **Don't chase losses** - Stick to strategy
9. **Take profits** - Don't be greedy
10. **Know when to stop** - Set loss limits

## FAQ

**Q: How long should I run dry runs before going live?**  
A: At least 2-3 days with 5+ dry runs. Look for consistent patterns.

**Q: What if dry run never recommends trades?**  
A: Markets may be efficiently priced, or your thresholds are too high. This is valuable information - wait for better opportunities.

**Q: Can I trust the AI's reasoning?**  
A: The AI provides logical analysis, but it can be wrong. Always validate with your own research. Use dry run to build confidence.

**Q: What's a good confidence threshold?**  
A: Start with 65-70%. Lower = more trades but less certain. Higher = fewer but more confident trades.

**Q: How much capital do I need?**  
A: Start with 5-10 USDe ($5-10) for testing. Scale up only after success.

**Q: What if I lose money?**  
A: Prediction markets are uncertain. Only trade with money you can afford to lose. Dry run helps minimize surprises.

**Q: How often should I run the agent?**  
A: Start with once daily. As you get comfortable, you can increase frequency.

**Q: Can I modify the agent?**  
A: Yes! The code is open. Start with dry runs after any changes to verify behavior.

## Summary

**Dry Run = Learning & Testing (No Risk)**
- Use extensively before any live trading
- Run multiple times at different market conditions
- Understand every metric and decision
- Free and safe

**Live Trading = Real Competition (Real Risk)**
- Only after extensive dry running
- Start with minimal capital
- Monitor closely
- Accept possibility of losses
- Potential for profit and leaderboard ranking

---

**Remember**: The goal of dry run is to give you confidence and understanding BEFORE risking real money. Use it extensively!

🚀 **Start with**: `pnpm test:dry-run`
