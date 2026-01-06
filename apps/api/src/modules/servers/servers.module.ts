import { Module, forwardRef } from '@nestjs/common';
import { ServersService } from './servers.service';
import { ServersController } from './servers.controller';
import { EncryptionModule } from '../../common/encryption/encryption.module';
import { SshModule } from '../ssh/ssh.module';

@Module({
    imports: [EncryptionModule, forwardRef(() => SshModule)],
    controllers: [ServersController],
    providers: [ServersService],
    exports: [ServersService],
})
export class ServersModule { }
