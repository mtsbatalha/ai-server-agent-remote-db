import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminalGateway } from './terminal.gateway';
import { SshModule } from '../ssh/ssh.module';
import { ServersModule } from '../servers/servers.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { getOrGenerateSecret } from '../../common/config/secrets.helper';

@Module({
    imports: [
        PrismaModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: getOrGenerateSecret(configService, 'JWT_SECRET'),
                signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN', '7d') },
            }),
        }),
        SshModule,
        ServersModule,
        AuditModule,
    ],
    providers: [TerminalGateway],
    exports: [TerminalGateway],
})
export class TerminalModule { }
