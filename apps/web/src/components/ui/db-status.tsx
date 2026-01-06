'use client';

import { useEffect, useState } from 'react';
import { Database, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { healthApi } from '@/lib/api';

interface DbStatus {
    status: 'connected' | 'disconnected' | 'checking';
    latency?: string;
    host?: string;
    error?: string;
}

export function DbStatus() {
    const [status, setStatus] = useState<DbStatus>({ status: 'checking' });
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await healthApi.getDatabaseStatus();
                setStatus({
                    status: response.data.status,
                    latency: response.data.latency,
                    host: response.data.host,
                    error: response.data.error,
                });
            } catch (error) {
                setStatus({
                    status: 'disconnected',
                    error: 'Failed to check database status',
                });
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, []);

    const getStatusColor = () => {
        switch (status.status) {
            case 'connected':
                return 'text-green-400 bg-green-500/20 border-green-500/30';
            case 'disconnected':
                return 'text-red-400 bg-red-500/20 border-red-500/30';
            default:
                return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
        }
    };

    const getIcon = () => {
        switch (status.status) {
            case 'connected':
                return <CheckCircle className="h-3 w-3" />;
            case 'disconnected':
                return <XCircle className="h-3 w-3" />;
            default:
                return <Loader2 className="h-3 w-3 animate-spin" />;
        }
    };

    const getStatusText = () => {
        switch (status.status) {
            case 'connected':
                return 'DB Online';
            case 'disconnected':
                return 'DB Offline';
            default:
                return 'Verificando...';
        }
    };

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all cursor-default ${getStatusColor()}`}
            >
                <Database className="h-3 w-3" />
                {getIcon()}
                <span>{getStatusText()}</span>
            </div>

            {/* Tooltip */}
            {isHovered && status.status !== 'checking' && (
                <div className="absolute top-full mt-2 right-0 z-50 p-3 rounded-lg bg-card border border-border shadow-lg min-w-[200px]">
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Status:</span>
                            <span className={status.status === 'connected' ? 'text-green-400' : 'text-red-400'}>
                                {status.status === 'connected' ? 'Conectado' : 'Desconectado'}
                            </span>
                        </div>
                        {status.host && (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Host:</span>
                                <span className="font-mono text-xs">{status.host}</span>
                            </div>
                        )}
                        {status.latency && (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Latência:</span>
                                <span className="text-green-400">{status.latency}</span>
                            </div>
                        )}
                        {status.error && (
                            <div className="flex items-center gap-2 text-red-400">
                                <AlertCircle className="h-3 w-3" />
                                <span className="text-xs">{status.error}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
