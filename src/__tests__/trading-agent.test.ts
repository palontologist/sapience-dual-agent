
import { TradingAgent } from '../agents/trading-agent';
import axios from 'axios';
import { Anthropic } from '@anthropic-ai/sdk';
import { ethers } from 'ethers';

// Mock dependencies
jest.mock('axios');
jest.mock('@anthropic-ai/sdk');
jest.mock('ethers');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;
const mockedEthers = ethers as any;

describe('TradingAgent', () => {
  let agent: TradingAgent;
  const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
  const mockAnthropicCreate = jest.fn();
  const mockContract = {
      approve: jest.fn(),
      placeTrade: jest.fn(),
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockAnthropicCreate.mockClear();
    mockContract.approve.mockClear();
    mockContract.placeTrade.mockClear();

    mockedAnthropic.mockImplementation(() => ({
        messages: {
            create: mockAnthropicCreate,
        },
    }) as any);

    // Mock ethers
    mockedEthers.JsonRpcProvider = jest.fn();
    mockedEthers.Wallet = jest.fn().mockImplementation(() => ({
      privateKey,
    }));
    mockedEthers.getAddress = jest.fn().mockReturnValue('0xTestAddress');
    mockedEthers.computeAddress = jest.fn().mockReturnValue('0xTestAddress');
    mockedEthers.SigningKey = jest.fn();
    mockedEthers.Contract = jest.fn().mockReturnValue(mockContract);
    mockedEthers.parseUnits = jest.fn().mockImplementation((value, decimals = 18) => {
      const factor = BigInt(10) ** BigInt(decimals);
      const [integer, decimal = '0'] = String(value).split('.');
      const decimalPadded = decimal.padEnd(decimals, '0').slice(0, decimals);
      return BigInt(integer) * factor + BigInt(decimalPadded);
    });

    agent = new TradingAgent(privateKey, 'http://localhost:8545');
  });

  describe('getMarkets', () => {
    it('should fetch and return active markets', async () => {
      const mockMarkets = {
        data: {
          markets: [
            { id: '1', question: 'Market 1?', description: 'description', resolution_date: 'date', yes_price: 0.5, no_price: 0.5, liquidity: 1000 },
          ],
        },
      };
      mockedAxios.get.mockResolvedValue(mockMarkets);

      const markets = await agent.getMarkets();

      expect(mockedAxios.get).toHaveBeenCalledWith('https://api.sapience.xyz/markets', {
        params: {
          status: 'active',
          limit: 50,
        },
      });
      expect(markets).toEqual(mockMarkets.data.markets);
    });

    it('should return an empty array if fetching markets fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const markets = await agent.getMarkets();

      expect(markets).toEqual([]);
    });
  });

  describe('generatePrediction', () => {
    it('should generate a prediction for a given market', async () => {
        const mockMarket = { id: '1', question: 'Market 1?', description: 'Test Market', resolution_date: '2025-12-31', yes_price: 0.5, no_price: 0.5, liquidity: 1000 };
        const mockResponse = {
            content: [{
                type: 'text',
                text: '{\n"predicted_outcome": "YES",\n"confidence": 0.8,\n"reasoning": "Test reasoning",\n"fair_value": 0.6,\n"recommendation": "BUY_YES"\n}',
            }],
        };
        mockAnthropicCreate.mockResolvedValue(mockResponse);

        const prediction = await agent.generatePrediction(mockMarket);

        expect(mockAnthropicCreate).toHaveBeenCalled();
        expect(prediction).toEqual({
            market_id: '1',
            market_question: 'Market 1?',
            predicted_outcome: 'YES',
            confidence: 0.8,
            reasoning: 'Test reasoning',
            recommendation: 'BUY_YES',
            expected_value: 1.2,
        });
    });
  });

  describe('executeTrade', () => {
      it('should execute a trade', async () => {
          const mockPrediction = {
              market_id: '1',
              market_question: 'Market 1?',
              predicted_outcome: 'YES',
              confidence: 0.8,
              reasoning: 'Test reasoning',
              recommendation: 'BUY_YES',
              expected_value: 1.2,
          } as any;
          const mockMarket = { id: '1', question: 'Market 1?', description: 'Test Market', resolution_date: '2025-12-31', yes_price: 0.5, no_price: 0.5, liquidity: 1000 };

          mockContract.approve.mockResolvedValue({ wait: jest.fn().mockResolvedValue({}) });
          mockContract.placeTrade.mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: '0xTxHash' }) });

          const trade = await agent.executeTrade(mockPrediction, mockMarket);

          expect(trade.market_id).toBe('1');
          expect(trade.outcome).toBe('YES');
          expect(trade.amount).toBe(1);
          expect(trade.price).toBe(0.5);
          expect(mockContract.approve).toHaveBeenCalled();
          expect(mockContract.placeTrade).toHaveBeenCalled();
          expect(trade.transaction_hash).toBe('0xTxHash');
      });

      it('should throw an error if trade execution fails', async () => {
        const mockPrediction = { recommendation: 'BUY_YES' } as any;
        const mockMarket = { yes_price: 0.5, no_price: 0.5 } as any;
  
        mockContract.approve.mockRejectedValue(new Error('Execution failed'));
  
        await expect(agent.executeTrade(mockPrediction, mockMarket)).rejects.toThrow('Execution failed');
      });
  });

  describe('shouldTrade', () => {
      it('should return true for a valid trade recommendation', () => {
          const mockPrediction = {
              recommendation: 'BUY_YES',
              confidence: 0.7,
              expected_value: 1.2,
          } as any;

          const result = agent.shouldTrade(mockPrediction);

          expect(result).toBe(true);
      });

      it('should return false if recommendation is to skip', () => {
          const mockPrediction = {
              recommendation: 'SKIP',
              confidence: 0.7,
              expected_value: 1.2,
          } as any;

          const result = agent.shouldTrade(mockPrediction);

          expect(result).toBe(false);
      });

      it('should return false if confidence is too low', () => {
          const mockPrediction = {
              recommendation: 'BUY_YES', 
              confidence: 0.6, 
              expected_value: 1.2, 
          } as any;

          const result = agent.shouldTrade(mockPrediction);

          expect(result).toBe(false);
      });

      it('should return false if expected value is too low', () => {
          const mockPrediction = {
              recommendation: 'BUY_YES',
              confidence: 0.7,
              expected_value: 1.05,
          } as any;

          const result = agent.shouldTrade(mockPrediction);

          expect(result).toBe(false);
      });
  });
