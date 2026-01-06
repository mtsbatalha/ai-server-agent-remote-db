/**
 * AI Provider Interface
 * Base interface for all AI providers (OpenAI, Gemini, Groq, Ollama)
 */
export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AICompletionOptions {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
}

export interface AIProvider {
    name: string;
    generateCompletion(
        messages: AIMessage[],
        options?: AICompletionOptions,
    ): Promise<string>;
}

export type AIProviderType = 'openai' | 'gemini' | 'groq' | 'ollama';

export interface AIProviderConfig {
    type: AIProviderType;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
}
