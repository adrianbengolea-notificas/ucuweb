import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isFirebaseConfigured() {
  const hasClientConfig = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  );
  const hasAdminConfig = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PRIVATE_KEY)
  );
  return hasClientConfig || hasAdminConfig;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasLikelyEmailTypo(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) return true;
  if (/\.(com|net|org)[a-z]{1,4}$/.test(domain) && !domain.endsWith('.com.ar')) return true;
  if (domain.endsWith('.con') || domain.endsWith('.cmo') || domain.endsWith('.comm')) return true;
  return false;
}

export function isPlausibleEmail(value: string): boolean {
  const email = value.trim();
  if (!EMAIL_RE.test(email) || email.includes('..') || email.length > 254) return false;
  if (hasLikelyEmailTypo(email)) return false;
  return true;
}
