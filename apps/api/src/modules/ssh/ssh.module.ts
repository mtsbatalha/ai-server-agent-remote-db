import { Module, forwardRef } from '@nestjs/common';
import { SshService } from './ssh.service';
import { CommandValidatorService } from './command-validator.service';
import { ServersModule } from '../servers/servers.module';

@Module({
    imports: [forwardRef(() => ServersModule)],
    providers: [SshService, CommandValidatorService],
    exports: [SshService, CommandValidatorService],
})
export class SshModule { }
