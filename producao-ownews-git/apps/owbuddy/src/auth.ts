/**
 * Conta OW (Supabase Auth, mesmo projeto do OWNews web). OPCIONAL.
 *
 * Fluxos — iguais aos de ownews.com.br/meu-ownews:
 *   entrar        → e-mail + senha
 *   criar conta   → e-mail + senha; a confirmação chega por e-mail e abre na web
 *   esqueci senha → link de recuperação por e-mail; a nova senha é definida na web
 * Não há link mágico: o app não tem rota de callback e o redirect não é garantido.
 *
 * Mensagens de erro sempre em português natural — nunca o texto cru do servidor.
 * Falha de login/rede NUNCA toca nos dados locais.
 */
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

/** Traduz erro do GoTrue/rede para uma frase curta para o usuário. */
export function mensagemErroConta(err: { message?: string; status?: number; code?: string } | null | undefined): string {
  const msg = (err?.message ?? '').toLowerCase();
  const code = (err?.code ?? '').toLowerCase();
  if (!err) return 'Não foi possível completar. Tente novamente.';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || err.status === 0) {
    return 'Sem conexão. Seus dados continuam salvos neste aparelho; tente de novo quando tiver internet.';
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'Este e-mail já tem conta. Use Entrar ou Esqueci minha senha.';
  if (code === 'weak_password' || msg.includes('password should')) return 'Senha fraca: use pelo menos 6 caracteres.';
  if (code === 'over_email_send_rate_limit' || err.status === 429 || msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (msg.includes('jwt') || msg.includes('session') || err.status === 401) return 'Sua sessão expirou. Entre de novo na Conta OW.';
  return 'Não foi possível completar. Tente novamente.';
}

export async function getSession(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

export async function getUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

export async function signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? mensagemErroConta(error) : null };
  } catch (e) {
    return { error: mensagemErroConta({ message: e instanceof Error ? e.message : 'network' }) };
  }
}

/** Cria conta (mesmo /signup da web). `precisaConfirmar` = e-mail de confirmação enviado. */
export async function signUp(email: string, password: string): Promise<{ error: string | null; precisaConfirmar: boolean }> {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: mensagemErroConta(error), precisaConfirmar: false };
    return { error: null, precisaConfirmar: !data.session };
  } catch (e) {
    return { error: mensagemErroConta({ message: e instanceof Error ? e.message : 'network' }), precisaConfirmar: false };
  }
}

/** Recuperação de senha (mesmo /recover da web — a troca de senha acontece no site). */
export async function recuperarSenha(email: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error ? mensagemErroConta(error) : null };
  } catch (e) {
    return { error: mensagemErroConta({ message: e instanceof Error ? e.message : 'network' }) };
  }
}

/** Sai da conta. Dados deste aparelho ficam (a conta é só sincronização). */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {}
}

export async function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return data.subscription;
}

// Sync: lê/escreve user_metadata (ver sync.ts para o que sincroniza e o que nunca sai).
export async function getUserMetadata(): Promise<Record<string, unknown> | null> {
  const user = await getUser();
  if (!user) return null;
  return (user.user_metadata as Record<string, unknown>) ?? null;
}

export async function updateUserMetadata(
  patch: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ data: patch });
  return { error: error ? mensagemErroConta(error) : null };
}
