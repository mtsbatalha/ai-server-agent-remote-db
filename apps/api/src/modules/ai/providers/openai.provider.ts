import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AIProvider, AIMessage, AICompletionOptions } from './ai-provider.interface';

/**
 * OpenAI Provider
 * Supports GPT-4o, GPT-4o-mini, GPT-4-turbo, etc.
 * Requires: OPENAI_API_KEY
 */
@Injectable()
export class OpenAIProvider implements AIProvider {
    name = 'OpenAI';
    private readonly logger = new Logger(OpenAIProvider.name);
    private client: OpenAI | null = null;
    private model: string;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (apiKey && this.isValidApiKey(apiKey)) {
            this.client = new OpenAI({ apiKey });
            this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
            this.logger.log(`OpenAI provider initialized with model: ${this.model}`);
        }
    }

    /**
     * Check if API key is valid (not a placeholder)
     */
    private isValidApiKey(key: string): boolean {
        const placeholderPatterns = [
            'your-',
            'sk-your',
            'your_',
            'placeholder',
            'example',
            'xxx',
            'your-openai',
            'sk-your-openai',
        ];
        const lowerKey = key.toLowerCase();
        return !placeholderPatterns.some(pattern => lowerKey.includes(pattern));
    }

    isConfigured(): boolean {
        return !!this.client;
    }

    async generateCompletion(
        messages: AIMessage[],
        options?: AICompletionOptions,
    ): Promise<string> {
        if (!this.client) {
            throw new Error('OpenAI not configured. Set OPENAI_API_KEY.');
        }

        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                temperature: options?.temperature ?? 0.3,
                max_tokens: options?.maxTokens,
                ...(options?.jsonMode && { response_format: { type: 'json_object' } }),
            });

            return response.choices[0]?.message?.content || '';
        } catch (error) {
            this.logger.error(`OpenAI error: ${error.message}`);
            throw error;
        }
    }
}
