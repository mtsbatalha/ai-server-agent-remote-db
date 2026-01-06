import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AIProviderType } from './providers/ai-provider.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
    constructor(private aiService: AiService) { }

    @Get('providers')
    @ApiOperation({ summary: 'Get available AI providers' })
    getProviders() {
        return {
            active: this.aiService.getActiveProvider(),
            available: this.aiService.getAvailableProviders(),
        };
    }

    @Post('provider')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Switch AI provider (Admin only)' })
    async setProvider(@Body() body: { provider: AIProviderType }) {
        await this.aiService.setProvider(body.provider);
        return {
            success: true,
            active: this.aiService.getActiveProvider(),
        };
    }
}
