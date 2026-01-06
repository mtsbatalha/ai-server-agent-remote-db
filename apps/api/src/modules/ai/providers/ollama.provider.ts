import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIMessage, AICompletionOptions } from './ai-provider.interface';

/**
 * Ollama Provider (100% FREE - LOCAL!)
 * 
 * Run AI models locally on your machine.
 * No API keys, no limits, no costs.
 * 
 * Popular models:
 * - llama3.2 (3B/1B params, fast)
 * - llama3.1 (8B/70B params)
 * - mistral (7B params)
 * - codellama (for code)
 * - qwen2.5-coder (for code)
 * 
 * Requires:
 * 1. Install Ollama: https://ollama.com
 * 2. Pull a model: ollama pull llama3.2
 * 3. Set OLLAMA_BASE_URL (default: http://localhost:11434)
 */
@Injectable()
export class OllamaProvider implements AIProvider {
    name = 'Ollama';
    private readonly logger = new Logger(OllamaProvider.name);
    private baseUrl: string;
    private model: string;

    constructor(private configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
        this.model = this.configService.get<string>('OLLAMA_MODEL', 'llama3.2');
        this.logger.log(`Ollama provider initialized with model: ${this.model} at ${this.baseUrl}`);
    }

    isConfigured(): boolean {
        // Ollama is always "configured" if URL is set, but may not be running
        return true;
    }

    async checkConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async generateCompletion(
        messages: AIMessage[],
        options?: AICompletionOptions,
    ): Promise<string> {
        try {
            // Ollama uses the /api/chat endpoint with message format
            const requestBody = {
                model: this.model,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                stream: false,
                options: {
                    temperature: options?.temperature ?? 0.3,
                    num_predict: options?.maxTokens ?? 4096,
                },
            };

            // For JSON mode, add format hint
            if (options?.jsonMode) {
                (requestBody as any).format = 'json';
            }

            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama error: ${errorText}`);
            }

            const data = await response.json();
            return data.message?.content || '';
        } catch (error) {
            this.logger.error(`Ollama error: ${error.message}`);

            // Provide helpful error message
            if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
                throw new Error(
                    `Ollama não está rodando. Inicie com: ollama serve\n` +
                    `Depois baixe um modelo: ollama pull ${this.model}`
                );
            }

            throw error;
        }
    }
}
