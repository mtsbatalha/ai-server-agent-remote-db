import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OllamaProvider } from './providers/ollama.provider';

@Module({
    controllers: [AiController],
    providers: [
        AiService,
        OpenAIProvider,
        GeminiProvider,
        GroqProvider,
        OllamaProvider,
    ],
    exports: [AiService],
})
export class AiModule { }
