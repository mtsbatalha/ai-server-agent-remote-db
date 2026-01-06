'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Terminal, Server, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HomePage() {
    const router = useRouter();
    const { isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, router]);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-8 w-8 text-primary" />
                        <span className="text-xl font-bold gradient-text">AI Server Admin</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/login">
                            <Button variant="ghost">Login</Button>
                        </Link>
                        <Link href="/register">
                            <Button>Começar</Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <main className="container mx-auto px-4 py-20">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        Administre seus servidores com{' '}
                        <span className="gradient-text">Inteligência Artificial</span>
                    </h1>
                    <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                        Execute tarefas administrativas complexas usando linguagem natural.
                        A IA entende, planeja, valida e executa comandos com segurança.
                    </p>
                    <div className="flex items-center justify-center gap-4">
                        <Link href="/register">
                            <Button size="lg" className="glow">
                                Começar Gratuitamente
                            </Button>
                        </Link>
                        <Link href="/login">
                            <Button size="lg" variant="outline">
                                Fazer Login
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Features */}
                <div className="grid md:grid-cols-3 gap-8 mt-20">
                    <div className="bg-card rounded-lg p-6 card-hover">
                        <Server className="h-12 w-12 text-primary mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Gerenciamento Fácil</h3>
                        <p className="text-muted-foreground">
                            Conecte seus servidores via SSH e gerencie todos de um único painel.
                        </p>
                    </div>
                    <div className="bg-card rounded-lg p-6 card-hover">
                        <Zap className="h-12 w-12 text-yellow-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">IA Multi-Agent</h3>
                        <p className="text-muted-foreground">
                            Agentes especializados planejam, validam e executam suas tarefas automaticamente.
                        </p>
                    </div>
                    <div className="bg-card rounded-lg p-6 card-hover">
                        <Shield className="h-12 w-12 text-green-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Segurança Total</h3>
                        <p className="text-muted-foreground">
                            Validação de comandos, auditoria completa e criptografia de credenciais.
                        </p>
                    </div>
                </div>

                {/* Demo Terminal */}
                <div className="mt-20 max-w-3xl mx-auto">
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <div className="bg-secondary px-4 py-2 flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="ml-2 text-sm text-muted-foreground">Terminal</span>
                        </div>
                        <div className="p-4 font-mono text-sm">
                            <p className="text-muted-foreground">$ ai-admin</p>
                            <p className="text-terminal-green mt-2">🤖 Olá! O que você gostaria de fazer?</p>
                            <p className="mt-2 text-primary">
                                &gt; Instale o Nginx, configure SSL com Let&apos;s Encrypt e abra a porta 443
                            </p>
                            <p className="text-terminal-green mt-2">
                                ✅ Plano criado! 4 comandos serão executados...
                            </p>
                            <p className="text-muted-foreground mt-1">
                                <span className="text-terminal-blue">1.</span> apt update && apt install -y nginx
                            </p>
                            <p className="text-muted-foreground">
                                <span className="text-terminal-blue">2.</span> apt install -y certbot python3-certbot-nginx
                            </p>
                            <p className="text-muted-foreground">
                                <span className="text-terminal-blue">3.</span> certbot --nginx -d example.com
                            </p>
                            <p className="text-muted-foreground">
                                <span className="text-terminal-blue">4.</span> ufw allow 443/tcp
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
