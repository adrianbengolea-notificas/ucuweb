import type { Metadata } from 'next';
import { Archivo, Literata } from 'next/font/google';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const literata = Literata({
  subsets: ['latin'],
  variable: '--font-literata',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'UCU — Usuarios y Consumidores Unidos',
  description: 'La red de defensa más grande del país',
  icons: {
    icon: '/brand/favicon.png',
    apple: '/brand/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${archivo.variable} ${literata.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">{children}</body>
    </html>
  );
}
