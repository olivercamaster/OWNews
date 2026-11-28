# Pendências — sem autorização de execução nesta etapa

## Infraestrutura www / HTTPS

Correção suspensa por instrução do usuário. Não alterar DNS, Cloudflare,
Workers Routes, configurações de cache ou certificados nesta etapa.

Plano já descrito: CNAME www -> ownews.com.br com proxy, mais uma Redirect Rule
301 que leve HTTP ou www diretamente a https://ownews.com.br, preservando
caminho e query. Manter o HTTPS do domínio principal atendido pelo ownews-git.
Nenhuma dessas alterações foi executada.

A tentativa autorizada de obter backup em 13/09/2026 às 14:25 UTC parou na
primeira consulta: HTTP 403, código 10000 (Authentication error). O backup de
infraestrutura não foi concluído. O registro está em
cloudflare-live-snapshot/pre-canonical-access-2026-09-13T142509Z/.
Antes de qualquer execução futura: autorização renovada, credencial válida,
backup completo das configurações e validação das quatro URLs.

O diagnóstico confirmou NXDOMAIN para www nos resolvedores Google e Cloudflare.
O erro de acesso ao domínio sem www no celular do usuário permanece sem causa
confirmada; não foi reproduzido nos perfis de navegador testados. Um deploy do
frontend não deve ser apresentado como correção dessa falha de conexão.

## Pesquisa Salarial

Coleta em preparação: botão desabilitado e lógica de POST removida. Sem
simulação de sucesso. Schema não executado; nenhuma alteração no Supabase.
Revisar supabase-pesquisa-salarial/REVISAO.md e implementar backend/validação,
controles de abuso, agregação e metodologia antes de autorizar a coleta.

## Dados aeroportuários

Totais de voos e transferidos não implementados. Dependem de fonte confiável
confirmada. Meteorologia sem observação confirmada permanece como sem dados.

## Publicação e versionamento

Deploy aguarda autorização explícita. Usar somente a configuração dedicada
producao-ownews-git/wrangler.jsonc. A raiz tem alterações preexistentes e não
deve ser usada para publicar. Parte importante do frontend permanece untracked;
não houve commit, exclusão de snapshots/caches ou limpeza dos arquivos do Claude.
