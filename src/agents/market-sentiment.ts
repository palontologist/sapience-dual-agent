import axios from "axios";
import { TradeResult } from "./trade-tracker";

export interface SentimentData {
  source: string;
  sentiment: number; // -1 to 1
  confidence: number; // 0 to 1
  timestamp: number;
  keywords: string[];
  volume: number;
}

export interface MarketPattern {
  pattern: string;
  frequency: number;
  successRate: number;
  avgReturn: number;
  lastSeen: number;
  strength: number;
}

export interface RealTimeSignal {
  timestamp: number;
  sentiment: number;
  momentum: number;
  volatility: number;
  volume: number;
  patternMatch: string | null;
  confidence: number;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
}

export class MarketSentimentAnalyzer {
  private sentimentCache: Map<string, SentimentData[]> = new Map();
  private patterns: Map<string, MarketPattern> = new Map();
  private apiKey: string;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEWS_API_KEY || "";
  }

  /**
   * Start real-time sentiment analysis
   */
  startRealTimeAnalysis(updateIntervalMs: number = 60000): void {
    console.log("📡 Starting real-time market sentiment analysis...");

    this.updateInterval = setInterval(() => {
      this.updateSentimentData();
      this.detectEmergingPatterns();
    }, updateIntervalMs);

    // Initial analysis
    this.updateSentimentData();
  }

  /**
   * Stop real-time analysis
   */
  stopRealTimeAnalysis(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log("📡 Real-time analysis stopped");
    }
  }

  /**
   * Analyze sentiment for a specific market/topic
   */
  async analyzeSentiment(topic: string): Promise<SentimentData> {
    try {
      // Search for recent news and social media mentions
      const newsArticles = await this.fetchNewsArticles(topic);
      const socialMediaData = await this.fetchSocialMediaSentiment(topic);

      // Combine and analyze
      const combinedSentiment = this.combineSentimentSources(
        newsArticles,
        socialMediaData,
      );

      const sentimentData: SentimentData = {
        source: "combined",
        sentiment: combinedSentiment.score,
        confidence: combinedSentiment.confidence,
        timestamp: Date.now(),
        keywords: combinedSentiment.keywords,
        volume: combinedSentiment.volume,
      };

      // Cache the result
      if (!this.sentimentCache.has(topic)) {
        this.sentimentCache.set(topic, []);
      }
      this.sentimentCache.get(topic)!.push(sentimentData);

      // Keep only last 50 entries per topic
      const cached = this.sentimentCache.get(topic)!;
      if (cached.length > 50) {
        cached.splice(0, cached.length - 50);
      }

      return sentimentData;
    } catch (error) {
      console.error(`Error analyzing sentiment for ${topic}:`, error);

      // Return neutral sentiment on error
      return {
        source: "fallback",
        sentiment: 0,
        confidence: 0.1,
        timestamp: Date.now(),
        keywords: [],
        volume: 0,
      };
    }
  }

  /**
   * Get real-time trading signal
   */
  async getRealTimeSignal(market: any): Promise<RealTimeSignal> {
    const topic = market.question || market.title;
    const currentPrice = market.yes_price || 0.5;

    // Get recent sentiment data
    const sentimentHistory = this.sentimentCache.get(topic) || [];
    const recentSentiment = sentimentHistory.slice(-10); // Last 10 entries

    // Calculate sentiment metrics
    const currentSentiment =
      recentSentiment.length > 0
        ? recentSentiment.reduce((sum, s) => sum + s.sentiment, 0) /
          recentSentiment.length
        : 0;

    const sentimentMomentum = this.calculateMomentum(recentSentiment);
    const volatility = this.calculateSentimentVolatility(recentSentiment);
    const volume =
      recentSentiment.length > 0
        ? recentSentiment.reduce((sum, s) => sum + s.volume, 0) /
          recentSentiment.length
        : 0;

    // Pattern matching
    const patternMatch = this.matchCurrentPattern(market, recentSentiment);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      currentSentiment,
      sentimentMomentum,
      volatility,
      currentPrice,
      patternMatch,
    );

    // Calculate overall confidence
    const confidence = this.calculateSignalConfidence(
      recentSentiment,
      patternMatch,
      volatility,
    );

    return {
      timestamp: Date.now(),
      sentiment: currentSentiment,
      momentum: sentimentMomentum,
      volatility,
      volume,
      patternMatch: patternMatch?.pattern || null,
      confidence,
      recommendation,
    };
  }

  /**
   * Detect emerging market patterns
   */
  private detectEmergingPatterns(): void {
    // Analyze sentiment trends across all topics
    for (const [topic, sentiments] of this.sentimentCache.entries()) {
      if (sentiments.length < 10) continue;

      const pattern = this.identifyPattern(topic, sentiments);
      if (pattern) {
        this.patterns.set(pattern.pattern, pattern);
      }
    }

    // Clean old patterns
    const now = Date.now();
    for (const [key, pattern] of this.patterns.entries()) {
      if (now - pattern.lastSeen > 24 * 60 * 60 * 1000) {
        // 24 hours
        this.patterns.delete(key);
      }
    }
  }

  /**
   * Fetch news articles for topic
   */
  private async fetchNewsArticles(topic: string): Promise<any[]> {
    try {
      if (!this.apiKey) {
        // Mock data for demonstration
        return this.generateMockNewsData(topic);
      }

      const response = await axios.get(`https://newsapi.org/v2/everything`, {
        params: {
          q: topic,
          sortBy: "publishedAt",
          pageSize: 10,
          language: "en",
          apiKey: this.apiKey,
        },
      });

      return response.data.articles || [];
    } catch (error) {
      console.error("Error fetching news:", error);
      return this.generateMockNewsData(topic);
    }
  }

  /**
   * Fetch social media sentiment
   */
  private async fetchSocialMediaSentiment(topic: string): Promise<any[]> {
    // This would integrate with Twitter API, Reddit API, etc.
    // For now, return mock data
    return this.generateMockSocialData(topic);
  }

  /**
   * Combine sentiment from multiple sources
   */
  private combineSentimentSources(
    newsArticles: any[],
    socialMediaData: any[],
  ): any {
    const allData = [...newsArticles, ...socialMediaData];

    let totalSentiment = 0;
    let totalConfidence = 0;
    const keywords = new Set<string>();
    let volume = 0;

    allData.forEach((item) => {
      const sentiment = this.analyzeTextSentiment(
        item.title + " " + (item.description || item.text),
      );
      totalSentiment += sentiment.score;
      totalConfidence += sentiment.confidence;

      // Extract keywords
      const itemKeywords = this.extractKeywords(
        item.title + " " + (item.description || item.text),
      );
      itemKeywords.forEach((k) => keywords.add(k));

      volume += 1;
    });

    const avgSentiment =
      allData.length > 0 ? totalSentiment / allData.length : 0;
    const avgConfidence =
      allData.length > 0 ? totalConfidence / allData.length : 0.1;

    return {
      score: avgSentiment,
      confidence: avgConfidence,
      keywords: Array.from(keywords).slice(0, 10),
      volume,
    };
  }

  /**
   * Simple text sentiment analysis
   */
  private analyzeTextSentiment(text: string): {
    score: number;
    confidence: number;
  } {
    const positiveWords = [
      "good",
      "great",
      "excellent",
      "positive",
      "bullish",
      "growth",
      "success",
      "win",
      "profit",
    ];
    const negativeWords = [
      "bad",
      "terrible",
      "negative",
      "bearish",
      "decline",
      "failure",
      "lose",
      "loss",
      "risk",
    ];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach((word) => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });

    const totalWords = words.length;
    const sentimentWords = positiveCount + negativeCount;
    const score =
      sentimentWords > 0 ? (positiveCount - negativeCount) / sentimentWords : 0;
    const confidence = sentimentWords / totalWords;

    return {
      score: Math.max(-1, Math.min(1, score)),
      confidence: Math.min(1, confidence),
    };
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = [
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
    ];
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.includes(word));

    // Count word frequency
    const wordFreq: { [key: string]: number } = {};
    words.forEach((word) => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Return top 5 most frequent words
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Calculate sentiment momentum
   */
  private calculateMomentum(sentiments: SentimentData[]): number {
    if (sentiments.length < 2) return 0;

    const recent = sentiments.slice(-5);
    const older = sentiments.slice(-10, -5);

    if (older.length === 0) return 0;

    const recentAvg =
      recent.reduce((sum, s) => sum + s.sentiment, 0) / recent.length;
    const olderAvg =
      older.reduce((sum, s) => sum + s.sentiment, 0) / older.length;

    return recentAvg - olderAvg;
  }

  /**
   * Calculate sentiment volatility
   */
  private calculateSentimentVolatility(sentiments: SentimentData[]): number {
    if (sentiments.length < 2) return 0;

    const sentimentValues = sentiments.map((s) => s.sentiment);
    const mean =
      sentimentValues.reduce((sum, val) => sum + val, 0) /
      sentimentValues.length;

    const variance =
      sentimentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      sentimentValues.length;
    return Math.sqrt(variance);
  }

  /**
   * Match current market pattern
   */
  private matchCurrentPattern(
    market: any,
    sentiments: SentimentData[],
  ): MarketPattern | null {
    // This would use more sophisticated pattern matching
    // For now, return null
    return null;
  }

  /**
   * Generate trading recommendation
   */
  private generateRecommendation(
    sentiment: number,
    momentum: number,
    volatility: number,
    price: number,
    pattern: MarketPattern | null,
  ): "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL" {
    // Calculate combined score
    let score = sentiment * 0.4 + momentum * 0.3 - volatility * 0.2;

    if (pattern && pattern.successRate > 0.7) {
      score += pattern.avgReturn * 0.1;
    }

    if (score > 0.6) return "STRONG_BUY";
    if (score > 0.2) return "BUY";
    if (score > -0.2) return "HOLD";
    if (score > -0.6) return "SELL";
    return "STRONG_SELL";
  }

  /**
   * Calculate signal confidence
   */
  private calculateSignalConfidence(
    sentiments: SentimentData[],
    pattern: MarketPattern | null,
    volatility: number,
  ): number {
    if (sentiments.length === 0) return 0.1;

    const avgConfidence =
      sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length;
    const dataPoints = Math.min(1, sentiments.length / 10); // More data = more confidence

    let confidence = avgConfidence * dataPoints * (1 - volatility);

    if (pattern && pattern.successRate > 0.7) {
      confidence *= 1.2;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Identify patterns in sentiment data
   */
  private identifyPattern(
    topic: string,
    sentiments: SentimentData[],
  ): MarketPattern | null {
    // Pattern identification logic would go here
    // For now, return null
    return null;
  }

  /**
   * Update sentiment data
   */
  private async updateSentimentData(): Promise<void> {
    // This would update sentiment for all tracked topics
    console.log("🔄 Updating sentiment data...");
  }

  /**
   * Generate mock news data for testing
   */
  private generateMockNewsData(topic: string): any[] {
    return [
      {
        title: `Positive developments in ${topic}`,
        description: "Recent trends show encouraging signs",
        publishedAt: new Date().toISOString(),
      },
      {
        title: `Analysis of ${topic} market conditions`,
        description: "Market analysis reveals interesting patterns",
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
  }

  /**
   * Generate mock social media data
   */
  private generateMockSocialData(topic: string): any[] {
    return [
      {
        text: `Bullish on ${topic}! Great opportunities ahead`,
        timestamp: Date.now() - 1800000,
      },
      {
        text: `Watching ${topic} closely, seeing positive momentum`,
        timestamp: Date.now() - 900000,
      },
    ];
  }
}
