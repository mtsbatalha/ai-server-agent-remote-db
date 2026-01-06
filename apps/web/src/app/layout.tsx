import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'AI Server Admin',
    description: 'Plataforma de administração de servidores Linux com IA',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR" className="dark">
            <body className={inter.className}>
                {children}
                <Toaster />
            </body>
        </html>
    );
}
