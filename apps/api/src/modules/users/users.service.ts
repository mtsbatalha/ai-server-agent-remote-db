import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, UserResponseDto } from './dto/user.dto';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll(): Promise<UserResponseDto[]> {
        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return users;
    }

    async findOne(id: string): Promise<UserResponseDto> {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async create(dto: CreateUserDto): Promise<UserResponseDto> {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 12);

        const user = await this.prisma.user.create({
            data: {
                ...dto,
                password: hashedPassword,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        return user;
    }

    async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
        await this.findOne(id); // Check if exists

        if (dto.email) {
            const existingUser = await this.prisma.user.findFirst({
                where: { email: dto.email, NOT: { id } },
            });

            if (existingUser) {
                throw new ConflictException('Email already in use');
            }
        }

        const user = await this.prisma.user.update({
            where: { id },
            data: dto,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        return user;
    }

    async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const isValid = await bcrypt.compare(dto.currentPassword, user.password);

        if (!isValid) {
            throw new ForbiddenException('Invalid current password');
        }

        const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

        await this.prisma.user.update({
            where: { id },
            data: { password: hashedPassword },
        });
    }

    async delete(id: string): Promise<void> {
        await this.findOne(id); // Check if exists

        await this.prisma.user.delete({
            where: { id },
        });
    }

    async getProfile(id: string): Promise<UserResponseDto> {
        return this.findOne(id);
    }
}
