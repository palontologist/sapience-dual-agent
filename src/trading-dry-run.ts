/**
 * Trading Agent Dry Run
 * 
 * Simulates trading without spending real money.
 * Fetches real market data and shows what trades the agent would make.
 * Perfect for testing before deploying capital.
 */

import Groq from 'groq-sdk';
import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from 'dotenv';

dotenv.config();

interface Market {
  id: string;
  question: string;
  description: string;
  platform?: string;
  yes_price?: number;
  no_price?: number;
  liquidity?: number;
  resolution_date?: string;
  volume?: number;
}

interface Forecast {
  probability: number;
  confidence: number;
  expectedValue: number;
  reasoning: string;
}

interface TradeDecision {
  marketId: string;
  marketQuestion: string;
  action: 'buy' | 'sell' | 'skip';
  side: 'YES' | 'NO' | null;
  size: number;
  reasoning: string;
  timestamp: number;
  confidence: number;
  expectedReturn: number;
  riskScore: number;
  stopLoss: number | null;
  takeProfit: number | null;
  currentPrice: number;
  fairValue: number;
  edge: number;
  // Profit projections
  entryPrice: number;
  projectedWinProfit: number;
  projectedLossAmount: number;
  breakEvenPrice: number;
}

interface DryRunResults {
  totalMarketsAnalyzed: number;
  tradesRecommended: number;
  tradesSkipped: number;
  avgConfidence: number;
  avgEdge: number;
  potentialCapitalDeployed: number;
  decisions: TradeDecision[];
  timestamp: string;
  // Profit projections
  projectedProfit: {
    bestCase: number;      // If all trades win
    worstCase: number;     // If all trades lose
    expectedCase: number;  // Probability-weighted
    roi: number;           // Expected ROI %
  };
  gasCosts: number;
  netExpectedProfit: number;
}

export class TradingDryRun {
  private groq: Groq;
  private walletAddress: string;
  private minConfidence: number = 0.65;
  private minEdge: number = 0.05; // 5% edge
  private wagerAmount: number = 1; // 1 USDe per trade
  private maxTrades: number;

  constructor(config: {
    groqApiKey: string;
    privateKey: string;
    arbitrumRpcUrl?: string;
    maxTrades?: number;
  }) {
    this.groq = new Groq({
      apiKey: config.groqApiKey,
    });
    
    // Get wallet address (but don't execute any transactions)
    const wallet = new ethers.Wallet(config.privateKey);
    this.walletAddress = wallet.address;
    this.maxTrades = config.maxTrades || 10;
  }

  /**
   * Fetch active markets from Sapience using GraphQL
   */
  async getMarkets(): Promise<Market[]> {
    try {
      console.log('\n📊 Fetching markets from Sapience...');
      
      // Use GraphQL endpoint like the forecasting agent
      const { gql, GraphQLClient } = await import('graphql-request');
      const graphqlClient = new GraphQLClient('https://api.sapience.xyz/graphql');
      
      const nowSec = Math.floor(Date.now() / 1000);
      const query = gql`
        query Conditions($nowSec: Int, $limit: Int) {
          conditions(
            where: { 
              public: { equals: true }
              endTime: { gt: $nowSec }
            }
            take: $limit
          ) {
            id
            question
            shortName
            endTime
            markets {
              id
              prices
              volume
            }
          }
        }
      `;
      
      const { conditions } = await graphqlClient.request<{ conditions: any[] }>(query, {
        nowSec,
        limit: 50,
      });

      // Convert to our Market format
      const markets: Market[] = conditions.map((condition: any) => {
        // Parse market prices if available
        let yes_price = 0.5;
        let no_price = 0.5;
        let volume = 0;
        
        if (condition.markets && condition.markets.length > 0) {
          const market = condition.markets[0];
          if (market.prices && market.prices.length >= 2) {
            yes_price = parseFloat(market.prices[0]) || 0.5;
            no_price = parseFloat(market.prices[1]) || 0.5;
          }
          volume = parseFloat(market.volume) || 0;
        }

        return {
          id: condition.id,
          question: condition.shortName || condition.question,
          description: condition.question,
          yes_price: yes_price,
          no_price: no_price,
          liquidity: volume,
          volume: volume,
          resolution_date: new Date(condition.endTime * 1000).toISOString(),
        };
      });

      console.log(`✅ Found ${markets.length} active markets`);
      return markets;
    } catch (error: any) {
      console.error("❌ Error fetching markets:", error.message);
      console.log('\n⚠️  Using demo markets for testing...\n');
      
      // Return demo markets for testing if API is unavailable
      return this.getDemoMarkets();
    }
  }

