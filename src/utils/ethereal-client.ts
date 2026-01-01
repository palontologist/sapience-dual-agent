/**
 * Ethereal Exchange API Client
 * 
 * EVM-native perpetual futures trading on Arbitrum
 * https://docs.ethereal.trade/
 */

import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';

export interface EtherealConfig {
  apiUrl?: string;
  privateKey: string;
  subaccountId?: string;
  testnet?: boolean;
}

export interface Product {
  id: string;
  ticker: string;
  displayTicker: string;
  baseTokenName: string;
  quoteTokenName: string;
  tickSize: string;
  lotSize: string;
  minQuantity: string;
  maxQuantity: string;
  maxLeverage: number;
  status: string;
  onchainId: number;
}

export interface MarketPrice {
  productId: string;
  indexPrice: string;
  markPrice: string;
  lastPrice: string;
  timestamp: number;
}

export interface Position {
  id: string;
  subaccountId: string;
  productId: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string;
  unrealizedPnl: string;
  leverage: number;
}

export interface Order {
  id?: string;
  subaccountId: string;
  productId: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  size: string;
  price?: string;
  reduceOnly?: boolean;
  postOnly?: boolean;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface Balance {
  token: string;
  available: string;
  locked: string;
  total: string;
}

export class EtherealClient {
  private api: AxiosInstance;
  private wallet: ethers.Wallet;
  private subaccountId: string;
  private domain: any;

  constructor(config: EtherealConfig) {
    const apiUrl = config.testnet 
      ? 'https://api.etherealtest.net'
      : config.apiUrl || 'https://api.ethereal.trade';

    this.api = axios.create({
      baseURL: apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.wallet = new ethers.Wallet(config.privateKey);
    this.subaccountId = config.subaccountId || this.wallet.address;
  }

  /**
   * Initialize the client by fetching EIP712 domain config
   */
  async initialize(): Promise<void> {
    try {
      const response = await this.api.get('/v1/rpc/config');
      this.domain = response.data.domain;
      console.log('✅ Ethereal client initialized');
    } catch (error: any) {
      console.error('❌ Failed to initialize Ethereal client:', error.message);
      throw error;
    }
  }

  /**
   * Sign a message using EIP712
   */
  private async signMessage(message: any, types: any): Promise<string> {
    const signature = await this.wallet.signTypedData(
      this.domain,
      types,
      message
    );
    return signature;
  }

  /**
   * Get all available products
   */
  async getProducts(): Promise<Product[]> {
    try {
      const response = await this.api.get('/v1/product');
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching products:', error.message);
      return [];
    }
  }

  /**
   * Get market prices for products
   * Note: Ethereal doesn't have a batch market-price endpoint
   * We'll fetch individual ticker data for each product
   */
  async getMarketPrices(productIds: string[]): Promise<MarketPrice[]> {
    try {
      // Fetch ticker data for each product
      const prices: MarketPrice[] = [];
      
      for (const productId of productIds) {
        try {
          const response = await this.api.get(`/v1/product/${productId}/ticker`);
          const ticker = response.data.data;
          
          if (ticker && ticker.lastPrice) {
            prices.push({
              productId,
              indexPrice: ticker.indexPrice || ticker.lastPrice,
              markPrice: ticker.markPrice || ticker.lastPrice,
              lastPrice: ticker.lastPrice,
              timestamp: Date.now()
            });
          }
        } catch (err: any) {
          // Silently fail for individual products (may not have active orderbook)
        }
      }
      
      return prices;
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Get current positions
   */
  async getPositions(): Promise<Position[]> {
    try {
      const response = await this.api.get('/v1/position', {
        params: { subaccountId: this.subaccountId },
      });
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching positions:', error.message);
      return [];
    }
  }

  /**
   * Get account balances
   */
  async getBalances(): Promise<Balance[]> {
    try {
      const response = await this.api.get('/v1/subaccount/balance', {
        params: { subaccountId: this.subaccountId },
      });
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching balances:', error.message);
      return [];
    }
  }

  /**
   * Place an order (requires EIP712 signature)
   */
  async placeOrder(order: Order): Promise<any> {
    try {
      // Prepare the order message
      const message = {
        subaccountId: order.subaccountId,
        productId: order.productId,
        side: order.side,
        type: order.type,
        size: order.size,
        price: order.price || '0',
        reduceOnly: order.reduceOnly || false,
        postOnly: order.postOnly || false,
        timeInForce: order.timeInForce || 'GTC',
        nonce: Date.now(),
      };

      // Sign the order
      const signature = await this.signMessage(message, {
        Order: [
          { name: 'subaccountId', type: 'string' },
          { name: 'productId', type: 'string' },
          { name: 'side', type: 'string' },
          { name: 'type', type: 'string' },
          { name: 'size', type: 'string' },
          { name: 'price', type: 'string' },
          { name: 'reduceOnly', type: 'bool' },
          { name: 'postOnly', type: 'bool' },
          { name: 'timeInForce', type: 'string' },
          { name: 'nonce', type: 'uint256' },
        ],
      });

      // Submit the order
      const response = await this.api.post('/v1/order', {
        data: message,
        signature,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error placing order:', error.message);
      throw error;
    }
  }

  /**
   * Dry run order (test without execution)
   */
  async dryRunOrder(order: Order): Promise<any> {
    try {
      const message = {
        subaccountId: order.subaccountId,
        productId: order.productId,
        side: order.side,
        type: order.type,
        size: order.size,
        price: order.price || '0',
        reduceOnly: order.reduceOnly || false,
        postOnly: order.postOnly || false,
        timeInForce: order.timeInForce || 'GTC',
        nonce: Date.now(),
      };

      const signature = await this.signMessage(message, {
        Order: [
          { name: 'subaccountId', type: 'string' },
          { name: 'productId', type: 'string' },
          { name: 'side', type: 'string' },
          { name: 'type', type: 'string' },
          { name: 'size', type: 'string' },
          { name: 'price', type: 'string' },
          { name: 'reduceOnly', type: 'bool' },
          { name: 'postOnly', type: 'bool' },
          { name: 'timeInForce', type: 'string' },
          { name: 'nonce', type: 'uint256' },
        ],
      });

      const response = await this.api.post('/v1/order/dry-run', {
        data: message,
        signature,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error in dry run:', error.message);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<any> {
    try {
      const message = {
        orderIds: [orderId],
        nonce: Date.now(),
      };

      const signature = await this.signMessage(message, {
        CancelOrder: [
          { name: 'orderIds', type: 'string[]' },
          { name: 'nonce', type: 'uint256' },
        ],
      });

      const response = await this.api.post('/v1/order/cancel', {
        data: message,
        signature,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error canceling order:', error.message);
      throw error;
    }
  }

  /**
   * Get active position for a product
   */
  async getActivePosition(productId: string): Promise<Position | null> {
    try {
      const response = await this.api.get('/v1/position/active', {
        params: {
          subaccountId: this.subaccountId,
          productId,
        },
      });
      return response.data || null;
    } catch (error: any) {
      // No active position
      return null;
    }
  }

  /**
   * Close a position (market order)
   */
  async closePosition(position: Position): Promise<any> {
    const closeSide = position.side === 'LONG' ? 'SELL' : 'BUY';
    
    return this.placeOrder({
      subaccountId: this.subaccountId,
      productId: position.productId,
      side: closeSide,
      type: 'MARKET',
      size: position.size,
      reduceOnly: true,
    });
  }
}
