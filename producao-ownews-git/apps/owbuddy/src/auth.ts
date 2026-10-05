import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signInWithEmail(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: 'owbuddy://auth/callback',
    },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return data.subscription;
}

// Sync: read user_metadata fields we care about (escala, certs, checklist, buddy prefs).
// Sensitive fields (localizador, obs, assento) are NEVER synced.
export async function getUserMetadata(): Promise<Record<string, unknown> | null> {
  const user = await getUser();
  if (!user) return null;
  return (user.user_metadata as Record<string, unknown>) ?? null;
}

export async function updateUserMetadata(
  patch: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ data: patch });
  return { error: error?.message ?? null };
}
