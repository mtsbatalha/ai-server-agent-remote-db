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
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, UserResponseDto } from './dto/user.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get all users (Admin only)' })
    @ApiResponse({ status: 200, type: [UserResponseDto] })
    async findAll(): Promise<UserResponseDto[]> {
        return this.usersService.findAll();
    }

    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, type: UserResponseDto })
    async getProfile(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
        return this.usersService.getProfile(userId);
    }

    @Get(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get user by ID (Admin only)' })
    @ApiResponse({ status: 200, type: UserResponseDto })
    async findOne(@Param('id') id: string): Promise<UserResponseDto> {
        return this.usersService.findOne(id);
    }

    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create new user (Admin only)' })
    @ApiResponse({ status: 201, type: UserResponseDto })
    async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
        return this.usersService.create(dto);
    }

    @Put(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update user (Admin only)' })
    @ApiResponse({ status: 200, type: UserResponseDto })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateUserDto,
    ): Promise<UserResponseDto> {
        return this.usersService.update(id, dto);
    }

    @Put('me/password')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Change current user password' })
    @ApiResponse({ status: 204 })
    async changePassword(
        @CurrentUser('id') userId: string,
        @Body() dto: ChangePasswordDto,
    ): Promise<void> {
        return this.usersService.changePassword(userId, dto);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete user (Admin only)' })
    @ApiResponse({ status: 204 })
    async delete(@Param('id') id: string): Promise<void> {
        return this.usersService.delete(id);
    }
}
