import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private connected = false;
    private lastError: string | null = null;

    async onModuleInit() {
        try {
            await this.$connect();
            this.connected = true;
            this.lastError = null;
            this.logger.log('✅ Database connected successfully');
        } catch (error) {
            this.connected = false;
            this.lastError = error.message;
            this.logger.error(`❌ Database connection failed: ${error.message}`);
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.connected = false;
    }

    /**
     * Check if database is currently connected
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Get last connection error if any
     */
    getLastError(): string | null {
        return this.lastError;
    }

    /**
     * Check database connection health with latency measurement
     */
    async checkConnection(): Promise<{
        connected: boolean;
        latency?: number;
        error?: string;
    }> {
        const start = Date.now();
        try {
            await this.$queryRaw`SELECT 1`;
            const latency = Date.now() - start;
            this.connected = true;
            this.lastError = null;
            return { connected: true, latency };
        } catch (error) {
            this.connected = false;
            this.lastError = error.message;
            return { connected: false, error: error.message };
        }
    }
}
