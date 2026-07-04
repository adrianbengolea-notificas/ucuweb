import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'UCU — Usuarios y Consumidores Unidos',
  description: 'La red de defensa más grande del país',
};

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
