import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
    constructor(private auditService: AuditService) { }

    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get all audit logs (Admin only)' })
    async getAllLogs(@Query('limit') limit?: number) {
        return this.auditService.getAllLogs(limit);
    }

    @Get('me')
    @ApiOperation({ summary: 'Get current user audit logs' })
    async getMyLogs(
        @CurrentUser('id') userId: string,
        @Query('limit') limit?: number,
    ) {
        return this.auditService.getUserLogs(userId, limit);
    }

    @Get('action')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get logs by action (Admin only)' })
    async getByAction(
        @Query('action') action: string,
        @Query('limit') limit?: number,
    ) {
        return this.auditService.getLogsByAction(action, limit);
    }

    @Get('resource')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get logs by resource (Admin only)' })
    async getByResource(
        @Query('resource') resource: string,
        @Query('resourceId') resourceId?: string,
        @Query('limit') limit?: number,
    ) {
        return this.auditService.getLogsByResource(resource, resourceId, limit);
    }
}
