'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2, Terminal as TerminalIcon, X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from './button';

// Get API port from environment variable
const getApiPort = (): string => {
    if (typeof window !== 'undefined') {
        // @ts-ignore
        return process.env.NEXT_PUBLIC_API_PORT || '3003';
    }
    return '3003';
};

const getWsUrl = () => {
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = getApiPort();
        return `${protocol}//${host}:${port}`;
    }
    return 'http://localhost:3003';
};

interface TerminalPanelProps {
    serverId: string;
    serverName: string;
    onClose?: () => void;
}

export function TerminalPanel({ serverId, serverName, onClose }: TerminalPanelProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<any>(null);
    const fitAddonRef = useRef<any>(null);
    const socketRef = useRef<Socket | null>(null);
    const { token } = useAuthStore();

    const [isConnecting, setIsConnecting] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Initialize terminal
    useEffect(() => {
        let mounted = true;
        let xterm: any = null;
        let fitAddon: any = null;

        const initTerminal = async () => {
            // Dynamically import xterm to avoid SSR issues
            const { Terminal } = await import('xterm');
            const { FitAddon } = await import('@xterm/addon-fit');
            const { WebLinksAddon } = await import('@xterm/addon-web-links');

            // Import CSS
            await import('xterm/css/xterm.css');

            if (!mounted || !terminalRef.current) return;

            // Create terminal instance
            xterm = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                theme: {
                    background: '#0d1117',
                    foreground: '#c9d1d9',
                    cursor: '#58a6ff',
                    cursorAccent: '#0d1117',
                    selectionBackground: '#3b5998',
                    black: '#484f58',
                    red: '#ff7b72',
                    green: '#3fb950',
                    yellow: '#d29922',
                    blue: '#58a6ff',
                    magenta: '#bc8cff',
                    cyan: '#39c5cf',
                    white: '#b1bac4',
                    brightBlack: '#6e7681',
                    brightRed: '#ffa198',
                    brightGreen: '#56d364',
                    brightYellow: '#e3b341',
                    brightBlue: '#79c0ff',
                    brightMagenta: '#d2a8ff',
                    brightCyan: '#56d4dd',
                    brightWhite: '#f0f6fc',
                },
                allowProposedApi: true,
            });

            fitAddon = new FitAddon();
            xterm.loadAddon(fitAddon);
            xterm.loadAddon(new WebLinksAddon());

            xterm.open(terminalRef.current);
            fitAddon.fit();

            xtermRef.current = xterm;
            fitAddonRef.current = fitAddon;

            // Connect to terminal WebSocket
            connectSocket(xterm);
        };

        const connectSocket = (xterm: any) => {
            const wsUrl = getWsUrl();
            const socket = io(`${wsUrl}/terminal`, {
                auth: { token },
                transports: ['websocket', 'polling'],
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('Terminal socket connected');
                // Request terminal connection to server
                socket.emit('connect-terminal', {
                    serverId,
                    cols: xterm.cols,
                    rows: xterm.rows,
                });
            });

            socket.on('terminal-ready', () => {
                if (mounted) {
                    setIsConnecting(false);
                    setIsConnected(true);
                    xterm.focus();
                }
            });

            socket.on('terminal-output', (data: { data: string }) => {
                xterm.write(data.data);
            });

            socket.on('terminal-error', (data: { message: string }) => {
                if (mounted) {
                    setError(data.message);
                    setIsConnecting(false);
                }
            });

            socket.on('terminal-closed', () => {
                if (mounted) {
                    setIsConnected(false);
                    xterm.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n');
                }
            });

            socket.on('connect_error', (err) => {
                if (mounted) {
                    setError(`Connection error: ${err.message}`);
                    setIsConnecting(false);
                }
            });

            // Handle terminal input
            xterm.onData((data: string) => {
                if (socket.connected) {
                    socket.emit('terminal-input', { data });
                }
            });
        };

        initTerminal();

        // Handle resize
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current && socketRef.current?.connected) {
                fitAddonRef.current.fit();
                socketRef.current.emit('terminal-resize', {
                    cols: xtermRef.current.cols,
                    rows: xtermRef.current.rows,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            mounted = false;
            window.removeEventListener('resize', handleResize);

            if (socketRef.current) {
                socketRef.current.emit('disconnect-terminal');
                socketRef.current.disconnect();
                socketRef.current = null;
            }

            if (xtermRef.current) {
                xtermRef.current.dispose();
                xtermRef.current = null;
            }
        };
    }, [serverId, token]);

    // Fit on fullscreen toggle
    useEffect(() => {
        if (fitAddonRef.current && xtermRef.current) {
            setTimeout(() => {
                fitAddonRef.current?.fit();
                if (socketRef.current?.connected) {
                    socketRef.current.emit('terminal-resize', {
                        cols: xtermRef.current.cols,
                        rows: xtermRef.current.rows,
                    });
                }
            }, 100);
        }
    }, [isFullscreen]);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);

    return (
        <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-border overflow-hidden ${isFullscreen ? 'fixed inset-4 z-50' : 'h-full'
            }`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <TerminalIcon className="h-4 w-4 text-muted-foreground ml-2" />
                    <span className="text-sm text-muted-foreground">
                        {serverName} {isConnected && <span className="text-green-400">●</span>}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={toggleFullscreen}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="h-3.5 w-3.5" />
                        ) : (
                            <Maximize2 className="h-3.5 w-3.5" />
                        )}
                    </Button>
                    {onClose && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={onClose}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Terminal Container */}
            <div className="flex-1 relative">
                {isConnecting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117] z-10">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Connecting to {serverName}...</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117] z-10">
                        <div className="flex flex-col items-center gap-2 text-center px-4">
                            <span className="text-red-400">Connection Error</span>
                            <span className="text-sm text-muted-foreground">{error}</span>
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={() => window.location.reload()}
                            >
                                Retry
                            </Button>
                        </div>
                    </div>
                )}

                <div
                    ref={terminalRef}
                    className="h-full w-full p-2"
                    style={{ minHeight: isFullscreen ? 'calc(100vh - 100px)' : '400px' }}
                />
            </div>
        </div>
    );
}
