import { IsString, IsNumber, IsOptional, IsEnum, IsArray, MinLength, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthType, ServerStatus } from '@prisma/client';

export class CreateServerDto {
    @ApiProperty({ example: 'Production Server' })
    @IsString()
    @MinLength(2)
    name: string;

    @ApiPropertyOptional({ example: 'Main production server' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: '192.168.1.100' })
    @IsString()
    host: string;

    @ApiPropertyOptional({ example: 22, default: 22 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(65535)
    port?: number;

    @ApiProperty({ example: 'root' })
    @IsString()
    username: string;

    @ApiProperty({ enum: AuthType })
    @IsEnum(AuthType)
    authType: AuthType;

    @ApiPropertyOptional({ description: 'SSH private key (for KEY auth)' })
    @IsOptional()
    @IsString()
    privateKey?: string;

    @ApiPropertyOptional({ description: 'Password (for PASSWORD auth)' })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiPropertyOptional({ description: 'Passphrase for encrypted private key' })
    @IsOptional()
    @IsString()
    passphrase?: string;

    @ApiPropertyOptional({ type: [String], example: ['production', 'web'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}

export class UpdateServerDto {
    @ApiPropertyOptional({ example: 'Production Server' })
    @IsOptional()
    @IsString()
    @MinLength(2)
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: '192.168.1.100' })
    @IsOptional()
    @IsString()
    host?: string;

    @ApiPropertyOptional({ example: 22 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(65535)
    port?: number;

    @ApiPropertyOptional({ example: 'root' })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiPropertyOptional({ enum: AuthType })
    @IsOptional()
    @IsEnum(AuthType)
    authType?: AuthType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    privateKey?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    password?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    passphrase?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}

export class ServerResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    description: string | null;

    @ApiProperty()
    host: string;

    @ApiProperty()
    port: number;

    @ApiProperty()
    username: string;

    @ApiProperty({ enum: AuthType })
    authType: AuthType;

    @ApiProperty({ enum: ServerStatus })
    status: ServerStatus;

    @ApiProperty()
    lastConnection: Date | null;

    @ApiProperty({ type: [String] })
    tags: string[];

    @ApiProperty()
    createdAt: Date;
}

export class TestConnectionDto {
    @ApiPropertyOptional({ description: 'Test timeout in seconds', default: 10 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(60)
    timeout?: number;
}
