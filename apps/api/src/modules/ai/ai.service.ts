import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    AIProvider,
    AIMessage,
    AICompletionOptions,
    AIProviderType,
} from './providers/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OllamaProvider } from './providers/ollama.provider';

export interface AIPlanResult {
    objective: string;
    steps: string[];
    risks: string[];
    estimatedTime: string;
    requiresConfirmation: boolean;
}

export interface AICommandsResult {
    commands: string[];
    explanation: string;
    warnings: string[];
}

export interface AISecurityResult {
    isApproved: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    issues: string[];
    recommendations: string[];
}

export interface AIResultAnalysis {
    success: boolean;
    summary: string;
    details: string;
    nextSteps: string[];
    errors: string[];
}

/**
 * AI Service with Multi-Provider Support
 * 
 * Supports the following providers:
 * - OpenAI (GPT-4o, GPT-4o-mini) - Paid
 * - Google Gemini (gemini-1.5-flash) - FREE TIER!
 * - Groq (Llama 3.3 70B, Mixtral) - FREE TIER!
 * - Ollama (Local models) - 100% FREE!
 * 
 * Priority order (uses first configured):
 * 1. OpenAI (if OPENAI_API_KEY is set)
 * 2. Gemini (if GEMINI_API_KEY is set)
 * 3. Groq (if GROQ_API_KEY is set)
 * 4. Ollama (always available if running)
 * 
 * Or set AI_PROVIDER environment variable to force a specific provider.
 */
@Injectable()
export class AiService implements OnModuleInit {
    private readonly logger = new Logger(AiService.name);
    private providers: Map<AIProviderType, AIProvider> = new Map();
    private activeProvider: AIProvider | null = null;
    private activeProviderType: AIProviderType | null = null;

    constructor(
        private configService: ConfigService,
        private openaiProvider: OpenAIProvider,
        private geminiProvider: GeminiProvider,
        private groqProvider: GroqProvider,
        private ollamaProvider: OllamaProvider,
    ) { }

    async onModuleInit() {
        // Register all providers
        if (this.openaiProvider.isConfigured()) {
            this.providers.set('openai', this.openaiProvider);
        }
        if (this.geminiProvider.isConfigured()) {
            this.providers.set('gemini', this.geminiProvider);
        }
        if (this.groqProvider.isConfigured()) {
            this.providers.set('groq', this.groqProvider);
        }
        // Ollama is always registered (local)
        this.providers.set('ollama', this.ollamaProvider);

        // Select active provider
        const forcedProvider = this.configService.get<AIProviderType>('AI_PROVIDER');

        if (forcedProvider && this.providers.has(forcedProvider)) {
            this.activeProvider = this.providers.get(forcedProvider)!;
            this.activeProviderType = forcedProvider;
        } else {
            // Auto-select first available provider (priority order)
            const priorityOrder: AIProviderType[] = ['openai', 'gemini', 'groq', 'ollama'];

            for (const type of priorityOrder) {
                const provider = this.providers.get(type);
                if (provider) {
                    // For Ollama, check if it's actually running
                    if (type === 'ollama') {
                        const isRunning = await this.ollamaProvider.checkConnection();
                        if (!isRunning) continue;
                    }

                    this.activeProvider = provider;
                    this.activeProviderType = type;
                    break;
                }
            }
        }

        if (this.activeProvider) {
            this.logger.log(`✅ Active AI provider: ${this.activeProvider.name}`);
        } else {
            this.logger.warn('⚠️ No AI provider configured! Set one of: OPENAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, or run Ollama');
        }

        // Log available providers
        const availableProviders = Array.from(this.providers.keys());
        this.logger.log(`📋 Available providers: ${availableProviders.join(', ')}`);
    }

    getActiveProvider(): { type: AIProviderType | null; name: string | null } {
        return {
            type: this.activeProviderType,
            name: this.activeProvider?.name || null,
        };
    }

    getAvailableProviders(): AIProviderType[] {
        return Array.from(this.providers.keys());
    }

    async setProvider(type: AIProviderType): Promise<void> {
        const provider = this.providers.get(type);
        if (!provider) {
            throw new Error(`Provider ${type} not available`);
        }
        this.activeProvider = provider;
        this.activeProviderType = type;
        this.logger.log(`Switched to provider: ${provider.name}`);
    }

    private async complete(
        messages: AIMessage[],
        options?: AICompletionOptions,
    ): Promise<string> {
        if (!this.activeProvider) {
            throw new Error(
                'No AI provider configured. Set GEMINI_API_KEY (free), GROQ_API_KEY (free), or OPENAI_API_KEY, or run Ollama locally.'
            );
        }

        return this.activeProvider.generateCompletion(messages, options);
    }

    /**
     * PLANNER AGENT - Creates execution plan from user prompt
     */
    async createPlan(prompt: string, serverInfo: string): Promise<AIPlanResult> {
        const systemPrompt = `Você é um planejador de tarefas Linux sênior.
Analise a solicitação do usuário e crie um plano detalhado de execução.

Informações do servidor:
${serverInfo}

Responda APENAS em JSON válido com este formato:
{
  "objective": "Descrição clara do objetivo",
  "steps": ["Passo 1", "Passo 2", ...],
  "risks": ["Risco 1", "Risco 2", ...],
  "estimatedTime": "Tempo estimado",
  "requiresConfirmation": true/false
}

Regras:
- Seja específico e detalhado nos passos
- Identifique todos os riscos potenciais
- Marque como requiresConfirmation: true se houver operações destrutivas`;

        try {
            const content = await this.complete(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt },
                ],
                { temperature: 0.3, jsonMode: true },
            );

