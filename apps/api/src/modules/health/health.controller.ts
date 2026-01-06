import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(private readonly prisma: PrismaService) { }

    @Get()
    @Public()
    @ApiOperation({ summary: 'Check API health status' })
    @ApiResponse({ status: 200, description: 'API is healthy' })
    async check() {
        const dbStatus = await this.prisma.checkConnection();
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: dbStatus.connected ? 'connected' : 'disconnected',
        };
    }

    @Get('db')
    @Public()
    @ApiOperation({ summary: 'Check database connection status' })
    @ApiResponse({ status: 200, description: 'Database status details' })
    async checkDatabase() {
        const dbStatus = await this.prisma.checkConnection();

        // Mask the DATABASE_URL for security
        const dbUrl = process.env.DATABASE_URL || '';
        const maskedUrl = dbUrl.replace(
            /\/\/([^:]+):([^@]+)@/,
            '//***:***@'
        );

        return {
            status: dbStatus.connected ? 'connected' : 'disconnected',
            latency: dbStatus.latency ? `${dbStatus.latency}ms` : null,
            error: dbStatus.error || null,
            host: maskedUrl ? maskedUrl.split('@')[1]?.split('/')[0] || 'unknown' : 'not configured',
            timestamp: new Date().toISOString(),
        };
    }
}
