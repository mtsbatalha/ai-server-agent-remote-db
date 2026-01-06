'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Terminal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { login } = useAuthStore();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast({
                title: 'Erro',
                description: 'As senhas não coincidem',
                variant: 'destructive',
            });
            return;
        }

        if (password.length < 8) {
            toast({
                title: 'Erro',
                description: 'A senha deve ter pelo menos 8 caracteres',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);

        try {
            const response = await authApi.register(email, password, name);
            const { accessToken, user } = response.data;

            login(accessToken, user);

            toast({
                title: 'Conta criada!',
                description: `Bem-vindo, ${user.name}! Sua conta foi criada com sucesso.`,
                variant: 'success',
            });

            router.push('/dashboard');
        } catch (error: any) {
            toast({
                title: 'Erro no cadastro',
                description: error.response?.data?.message || 'Não foi possível criar a conta',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-md">
                <div className="bg-card rounded-lg border border-border p-8">
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <Terminal className="h-8 w-8 text-primary" />
                        <span className="text-2xl font-bold gradient-text">AI Server Admin</span>
                    </div>

                    <h1 className="text-2xl font-bold text-center mb-6">Criar Conta</h1>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Seu nome"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Criando conta...
                                </>
                            ) : (
                                'Criar Conta'
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground mt-6">
                        Já tem uma conta?{' '}
                        <Link href="/login" className="text-primary hover:underline">
                            Fazer login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
