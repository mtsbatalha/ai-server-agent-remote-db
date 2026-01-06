import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

let socket: Socket | null = null;

// Get API port from environment variable (set at build time in Dockerfile)
// Falls back to 3003 if not set
const getApiPort = (): string => {
    // In browser, use the NEXT_PUBLIC env var that was compiled in
    if (typeof window !== 'undefined') {
        // @ts-ignore - NEXT_PUBLIC vars are replaced at build time
        return process.env.NEXT_PUBLIC_API_PORT || '3003';
    }
    return '3003';
};

// Get WebSocket URL - must connect directly to API (not via Next.js proxy)
const getWsUrl = () => {
    if (typeof window !== 'undefined') {
        // Construct from current location + API port
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = getApiPort();
        return `${protocol}//${host}:${port}`;
    }
    return 'http://localhost:3003';
};

export const getSocket = (): Socket => {
    if (!socket) {
        const token = useAuthStore.getState().token;
        const wsUrl = getWsUrl();

        socket = io(`${wsUrl}/chat`, {
            auth: { token },
            transports: ['websocket', 'polling'],
            autoConnect: false,
        });
    }
    return socket;
};

export const connectSocket = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const s = getSocket();

        if (s.connected) {
            resolve();
            return;
        }

        s.connect();

        s.on('connect', () => {
            console.log('Socket connected');
            resolve();
        });

        s.on('connect_error', (error: Error) => {
            console.error('Socket connection error:', error);
            reject(error);
        });
    });
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const resetSocket = () => {
    disconnectSocket();
    socket = null;
};
