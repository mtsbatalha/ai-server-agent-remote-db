import { Injectable, BadRequestException, Logger, OnModuleDestroy } from '@nestjs/common';
import { NodeSSH, SSHExecCommandResponse } from 'node-ssh';
import { AuthType } from '@prisma/client';

export interface SSHCredentials {
    host: string;
    port: number;
    username: string;
    authType: AuthType;
    password: string | null;
    privateKey: string | null;
    passphrase: string | null;
}

export interface CommandResult {
    stdout: string;
    stderr: string;
    code: number | null;
    success: boolean;
}

interface ConnectionEntry {
    ssh: NodeSSH;
    credentials: SSHCredentials;
    lastUsed: number;
    retryCount: number;
}

@Injectable()
export class SshService implements OnModuleDestroy {
    private readonly logger = new Logger(SshService.name);
    private connections: Map<string, ConnectionEntry> = new Map();

    // Configuration
    private readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_RETRY_ATTEMPTS = 3;
    private readonly RETRY_DELAY_MS = 1000; // Base delay for exponential backoff
    private readonly HEALTH_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Start cleanup interval for idle connections
        this.startCleanupInterval();
    }

    onModuleDestroy() {
        this.stopCleanupInterval();
        this.disconnectAll();
    }

    private startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdleConnections();
        }, this.HEALTH_CHECK_INTERVAL_MS);
    }

    private stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    private cleanupIdleConnections() {
        const now = Date.now();
        for (const [serverId, entry] of this.connections) {
            if (now - entry.lastUsed > this.IDLE_TIMEOUT_MS) {
                this.logger.log(`Closing idle connection for server ${serverId}`);
                this.disconnect(serverId);
            }
        }
    }

    async testConnection(
        credentials: SSHCredentials,
        timeout: number = 10,
    ): Promise<{ success: boolean; message: string; fingerprint?: string }> {
        const ssh = new NodeSSH();

        try {
            const config = this.buildConnectionConfig(credentials, timeout * 1000);

            await ssh.connect(config);

            // Get server fingerprint
            const result = await ssh.execCommand('hostname');
            const hostname = result.stdout.trim();

            ssh.dispose();

            return {
                success: true,
                message: `Successfully connected to ${hostname}`,
                fingerprint: hostname,
            };
        } catch (error) {
            this.logger.error(`SSH connection failed: ${error.message}`);
            return {
                success: false,
                message: error.message || 'Connection failed',
            };
        } finally {
            if (ssh.isConnected()) {
                ssh.dispose();
            }
        }
    }

    /**
     * Check if connection is healthy by sending a simple command
     */
    private async isConnectionHealthy(ssh: NodeSSH): Promise<boolean> {
        if (!ssh.isConnected()) {
            return false;
        }

        try {
            // Send a simple command to verify connection is responsive
            const result = await Promise.race([
                ssh.execCommand('echo ok', { cwd: '/' }),
                new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error('Health check timeout')), 5000)
                )
            ]) as SSHExecCommandResponse | null;

            return result !== null && result.stdout.includes('ok');
        } catch (error) {
            this.logger.warn(`Connection health check failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Connect to a server with auto-reconnect capability
     */
    async connect(serverId: string, credentials: SSHCredentials): Promise<NodeSSH> {
        // Check if already connected and healthy
        const existing = this.connections.get(serverId);
        if (existing) {
            const isHealthy = await this.isConnectionHealthy(existing.ssh);
            if (isHealthy) {
                existing.lastUsed = Date.now();
                return existing.ssh;
            }
            // Connection unhealthy, clean it up
            this.logger.warn(`Connection for ${serverId} unhealthy, reconnecting...`);
            await this.disconnect(serverId);
        }

        // Establish new connection with retry logic
        return this.connectWithRetry(serverId, credentials);
    }

    /**
     * Connect with exponential backoff retry
     */
    private async connectWithRetry(
        serverId: string,
        credentials: SSHCredentials,
        attempt: number = 0
    ): Promise<NodeSSH> {
        const ssh = new NodeSSH();
        const config = this.buildConnectionConfig(credentials, 30000);

        try {
            await ssh.connect(config);

            this.connections.set(serverId, {
                ssh,
                credentials,
                lastUsed: Date.now(),
                retryCount: 0,
            });

            this.logger.log(`SSH connected to ${credentials.host} (attempt ${attempt + 1})`);
            return ssh;
        } catch (error) {
            if (attempt < this.MAX_RETRY_ATTEMPTS - 1) {
                const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt);
                this.logger.warn(
                    `SSH connection failed (attempt ${attempt + 1}/${this.MAX_RETRY_ATTEMPTS}), ` +
                    `retrying in ${delay}ms: ${error.message}`
                );

                await this.sleep(delay);
                return this.connectWithRetry(serverId, credentials, attempt + 1);
            }

            this.logger.error(
                `Failed to connect to ${credentials.host} after ${this.MAX_RETRY_ATTEMPTS} attempts: ${error.message}`
            );
            throw new BadRequestException(`SSH connection failed: ${error.message}`);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async disconnect(serverId: string): Promise<void> {
        const entry = this.connections.get(serverId);
        if (entry) {
            try {
                if (entry.ssh.isConnected()) {
                    entry.ssh.dispose();
                }
            } catch (error) {
                this.logger.warn(`Error disposing connection: ${error.message}`);
            }
            this.connections.delete(serverId);
            this.logger.log(`SSH disconnected from server ${serverId}`);
        }
    }

    /**
     * Execute command with auto-reconnect on failure
     */
    async executeCommand(
        serverId: string,
        command: string,
        credentials: SSHCredentials,
    ): Promise<CommandResult> {
        const entry = this.connections.get(serverId);

        // Get or establish connection
        let ssh: NodeSSH;
        try {
            ssh = await this.connect(serverId, credentials);
        } catch (error) {
            return {
                stdout: '',
                stderr: `Connection failed: ${error.message}`,
                code: -1,
                success: false,
            };
        }

        try {
            const result = await ssh.execCommand(command, {
                cwd: '/',
                execOptions: { pty: true },
            });

            // Update last used time
            const connectionEntry = this.connections.get(serverId);
            if (connectionEntry) {
                connectionEntry.lastUsed = Date.now();
            }

            return {
                stdout: result.stdout,
                stderr: result.stderr,
                code: result.code,
                success: result.code === 0,
            };
        } catch (error) {
            this.logger.error(`Command execution failed: ${error.message}`);

            // Check if it's a connection error, try to reconnect
            if (this.isConnectionError(error)) {
                this.logger.warn(`Connection error detected, attempting reconnect...`);
                await this.disconnect(serverId);

                try {
                    ssh = await this.connect(serverId, credentials);
                    const result = await ssh.execCommand(command, {
                        cwd: '/',
                        execOptions: { pty: true },
                    });

                    return {
                        stdout: result.stdout,
                        stderr: result.stderr,
                        code: result.code,
                        success: result.code === 0,
                    };
                } catch (retryError) {
                    return {
                        stdout: '',
                        stderr: `Reconnection failed: ${retryError.message}`,
                        code: -1,
                        success: false,
                    };
                }
            }

            return {
                stdout: '',
                stderr: error.message,
                code: -1,
                success: false,
            };
        }
    }

    private isConnectionError(error: any): boolean {
        const connectionErrors = [
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'EPIPE',
            'socket hang up',
            'connection lost',
            'Connection lost',
            'Not connected',
        ];

        const message = error.message || error.toString();
        return connectionErrors.some(err => message.includes(err));
    }

    async executeCommands(
        serverId: string,
        commands: string[],
        credentials: SSHCredentials,
        onOutput?: (output: string, isError: boolean) => void,
    ): Promise<CommandResult[]> {
        const results: CommandResult[] = [];

        for (const command of commands) {
            if (onOutput) {
                onOutput(`$ ${command}\n`, false);
            }

            const result = await this.executeCommand(serverId, command, credentials);
            results.push(result);

            if (onOutput) {
                if (result.stdout) {
                    onOutput(result.stdout + '\n', false);
                }
                if (result.stderr) {
                    onOutput(result.stderr + '\n', true);
                }
            }

            // Stop execution if command failed
            if (!result.success) {
                break;
            }
        }

        return results;
    }

    private buildConnectionConfig(credentials: SSHCredentials, timeout: number) {
        const config: any = {
            host: credentials.host,
            port: credentials.port,
            username: credentials.username,
            readyTimeout: timeout,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3,
        };

        if (credentials.authType === AuthType.PASSWORD) {
            config.password = credentials.password;
        } else {
            config.privateKey = credentials.privateKey;
            if (credentials.passphrase) {
                config.passphrase = credentials.passphrase;
            }
        }

        return config;
    }

    isConnected(serverId: string): boolean {
        const entry = this.connections.get(serverId);
        return entry ? entry.ssh.isConnected() : false;
    }

    /**
     * Get connection info for debugging
     */
    getConnectionInfo(serverId: string): { connected: boolean; lastUsed: Date | null; idleMs: number } | null {
        const entry = this.connections.get(serverId);
        if (!entry) return null;

        return {
            connected: entry.ssh.isConnected(),
            lastUsed: new Date(entry.lastUsed),
            idleMs: Date.now() - entry.lastUsed,
        };
    }

    /**
     * Get all active connections count
     */
    getActiveConnectionsCount(): number {
        return this.connections.size;
    }

    async disconnectAll(): Promise<void> {
        for (const [serverId] of this.connections) {
            await this.disconnect(serverId);
        }
        this.logger.log('All SSH connections closed');
    }
}