  /**
   * Get demo markets for testing when API is unavailable
   */
  private getDemoMarkets(): Market[] {
    return [
      {
        id: 'demo-btc-100k',
        question: 'Will Bitcoin reach $100,000 by end of 2025?',
        description: 'Resolves YES if Bitcoin (BTC) trades at or above $100,000 on any major exchange before December 31, 2025 23:59 UTC',
        yes_price: 0.47,
        no_price: 0.53,
        liquidity: 50000,
        volume: 125000,
        resolution_date: '2025-12-31T23:59:59Z',
      },
      {
        id: 'demo-eth-5k',
        question: 'Will Ethereum reach $5,000 in 2025?',
        description: 'Resolves YES if Ethereum (ETH) trades at or above $5,000 on any major exchange during 2025',
        yes_price: 0.62,
        no_price: 0.38,
        liquidity: 35000,
        volume: 89000,
        resolution_date: '2025-12-31T23:59:59Z',
      },
      {
        id: 'demo-trump-2024',
        question: 'Will Trump win the 2024 election?',
        description: 'Resolves YES if Donald Trump wins the 2024 US Presidential Election',
        yes_price: 0.51,
        no_price: 0.49,
        liquidity: 150000,
        volume: 500000,
        resolution_date: '2024-11-05T23:59:59Z',
      },
      {
        id: 'demo-ai-nobel',
        question: 'Will an AI system win a Nobel Prize by 2030?',
        description: 'Resolves YES if any AI system is awarded a Nobel Prize in any category before 2030',
        yes_price: 0.15,
        no_price: 0.85,
        liquidity: 25000,
        volume: 42000,
        resolution_date: '2030-01-01T00:00:00Z',
      },
      {
        id: 'demo-sp500-6k',
        question: 'Will S&P 500 reach 6,000 in 2025?',
        description: 'Resolves YES if the S&P 500 index closes at or above 6,000 any day in 2025',
        yes_price: 0.68,
        no_price: 0.32,
        liquidity: 75000,
        volume: 200000,
        resolution_date: '2025-12-31T23:59:59Z',
      },
    ];
  }

