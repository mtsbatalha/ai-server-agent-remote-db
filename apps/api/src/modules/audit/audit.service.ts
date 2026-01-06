import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AuditLogData {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    executionId?: string;
}

@Injectable()
export class AuditService {
    constructor(private prisma: PrismaService) { }

    async log(data: AuditLogData): Promise<void> {
        await this.prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                resource: data.resource,
                resourceId: data.resourceId,
                details: data.details,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                executionId: data.executionId,
            },
        });
    }

    async getUserLogs(userId: string, limit: number = 50) {
        return this.prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async getExecutionLogs(executionId: string) {
        return this.prisma.auditLog.findMany({
            where: { executionId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async getAllLogs(limit: number = 100) {
        return this.prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });
    }

    async getLogsByAction(action: string, limit: number = 50) {
        return this.prisma.auditLog.findMany({
            where: { action },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });
    }

    async getLogsByResource(resource: string, resourceId?: string, limit: number = 50) {
        return this.prisma.auditLog.findMany({
            where: {
                resource,
                ...(resourceId && { resourceId }),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });
    }
}
