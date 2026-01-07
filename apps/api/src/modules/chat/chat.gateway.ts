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
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SshService } from '../ssh/ssh.service';
import { CommandValidatorService } from '../ssh/command-validator.service';
import { ServersService } from '../servers/servers.service';
import { AuditService } from '../audit/audit.service';
import { ExecutionStatus, RiskLevel, Role } from '@prisma/client';
import { getOrGenerateSecret } from '../../common/config/secrets.helper';

interface AuthenticatedSocket extends Socket {
    user?: {
        id: string;
        email: string;
        role: Role;
    };
}

interface ExecuteMessage {
    serverId: string;
    prompt: string;
    dryRun?: boolean;
}

interface ConfirmMessage {
    executionId: string;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        private prisma: PrismaService,
        private aiService: AiService,
        private sshService: SshService,
        private commandValidator: CommandValidatorService,
        private serversService: ServersService,
        private auditService: AuditService,
    ) { }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                this.logger.warn('Client connected without token');
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

            client.join(`user:${payload.sub}`);
            this.logger.log(`Client connected: ${payload.email}`);
        } catch (error) {
            this.logger.error(`Authentication failed: ${error.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: AuthenticatedSocket) {
        if (client.user) {
            this.logger.log(`Client disconnected: ${client.user.email}`);
        }
    }

    @SubscribeMessage('execute')
    async handleExecute(
        @MessageBody() data: ExecuteMessage,
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.user) {
            return { error: 'Not authenticated' };
        }

        const { serverId, prompt, dryRun = false } = data;
        const userId = client.user.id;
        const userRole = client.user.role;

        try {
            // Create execution record
            const execution = await this.prisma.execution.create({
                data: {
                    prompt,
                    commands: [],
                    status: ExecutionStatus.PLANNING,
                    dryRun,
                    userId,
                    serverId,
                },
            });

            // Emit status update
            client.emit('status', { executionId: execution.id, status: 'PLANNING', message: 'Analisando solicitação...' });

            // Get server info and detect distro
            const server = await this.serversService.findOne(serverId, userId, userRole);
            const credentials = await this.serversService.getDecryptedCredentials(serverId, userId, userRole);
            const distro = await this.detectDistro(serverId, credentials);
            const serverInfo = `Host: ${server.host}, OS: ${distro}`;

            // Step 1: Create plan
            const plan = await this.aiService.createPlan(prompt, serverInfo);

            await this.prisma.execution.update({
                where: { id: execution.id },
                data: { plan: plan as any, status: ExecutionStatus.VALIDATING },
            });

            client.emit('plan', { executionId: execution.id, plan });
            client.emit('status', { executionId: execution.id, status: 'VALIDATING', message: 'Gerando comandos...' });

            // Step 2: Generate commands
            const commandsResult = await this.aiService.generateCommands(prompt, plan, distro);

            // Step 3: Validate commands
            const validation = this.commandValidator.validateCommands(commandsResult.commands);

            if (!validation.isValid) {
                await this.prisma.execution.update({
                    where: { id: execution.id },
                    data: {
                        commands: commandsResult.commands,
                        status: ExecutionStatus.BLOCKED,
                        riskLevel: RiskLevel.CRITICAL,
                        error: `Comandos bloqueados: ${validation.blockedCommands.join(', ')}`,
                    },
                });

                client.emit('blocked', {
                    executionId: execution.id,
                    blockedCommands: validation.blockedCommands,
                    allCommands: commandsResult.commands,
                    reason: validation.reason,
                });

                await this.auditService.log({
                    userId,
                    action: 'EXECUTION_BLOCKED',
                    resource: 'execution',
                    resourceId: execution.id,
                    details: { blockedCommands: validation.blockedCommands },
                });

                return;
            }

            // Step 4: AI Security validation
            const securityResult = await this.aiService.validateSecurity(commandsResult.commands);

            const riskLevel = securityResult.riskLevel as RiskLevel;

            await this.prisma.execution.update({
                where: { id: execution.id },
                data: {
                    commands: commandsResult.commands,
                    riskLevel,
                    status: plan.requiresConfirmation || riskLevel !== 'LOW'
                        ? ExecutionStatus.AWAITING_CONFIRMATION
                        : ExecutionStatus.EXECUTING,
                },
            });

            client.emit('commands', {
                executionId: execution.id,
                commands: commandsResult.commands,
                explanation: commandsResult.explanation,
                warnings: [...commandsResult.warnings, ...validation.warningCommands],
                riskLevel,
                securityIssues: securityResult.issues,
                requiresConfirmation: plan.requiresConfirmation || riskLevel !== 'LOW',
            });

            // If dry-run or requires confirmation, wait for user
            if (dryRun || plan.requiresConfirmation || riskLevel !== 'LOW') {
                client.emit('status', {
                    executionId: execution.id,
                    status: 'AWAITING_CONFIRMATION',
                    message: 'Aguardando confirmação...',
                });
                return;
            }

            // Otherwise, execute immediately
            await this.executeCommands(execution.id, client);

        } catch (error) {
            this.logger.error(`Execution error: ${error.message}`);
            client.emit('error', { message: error.message });
        }
    }

    @SubscribeMessage('confirm')
    async handleConfirm(
        @MessageBody() data: ConfirmMessage,
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.user) {
            return { error: 'Not authenticated' };
        }

        const { executionId } = data;

        try {
            const execution = await this.prisma.execution.findUnique({
                where: { id: executionId },
            });

            if (!execution || execution.userId !== client.user.id) {
                return { error: 'Execution not found' };
            }

            if (execution.status !== ExecutionStatus.AWAITING_CONFIRMATION) {
                return { error: 'Execution not awaiting confirmation' };
            }

            await this.prisma.execution.update({
                where: { id: executionId },
                data: { confirmed: true },
            });

            await this.auditService.log({
                userId: client.user.id,
                action: 'EXECUTION_CONFIRMED',
                resource: 'execution',
                resourceId: executionId,
            });

            await this.executeCommands(executionId, client);

        } catch (error) {
            this.logger.error(`Confirm error: ${error.message}`);
            client.emit('error', { message: error.message });
        }
    }

    @SubscribeMessage('cancel')
    async handleCancel(
        @MessageBody() data: ConfirmMessage,
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.user) {
            return { error: 'Not authenticated' };
        }

        const { executionId } = data;

        try {
            await this.prisma.execution.update({
                where: { id: executionId },
                data: { status: ExecutionStatus.CANCELLED },
            });

            await this.auditService.log({
                userId: client.user.id,
                action: 'EXECUTION_CANCELLED',
                resource: 'execution',
                resourceId: executionId,
            });

            client.emit('status', { executionId, status: 'CANCELLED', message: 'Execução cancelada' });

        } catch (error) {
            this.logger.error(`Cancel error: ${error.message}`);
        }
    }

    /**
     * Handle override of blocked commands
     * Allows user to execute blocked commands with explicit confirmation
     */
    @SubscribeMessage('override')
    async handleOverride(
        @MessageBody() data: { executionId: string },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.user) {
            return { error: 'Not authenticated' };
        }

        const { executionId } = data;

        try {
            const execution = await this.prisma.execution.findUnique({
                where: { id: executionId },
            });

            if (!execution || execution.userId !== client.user.id) {
                return { error: 'Execution not found' };
            }

            if (execution.status !== ExecutionStatus.BLOCKED) {
                return { error: 'Execution is not blocked' };
            }

            // Log the override action for security audit
            await this.auditService.log({
                userId: client.user.id,
                action: 'EXECUTION_OVERRIDE',
                resource: 'execution',
                resourceId: executionId,
                details: {
                    commands: execution.commands,
                    warning: 'User overrode security block to execute potentially dangerous commands'
                },
            });

            this.logger.warn(
                `User ${client.user.email} overrode security block for execution ${executionId}`
            );

            // Update execution status to awaiting confirmation
            await this.prisma.execution.update({
                where: { id: executionId },
                data: {
                    status: ExecutionStatus.AWAITING_CONFIRMATION,
                    riskLevel: RiskLevel.CRITICAL,
                },
            });

            // Execute the commands directly
            await this.executeCommands(executionId, client);

        } catch (error) {
            this.logger.error(`Override error: ${error.message}`);
            client.emit('error', { message: error.message });
        }
    }

    private async executeCommands(executionId: string, client: AuthenticatedSocket) {
        const execution = await this.prisma.execution.findUnique({
            where: { id: executionId },
            include: { server: true },
        });

        if (!execution || !client.user) return;

        const startTime = Date.now();

        await this.prisma.execution.update({
            where: { id: executionId },
            data: { status: ExecutionStatus.EXECUTING, executedAt: new Date() },
        });

        client.emit('status', { executionId, status: 'EXECUTING', message: 'Executando comandos...' });

        try {
            const credentials = await this.serversService.getDecryptedCredentials(
                execution.serverId,
                execution.userId,
                client.user.role,
            );

            const commands = execution.commands as string[];
            let fullOutput = '';
            const exitCodes: (number | null)[] = [];

            for (let i = 0; i < commands.length; i++) {
                const command = commands[i];
                client.emit('output', { executionId, type: 'command', content: `$ ${command}` });

                let result = await this.sshService.executeCommand(
                    execution.serverId,
                    command,
                    credentials,
                );

                // If connection error detected, try reconnecting
                if (!result.success && this.isConnectionLostError(result.stderr)) {
                    result = await this.retryWithReconnect(
                        execution.serverId,
                        command,
                        credentials,
                        client,
                        executionId,
                    );
                }

                exitCodes.push(result.code);

                if (result.stdout) {
                    fullOutput += result.stdout + '\n';
                    client.emit('output', { executionId, type: 'stdout', content: result.stdout });
                }

                if (result.stderr) {
                    fullOutput += result.stderr + '\n';
                    client.emit('output', { executionId, type: 'stderr', content: result.stderr });
                }

                if (!result.success) {
                    break;
                }
            }

            const duration = Date.now() - startTime;
            const allSucceeded = exitCodes.every(code => code === 0);

            // Analyze result with AI
            const analysis = await this.aiService.analyzeResult(
                execution.prompt,
                commands,
                fullOutput,
                exitCodes,
            );

            await this.prisma.execution.update({
                where: { id: executionId },
                data: {
                    output: fullOutput,
                    status: allSucceeded ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED,
                    completedAt: new Date(),
                    duration,
                },
            });

            client.emit('complete', {
                executionId,
                success: allSucceeded,
                duration,
                analysis,
            });

            await this.auditService.log({
                userId: execution.userId,
                action: allSucceeded ? 'EXECUTION_COMPLETED' : 'EXECUTION_FAILED',
                resource: 'execution',
                resourceId: executionId,
                details: { duration, exitCodes },
                executionId,
            });

        } catch (error) {
            this.logger.error(`Command execution error: ${error.message}`);

            await this.prisma.execution.update({
                where: { id: executionId },
                data: {
                    status: ExecutionStatus.FAILED,
                    error: error.message,
                    completedAt: new Date(),
                },
            });

            client.emit('error', { executionId, message: error.message });
        }
    }

    /**
     * Detect if error is connection-related
     */
    private isConnectionLostError(errorMessage: string): boolean {
        const connectionErrors = [
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'EPIPE',
            'socket hang up',
            'Connection lost',
            'connection lost',
            'Not connected',
            'Reconnection failed',
            'Connection failed',
        ];
        return connectionErrors.some(err => errorMessage.includes(err));
    }

    /**
     * Retry command execution with reconnect attempts
     */
    private async retryWithReconnect(
        serverId: string,
        command: string,
        credentials: any,
        client: AuthenticatedSocket,
        executionId: string,
    ): Promise<{ stdout: string; stderr: string; code: number | null; success: boolean }> {
        const MAX_RECONNECT_ATTEMPTS = 6; // 6 attempts * 10s = 1 minute max wait
        const RECONNECT_INTERVAL_MS = 10000; // 10 seconds

        for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
            client.emit('reconnecting', {
                executionId,
                attempt,
                maxAttempts: MAX_RECONNECT_ATTEMPTS,
                message: `Servidor não responde. Tentando reconectar (${attempt}/${MAX_RECONNECT_ATTEMPTS})...`,
            });

            this.logger.warn(`Reconnect attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} for server ${serverId}`);

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, RECONNECT_INTERVAL_MS));

            // Disconnect old connection
            await this.sshService.disconnect(serverId);

            // Try to reconnect and execute
            try {
                const result = await this.sshService.executeCommand(serverId, command, credentials);

                if (result.success || !this.isConnectionLostError(result.stderr)) {
                    client.emit('reconnected', {
                        executionId,
                        message: 'Conexão restabelecida!',
                    });
                    return result;
                }
            } catch (error) {
                this.logger.warn(`Reconnect attempt ${attempt} failed: ${error.message}`);
            }
        }

        // All attempts failed
        client.emit('reconnect-failed', {
            executionId,
            message: 'Falha ao reconectar ao servidor após múltiplas tentativas.',
        });

        return {
            stdout: '',
            stderr: 'Falha ao reconectar ao servidor após múltiplas tentativas.',
            code: -1,
            success: false,
        };
    }

    @SubscribeMessage('chat')
    async handleChat(
        @MessageBody() data: { message: string; serverId?: string },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.user) {
            return { error: 'Not authenticated' };
        }

        try {
            let context = '';
            if (data.serverId) {
                const server = await this.serversService.findOne(data.serverId, client.user.id, client.user.role);
                context = `Servidor: ${server.name} (${server.host})`;
            }

            const response = await this.aiService.chat(data.message, context);
            client.emit('chat_response', { message: response });

        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    /**
     * Detect the Linux distribution of a server
     */
    private async detectDistro(serverId: string, credentials: any): Promise<string> {
        try {
            // Try to detect distro using various methods
            const result = await this.sshService.executeCommand(
                serverId,
                'cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || cat /etc/alpine-release 2>/dev/null || uname -a',
                credentials,
            );

            if (!result.success || !result.stdout) {
                return 'Linux (unknown)';
            }

            const output = result.stdout.toLowerCase();

            // Detect specific distributions
            if (output.includes('alpine')) {
                return 'Alpine Linux';
            } else if (output.includes('ubuntu')) {
                return 'Ubuntu';
            } else if (output.includes('debian')) {
                return 'Debian';
            } else if (output.includes('centos')) {
                return 'CentOS';
            } else if (output.includes('rocky')) {
                return 'Rocky Linux';
            } else if (output.includes('alma')) {
                return 'AlmaLinux';
            } else if (output.includes('fedora')) {
                return 'Fedora';
            } else if (output.includes('rhel') || output.includes('red hat')) {
                return 'RHEL';
            } else if (output.includes('arch')) {
                return 'Arch Linux';
            } else if (output.includes('opensuse') || output.includes('suse')) {
                return 'openSUSE';
            } else if (output.includes('amazon')) {
                return 'Amazon Linux';
            }

            // Extract from PRETTY_NAME if available
            const prettyNameMatch = output.match(/pretty_name="?([^"\n]+)"?/i);
            if (prettyNameMatch) {
                return prettyNameMatch[1].trim();
            }

            return 'Linux (unknown)';
        } catch (error) {
            this.logger.warn(`Failed to detect distro: ${error.message}`);
            return 'Linux (unknown)';
        }
    }
}