  /**
   * Generate forecast for a market
   */
  async generateForecast(market: Market): Promise<Forecast> {
    const prompt = `You are a prediction market forecasting expert. Analyze this market:

Market: "${market.question}"
Description: ${market.description || 'N/A'}
Current YES Price: ${((market.yes_price || 0.5) * 100).toFixed(1)}%
Current NO Price: ${((market.no_price || 0.5) * 100).toFixed(1)}%
Liquidity: $${market.liquidity?.toLocaleString() || 'N/A'}
Volume: $${market.volume?.toLocaleString() || 'N/A'}

Provide analysis in JSON format:
{
  "probability": <number 0-100>,
  "confidence": <number 0-100>,
  "expectedValue": <number>,
  "reasoning": "<detailed reasoning>"
}

Rules:
- probability: Your estimated probability for YES outcome (0-100)
- confidence: How confident you are (0-100) - consider data quality, time horizon, uncertainty
- expectedValue: Expected value multiplier (>1.0 = +EV, <1.0 = -EV)
- reasoning: Brief explanation with specific factors
- Use base rates, historical data, and quantitative analysis`;

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a professional prediction market forecaster specializing in probability estimation and value assessment.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: 'moonshotai/kimi-k2-instruct-0905',
        temperature: 0.4,
        max_tokens: 1024,
      });

      const content = chatCompletion.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from model response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      return {
        probability: Math.max(0, Math.min(100, analysis.probability)) / 100,
        confidence: Math.max(0, Math.min(100, analysis.confidence)) / 100,
        expectedValue: analysis.expectedValue,
        reasoning: analysis.reasoning,
      };
    } catch (error: any) {
      console.error(`  ⚠️  Forecast error: ${error.message}`);
      // Return neutral forecast on error
      return {
        probability: 0.5,
        confidence: 0.3,
        expectedValue: 1.0,
        reasoning: "Error generating forecast - defaulting to neutral",
      };
    }
  }

  /**
   * Evaluate trade decision
   */
  async evaluateTrade(
    market: Market,
    forecast: Forecast
  ): Promise<TradeDecision> {
    const currentYesPrice = market.yes_price || 0.5;
    const currentNoPrice = market.no_price || 0.5;
    
    // Calculate edge (difference between forecast and market price)
    const yesEdge = forecast.probability - currentYesPrice;
    const noEdge = (1 - forecast.probability) - currentNoPrice;
    
    // Determine best side
    let side: 'YES' | 'NO' | null = null;
    let edge = 0;
    let currentPrice = 0.5;
    
    if (Math.abs(yesEdge) > Math.abs(noEdge)) {
      side = yesEdge > 0 ? 'YES' : null;
      edge = yesEdge;
      currentPrice = currentYesPrice;
    } else {
      side = noEdge > 0 ? 'NO' : null;
      edge = noEdge;
      currentPrice = currentNoPrice;
    }

    // Risk management prompt
    const prompt = `You are a risk-management expert for prediction markets. Evaluate this trading opportunity:

Market: "${market.question}"
Current Price (${side || 'N/A'}): ${(currentPrice * 100).toFixed(1)}%
Forecast Probability (YES): ${(forecast.probability * 100).toFixed(1)}%
Edge: ${(edge * 100).toFixed(1)}%
Confidence: ${(forecast.confidence * 100).toFixed(1)}%
Expected Value: ${forecast.expectedValue.toFixed(3)}
Liquidity: $${market.liquidity?.toLocaleString() || 'N/A'}

Forecast Reasoning: ${forecast.reasoning}

Apply Kelly criterion and risk management. Provide decision in JSON:
{
  "action": "BUY" or "SKIP",
  "size": <number 0-1>,
  "reasoning": "<risk assessment>",
  "riskScore": <number 0-100>,
  "stopLoss": <number or null>,
  "takeProfit": <number or null>
}

Rules:
- action: BUY if edge > 5% AND confidence > 65%, else SKIP
- size: Kelly stake capped at 10% of bankroll (0.1 max)
- riskScore: 0-100 based on volatility, liquidity, time horizon, confidence
- stopLoss/takeProfit: Price levels to exit (or null)
- Consider slippage, liquidity constraints, and market efficiency`;

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a risk-management expert specializing in prediction market trading with Kelly criterion and proper position sizing.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: 'moonshotai/kimi-k2-instruct-0905',
        temperature: 0.5,
        max_tokens: 1024,
      });

      const content = chatCompletion.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from model response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Calculate profit projections
      const entryPrice = currentPrice;
      const wagerAmount = this.wagerAmount;
      
      // If YES: win if resolves to 1 (100%), lose if resolves to 0
      // If NO: win if resolves to 0, lose if resolves to 1
      // Win payout = wager / entry_price (e.g., $1 / 0.47 = $2.13)
      // Loss = -wager amount
      const projectedWinProfit = side === 'YES' 
        ? (wagerAmount / entryPrice) - wagerAmount  // Profit = payout - wager
        : (wagerAmount / (1 - entryPrice)) - wagerAmount;
      const projectedLossAmount = -wagerAmount;
      const breakEvenPrice = side === 'YES' 
        ? 1 / (1 + projectedWinProfit / wagerAmount)
        : 1 - (1 / (1 + projectedWinProfit / wagerAmount));

      const decision: TradeDecision = {
        marketId: market.id,
        marketQuestion: market.question,
        action: analysis.action.toLowerCase() === 'buy' ? 'buy' : 'skip',
        side: side,
        size: Math.min(analysis.size || 0, 0.1), // Cap at 10%
        reasoning: analysis.reasoning,
        timestamp: Date.now(),
        confidence: forecast.confidence,
        expectedReturn: forecast.expectedValue,
        riskScore: (analysis.riskScore || 50) / 100,
        stopLoss: analysis.stopLoss,
        takeProfit: analysis.takeProfit,
        currentPrice: currentPrice,
        fairValue: forecast.probability,
        edge: edge,
        // Profit projections
        entryPrice: entryPrice,
        projectedWinProfit: projectedWinProfit,
        projectedLossAmount: projectedLossAmount,
        breakEvenPrice: breakEvenPrice,
      };

      return decision;
    } catch (error: any) {
      console.error(`  ⚠️  Evaluation error: ${error.message}`);
      
      // Return safe default decision
      return {
        marketId: market.id,
        marketQuestion: market.question,
        action: 'skip',
        side: null,
        size: 0,
        reasoning: "Error during evaluation - defaulting to SKIP for safety",
        timestamp: Date.now(),
        confidence: forecast.confidence,
        expectedReturn: forecast.expectedValue,
        riskScore: 1.0,
        stopLoss: null,
        takeProfit: null,
        currentPrice: currentPrice,
        fairValue: forecast.probability,
        edge: edge,
        entryPrice: currentPrice,
        projectedWinProfit: 0,
        projectedLossAmount: 0,
        breakEvenPrice: currentPrice,
      };
    }
  }

  /**
   * Display trade decision
   */
  displayDecision(decision: TradeDecision, index: number): void {
    const action = decision.action === 'buy' ? '✅ BUY' : '⏭️  SKIP';
    const edgeColor = decision.edge > 0.1 ? '🟢' : decision.edge > 0.05 ? '🟡' : '🔴';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 MARKET #${index + 1}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Question: ${decision.marketQuestion}`);
    console.log(`\n💰 PRICING:`);
    console.log(`   Market Price: ${(decision.currentPrice * 100).toFixed(1)}%`);
    console.log(`   Fair Value: ${(decision.fairValue * 100).toFixed(1)}%`);
    console.log(`   Edge: ${edgeColor} ${(decision.edge * 100).toFixed(1)}%`);
    console.log(`\n🎯 DECISION: ${action}`);
    
    if (decision.action === 'buy') {
      console.log(`   Side: ${decision.side}`);
      console.log(`   Size: ${(decision.size * 100).toFixed(1)}% of bankroll`);
      console.log(`   Amount: ${this.wagerAmount} USDe`);
      console.log(`\n💵 PROFIT PROJECTION:`);
      console.log(`   Entry Price: ${(decision.entryPrice * 100).toFixed(1)}%`);
      console.log(`   If WIN: +$${decision.projectedWinProfit.toFixed(2)} (${((decision.projectedWinProfit / this.wagerAmount) * 100).toFixed(1)}% ROI)`);
      console.log(`   If LOSE: $${decision.projectedLossAmount.toFixed(2)} (-100% ROI)`);
      console.log(`   Break-Even Price: ${(decision.breakEvenPrice * 100).toFixed(1)}%`);
      
      if (decision.stopLoss) {
        console.log(`   Stop Loss: ${(decision.stopLoss * 100).toFixed(1)}%`);
      }
      if (decision.takeProfit) {
        console.log(`   Take Profit: ${(decision.takeProfit * 100).toFixed(1)}%`);
      }
    }
    
    console.log(`\n📊 METRICS:`);
    console.log(`   Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`   Expected Return: ${decision.expectedReturn.toFixed(3)}x`);
    console.log(`   Risk Score: ${(decision.riskScore * 100).toFixed(1)}%`);
    console.log(`\n💭 REASONING:`);
    console.log(`   ${decision.reasoning}`);
  }

  /**
   * Generate summary report
   */
  generateReport(results: DryRunResults): void {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📊 DRY RUN SUMMARY REPORT`);
    console.log(`${'='.repeat(80)}`);
    console.log(`\n🤖 Agent: Trading Agent (Dry Run Mode)`);
    console.log(`💼 Wallet: ${this.walletAddress}`);
    console.log(`⏰ Timestamp: ${results.timestamp}`);
    console.log(`\n📈 ANALYSIS:`);
    console.log(`   Markets Analyzed: ${results.totalMarketsAnalyzed}`);
    console.log(`   Trades Recommended: ${results.tradesRecommended}`);
    console.log(`   Trades Skipped: ${results.tradesSkipped}`);
    console.log(`   Success Rate: ${((results.tradesRecommended / results.totalMarketsAnalyzed) * 100).toFixed(1)}%`);
    
    if (results.tradesRecommended > 0) {
      console.log(`\n💰 CAPITAL ALLOCATION:`);
      console.log(`   Wager per Trade: ${this.wagerAmount} USDe`);
      console.log(`   Total Capital Required: ${results.potentialCapitalDeployed} USDe`);
      console.log(`   Average Confidence: ${results.avgConfidence.toFixed(1)}%`);
      console.log(`   Average Edge: ${results.avgEdge.toFixed(1)}%`);
      
      console.log(`\n💵 PROFIT PROJECTIONS:`);
      console.log(`   📈 Best Case (All Win): +$${results.projectedProfit.bestCase.toFixed(2)}`);
      console.log(`   📉 Worst Case (All Lose): $${results.projectedProfit.worstCase.toFixed(2)}`);
      console.log(`   🎯 Expected Case (Probability-Weighted): $${results.projectedProfit.expectedCase.toFixed(2)}`);
      console.log(`   ⛽ Gas Costs (Est.): -$${results.gasCosts.toFixed(2)}`);
      console.log(`   💎 Net Expected Profit: $${results.netExpectedProfit.toFixed(2)}`);
      console.log(`   📊 Expected ROI: ${results.projectedProfit.roi > 0 ? '+' : ''}${results.projectedProfit.roi.toFixed(1)}%`);
      
      // ROI Analysis
      const roiColor = results.projectedProfit.roi > 20 ? '🟢' : 
                       results.projectedProfit.roi > 10 ? '🟡' : 
                       results.projectedProfit.roi > 0 ? '🔵' : '🔴';
      const roiLabel = results.projectedProfit.roi > 20 ? 'EXCELLENT' :
                       results.projectedProfit.roi > 10 ? 'GOOD' :
                       results.projectedProfit.roi > 0 ? 'MARGINAL' : 'NEGATIVE';
      console.log(`   ${roiColor} Assessment: ${roiLabel}`);
      
      console.log(`\n🎯 RECOMMENDED TRADES:`);
      const buyDecisions = results.decisions.filter(d => d.action === 'buy');
      
      buyDecisions.forEach((decision, i) => {
        console.log(`\n   ${i + 1}. ${decision.marketQuestion.substring(0, 60)}...`);
        console.log(`      Side: ${decision.side} @ ${(decision.currentPrice * 100).toFixed(1)}%`);
        console.log(`      Edge: ${(decision.edge * 100).toFixed(1)}% | Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
        console.log(`      💰 If Win: +$${decision.projectedWinProfit.toFixed(2)} | If Lose: $${decision.projectedLossAmount.toFixed(2)}`);
      });
      
      console.log(`\n\n📊 PROFIT SUMMARY TABLE:`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`   Scenario              │ Gross P/L │ Gas Cost │ Net P/L   │ ROI`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`   Best Case (All Win)   │ +$${results.projectedProfit.bestCase.toFixed(2).padEnd(8)} │ -$${results.gasCosts.toFixed(2).padEnd(7)} │ +$${(results.projectedProfit.bestCase - results.gasCosts).toFixed(2).padEnd(8)} │ +${((results.projectedProfit.bestCase - results.gasCosts) / results.potentialCapitalDeployed * 100).toFixed(1)}%`);
      console.log(`   Expected Case         │ ${results.projectedProfit.expectedCase >= 0 ? '+' : ''}$${results.projectedProfit.expectedCase.toFixed(2).padEnd(8)} │ -$${results.gasCosts.toFixed(2).padEnd(7)} │ ${results.netExpectedProfit >= 0 ? '+' : ''}$${results.netExpectedProfit.toFixed(2).padEnd(8)} │ ${results.projectedProfit.roi >= 0 ? '+' : ''}${results.projectedProfit.roi.toFixed(1)}%`);
      console.log(`   Worst Case (All Lose) │ $${results.projectedProfit.worstCase.toFixed(2).padEnd(8)} │ -$${results.gasCosts.toFixed(2).padEnd(7)} │ $${(results.projectedProfit.worstCase - results.gasCosts).toFixed(2).padEnd(8)} │ ${((results.projectedProfit.worstCase - results.gasCosts) / results.potentialCapitalDeployed * 100).toFixed(1)}%`);
      console.log(`${'─'.repeat(80)}`);
    } else {
      console.log(`\n⚠️  NO TRADES RECOMMENDED`);
      console.log(`   Reasons: Insufficient edge or low confidence on all markets`);
      console.log(`   Suggestion: Wait for better opportunities or adjust risk parameters`);
    }
    
    console.log(`\n\n✨ DRY RUN COMPLETE!`);
    console.log(`\n📝 NEXT STEPS:`);
    console.log(`   1. Review the recommended trades above`);
    console.log(`   2. Adjust risk parameters if needed (minConfidence, minEdge)`);
    console.log(`   3. Fund your wallet with ${results.potentialCapitalDeployed}+ USDe`);
    console.log(`   4. Run the live trading agent to execute trades`);
    console.log(`   5. Monitor results at https://sapience.xyz/leaderboard`);
    console.log(`\n⚠️  DISCLAIMER: This is a simulation. Past performance doesn't guarantee future results.`);
    console.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Main dry run execution
   */
  async run(): Promise<DryRunResults> {
    console.log(`\n${'='.repeat(80)}`);
    console.log('🧪 TRADING AGENT DRY RUN MODE');
    console.log(`${'='.repeat(80)}`);
    console.log('\n⚠️  DRY RUN: No real trades will be executed');
    console.log('📊 Fetching real market data and analyzing opportunities...\n');
    console.log(`💼 Wallet: ${this.walletAddress}`);
    console.log(`💰 Simulated Budget: ${this.maxTrades} USDe (${this.maxTrades} trades @ ${this.wagerAmount} USDe each)`);
    console.log(`🎯 Min Confidence: ${(this.minConfidence * 100).toFixed(0)}%`);
    console.log(`📊 Min Edge: ${(this.minEdge * 100).toFixed(0)}%`);

    try {
      // Fetch markets
      const markets = await this.getMarkets();
      
      if (markets.length === 0) {
        throw new Error('No markets available');
      }

      const decisions: TradeDecision[] = [];
      let tradesRecommended = 0;

      // Analyze each market
      for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        
        console.log(`\n\n${'▬'.repeat(80)}`);
        console.log(`🔍 Analyzing Market ${i + 1}/${markets.length}`);
        console.log(`${'▬'.repeat(80)}`);
        console.log(`${market.question}`);

        try {
          // Generate forecast
          console.log('\n⏳ Generating forecast...');
          const forecast = await this.generateForecast(market);
          console.log(`✅ Forecast: ${(forecast.probability * 100).toFixed(1)}% (confidence: ${(forecast.confidence * 100).toFixed(1)}%)`);

          // Evaluate trade
          console.log('⏳ Evaluating trade...');
          const decision = await this.evaluateTrade(market, forecast);
          decisions.push(decision);

          // Display decision
          this.displayDecision(decision, i);

          if (decision.action === 'buy') {
            tradesRecommended++;
            
            if (tradesRecommended >= this.maxTrades) {
              console.log(`\n\n✋ Reached max trades (${this.maxTrades}), stopping analysis`);
              break;
            }
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error: any) {
          console.error(`\n❌ Error analyzing market: ${error.message}`);
          continue;
        }
      }

      // Calculate statistics
      const buyDecisions = decisions.filter(d => d.action === 'buy');
      const avgConfidence = buyDecisions.length > 0
        ? (buyDecisions.reduce((sum, d) => sum + d.confidence, 0) / buyDecisions.length) * 100
        : 0;
      const avgEdge = buyDecisions.length > 0
        ? (buyDecisions.reduce((sum, d) => sum + d.edge, 0) / buyDecisions.length) * 100
        : 0;

      // Calculate profit projections
      const gasCostPerTrade = 0.0015; // ~$0.50 in ETH at $3000/ETH
      const totalGasCosts = tradesRecommended * gasCostPerTrade * 3000; // Convert to USD
      
      let bestCaseProfit = 0;
      let worstCaseProfit = 0;
      let expectedProfit = 0;
      
      buyDecisions.forEach(decision => {
        // Best case: all trades win
        bestCaseProfit += decision.projectedWinProfit;
        
        // Worst case: all trades lose
        worstCaseProfit += decision.projectedLossAmount;
        
        // Expected case: probability-weighted
        // Expected value = (probability * win) + ((1 - probability) * loss)
        const winProb = decision.side === 'YES' ? decision.fairValue : (1 - decision.fairValue);
        const expectedValue = (winProb * decision.projectedWinProfit) + 
                             ((1 - winProb) * decision.projectedLossAmount);
        expectedProfit += expectedValue;
      });
      
      const capitalDeployed = tradesRecommended * this.wagerAmount;
      const netExpectedProfit = expectedProfit - totalGasCosts;
      const expectedROI = capitalDeployed > 0 ? (netExpectedProfit / capitalDeployed) * 100 : 0;

      const results: DryRunResults = {
        totalMarketsAnalyzed: decisions.length,
        tradesRecommended: tradesRecommended,
        tradesSkipped: decisions.length - tradesRecommended,
        avgConfidence: avgConfidence,
        avgEdge: avgEdge,
        potentialCapitalDeployed: capitalDeployed,
        decisions: decisions,
        timestamp: new Date().toISOString(),
        projectedProfit: {
          bestCase: bestCaseProfit,
          worstCase: worstCaseProfit,
          expectedCase: expectedProfit,
          roi: expectedROI,
        },
        gasCosts: totalGasCosts,
        netExpectedProfit: netExpectedProfit,
      };

      // Generate report
      this.generateReport(results);

      return results;
    } catch (error: any) {
      console.error('\n❌ Fatal error:', error.message);
      throw error;
    }
  }
}

// Main execution
if (require.main === module) {
  const dryRun = new TradingDryRun({
    groqApiKey: process.env.GROQ_API_KEY || "",
    privateKey: process.env.PRIVATE_KEY || "",
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
    maxTrades: parseInt(process.env.MAX_TRADES || '10'),
  });

  dryRun.run()
    .then((results) => {
      console.log('\n✅ Dry run completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Dry run failed:', error);
      process.exit(1);
    });
}

export default TradingDryRun;
