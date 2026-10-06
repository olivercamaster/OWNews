/**
 * Regras PURAS de reconciliação entre o dispositivo e a conta OW (Supabase
 * `user_metadata`). Sem I/O: quem lê/grava é apps/owbuddy/src/sync.ts.
 *
 * Chaves que existem HOJE no user_metadata (lidas do worker.js do OWNews):
 *   escala_config   — formato plano do web + `salvo_em` (ISO)      ← fonte de verdade
 *   certificados    — [{ id, nome, validade, emissao, instituicao, obs, updated_at, _deleted }]
 *   cruzar_config, datas_pessoais_config, nome, sobrenome, funcao, consent_*
 *
 * Chaves legadas gravadas só pelo OWBuddy (<= Missão 007):
 *   ownews_minha_escala — { data: EscalaConfig, updated_at }
 *   ownews_certificados — Certificado[]
 *
 * Princípio: nunca apagar dado do outro lado; "mais recente vence" só quando
 * os dois lados carregam carimbo de tempo comparável. Sem carimbo → local vence.
 */
import type { Certificado, EscalaConfig } from './types';
import { normalizeEscalaConfig, toWebEscalaConfig } from './escala-codec';

export function carimboParaMs(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  return 0;
}

export type OrigemEscalaNuvem = 'web' | 'buddy';

export interface EscalaNuvem {
  cfg: EscalaConfig;
  /** ms do carimbo da nuvem (salvo_em / updated_at); 0 quando ausente */
  at: number;
  origem: OrigemEscalaNuvem;
}

/**
 * Escolhe a escala mais recente entre `escala_config` (web) e
 * `ownews_minha_escala` (Buddy legado). Empate → web (fonte de verdade).
 */
export function escolherEscalaDaNuvem(meta: Record<string, unknown> | null | undefined): EscalaNuvem | null {
  if (!meta) return null;
  const candidatos: EscalaNuvem[] = [];

  const web = meta.escala_config as Record<string, unknown> | undefined;
  const webCfg = normalizeEscalaConfig(web);
  if (webCfg) candidatos.push({ cfg: webCfg, at: carimboParaMs(web?.salvo_em), origem: 'web' });

  const buddy = meta.ownews_minha_escala as Record<string, unknown> | undefined;
  const buddyCfg = normalizeEscalaConfig(buddy);
  if (buddyCfg) candidatos.push({ cfg: buddyCfg, at: carimboParaMs(buddy?.updated_at), origem: 'buddy' });

  if (!candidatos.length) return null;
  return candidatos.reduce((a, b) => (b.at > a.at ? b : a));
}

/** ms → ISO datetime; 0/inválido → undefined (sem carimbo). */
export function carimboParaISO(ms: number): string | undefined {
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : undefined;
}

/**
 * A escala da nuvem deve SUBSTITUIR a cópia local?
 *
 *  - sem escala local            → sim (primeiro login)
 *  - local sem carimbo           → NÃO (princípio: sem carimbo comparável, local vence;
 *                                   uma escala configurada neste aparelho nunca é
 *                                   silenciosamente trocada por uma cópia antiga da conta)
 *  - ambos carimbados            → só se a nuvem for ESTRITAMENTE mais nova
 *
 * Regra pura — é ela (e não a tela) que decide quem é a fonte de verdade da
 * Minha Escala, Home, Meu Embarque e calendário após um sync.
 */
export function nuvemDeveSubstituirLocal(local: EscalaConfig | null | undefined, nuvem: EscalaNuvem | null | undefined): boolean {
  if (!nuvem) return false;
  if (!local) return true;
  const localAt = carimboParaMs(local.updated_at);
  if (localAt <= 0) return false;
  return nuvem.at > localAt;
}

/** Payload que o web lê em `user_metadata.escala_config`. */
export function escalaConfigParaNuvem(cfg: EscalaConfig, salvoEm: string = new Date().toISOString()): Record<string, unknown> {
  return { ...toWebEscalaConfig(cfg), salvo_em: salvoEm };
}

/**
 * É seguro sobrescrever `escala_config` na nuvem? Só quando o local é pelo
 * menos tão recente quanto o que está lá — nunca clobbar uma edição feita no web.
 */
export function podeGravarEscalaNaNuvem(local: EscalaConfig | null, nuvem: EscalaNuvem | null): boolean {
  if (!local) return false;
  if (!nuvem) return true;
  return carimboParaMs(local.updated_at) >= nuvem.at;
}

/**
 * Merge de certificados por id — mesma regra do web (carregarCerts):
 * mais recente `updated_at` vence; tombstones `_deleted` são preservados para
 * propagar a remoção. Sem carimbo nos dois → local vence.
 */
export function mesclarCertificados(local: Certificado[], ...nuvens: Array<unknown>): Certificado[] {
  const map = new Map<string, Certificado>();
  // Local entra primeiro; a nuvem só substitui com carimbo estritamente mais novo.
  const considerar = (c: unknown) => {
    if (!c || typeof c !== 'object') return;
    const cert = c as Certificado;
    if (!cert.id || typeof cert.nome !== 'string') return;
    const atual = map.get(cert.id);
    if (!atual || carimboParaMs(cert.updated_at) > carimboParaMs(atual.updated_at)) map.set(cert.id, cert);
  };
  for (const c of local) considerar(c);
  for (const nuvem of nuvens) {
    if (!Array.isArray(nuvem)) continue;
    for (const c of nuvem) considerar(c);
  }
  return Array.from(map.values());
}

/** Lista que o usuário vê: sem tombstones. */
export function certificadosVisiveis(certs: Certificado[]): Certificado[] {
  return certs.filter(c => !c._deleted);
}
