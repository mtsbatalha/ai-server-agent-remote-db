import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { CreateServerDto, UpdateServerDto, ServerResponseDto, TestConnectionDto } from './dto/server.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SshService } from '../ssh/ssh.service';

@ApiTags('Servers')
@ApiBearerAuth()
@Controller('servers')
export class ServersController {
    constructor(
        private serversService: ServersService,
        private sshService: SshService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get all servers' })
    @ApiResponse({ status: 200, type: [ServerResponseDto] })
    async findAll(
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: Role,
    ): Promise<ServerResponseDto[]> {
        return this.serversService.findAll(userId, userRole);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get server by ID' })
    @ApiResponse({ status: 200, type: ServerResponseDto })
    async findOne(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: Role,
    ): Promise<ServerResponseDto> {
        return this.serversService.findOne(id, userId, userRole);
    }

    @Post()
    @ApiOperation({ summary: 'Create new server' })
    @ApiResponse({ status: 201, type: ServerResponseDto })
    async create(
        @Body() dto: CreateServerDto,
        @CurrentUser('id') userId: string,
    ): Promise<ServerResponseDto> {
        return this.serversService.create(dto, userId);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update server' })
    @ApiResponse({ status: 200, type: ServerResponseDto })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateServerDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: Role,
    ): Promise<ServerResponseDto> {
        return this.serversService.update(id, dto, userId, userRole);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete server' })
    @ApiResponse({ status: 204 })
    async delete(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: Role,
    ): Promise<void> {
        return this.serversService.delete(id, userId, userRole);
    }

    @Post(':id/test')
    @ApiOperation({ summary: 'Test SSH connection' })
    @ApiResponse({ status: 200, description: 'Connection successful' })
    @ApiResponse({ status: 400, description: 'Connection failed' })
    async testConnection(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: Role,
        @Body() dto: TestConnectionDto,
    ): Promise<{ success: boolean; message: string; fingerprint?: string }> {
        const credentials = await this.serversService.getDecryptedCredentials(id, userId, userRole);
        const result = await this.sshService.testConnection(credentials, dto.timeout);

        if (result.success) {
            await this.serversService.updateStatus(id, 'CONNECTED', result.fingerprint);
        } else {
            await this.serversService.updateStatus(id, 'ERROR');
        }

        return result;
    }
}