            return this.parseJSON<AIPlanResult>(content, 'Planner');
        } catch (error) {
            this.logger.error(`Planner Agent error: ${error.message}`);
            throw error;
        }
    }

    /**
     * COMMAND AGENT - Generates shell commands from plan
     */
    async generateCommands(
        prompt: string,
        plan: AIPlanResult,
        distro: string = 'Debian/Ubuntu',
    ): Promise<AICommandsResult> {
        const systemPrompt = `Você é um administrador Linux sênior especialista em ${distro}.
Gere comandos shell seguros para executar o plano fornecido.

CONTEXTO IMPORTANTE:
- Os comandos serão executados DIRETAMENTE no servidor remoto via SSH
- Você já está conectado ao servidor, NÃO use ssh, scp, rsync ou qualquer comando de conexão remota
- Execute os comandos como se estivesse no terminal do servidor

REGRAS CRÍTICAS:
- NUNCA use ssh, scp, rsync ou comandos de conexão remota (você já está no servidor!)
- NUNCA use comandos destrutivos (rm -rf /, mkfs, dd, etc)
- Use sudo APENAS quando absolutamente necessário
- Prefira comandos não-interativos (use -y para apt, etc)
- Adicione comentários explicativos quando necessário
- Separe comandos complexos em passos simples

Responda APENAS em JSON válido:
{
  "commands": ["comando1", "comando2", ...],
  "explanation": "Explicação do que cada comando faz",
  "warnings": ["Aviso 1", "Aviso 2", ...]
}`;

        const userPrompt = `Prompt original: ${prompt}

Plano de execução:
- Objetivo: ${plan.objective}
- Passos: ${plan.steps.join(', ')}

Gere os comandos shell necessários.`;

        try {
            const content = await this.complete(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                { temperature: 0.2, jsonMode: true },
            );

            return this.parseJSON<AICommandsResult>(content, 'Command');
        } catch (error) {
            this.logger.error(`Command Agent error: ${error.message}`);
            throw error;
        }
    }

    /**
     * SECURITY AGENT - Validates commands for security risks
     */
    async validateSecurity(commands: string[]): Promise<AISecurityResult> {
        const systemPrompt = `Você é um especialista em segurança Linux.
Analise os comandos fornecidos e identifique riscos de segurança.

COMANDOS PROIBIDOS (sempre rejeitar):
- rm -rf / ou rm -rf /*
- mkfs em qualquer dispositivo
- dd com if=/dev/zero
- Fork bombs
- Alterações em /etc/passwd ou /etc/shadow
- Download e execução de scripts remotos (curl | sh)

Responda APENAS em JSON válido:
{
  "isApproved": true/false,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "issues": ["Problema 1", "Problema 2", ...],
  "recommendations": ["Recomendação 1", ...]
}`;

        try {
            const content = await this.complete(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Analise estes comandos:\n${commands.join('\n')}` },
                ],
                { temperature: 0.1, jsonMode: true },
            );

            return this.parseJSON<AISecurityResult>(content, 'Security');
        } catch (error) {
            this.logger.error(`Security Agent error: ${error.message}`);
            throw error;
        }
    }

    /**
     * RESULT AGENT - Analyzes command execution output
     */
    async analyzeResult(
        prompt: string,
        commands: string[],
        output: string,
        exitCodes: (number | null)[],
    ): Promise<AIResultAnalysis> {
        const systemPrompt = `Você é um analista de sistemas Linux sênior.
Interprete a saída dos comandos executados e forneça um relatório.

Responda APENAS em JSON válido:
{
  "success": true/false,
  "summary": "Resumo do resultado",
  "details": "Detalhes da execução",
  "nextSteps": ["Próximo passo 1", ...],
  "errors": ["Erro 1", ...]
}`;

        const userPrompt = `Prompt original: ${prompt}

Comandos executados:
${commands.map((cmd, i) => `${cmd} (exit code: ${exitCodes[i]})`).join('\n')}

Saída:
${output}

Analise o resultado e forneça um relatório.`;

        try {
            const content = await this.complete(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                { temperature: 0.3, jsonMode: true },
            );

            return this.parseJSON<AIResultAnalysis>(content, 'Result');
        } catch (error) {
            this.logger.error(`Result Agent error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Quick chat response for simple queries
     */
    async chat(message: string, context?: string): Promise<string> {
        const systemPrompt = `Você é um assistente de administração Linux sênior.
Responda de forma clara e concisa.
${context ? `\nContexto:\n${context}` : ''}`;

        try {
            return await this.complete(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message },
                ],
                { temperature: 0.5 },
            );
        } catch (error) {
            this.logger.error(`Chat error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Parse JSON response with fallback for non-JSON responses
     */
    private parseJSON<T>(content: string, agentName: string): T {
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as T;
            }
            throw new Error('No JSON found in response');
        } catch (error) {
            this.logger.warn(`${agentName} Agent: Failed to parse JSON, content: ${content.substring(0, 200)}`);
            throw new Error(`Failed to parse ${agentName} response as JSON`);
        }
    }
}
