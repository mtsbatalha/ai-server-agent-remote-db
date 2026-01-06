import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { CreateServerDto, UpdateServerDto, ServerResponseDto } from './dto/server.dto';
import { AuthType, ServerStatus, Role } from '@prisma/client';

@Injectable()
export class ServersService {
    constructor(
        private prisma: PrismaService,
        private encryption: EncryptionService,
    ) { }

    async findAll(userId: string, userRole: Role): Promise<ServerResponseDto[]> {
        const where = userRole === Role.ADMIN ? {} : { userId };

        const servers = await this.prisma.server.findMany({
            where,
            select: {
                id: true,
                name: true,
                description: true,
                host: true,
                port: true,
                username: true,
                authType: true,
                status: true,
                lastConnection: true,
                tags: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return servers;
    }

    async findOne(id: string, userId: string, userRole: Role): Promise<ServerResponseDto> {
        const server = await this.prisma.server.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                description: true,
                host: true,
                port: true,
                username: true,
                authType: true,
                status: true,
                lastConnection: true,
                tags: true,
                createdAt: true,
                userId: true,
            },
        });

        if (!server) {
            throw new NotFoundException('Server not found');
        }

        if (userRole !== Role.ADMIN && server.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        return server;
    }

    async create(dto: CreateServerDto, userId: string): Promise<ServerResponseDto> {
        // Validate auth credentials
        if (dto.authType === AuthType.PASSWORD && !dto.password) {
            throw new BadRequestException('Password is required for PASSWORD auth type');
        }

        if (dto.authType === AuthType.KEY && !dto.privateKey) {
            throw new BadRequestException('Private key is required for KEY auth type');
        }

        // Encrypt sensitive data
        const encryptedData: Partial<CreateServerDto> = { ...dto };

        if (dto.password) {
            encryptedData.password = this.encryption.encrypt(dto.password);
        }

        if (dto.privateKey) {
            encryptedData.privateKey = this.encryption.encrypt(dto.privateKey);
        }

        if (dto.passphrase) {
            encryptedData.passphrase = this.encryption.encrypt(dto.passphrase);
        }

        const server = await this.prisma.server.create({
            data: {
                name: dto.name,
                host: dto.host,
                username: dto.username,
                authType: dto.authType,
                description: dto.description,
                password: encryptedData.password,
                privateKey: encryptedData.privateKey,
                passphrase: encryptedData.passphrase,
                port: dto.port || 22,
                tags: dto.tags || [],
                userId,
            },
            select: {
                id: true,
                name: true,
                description: true,
                host: true,
                port: true,
                username: true,
                authType: true,
                status: true,
                lastConnection: true,
                tags: true,
                createdAt: true,
            },
        });

        return server;
    }

    async update(id: string, dto: UpdateServerDto, userId: string, userRole: Role): Promise<ServerResponseDto> {
        await this.findOne(id, userId, userRole); // Check access

        const encryptedData: Partial<UpdateServerDto> = { ...dto };

        if (dto.password) {
            encryptedData.password = this.encryption.encrypt(dto.password);
        }

        if (dto.privateKey) {
            encryptedData.privateKey = this.encryption.encrypt(dto.privateKey);
        }

        if (dto.passphrase) {
            encryptedData.passphrase = this.encryption.encrypt(dto.passphrase);
        }

        const server = await this.prisma.server.update({
            where: { id },
            data: encryptedData,
            select: {
                id: true,
                name: true,
                description: true,
                host: true,
                port: true,
                username: true,
                authType: true,
                status: true,
                lastConnection: true,
                tags: true,
                createdAt: true,
            },
        });

        return server;
    }

    async delete(id: string, userId: string, userRole: Role): Promise<void> {
        await this.findOne(id, userId, userRole); // Check access

        await this.prisma.server.delete({
            where: { id },
        });
    }

    async getDecryptedCredentials(id: string, userId: string, userRole: Role) {
        const server = await this.prisma.server.findUnique({
            where: { id },
        });

        if (!server) {
            throw new NotFoundException('Server not found');
        }

        if (userRole !== Role.ADMIN && server.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        return {
            host: server.host,
            port: server.port,
            username: server.username,
            authType: server.authType,
            password: server.password ? this.encryption.decrypt(server.password) : null,
            privateKey: server.privateKey ? this.encryption.decrypt(server.privateKey) : null,
            passphrase: server.passphrase ? this.encryption.decrypt(server.passphrase) : null,
        };
    }

    async updateStatus(id: string, status: ServerStatus, fingerprint?: string): Promise<void> {
        await this.prisma.server.update({
            where: { id },
            data: {
                status,
                lastConnection: status === ServerStatus.CONNECTED ? new Date() : undefined,
                fingerprint,
            },
        });
    }
}
