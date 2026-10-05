/**
 * Resolver hook para testes importarem o domínio TypeScript REAL
 * (packages/ow-domain/src) sem transpilar: o Node 22 faz type-stripping
 * nativo, mas exige extensão nos imports relativos — este hook completa
 * `./types` → `./types.ts`.
 */
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
    const candidate = new URL(specifier + '.ts', context.parentURL);
    try {
      await access(fileURLToPath(candidate));
      return next(candidate.href, context);
    } catch {
      // cai no resolver padrão
    }
  }
  return next(specifier, context);
}
