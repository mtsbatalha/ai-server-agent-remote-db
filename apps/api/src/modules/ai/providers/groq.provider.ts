import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIMessage, AICompletionOptions } from './ai-provider.interface';

/**
 * Groq Provider (FREE TIER AVAILABLE!)
 * 
 * Free tier includes:
 * - 30 requests per minute
 * - 14,400 requests per day
 * - Up to 6,000 tokens per minute
 * 
 * Models: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
 * 
 * Requires: GROQ_API_KEY
 * Get your free key at: https://console.groq.com/keys
 */
@Injectable()
export class GroqProvider implements AIProvider {
    name = 'Groq';
    private readonly logger = new Logger(GroqProvider.name);
    private apiKey: string | undefined;
    private model: string;
    private baseUrl = 'https://api.groq.com/openai/v1';

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('GROQ_API_KEY');
        this.model = this.configService.get<string>('GROQ_MODEL', 'llama-3.3-70b-versatile');

        if (this.apiKey) {
            this.logger.log(`Groq provider initialized with model: ${this.model}`);
        }
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    async generateCompletion(
        messages: AIMessage[],
        options?: AICompletionOptions,
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error('Groq not configured. Set GROQ_API_KEY.');
        }

        try {
            const requestBody: any = {
                model: this.model,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                temperature: options?.temperature ?? 0.3,
                max_tokens: options?.maxTokens ?? 4096,
            };

            // Groq supports JSON mode for some models
            if (options?.jsonMode) {
                requestBody.response_format = { type: 'json_object' };
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Groq API error');
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            this.logger.error(`Groq error: ${error.message}`);
            throw error;
        }
    }
}
