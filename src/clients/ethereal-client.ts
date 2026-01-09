import axios from 'axios';

export interface EtherealMarket {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  leverage: number;
  lastPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  fundingRate: number;
  openInterest: number;
  markPrice?: number;
  indexPrice?: number;
}

export interface EtherealOrderBook {
  symbol: string;
  bids: [number, number][]; // [price, size]
  asks: [number, number][];
  timestamp: number;
}

export interface EtherealTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: number;
}

export class EtherealClient {
  private baseUrl: string = 'https://api.ethereal.exchange';
  private wsUrl: string = 'wss://api.ethereal.exchange/ws';

  constructor(apiKey?: string) {
    if (apiKey) {
      // Store API key for authenticated requests
    }
  }

  /**
   * Get all available markets
   */
  async getMarkets(): Promise<EtherealMarket[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/markets`, {
        timeout: 10000,
      });

      return response.data.markets || [];
    } catch (error: any) {
      console.error('Error fetching Ethereal markets:', error.message);
      
      // Return mock data based on the provided market list
      return this.getMockMarkets();
    }
  }

  /**
   * Get market by symbol
   */
  async getMarket(symbol: string): Promise<EtherealMarket | null> {
    const markets = await this.getMarkets();
    return markets.find(m => m.symbol === symbol) || null;
  }

  /**
   * Get order book for a symbol
   */
  async getOrderBook(symbol: string, depth: number = 20): Promise<EtherealOrderBook> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/orderbook/${symbol}`, {
        params: { depth },
        timeout: 5000,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch order book for ${symbol}`);
    }
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(symbol: string, limit: number = 100): Promise<EtherealTrade[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/trades/${symbol}`, {
        params: { limit },
        timeout: 5000,
      });

      return response.data.trades || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Mock markets based on provided data
   */
  private getMockMarkets(): EtherealMarket[] {
    return [
      {
        symbol: 'BTC-USD',
        baseAsset: 'BTC',
        quoteAsset: 'USD',
        leverage: 20,
        lastPrice: 89706,
        priceChange24h: -432.89,
        priceChangePercent24h: -0.48,
        volume24h: 53940000,
        fundingRate: 0.000016,
        openInterest: 53840000,
      },
      {
        symbol: 'ETH-USD',
        baseAsset: 'ETH',
        quoteAsset: 'USD',
        leverage: 20,
        lastPrice: 3070.2,
        priceChange24h: -44.20,
        priceChangePercent24h: -1.42,
        volume24h: 34090000,
        fundingRate: 0.000017,
        openInterest: 34730000,
      },
      {
        symbol: 'ENA-USD',
        baseAsset: 'ENA',
        quoteAsset: 'USD',
        leverage: 5,
        lastPrice: 0.22881,
        priceChange24h: -0.00386,
        priceChangePercent24h: -1.66,
        volume24h: 740000,
        fundingRate: 0.000016,
        openInterest: 784510,
      },
      {
        symbol: 'SOL-USD',
        baseAsset: 'SOL',
        quoteAsset: 'USD',
        leverage: 10,
        lastPrice: 137.08,
        priceChange24h: 1.93,
        priceChangePercent24h: 1.43,
        volume24h: 6360000,
        fundingRate: 0.000017,
        openInterest: 3940000,
      },
      {
        symbol: 'HYPE-USD',
        baseAsset: 'HYPE',
        quoteAsset: 'USD',
        leverage: 10,
        lastPrice: 25.520,
        priceChange24h: -0.90,
        priceChangePercent24h: -3.41,
        volume24h: 2700000,
        fundingRate: 0.0005,
        openInterest: 2330000,
      },
      {
        symbol: 'ZEC-USD',
        baseAsset: 'ZEC',
        quoteAsset: 'USD',
        leverage: 5,
        lastPrice: 432.23,
        priceChange24h: 10.05,
        priceChangePercent24h: 2.38,
        volume24h: 2340000,
        fundingRate: 0.000016,
        openInterest: 664740,
      },
      {
        symbol: 'SUI-USD',
        baseAsset: 'SUI',
        quoteAsset: 'USD',
        leverage: 10,
        lastPrice: 1.7726,
        priceChange24h: -0.0348,
        priceChangePercent24h: -1.93,
        volume24h: 981200,
        fundingRate: 0.0005,
        openInterest: 501150,
      },
      {
        symbol: 'XRP-USD',
        baseAsset: 'XRP',
        quoteAsset: 'USD',
        leverage: 10,
        lastPrice: 2.0756,
        priceChange24h: -0.0356,
        priceChangePercent24h: -1.69,
        volume24h: 784520,
        fundingRate: 0.000017,
        openInterest: 559250,
      },
      {
        symbol: 'FARTCOIN-USD',
        baseAsset: 'FARTCOIN',
        quoteAsset: 'USD',
        leverage: 5,
        lastPrice: 0.39321,
        priceChange24h: 0.00501,
        priceChangePercent24h: 1.29,
        volume24h: 528680,
        fundingRate: 0.000017,
        openInterest: 532450,
      },
      {
        symbol: 'PUMP-USD',
        baseAsset: 'PUMP',
        quoteAsset: 'USD',
        leverage: 5,
        lastPrice: 0.0021274,
        priceChange24h: -0.0000775,
        priceChangePercent24h: -3.52,
        volume24h: 436510,
        fundingRate: 0.000017,
        openInterest: 604480,
      },
      {
        symbol: 'MON-USD',
        baseAsset: 'MON',
        quoteAsset: 'USD',
        leverage: 5,
        lastPrice: 0.026617,
        priceChange24h: 0.000114,
        priceChangePercent24h: 0.43,
        volume24h: 278050,
        fundingRate: 0.000014,
        openInterest: 672290,
      },
      {
        symbol: 'AAVE-USD',
        baseAsset: 'AAVE',
        quoteAsset: 'USD',
        leverage: 5,
        lastPrice: 162.83,
        priceChange24h: -1.79,
        priceChangePercent24h: -1.09,
        volume24h: 222390,
        fundingRate: 0.000017,
        openInterest: 863090,
      },
    ];
  }

  /**
   * Calculate market liquidity score (0-100)
   */
  calculateLiquidityScore(market: EtherealMarket): number {
    const volumeScore = Math.min(market.volume24h / 50000000, 1) * 40;
    const oiScore = Math.min(market.openInterest / 50000000, 1) * 40;
    const fundingScore = Math.abs(market.fundingRate) < 0.001 ? 20 : 10;
    
    return volumeScore + oiScore + fundingScore;
  }
}
