import { LLMService, LLMConfig } from "./types";
import { OpenAIService } from "./openai";
import { OpenSourceLLMService } from "./openSource";

export type LLMProvider = "openai" | "open-source";

export class LLMServiceFactory {
  static createService(provider: LLMProvider, config: LLMConfig): LLMService {
    switch (provider) {
      case "openai":
        return new OpenAIService(config);
      case "open-source":
        return new OpenSourceLLMService(config);
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
} 