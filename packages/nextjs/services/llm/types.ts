export interface LLMResponse {
    type: "swap" | "deposit" | "query" | "error";
    action: string;
    params: {
      amount?: number;
      fromToken?: string;
      toToken?: string;
      token1Amount?: number;
      token1Symbol?: string;
      token2Amount?: number;
      token2Symbol?: string;
      poolAddress?: string;
      intent?: "getReserves" | "swapCount" | "priceDistribution";
      timeframe?: "today" | { from: number; to: number };
      [key: string]: any;
    };
    confidence: number;
    explanation?: string;
  }
  
  export interface LLMService {
    processCommand: (command: string) => Promise<LLMResponse>;
  }
  
  export interface LLMConfig {
    apiKey?: string;
    apiEndpoint?: string;
    model?: string;
  }
  
  // 默认配置
  export const defaultLLMConfig: LLMConfig = {
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || "",
    apiEndpoint: process.env.NEXT_PUBLIC_OPEN_SOURCE_ENDPOINT || "",
    model: process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL || "gpt-4o"
  };