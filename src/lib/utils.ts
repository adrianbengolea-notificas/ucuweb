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
