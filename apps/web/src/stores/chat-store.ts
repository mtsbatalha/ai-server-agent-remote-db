import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { chatSessionsApi } from '@/lib/api';

// Polyfill for crypto.randomUUID (not available in insecure contexts)
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for insecure contexts (HTTP)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

export interface Message {
    id: string;
    type: 'user' | 'assistant' | 'system' | 'command' | 'output' | 'error';
    content: string;
    timestamp: Date;
    metadata?: {
        executionId?: string;
        plan?: any;
        commands?: string[];
        riskLevel?: string;
    };
}

export interface Execution {
    id: string;
    prompt: string;
    status: string;
    plan?: any;
    commands?: string[];
    output?: string;
    riskLevel?: string;
    requiresConfirmation?: boolean;
}

export interface ChatSession {
    id: string;
    title: string | null;
    serverId: string;
    serverName: string;
    createdAt: string;
    updatedAt: string;
    messages?: Message[];
}

interface ChatState {
    messages: Message[];
    currentExecution: Execution | null;
    isProcessing: boolean;
    currentSessionId: string | null;
    currentServerId: string | null;
    currentServerName: string | null;
    sessions: ChatSession[];
    sessionsLoading: boolean;
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
    clearMessages: () => void;
    setExecution: (execution: Execution | null) => void;
    updateExecution: (updates: Partial<Execution>) => void;
    setProcessing: (processing: boolean) => void;
    loadSessions: () => Promise<void>;
    loadSession: (id: string) => Promise<void>;
    saveCurrentSession: (serverId: string, serverName: string) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    startNewSession: () => void;
    setMessages: (messages: Message[]) => void;
    setCurrentServer: (serverId: string, serverName: string) => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set, get) => ({
            messages: [],
            currentExecution: null,
            isProcessing: false,
            currentSessionId: null,
            currentServerId: null,
            currentServerName: null,
            sessions: [],
            sessionsLoading: false,
            addMessage: (message) =>
                set((state) => ({
                    messages: [
                        ...state.messages,
                        {
                            ...message,
                            id: generateUUID(),
                            timestamp: new Date(),
                        },
                    ],
                })),
            clearMessages: () => set({ messages: [], currentSessionId: null }),
            setExecution: (currentExecution) => set({ currentExecution }),
            updateExecution: (updates) =>
                set((state) => ({
                    currentExecution: state.currentExecution
                        ? { ...state.currentExecution, ...updates }
                        : null,
                })),
            setProcessing: (isProcessing) => set({ isProcessing }),
            setMessages: (messages) => set({ messages }),
            setCurrentServer: (serverId, serverName) => set({ currentServerId: serverId, currentServerName: serverName }),
            loadSessions: async () => {
                set({ sessionsLoading: true });
                try {
                    const response = await chatSessionsApi.getAll();
                    set({ sessions: response.data, sessionsLoading: false });
                } catch (error) {
                    console.error('Failed to load chat sessions:', error);
                    set({ sessionsLoading: false });
                }
            },
            loadSession: async (id: string) => {
                try {
                    const response = await chatSessionsApi.getOne(id);
                    if (response.data) {
                        const messages = response.data.messages as Message[];
                        set({
                            messages,
                            currentSessionId: id,
                            currentExecution: null,
                        });
                    }
                } catch (error) {
                    console.error('Failed to load chat session:', error);
                }
            },
            saveCurrentSession: async (serverId: string, serverName: string) => {
                const { messages, currentSessionId } = get();
                if (messages.length === 0) return;

                try {
                    if (currentSessionId) {
                        // Update existing session
                        await chatSessionsApi.update(currentSessionId, { messages });
                    } else {
                        // Create new session
                        const response = await chatSessionsApi.create({
                            messages,
                            serverId,
                            serverName,
                        });
                        set({ currentSessionId: response.data.id });
                    }
                    // Refresh sessions list
                    get().loadSessions();
                } catch (error) {
                    console.error('Failed to save chat session:', error);
                }
            },
            deleteSession: async (id: string) => {
                try {
                    await chatSessionsApi.delete(id);
                    set((state) => ({
                        sessions: state.sessions.filter(s => s.id !== id),
                        // Clear messages if deleting current session
                        ...(state.currentSessionId === id ? { messages: [], currentSessionId: null } : {}),
                    }));
                } catch (error) {
                    console.error('Failed to delete chat session:', error);
                }
            },
            startNewSession: () => {
                set({
                    messages: [],
                    currentSessionId: null,
                    currentExecution: null,
                });
            },
        }),
        {
            name: 'chat-storage',
            partialize: (state) => ({
                messages: state.messages,
                currentSessionId: state.currentSessionId,
                currentServerId: state.currentServerId,
                currentServerName: state.currentServerName,
            }),
        }
    )
);

