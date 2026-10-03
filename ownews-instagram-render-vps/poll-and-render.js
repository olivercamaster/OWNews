#!/usr/bin/env node
/* =========================================================================
   OWNews — poller de renderização Instagram (VPS)
   =========================================================================
   Rodado via cron (a cada minuto, com flock -n pra nunca sobrepor execuções
   — ver crontab do usuário offshore, install via `crontab -l`). NUNCA abre
   porta nenhuma: só faz chamadas de SAÍDA pro Worker (que já é público em
   workers.dev). Uma execução = no máximo um job processado, depois sai.
   Idempotente: se o Worker já marcou o job como concluído/outro id, o POST
   de conclusão é recusado com segurança (404) e este script só loga e sai.

   Higiene (ETAPA 23 da missão de acabamento):
   - timeout duro no processo inteiro (WATCHDOG_MS) — nunca fica pendurado
     segurando o lock além de 1 minuto, mesmo se Meta/VPS travarem;
   - timeout por chamada de rede (AbortSignal.timeout);
   - log com rotação simples (nunca cresce sem limite);
   - roda como usuário offshore (nunca root — cron do usuário, não do sistema);
   - não spawna processos além de curl pontual dentro de render.js (sem
     Chromium, sem processos que fiquem pendurados).
   ========================================================================= */
const { renderizarJob } = require('./render.js');
const fs = require('fs');
const path = require('path');

const WORKER_BASE = 'https://ownews-instagram-publisher.olivercamaster.workers.dev';
const SECRET_PATH = '/home/offshore/.config/ownews/render-shared-secret';
const LOG_PATH = path.join(__dirname, 'poll.log');
const MAX_LINHAS_LOG = 500;
const WATCHDOG_MS = 50000; // menor que o intervalo de 1 min do cron

function log(msg) {
  const linha = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_PATH, linha);
  rotacionarLogSeNecessario();
}

function rotacionarLogSeNecessario() {
  try {
    const conteudo = fs.readFileSync(LOG_PATH, 'utf8');
    const linhas = conteudo.split('\n');
    if (linhas.length > MAX_LINHAS_LOG * 1.5) {
      fs.writeFileSync(LOG_PATH, linhas.slice(-MAX_LINHAS_LOG).join('\n'));
    }
  } catch { /* rotação nunca pode derrubar o poller */ }
}

async function main() {
  const secret = fs.readFileSync(SECRET_PATH, 'utf8').trim();

  const respPending = await fetch(`${WORKER_BASE}/render-jobs/pending`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(10000),
  });

  if (respPending.status === 204) return; // nada pendente — normal na maioria dos ciclos
  if (respPending.status === 401) { log('ERRO: 401 do Worker — segredo compartilhado desatualizado?'); return; }
  if (!respPending.ok) { log(`ERRO: /render-jobs/pending respondeu HTTP ${respPending.status}`); return; }

  const job = await respPending.json();
  log(`job recebido: id=${job.id} tipo=${job.tipo} template=${job.arte && job.arte.template}`);

  let jpegBuffer;
  try {
    jpegBuffer = await renderizarJob(job.arte);
  } catch (erro) {
    const isGuard = erro.message && erro.message.startsWith('VISUAL_GUARD_REJECTED');
    log(`${isGuard ? 'VISUAL_GUARD_REJECTED' : 'ERRO'} ao renderizar job ${job.id}: ${erro.message}`);
    // Avisa o Worker com endpoint específico — evita job preso em "in_progress".
    const endpoint = isGuard
      ? `${WORKER_BASE}/render-jobs/${job.id}/guard-fail`
      : `${WORKER_BASE}/render-jobs/${job.id}/complete`;
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': isGuard ? 'application/json' : 'image/jpeg',
        },
        body: isGuard ? JSON.stringify({ motivo: erro.message }) : Buffer.alloc(0),
        signal: AbortSignal.timeout(10000),
      });
    } catch { /* melhor esforço — job expira em 1h (KV TTL) */ }
    return;
  }

  const respComplete = await fetch(`${WORKER_BASE}/render-jobs/${job.id}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'image/jpeg' },
    body: jpegBuffer,
    signal: AbortSignal.timeout(20000), // inclui o tempo de espera do container na Graph API
  });
  const resultado = await respComplete.json().catch(() => ({ ok: false, erro: `HTTP ${respComplete.status} sem corpo JSON` }));
  log(`job ${job.id} finalizado: ${JSON.stringify(resultado)}`);
}

const watchdog = setTimeout(() => {
  log('WATCHDOG: execução excedeu 50s — encerrando processo à força (nunca deve segurar o lock além do próximo ciclo do cron)');
  process.exit(1);
}, WATCHDOG_MS);
watchdog.unref?.();

main()
  .catch((erro) => log(`ERRO NÃO TRATADO: ${erro.stack || erro.message}`))
  .finally(() => clearTimeout(watchdog));
