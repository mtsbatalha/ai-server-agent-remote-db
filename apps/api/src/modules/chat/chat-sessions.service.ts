import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

interface CreateChatSessionDto {
    title?: string;
    messages: any[];
    serverId: string;
    serverName: string;
}

interface UpdateChatSessionDto {
    title?: string;
    messages?: any[];
}

@Injectable()
export class ChatSessionsService {
    private readonly MAX_SESSIONS_PER_USER = 50;

    constructor(private prisma: PrismaService) { }

    async findAllByUser(userId: string) {
        return this.prisma.chatSession.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            take: this.MAX_SESSIONS_PER_USER,
            select: {
                id: true,
                title: true,
                serverId: true,
                serverName: true,
                createdAt: true,
                updatedAt: true,
                // Only get first message for preview
                messages: true,
            },
        });
    }

    async findOne(id: string, userId: string) {
        return this.prisma.chatSession.findFirst({
            where: { id, userId },
        });
    }

    async create(userId: string, dto: CreateChatSessionDto) {
        // Generate title from first user message if not provided
        const title = dto.title || this.generateTitle(dto.messages);

        // Check if user has reached max sessions, delete oldest if needed
        const count = await this.prisma.chatSession.count({ where: { userId } });
        if (count >= this.MAX_SESSIONS_PER_USER) {
            const oldest = await this.prisma.chatSession.findFirst({
                where: { userId },
                orderBy: { updatedAt: 'asc' },
            });
            if (oldest) {
                await this.prisma.chatSession.delete({ where: { id: oldest.id } });
            }
        }

        return this.prisma.chatSession.create({
            data: {
                title,
                messages: dto.messages,
                serverId: dto.serverId,
                serverName: dto.serverName,
                userId,
            },
        });
    }

    async update(id: string, userId: string, dto: UpdateChatSessionDto) {
        return this.prisma.chatSession.updateMany({
            where: { id, userId },
            data: {
                ...(dto.title && { title: dto.title }),
                ...(dto.messages && { messages: dto.messages }),
            },
        });
    }

    async delete(id: string, userId: string) {
        return this.prisma.chatSession.deleteMany({
            where: { id, userId },
        });
    }

    private generateTitle(messages: any[]): string {
        const firstUserMessage = messages.find(m => m.type === 'user');
        if (firstUserMessage) {
            const content = firstUserMessage.content as string;
            return content.length > 50 ? content.substring(0, 47) + '...' : content;
        }
        return 'Nova conversa';
    }
}