describe('evaluateTrade', () => {
  let mockGroqCreate: jest.Mock;

  beforeEach(() => {
    mockGroqCreate = jest.fn();
    agent = new TradingAgent({
      groqApiKey: 'test-groq-key',
      privateKey: privateKey,
      arbitrumRpcUrl: 'http://localhost:8545',
    });
    (agent as any).groq = {
      chat: {
        completions: {
          create: mockGroqCreate,
        },
      },
    };
  });

  it('should evaluate a trade and return a decision', async () => {
    const mockMarket = {
      id: '1',
      question: 'Will BTC reach $100k by EOY?',
      description: 'Bitcoin price prediction',
      yes_price: 0.65,
      no_price: 0.35,
      liquidity: 10000,
    };

    const mockForecast = {
      probability: 0.75,
      confidence: 0.80,
      expectedValue: 1.25,
      reasoning: 'Strong technical indicators and market momentum',
    };

    const mockGroqResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            action: 'BUY',
            size: 0.08,
            reasoning: 'Positive edge with good risk/reward ratio',
            riskScore: 45,
            stopLoss: 0.55,
            takeProfit: 0.85,
          }),
        },
      }],
    };

    mockGroqCreate.mockResolvedValue(mockGroqResponse);

    const decision = await agent.evaluateTrade(mockMarket, mockForecast);

    expect(mockGroqCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'moonshotai/kimi-k2-instruct-0905',
        temperature: 0.5,
        max_tokens: 2048,
      })
    );

    expect(decision).toMatchObject({
      marketId: '1',
      action: 'buy',
      size: 0.08,
      reasoning: 'Positive edge with good risk/reward ratio',
      confidence: 0.80,
      expectedReturn: 1.25,
      riskScore: 0.45,
      stopLoss: 0.55,
      takeProfit: 0.85,
    });
    expect(decision.timestamp).toBeGreaterThan(0);
  });

  it('should cap position size at 10%', async () => {
    const mockMarket = {
      id: '2',
      question: 'Test market',
      description: 'Test',
      yes_price: 0.5,
    };

    const mockForecast = {
      probability: 0.8,
      confidence: 0.9,
      expectedValue: 1.5,
      reasoning: 'Test',
    };

    const mockGroqResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            action: 'BUY',
            size: 0.25, // Exceeds 10% cap
            reasoning: 'High confidence trade',
            riskScore: 30,
            stopLoss: null,
            takeProfit: null,
          }),
        },
      }],
    };

    mockGroqCreate.mockResolvedValue(mockGroqResponse);

    const decision = await agent.evaluateTrade(mockMarket, mockForecast);

    expect(decision.size).toBe(0.1); // Capped at 10%
  });

  it('should handle SKIP action correctly', async () => {
    const mockMarket = {
      id: '3',
      question: 'Uncertain market',
      description: 'High volatility',
      yes_price: 0.5,
    };

    const mockForecast = {
      probability: 0.52,
      confidence: 0.60,
      expectedValue: 1.05,
      reasoning: 'Insufficient edge',
    };

    const mockGroqResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            action: 'SKIP',
            size: 0,
            reasoning: 'Insufficient edge and low confidence',
            riskScore: 75,
            stopLoss: null,
            takeProfit: null,
          }),
        },
      }],
    };

    mockGroqCreate.mockResolvedValue(mockGroqResponse);

    const decision = await agent.evaluateTrade(mockMarket, mockForecast);

    expect(decision.action).toBe('skip');
    expect(decision.size).toBe(0);
    expect(decision.riskScore).toBe(0.75);
  });

  it('should throw error if Groq API fails', async () => {
    const mockMarket = {
      id: '4',
      question: 'Test',
      description: 'Test',
      yes_price: 0.5,
    };

    const mockForecast = {
      probability: 0.7,
      confidence: 0.8,
      expectedValue: 1.2,
      reasoning: 'Test',
    };

    mockGroqCreate.mockRejectedValue(new Error('API rate limit exceeded'));

    await expect(agent.evaluateTrade(mockMarket, mockForecast)).rejects.toThrow('API rate limit exceeded');
  });

  it('should throw error if response is not valid JSON', async () => {
    const mockMarket = {
      id: '5',
      question: 'Test',
      description: 'Test',
      yes_price: 0.5,
    };

    const mockForecast = {
      probability: 0.7,
      confidence: 0.8,
      expectedValue: 1.2,
      reasoning: 'Test',
    };

    const mockGroqResponse = {
      choices: [{
        message: {
          content: 'This is not JSON',
        },
      }],
    };

    mockGroqCreate.mockResolvedValue(mockGroqResponse);

    await expect(agent.evaluateTrade(mockMarket, mockForecast)).rejects.toThrow('Could not extract JSON from model response');
  });

  it('should normalize action to lowercase', async () => {
    const mockMarket = {
      id: '6',
      question: 'Test',
      description: 'Test',
      yes_price: 0.5,
    };

    const mockForecast = {
      probability: 0.7,
      confidence: 0.8,
      expectedValue: 1.2,
      reasoning: 'Test',
    };

    const mockGroqResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            action: 'SELL', // Uppercase
            size: 0.05,
            reasoning: 'Overvalued',
            riskScore: 40,
            stopLoss: null,
            takeProfit: null,
          }),
        },
      }],
    };

    mockGroqCreate.mockResolvedValue(mockGroqResponse);

    const decision = await agent.evaluateTrade(mockMarket, mockForecast);

    expect(decision.action).toBe('sell'); // Should be lowercase
  });
});
});
