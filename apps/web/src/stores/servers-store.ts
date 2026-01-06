import { create } from 'zustand';
import { serversApi } from '@/lib/api';

export interface Server {
    id: string;
    name: string;
    description: string | null;
    host: string;
    port: number;
    username: string;
    authType: 'PASSWORD' | 'KEY';
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    lastConnection: string | null;
    tags: string[];
    createdAt: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ServersState {
    servers: Server[];
    selectedServer: Server | null;
    isLoading: boolean;
    connectionStatus: ConnectionStatus;
    connectionError: string | null;
    setServers: (servers: Server[]) => void;
    addServer: (server: Server) => void;
    updateServer: (id: string, updates: Partial<Server>) => void;
    removeServer: (id: string) => void;
    selectServer: (server: Server | null) => void;
    setLoading: (loading: boolean) => void;
    connect: () => Promise<boolean>;
    disconnect: () => void;
    setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
}

export const useServersStore = create<ServersState>((set, get) => ({
    servers: [],
    selectedServer: null,
    isLoading: false,
    connectionStatus: 'disconnected',
    connectionError: null,
    setServers: (servers) => set({ servers }),
    addServer: (server) =>
        set((state) => ({ servers: [server, ...state.servers] })),
    updateServer: (id, updates) =>
        set((state) => ({
            servers: state.servers.map((s) =>
                s.id === id ? { ...s, ...updates } : s
            ),
            selectedServer:
                state.selectedServer?.id === id
                    ? { ...state.selectedServer, ...updates }
                    : state.selectedServer,
        })),
    removeServer: (id) =>
        set((state) => ({
            servers: state.servers.filter((s) => s.id !== id),
            selectedServer:
                state.selectedServer?.id === id ? null : state.selectedServer,
        })),
    selectServer: (server) => set({
        selectedServer: server,
        connectionStatus: 'disconnected',
        connectionError: null,
    }),
    setLoading: (isLoading) => set({ isLoading }),
    connect: async () => {
        const server = get().selectedServer;
        if (!server) return false;

        set({ connectionStatus: 'connecting', connectionError: null });

        try {
            await serversApi.testConnection(server.id, 15);
            set({ connectionStatus: 'connected', connectionError: null });
            get().updateServer(server.id, { status: 'CONNECTED' });
            return true;
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || 'Falha ao conectar';
            set({ connectionStatus: 'error', connectionError: errorMsg });
            get().updateServer(server.id, { status: 'ERROR' });
            return false;
        }
    },
    disconnect: () => {
        const server = get().selectedServer;
        if (server) {
            get().updateServer(server.id, { status: 'DISCONNECTED' });
        }
        set({ connectionStatus: 'disconnected', connectionError: null });
    },
    setConnectionStatus: (status, error) => set({
        connectionStatus: status,
        connectionError: error || null
    }),
}));

