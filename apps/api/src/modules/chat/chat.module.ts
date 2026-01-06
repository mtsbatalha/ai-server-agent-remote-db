import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { ExecutionsController } from './executions.controller';
import { ChatSessionsController } from './chat-sessions.controller';
import { ChatSessionsService } from './chat-sessions.service';
import { AiModule } from '../ai/ai.module';
import { SshModule } from '../ssh/ssh.module';
import { ServersModule } from '../servers/servers.module';
import { getOrGenerateSecret } from '../../common/config/secrets.helper';

@Module({
    imports: [
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: getOrGenerateSecret(configService, 'JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
        AiModule,
        SshModule,
        ServersModule,
    ],
    controllers: [ExecutionsController, ChatSessionsController],
    providers: [ChatGateway, ChatSessionsService],
})
export class ChatModule { }

