import { LLMService, LLMResponse, LLMConfig } from "./types";

export class OpenSourceLLMService implements LLMService {
  private apiEndpoint: string;
  private model: string;

  constructor(config: LLMConfig) {
    if (!config.apiEndpoint) {
      throw new Error("API endpoint is required for open source LLM");
    }
    this.apiEndpoint = config.apiEndpoint;
    this.model = config.model || "default";
  }

  async processCommand(command: string): Promise<LLMResponse> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const llmResponse = data.choices[0]?.message?.content;

      if (!llmResponse) {
        throw new Error("No response from LLM");
      }

      try {
        const parsedResponse = JSON.parse(llmResponse) as LLMResponse;
        return parsedResponse;
      } catch (error) {
        console.error("Failed to parse LLM response:", error);
        return {
          type: "error",
          action: "error",
          params: {},
          confidence: 0,
          explanation: "Failed to parse command"
        };
      }
    } catch (error) {
      console.error("Open source LLM API error:", error);
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