import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ChatSessionsService } from './chat-sessions.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Chat Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat/sessions')
export class ChatSessionsController {
    constructor(private chatSessionsService: ChatSessionsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all chat sessions for current user' })
    async findAll(@Request() req: any) {
        return this.chatSessionsService.findAllByUser(req.user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific chat session' })
    async findOne(@Param('id') id: string, @Request() req: any) {
        return this.chatSessionsService.findOne(id, req.user.id);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new chat session' })
    async create(
        @Body() dto: { title?: string; messages: any[]; serverId: string; serverName: string },
        @Request() req: any,
    ) {
        return this.chatSessionsService.create(req.user.id, dto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a chat session' })
    async update(
        @Param('id') id: string,
        @Body() dto: { title?: string; messages?: any[] },
        @Request() req: any,
    ) {
        return this.chatSessionsService.update(id, req.user.id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a chat session' })
    async delete(@Param('id') id: string, @Request() req: any) {
        return this.chatSessionsService.delete(id, req.user.id);
    }
}
