/**
 * Rodado como subprocesso com TZ=<fuso> por escala-matriz.test.mjs.
 * Para cada hora de vários dias (inclui dias de troca de horário de verão no
 * hemisfério norte e sul), confere que o domínio usa o DIA CIVIL LOCAL:
 *   - hojeISO(agora) = data local do relógio;
 *   - resumoEscala(agora) = calcEscalaISO(dia local);
 *   - calcCertStatus conta a partir do dia local.
 * Imprime { checados, erros } em JSON na última linha.
 */
import { register } from 'node:module';

register('./_ts-resolver.mjs', import.meta.url);
const D = await import('../../../packages/ow-domain/src/index.ts');

const p2 = n => String(n).padStart(2, '0');
const cfg = { tipo: '14x14', dataRef: '2026-10-12', tipoRef: 'embarquei' };
const erros = [];
let checados = 0;

// Dias de teste: entorno do dia 12, virada de ano, e trocas de DST
// (EUA 2026-03-08/11-01, UK 2026-03-29/10-25, NZ 2026-04-05/09-27).
const dias = ['2026-10-11', '2026-10-12', '2026-12-31', '2027-01-01', '2026-03-08', '2026-11-01',
  '2026-03-29', '2026-10-25', '2026-04-05', '2026-09-27', '2028-02-29'];

for (const dia of dias) {
  const [y, m, d] = dia.split('-').map(Number);
  for (let h = 0; h < 24; h++) {
    for (const min of [0, 59]) {
      const agora = new Date(y, m - 1, d, h, min, 0);
      const local = `${agora.getFullYear()}-${p2(agora.getMonth() + 1)}-${p2(agora.getDate())}`;
      if (D.hojeISO(agora) !== local) erros.push(`hojeISO ${dia} ${h}:${min} → ${D.hojeISO(agora)}`);
      const r = D.resumoEscala(cfg, agora);
      const c = D.calcEscalaISO(cfg, local);
      if (r.calc.diaDoBloco !== c.diaDoBloco || r.calc.embarcado !== c.embarcado) {
        erros.push(`resumo ${dia} ${h}:${min} difere do dia civil ${local}`);
      }
      const cert = D.calcCertStatus({ id: 'c', nome: 'x', validade: local }, agora);
      if (cert.dias !== 0) erros.push(`cert ${dia} ${h}:${min} dias=${cert.dias}`);
      checados++;
    }
  }
}

// Calendário: os mesmos dias do mês em qualquer fuso (o resultado não pode
// depender do fuso — compara com valores fixos calculados em ISO puro).
const out = D.gerarMesDias(cfg, [], [], 2026, 10, '2026-10-01');
const verdes = out.filter(x => x.kind === 'EMBARCADO').map(x => Number(x.iso.slice(8)));
const esperado = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
if (JSON.stringify(verdes) !== JSON.stringify(esperado)) erros.push(`calendário out/2026: ${verdes}`);
const janelas = D.encontrarJanelasJuntos(cfg, { tipo: '14x14', dataRef: '2026-10-19', tipoRef: 'embarquei' }, '2026-10-12', 60, 3);
if (janelas[0]?.inicio !== '2026-11-02') erros.push(`cruzar inicio=${janelas[0]?.inicio}`);

console.log(JSON.stringify({ checados, erros }));
