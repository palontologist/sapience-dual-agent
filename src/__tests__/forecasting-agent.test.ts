
import { ForecastingAgent } from '../agents/forecasting-agent';
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

describe('ForecastingAgent', () => {
  let agent: ForecastingAgent;
  const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
  const mockAnthropicCreate = jest.fn();
  const mockContractAttest = jest.fn();

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockAnthropicCreate.mockClear();
    mockContractAttest.mockClear();

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
    mockedEthers.AbiCoder = {
        defaultAbiCoder: jest.fn().mockReturnValue({
            encode: jest.fn().mockReturnValue('0xEncodedData'),
        }),
    };
    mockContractAttest.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
            logs: [{
                topics: [
                    '0x0000000000000000000000000000000000000000000000000000000000000000', // event signature
                    '0x0000000000000000000000000000000000000000000000000000000000000001', // attestationUID
                ],
            }],
            hash: '0xTxHash',
            blockNumber: 12345,
        }),
    });
    mockedEthers.Contract = jest.fn().mockImplementation(() => ({
        attest: mockContractAttest,
    }));

    agent = new ForecastingAgent(privateKey, 'http://localhost:8545', '0xSchemaUID');
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

  describe('generateForecast', () => {
    it('should generate a forecast for a given market', async () => {
        const mockMarket = { id: '1', question: 'Market 1?', description: 'Test Market', resolution_date: '2025-12-31', yes_price: 0.5, no_price: 0.5, liquidity: 1000 };
        const mockResponse = {
            content: [{
                type: 'text',
                text: '{\n"probability": 75,\n"confidence": 80,\n"reasoning": "Test reasoning"\n}',
            }],
        };
        mockAnthropicCreate.mockResolvedValue(mockResponse);

        const forecast = await agent.generateForecast(mockMarket);

        expect(mockAnthropicCreate).toHaveBeenCalled();
        expect(forecast).toEqual({
            market_id: '1',
            probability: 0.75,
            confidence: 0.8,
            reasoning: 'Test reasoning',
            timestamp: expect.any(Date),
        });
    });

    it('should throw an error if forecast parsing fails', async () => {
        const mockMarket = { id: '1', question: 'Market 1?', description: 'Test Market', resolution_date: '2025-12-31', yes_price: 0.5, no_price: 0.5, liquidity: 1000 };
        const mockResponse = {
            content: [{ type: 'text', text: 'not a json' }],
        };
        mockAnthropicCreate.mockResolvedValue(mockResponse);
        await expect(agent.generateForecast(mockMarket)).rejects.toThrow('Could not extract JSON from response');
    });
  });

  describe('attestForecast', () => {
      it('should attest a forecast on-chain', async () => {
          const mockForecast = {
              market_id: '1',
              probability: 0.75,
              confidence: 0.8,
              reasoning: 'Test reasoning',
              timestamp: new Date(),
          };

          const attestation = await agent.attestForecast(mockForecast);

          expect(mockedEthers.Contract).toHaveBeenCalled();
          expect(mockContractAttest).toHaveBeenCalled();
          expect(attestation).toEqual({
              uid: '0x0000000000000000000000000000000000000000000000000000000000000001',
              schema_uid: '0xSchemaUID',
              transaction_hash: '0xTxHash',
              block_number: 12345,
          });
      });
  });
});
