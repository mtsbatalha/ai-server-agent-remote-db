import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIMessage, AICompletionOptions } from './ai-provider.interface';

/**
 * Google Gemini Provider (FREE TIER AVAILABLE!)
 * 
 * Free tier includes:
 * - 60 requests per minute
 * - 1 million tokens per day
 * 
 * Models: gemini-1.5-flash (fast), gemini-1.5-pro (powerful)
 * 
 * Requires: GEMINI_API_KEY
 * Get your free key at: https://aistudio.google.com/app/apikey
 */
@Injectable()
export class GeminiProvider implements AIProvider {
    name = 'Google Gemini';
    private readonly logger = new Logger(GeminiProvider.name);
    private apiKey: string | undefined;
    private model: string;
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (apiKey && this.isValidApiKey(apiKey)) {
            this.apiKey = apiKey;
            this.model = this.configService.get<string>('GEMINI_MODEL', 'gemini-1.5-flash');
            this.logger.log(`Gemini provider initialized with model: ${this.model}`);
        } else {
            this.model = this.configService.get<string>('GEMINI_MODEL', 'gemini-1.5-flash');
        }
    }

    /**
     * Check if API key is valid (not a placeholder)
     */
    private isValidApiKey(key: string): boolean {
        const placeholderPatterns = [
            'your-',
            'your_',
            'placeholder',
            'example',
            'xxx',
            'your-gemini',
        ];
        const lowerKey = key.toLowerCase();
        return !placeholderPatterns.some(pattern => lowerKey.includes(pattern));
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    async generateCompletion(
        messages: AIMessage[],
        options?: AICompletionOptions,
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error('Gemini not configured. Set GEMINI_API_KEY.');
        }

        try {
            // Convert messages to Gemini format
            const systemMessage = messages.find(m => m.role === 'system');
            const userMessages = messages.filter(m => m.role !== 'system');

            const contents = userMessages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

            const requestBody: any = {
                contents,
                generationConfig: {
                    temperature: options?.temperature ?? 0.3,
                    maxOutputTokens: options?.maxTokens ?? 8192,
                },
            };

            // Add system instruction if present
            if (systemMessage) {
                requestBody.systemInstruction = {
                    parts: [{ text: systemMessage.content }],
                };
            }

            // For JSON mode, add response schema hint
            if (options?.jsonMode) {
                requestBody.generationConfig.responseMimeType = 'application/json';
            }

            const response = await fetch(
                `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                },
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Gemini API error');
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (error) {
            this.logger.error(`Gemini error: ${error.message}`);
            throw error;
        }
    }
}
