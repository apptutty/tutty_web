import path from 'node:path';
import dotenv from 'dotenv';

// Loads web/e2e/.env (gitignored). Falls back to already-set process.env
// values so CI can inject secrets without a physical .env file.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[e2e] Missing required env var "${name}". Copy web/e2e/.env.example to web/e2e/.env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:4210',
  supabaseUrl: process.env.E2E_SUPABASE_URL || 'https://sjfyrhqdypwnauetvpju.supabase.co',
  supabaseAnonKey:
    process.env.E2E_SUPABASE_ANON_KEY || 'sb_publishable_OCV30cI72vPeh8s1_by4og_W9KeOjzB',
};

export interface QaCredentials {
  email: string;
  password: string;
}

/** Reads a required QA account (throws with a clear message if missing). */
export function qaAccount(prefix: string): QaCredentials {
  return {
    email: required(`${prefix}_EMAIL`),
    password: required(`${prefix}_PASSWORD`),
  };
}

/** Reads an optional QA account. Returns null if not configured (tests should skip, not fail). */
export function qaAccountOptional(prefix: string): QaCredentials | null {
  const email = optional(`${prefix}_EMAIL`);
  const password = optional(`${prefix}_PASSWORD`);
  if (!email || !password) return null;
  return { email, password };
}

export const qaAccounts = {
  superAdmin: () => qaAccount('QA_SUPER_ADMIN'),
  storeAdmin: () => qaAccount('QA_STORE_ADMIN'),
};
