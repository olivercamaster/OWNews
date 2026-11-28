# Validação frontend — concluída sem deploy

Data UTC: 2026-09-13T14:29:36.886293+00:00

- Sintaxe dos dois Workers e da suíte: válida.
- 43 rotas com HTTP 200, incluindo detalhes de salários/funções e notícia.
- HTML de produção e preview equivalente, exceto rótulos conhecidos de preview.
- Scripts inline das rotas com sintaxe válida; zero erros JavaScript no navegador.
- 387 medições em 320, 360, 375, 390, 412, 430, 768, 1024 e 1440 px.
- Zero overflow horizontal do documento/corpo. O teste rejeita overflow-x
  hidden/clip nesses dois elementos. Trilhos internos mantêm rolagem intencional.
- Menu mobile, links oficiais Instagram em nova aba, ticker de 34 px/s com
  1, 3 e 12 manchetes, movimento reduzido e texto longo: passaram.
- Maricá sem observação confirmada: sem dados; dado confirmado: exibido;
  falha após resposta válida: limpa meteorologia antiga. Offshore Agora também
  trata falha de consulta sem inventar condição.
- Pesquisa em preparação: botão desabilitado, tentativa de submit sem POST,
  mensagem explícita de que nenhuma resposta foi enviada. Zero POSTs.
- Manifesto 200; rotas inexistentes/notícia sem id com 404, conforme esperado.
- Testes com Chromium e 11 recursos tipográficos locais do site. Serviços
  externos interceptados; nenhum acesso real ao Supabase ou collector.
- Inspeção visual da captura de 390 px realizada. Safari nativo/aparelhos físicos
  não foram validados nesta suíte.

## Escopo preservado

Comparação SHA-256 com o snapshot inicial
`cloudflare-live-snapshot/pre-frontend-codex-2026-09-13T135546Z/` confirmou todos
os wrangler.jsonc, arquivos da raiz, collector e demais arquivos fora do escopo
intactos. Hero, inteligência de imagens e renderizadores editoriais foram
comparados byte a byte com o snapshot e preservados.

O SQL executável do schema permanece igual; somente comentários foram revisados.
Nenhuma migration foi executada. Nenhum deploy, alteração DNS/Cloudflare,
Routes, Supabase, cron, secret ou cache foi realizado nesta retomada.

Snapshot adicional antes da revisão final da suíte:
`cloudflare-live-snapshot/pre-frontend-final-validation-2026-09-13T142719Z/`.

Detalhes das medições: `/tmp/ownews-frontend-tests/results.json`.
Capturas: `/tmp/ownews-frontend-tests/home-390.png` e
`/tmp/ownews-frontend-tests/home-390-viewport.png`.
Pendências de infraestrutura e coleta: `PENDENCIAS.md`.

## Hashes validados

- `home-redesign/index.html`: `4169dfb639cf0180a88fe06c17bb56fcd27474edb54e77523c3b51e61eb340a1`
- `home-redesign/worker.js`: `b3d4f8e322479099c5c58deb53ebabd6f23282ea489521ab11ff1f5af486cec9`
- `producao-ownews-git/worker.js`: `4ac152ab4ababf035a342928128a3a193c03bc519bdb6dc00a913a71c62b679c`
- `supabase-pesquisa-salarial/schema.sql`: `b1397105d363093fc37f2c530fc991615e355ebaac3b5f6202c8a50670d352b4`
- `frontend-tools/validate.mjs`: `0473489793f3568537a68b79b5fbcede6e0988d493a2def2ac6d2225874deb3b`
