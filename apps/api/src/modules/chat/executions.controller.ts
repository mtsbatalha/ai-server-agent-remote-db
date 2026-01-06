import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Executions')
@ApiBearerAuth()
@Controller('executions')
export class ExecutionsController {
    constructor(private prisma: PrismaService) { }

    @Get()
    @ApiOperation({ summary: 'Get execution history' })
    async findAll(
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: Role,
        @Query('serverId') serverId?: string,
        @Query('limit') limit: number = 50,
    ) {
        const where = {
            ...(userRole !== Role.ADMIN && { userId }),
            ...(serverId && { serverId }),
        };

        return this.prisma.execution.findMany({
            where,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                server: {
                    select: {
                        id: true,
                        name: true,
                        host: true,
                    },
                },
            },
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get execution details' })
    async findOne(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: Role,
    ) {
        const execution = await this.prisma.execution.findUnique({
            where: { id },
            include: {
                server: {
                    select: {
                        id: true,
                        name: true,
                        host: true,
                    },
                },
                auditLogs: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!execution) {
            return null;
        }

        if (userRole !== Role.ADMIN && execution.userId !== userId) {
            return null;
        }

        return execution;
    }
}
