import OpenAI from "openai";
import { LLMService, LLMResponse, LLMConfig } from "./types";

export class OpenAIService implements LLMService {
  private client: OpenAI;
  private model: string;

  constructor(config: LLMConfig) {
    const apiKey = config.apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key is required. Please set NEXT_PUBLIC_OPENAI_API_KEY in your environment variables.");
    }

    console.warn(
      "⚠️ Warning: Using OpenAI API directly in the browser is not recommended for production use. " +
      "Consider using a backend proxy to protect your API key. " +
      "See: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety"
    );

    this.client = new OpenAI({ 
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
    this.model = config.model || process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL || "gpt-4";
  }

  async processCommand(command: string): Promise<LLMResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a natural language processor for Uniswap V2. 
            Convert user commands into structured data for blockchain transactions.
            Available commands:
            - swap: "swap X TOKEN1 for TOKEN2"
            - deposit: "deposit X TOKEN1 and Y TOKEN2"
            - query: "what are the reserves of the TOKEN1-TOKEN2 pool"
            
            Respond with a JSON object containing:
            {
              "type": "swap" | "deposit" | "query" | "error",
              "action": "function name",
              "params": {
                // relevant parameters
              },
              "confidence": number between 0 and 1,
              "explanation": "brief explanation of the parsed command"
            }`
          },
          {
            role: "user",
            content: command
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error("No response from OpenAI");
      }

      try {
        const parsedResponse = JSON.parse(response) as LLMResponse;
        return parsedResponse;
      } catch (error) {
        console.error("Failed to parse OpenAI response:", error);
        return {
          type: "error",
          action: "error",
          params: {},
          confidence: 0,
          explanation: "Failed to parse command"
        };
      }
    } catch (error) {
      console.error("OpenAI API error:", error);
      return {
        type: "error",
        action: "error",
        params: {},
        confidence: 0,
        explanation: "Failed to process command"
      };
    }
  }
} 