// Ambiente simulado do worker: KV lendo um diretório de snapshot (saida/*.json) e Cache API em memória.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export function ambiente(dirSaida, { segredo = 'x'.repeat(32) } = {}) {
  const gravados = new Map();
  const RADAR_KV = {
    async get(chave, tipo) {
      if (gravados.has(chave)) return tipo === 'json' ? JSON.parse(gravados.get(chave)) : gravados.get(chave);
      if (!dirSaida) return null;
      const f = join(dirSaida, `${chave.replace(/:/g, '_')}.json`);
      if (!existsSync(f)) return null;
      const t = readFileSync(f, 'utf8');
      return tipo === 'json' ? JSON.parse(t) : t;
    },
    async put(chave, valor) { gravados.set(chave, valor); },
  };
  const cache = new Map();
  globalThis.caches = { default: { async match(r) { return cache.get(r.url)?.clone() || null; }, async put(r, resp) { cache.set(r.url, resp); } } };
  return { env: { RADAR_KV, RADAR_INGEST_SECRET: segredo }, gravados, ctx: { waitUntil() {} } };
}
