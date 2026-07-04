import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type LogoProps = {
  variant?: 'color' | 'white';
  className?: string;
  href?: string;
  linked?: boolean;
  priority?: boolean;
};

export function Logo({
  variant = 'color',
  className,
  href = '/',
  linked = true,
  priority = false,
}: LogoProps) {
  const src = variant === 'white' ? '/brand/logo-ucu-white.png' : '/brand/logo-ucu.png';
  const img = (
    <Image
      src={src}
      alt="Usuarios y Consumidores Unidos"
      width={variant === 'white' ? 220 : 236}
      height={variant === 'white' ? 105 : 111}
      priority={priority}
      className={cn('h-auto w-[170px] sm:w-[200px]', className)}
    />
  );

  if (!linked) return img;
  return (
    <Link href={href} className="inline-flex shrink-0">
      {img}
    </Link>
  );
}

export function BrandStripe({ className }: { className?: string }) {
  return <div className={cn('ucu-brand-bar h-1.5 w-full', className)} aria-hidden />;
}
