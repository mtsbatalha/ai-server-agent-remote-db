import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SshService } from '../ssh/ssh.service';
import { ServersService } from '../servers/servers.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@prisma/client';
import { getOrGenerateSecret } from '../../common/config/secrets.helper';
import { NodeSSH } from 'node-ssh';
import { ClientChannel } from 'ssh2';

interface AuthenticatedSocket extends Socket {
    user?: {
        id: string;
        email: string;
        role: Role;
    };
    shell?: ClientChannel;
    serverId?: string;
}

interface ConnectTerminalMessage {
    serverId: string;
    cols?: number;
    rows?: number;
}

interface TerminalInputMessage {
    data: string;
}

interface TerminalResizeMessage {
    cols: number;
    rows: number;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/terminal',
})
export class TerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(TerminalGateway.name);
    private sshConnections: Map<string, NodeSSH> = new Map();

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        private prisma: PrismaService,
        private sshService: SshService,
        private serversService: ServersService,
        private auditService: AuditService,
    ) { }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                this.logger.warn('Terminal client connected without token');
                client.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token, {
                secret: getOrGenerateSecret(this.configService, 'JWT_SECRET'),
            });

            client.user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
            };

            this.logger.log(`Terminal client connected: ${payload.email}`);
        } catch (error) {
            this.logger.error(`Terminal authentication failed: ${error.message}`);
            client.disconnect();
        }
    }

    async handleDisconnect(client: AuthenticatedSocket) {
        if (client.shell) {
            client.shell.end();
            client.shell = undefined;
        }

        if (client.serverId) {
            const ssh = this.sshConnections.get(client.id);
            if (ssh) {
                ssh.dispose();
                this.sshConnections.delete(client.id);
            }
        }

        if (client.user) {
            this.logger.log(`Terminal client disconnected: ${client.user.email}`);
        }
    }

    @SubscribeMessage('connect-terminal')
    async handleConnectTerminal(
        @MessageBody() data: ConnectTerminalMessage,
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.user) {
            return { error: 'Not authenticated' };
        }

        const { serverId, cols = 80, rows = 24 } = data;

        try {
            // Get server credentials
            const credentials = await this.serversService.getDecryptedCredentials(
                serverId,
                client.user.id,
                client.user.role,
            );

            // Create a new SSH connection for this terminal session
            const ssh = new NodeSSH();

            const connectConfig: any = {
                host: credentials.host,
                port: credentials.port,
                username: credentials.username,
                readyTimeout: 30000,
            };

            if (credentials.authType === 'PASSWORD' && credentials.password) {
                connectConfig.password = credentials.password;
            } else if (credentials.privateKey) {
                connectConfig.privateKey = credentials.privateKey;
                if (credentials.passphrase) {
                    connectConfig.passphrase = credentials.passphrase;
                }
            }

            await ssh.connect(connectConfig);

            // Store the connection
            this.sshConnections.set(client.id, ssh);
            client.serverId = serverId;

            // Request a PTY shell
            const connection = ssh.connection;
            if (!connection) {
                throw new Error('SSH connection not established');
            }

            connection.shell(
                {
                    term: 'xterm-256color',
                    cols,
                    rows,
                },
                (err: Error | undefined, stream: ClientChannel) => {
                    if (err) {
                        this.logger.error(`Shell error: ${err.message}`);
                        client.emit('terminal-error', { message: err.message });
                        return;
                    }

                    client.shell = stream;

                    // Send data to client
                    stream.on('data', (data: Buffer) => {
                        client.emit('terminal-output', { data: data.toString('utf8') });
                    });

                    stream.stderr?.on('data', (data: Buffer) => {
                        client.emit('terminal-output', { data: data.toString('utf8') });
                    });

                    stream.on('close', () => {
                        client.emit('terminal-closed', {});
                        this.cleanupConnection(client);
                    });

                    // Log the connection
                    this.auditService.log({
                        userId: client.user!.id,
                        action: 'TERMINAL_CONNECTED',
                        resource: 'server',
                        resourceId: serverId,
                    });

                    client.emit('terminal-ready', { message: 'Terminal connected' });
                }
            );

        } catch (error) {
            this.logger.error(`Terminal connection error: ${error.message}`);
            client.emit('terminal-error', { message: error.message });
        }
    }

    @SubscribeMessage('terminal-input')
    async handleTerminalInput(
        @MessageBody() data: TerminalInputMessage,
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.user || !client.shell) {
            return;
        }

        try {
            client.shell.write(data.data);
        } catch (error) {
            this.logger.error(`Terminal input error: ${error.message}`);
            client.emit('terminal-error', { message: error.message });
        }
    }

    @SubscribeMessage('terminal-resize')
    async handleTerminalResize(
        @MessageBody() data: TerminalResizeMessage,
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.user || !client.shell) {
            return;
        }

        try {
            const { cols, rows } = data;
            client.shell.setWindow(rows, cols, 0, 0);
        } catch (error) {
            this.logger.error(`Terminal resize error: ${error.message}`);
        }
    }

    @SubscribeMessage('disconnect-terminal')
    async handleDisconnectTerminal(
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        this.cleanupConnection(client);
        client.emit('terminal-closed', {});
    }

    private cleanupConnection(client: AuthenticatedSocket) {
        if (client.shell) {
            client.shell.end();
            client.shell = undefined;
        }

        const ssh = this.sshConnections.get(client.id);
        if (ssh) {
            ssh.dispose();
            this.sshConnections.delete(client.id);
        }

        if (client.serverId && client.user) {
            this.auditService.log({
                userId: client.user.id,
                action: 'TERMINAL_DISCONNECTED',
                resource: 'server',
                resourceId: client.serverId,
            });
        }

        client.serverId = undefined;
    }
}
