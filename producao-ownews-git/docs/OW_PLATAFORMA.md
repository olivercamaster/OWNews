# OW Ecossistema — Uma plataforma, web + app

**Checkpoint de arquitetura — 2026-10-05.** Documento-mãe. Sonnet/Fable/humanos: ler antes de qualquer
alteração que toque Minha Escala, conta OW, APIs `/api/buddy/*`, aeroportos, vagas, notícias ou Command Center.

---

## 0. Regra-mãe

> **OWNews** (`worker.js`, Cloudflare Worker `ownews-git`) é a plataforma: web, conteúdo, backend e APIs.
> **OWBuddy** (`apps/owbuddy`, Expo/React Native) é o **app nativo da MESMA plataforma** — não é outro produto.
>
> Toda alteração relevante num lado deve ser avaliada no outro **antes** de ser considerada concluída.
> Não existe "só no app" nem "só no web" para dado compartilhado: existe *uma* fonte de verdade e *dois* clientes.

O que é **compartilhado por definição** (nunca duplicar): Supabase (`awyowuhwkqfyhwgdpepp`), banco, usuários e
Auth (GoTrue, `user_metadata` como perfil), pipeline de notícias (Editorial Engine → `articles`), vagas
(Radar de Vagas 2.0 → KV `vagas:cache`), aeroportos/OffVoos (collector `shrill-pond-a915` → `/aeroportos`),
meteorologia operacional (REDEMET no collector), regras da Minha Escala (`packages/ow-domain` ≡ motor canônico
do web), carreiras/funções, mercado, agenda, empresas.

O Buddy **continua nativo**: nada de WebView para "ganhar paridade". Paridade se ganha portando lógica para
`@owbuddy/domain` ou consumindo API do OWNews.

---

## 1. Arquitetura encontrada (auditoria sobre o código em 2026-10-05)

```
                 ┌──────────────────────────────────────────────────────────┐
                 │  Supabase awyowuhwkqfyhwgdpepp                           │
                 │  • auth.users + user_metadata (perfil, escala_config,    │
                 │    certificados, cruzar_config, datas_pessoais_config)   │
                 │  • public.articles (único uso via REST)                  │
                 └───────────────▲──────────────────────────▲───────────────┘
                                 │ REST anon / GoTrue       │ service role (só collector)
┌────────────────────────────────┴───────────┐  ┌───────────┴──────────────────────────────┐
│ ownews-git (worker.js, 1 arquivo, ~20.7k l) │  │ shrill-pond-a915 (collector, ~6.7k l HEAD) │
│ • HTML/SSR de todas as páginas              │  │ • Editorial Engine (cron) → articles        │
│ • Minha Escala web (motor canônico, LS)     │  │ • /aeroportos (REDEMET METAR + OffVoos DO)  │
│ • OW Hub (signup/login/perfil → GoTrue)     │  │ • /mercado, /saude, /revisao (interno)      │
│ • /api/buddy/feed, /api/buddy/vagas         │  │ • Telegram, Instagram render trigger        │
│ • Command Center + PageViews DO + Presença  │  └─────────────────────────────────────────────┘
│ • Web Push (VAPID), Radar Vagas 2.0 (KV)    │
└──────────────▲──────────────────────────────┘
               │ HTTPS (sem auth; CORS *)           Open-Meteo (direto do app)
┌──────────────┴──────────────────────────────┐
│ apps/owbuddy (Expo 57, Router v4)           │
│ • @owbuddy/domain (packages/ow-domain)      │
│ • AsyncStorage offline-first                │
│ • Feed/Vagas via /api/buddy/* (cache 5m/1h) │
│ • Supabase JS (OTP) — presente, NÃO usado   │
└─────────────────────────────────────────────┘
```

### Duplicações / divergências encontradas

| # | Onde | Problema | Decisão |
|---|------|----------|---------|
| D1 | `worker.js` `/api/buddy/vagas` | Serve `VAGAS_ABERTAS_ESPECIFICAS` (array **estático** de 15 vagas) enquanto `/vagas` web usa `getVagasRadar()` (KV `vagas:cache`, crawler Radar 2.0, TTL 6h) | **PRECISA CORRIGIR** (Missão S1): endpoint deve chamar `getVagasRadar(env, ctx)` e mapear o mesmo shape; manter campos atuais para não quebrar o app já instalado |
| D2 | `apps/owbuddy/src/sync.ts` | Gravava `ownews_minha_escala` / `ownews_certificados` no `user_metadata`; o web lê `escala_config` / `certificados` | **CORRIGIDO neste checkpoint** — ver §4 e `packages/ow-domain/src/sync-merge.ts` |
| D3 | Aeroporto do usuário | App guarda em `EscalaConfig.aeroporto`; web guarda em `localStorage ownews_meu_aeroporto` (não sobe para a conta) | Manter: `toWebEscalaConfig` já emite `aeroporto`; web já copia `aeroporto` do local para a nuvem quando ausente (`salvarEscalaNoMeta`). Fonte de verdade = `escala_config.aeroporto` |
| D4 | `apps/owbuddy/app/aeroportos.tsx` | Lista estática + link "Abrir no OWNews"; web consome JSON vivo do collector | **PRECISA PORTAR** (Missão S3): consumir `https://shrill-pond-a915…/aeroportos` (mesmo JSON, mesmo frescor, termo **TRANSFERIDO**) |
| D5 | Auth | App usa OTP magic link (`owbuddy://auth/callback`); web usa e-mail+senha | Mesmo projeto Supabase, mesmo usuário — **compatível**. Decisão: app oferece os dois (senha primeiro, OTP como "esqueci a senha"); nunca obrigar login |
| D6 | `docs/OWBUDDY_SYNC.md` | Dizia "Escala ❌ não sincroniza" — falso (web sincroniza via `escala_config`) | **CORRIGIDO** |
| D7 | Checklist categorias | Web: `cat:"E"|"P"` (essencial/pessoal); app: `higiene/saude/eletronicos/roupas/extras/custom` | Shape `{items:[{id,t,cat,ok,rec}],ciclo}` é **idêntico**; só o vocabulário difere. Missão S2 define vocabulário canônico em `@owbuddy/domain` (`documentos, epi, roupas, higiene, eletronicos, medicamentos, personalizados`) + mapa `E→higiene?`/`P→personalizados` **sem apagar itens** |
| D8 | Datas | `escala-cruzar.ts` tinha `msParaISO/isoParaMs` privados + default `toISOString()`; `escala.tsx` convertia feriado com `toISOString()` | **CORRIGIDO** — usa `hojeISO()`/`msParaISO()` do domínio |
| D9 | Collector | `shrill-pond-a915-fix/worker.js` na árvore de trabalho está **sobrescrito** pelo worker principal (diff +19.983/−6.031; HEAD intacto) | **NÃO deployar o collector a partir dessa pasta** até `git checkout -- shrill-pond-a915-fix/worker.js` (com confirmação humana) |

---

## 2. Arquitetura consolidada (alvo — sem reescrever nada)

1. **Núcleo compartilhado** = `packages/ow-domain` (TypeScript puro, sem RN, sem I/O):
   escala (`calcEscala`, `hojeISO`, `normalizarDia`), calendário/feriados, cruzar, codec (`normalizeEscalaConfig`,
   `toWebEscalaConfig`), checklist, certificados, viagem, buddy-voice, **sync-merge** (reconciliação pura).
   O motor web em `worker.js` é o **canônico**; o domínio é a transcrição testada (`apps/owbuddy/tests/domain.test.mjs`
   + `escala.test.mjs` provam paridade). Qualquer mudança de regra: primeiro no web, depois espelhar no domínio
   com teste de paridade.
2. **Dados do usuário** vivem em `user_metadata` (sem DDL). Formato = o que o web já grava. O app lê/escreve
   as mesmas chaves (§4). Chaves legadas do Buddy continuam sendo lidas, nunca mais escritas como fonte.
3. **Conteúdo** (notícias/vagas) só via API do OWNews. O app nunca fala com Supabase para conteúdo.
4. **Aeroportos/meteorologia operacional** só via collector `/aeroportos`. Meteorologia **pessoal** (cidade
   digitada) via Open-Meteo direto no app — dois conceitos, dois provedores, nunca misturar no mesmo card.
5. **Command Center** continua no worker principal; qualquer visão de "usuários OW" é **agregada** e sai de um
   endpoint interno do collector (único lugar com service role), proxied pelo CC com `X-OWNews-Internal`.

---

## 3. Mapa OWNews → OWBuddy (por recurso)

Legenda: **JÁ COMPARTILHADO** · **NATIVO NO APP** · **CONSOME API OWNEWS** · **PRECISA PORTAR** ·
**MANTER SOMENTE WEB** · **FUTURO** · **NÃO APLICÁVEL**

Levantado da **tabela de rotas real** do `worker.js` (handlers a partir da L19400; redirects 301 marcados como tal —
não são recursos, não portar).

| Rota / recurso OWNews | Handler | Status no app | Observação |
|---|---|---|---|
| `/` Home (editorial 48h, Minha Escala, Atalhos, Giro 24h, Aeroportos, Mercado) | `renderHome` | CONSOME API OWNEWS (feed) + NATIVO (escala) | Home do app responde "o que importa agora"; não replicar a grade da home web |
| `/noticia/:slug` artigo | `renderNoticia` | CONSOME API OWNEWS | app abre o artigo no OWNews; leitura nativa = FUTURO (só se houver demanda; exigiria HTML sanitizado na API) |
| Giro 24h (bloco da home) | parte de `renderHome` | JÁ COMPARTILHADO via feed | mesma `articles`; o app já lista por recência |
| `/offshore-agora` (`/agora` → 301) | `renderOffshoreAgora` | CONSOME API OWNEWS (parcial) | agrega feed + aeroportos + mercado; no app vira a Home, não uma tela |
| `/api/mais-lidas` | handler | FUTURO | ordenação "mais lidas" no feed do app, aditiva |
| `/buscar` | `renderBuscaGlobal` | FUTURO | busca local no cache do feed é suficiente no app |
| `/minha-escala` (`/comparador-escalas` → 301) | `renderMinhaEscala` | JÁ COMPARTILHADO (domínio) + NATIVO | paridade provada |
| `/checklist-embarque` | `renderChecklistEmbarque` | NATIVO (checklist) → Meu Embarque (S2) | D7 vocabulário |
| `/meus-certificados` | `renderMeusCertificados` | NATIVO + sync preparado | chave `certificados` |
| `/certificados-offshore` (guia) | `renderCertificadosOffshore` | MANTER SOMENTE WEB | conteúdo editorial |
| `/central-do-trabalhador` | `renderCentralTrabalhador` | NATIVO (equivale ao app inteiro) | — |
| `/meu-ownews` (OW Hub: conta, perfil, escala na conta) | `renderMeuOwnews` | FUTURO (S4 Conta OW) | mesmo Supabase; §5 |
| `/meus-alertas` (Web Push) | `renderMeusAlertas` | NÃO APLICÁVEL (push web) / FUTURO (Expo push) | sem nova infra agora |
| `/vagas`, `/vagas/:id` | `renderVagasIndex` (Radar 2.0 KV) | CONSOME API OWNEWS — **D1** | S1 |
| `/api/vagas/radar-status`, `/force-refresh` | handlers | NÃO APLICÁVEL | operacional/CC |
| `/carreiras`, `/carreiras/:slug`, `/funcoes`, `/funcoes/:slug` (taxonomia) | `renderCarreiras*`, `renderFuncoes*` | MANTER SOMENTE WEB (link no app) | FUTURO: expor `/api/buddy/funcoes` só se o app ganhar "minha função" |
| `/carreiras/cadastre-seu-curriculo`, `/modelo-curriculo`, `/guias/curriculo-offshore` | renderers | MANTER SOMENTE WEB | formulário/conteúdo |
| `/salarios`, `/salarios/:slug`, `/pesquisa-salarial`, `/api/pesquisa-salarial*` (`/dados` → 301) | Radar Salarial / `PesquisaSalarial` DO | MANTER SOMENTE WEB | FUTURO: responder pesquisa pelo app, mesma DO |
| `/aeroportos`, `/horarios`, `/aviacao-offshore`, `/aviacao-offshore/aeronaves` | `renderAeroportos`, `renderHorarios`, `renderAviacaoOffshoreHub` | PRECISA PORTAR (só `/aeroportos` — D4) | `/horarios`, aeronaves = MANTER SOMENTE WEB |
| `/mercado` | `renderMercado` (collector `/mercado`) | MANTER SOMENTE WEB (por ora) | FUTURO: card na Home via mesmo JSON |
| `/agenda`, `/agenda/submeter`, `/api/agenda/submissao` | renderers | MANTER SOMENTE WEB | — |
| `/empresas`, `/empresas/:slug` | `renderEmpresas*` | MANTER SOMENTE WEB | — |
| `/radar`, `/radar/camadas/*`, `/radar/localizacoes` (Radar Offshore) | `renderRadarIndex` | MANTER SOMENTE WEB | mapa pesado; app FUTURO só se houver uso |
| `/unidades` (Radar de Unidades) | `renderUnidades` | MANTER SOMENTE WEB | — |
| `/explica`, `/explica/:slug`, `/guias/*`, `/glossario`, `/cursos`, `/comece-aqui` | renderers de conteúdo | MANTER SOMENTE WEB | links a partir do app são aceitáveis |
| `/ferramentas`, `/conversor`, `/calculadora-embarque` | `renderFerramentas`, `renderConversor`, `renderCalculadoraEmbarque` | NATIVO NO APP | calculadora de embarque já é a Minha Escala; conversor: faltam velocidade/volume (S5) |
| Modo Embarcado (CSS/pref web) | `ownews_embarcado` | NÃO APLICÁVEL | app já é "modo embarcado" por natureza (estado embarcado na Home) |
| Compartilhamento (WhatsApp/Telegram/Facebook/copiar + evento) | script de artigo | NATIVO (Share API do RN) — FUTURO | emitir o mesmo evento `compartilhado_*` via API só se o CC for medir app |
| `/pergunte-ao-ownews`, `/api/pergunte` (IA) | handler + AI binding | NÃO APLICÁVEL (custo) | — |
| `/sobre`, `/contato`, `/privacidade`, `/termos-de-uso`, `/politica-editorial` | estáticos | MANTER SOMENTE WEB (links no app) | — |
| `/command-center*`, `/api/cc/*` | CC | MANTER SOMENTE WEB | nunca no app |
| `/sitemap*.xml`, `/robots.txt`, `/ads.txt`, `/manifest.webmanifest`, `/sw.js`, `/icons/*`, `/saude` | infra | NÃO APLICÁVEL | — |
| Instagram, Telegram, AdSense, Editorial Engine | collector / infra | NÃO APLICÁVEL | — |

Resumo: **3** recursos JÁ COMPARTILHADOS (feed, escala, Giro), **4** NATIVOS, **2** CONSUMINDO API com **1 divergente**
(vagas), **1** PRECISA PORTAR (aeroportos), **~20** MANTER SOMENTE WEB, **5** FUTURO, restante NÃO APLICÁVEL.
Nenhum código morto identificado nas rotas: os três redirects (`/agora`, `/dados`, `/comparador-escalas`) são
legados de URL e devem ficar.

---

## 4. Núcleo compartilhado: dados do usuário (user_metadata)

| Chave | Formato | Quem escreve | Quem lê | Regra de conflito |
|---|---|---|---|---|
| `escala_config` | plano do web `{tipo, diasEmbarcado, diasFolga, data, tipoRef, aeroporto, excecoes, salvo_em}` | web (`salvarEscalaNoMeta`), app (`escalaConfigParaNuvem`, só se `podeGravarEscalaNaNuvem`) | ambos | `salvo_em` mais novo vence; empate → web; app nunca sobrescreve nuvem mais nova |
| `certificados` | `[{id,nome,validade,emissao,instituicao,obs,updated_at,_deleted}]` | ambos | ambos | merge por `id`, `updated_at` mais novo; tombstone `_deleted` propaga; sem carimbo → local vence |
| `cruzar_config`, `datas_pessoais_config` | web | web | web (app: FUTURO) | `salvo_em` / união por id |
| `nome, sobrenome, funcao, consent_*` | strings | web | ambos | web |
| `ownews_minha_escala`, `ownews_certificados` | legado Buddy | **ninguém mais como fonte** (app ainda grava `ownews_minha_escala` por compat.) | app (fallback) | — |
| `ownews_checklist_mala`, `ownews_minha_viagem`, `ownews_buddy_prefs` | app | app | app | viagem sem `localizador/obs/assento/poltrona` |

Implementação: `packages/ow-domain/src/sync-merge.ts` (puro, testado em `apps/owbuddy/tests/sync-merge.test.mjs`),
`apps/owbuddy/src/sync.ts` (I/O). **Nenhuma tela chama sync ainda** — ligar só na Missão de Conta OW (§5).

---

## 5. Conta única OW — regras

- Um único Supabase Auth. Nunca outro provedor, nunca tabela própria de usuários.
- App funciona 100% sem conta (AsyncStorage). Login é opcional e pode ser oferecido como "guardar na conta OW".
- Sem sincronização bidirecional improvisada: só as regras de §4 (carimbo + merge por id + tombstones). Qualquer
  novo dado sincronizado entra na tabela de §4 **antes** do código.
- Sessão do app em `SecureStore` (já é o adapter do `supabase.ts`); nunca em AsyncStorage em texto plano.

---

## 6. Matriz de paridade

| RECURSO | OWNEWS WEB | OWBUDDY | BACKEND/FONTE | OFFLINE? | LOGIN? | STATUS | PRÓXIMA AÇÃO |
|---|---|---|---|---|---|---|---|
| Motor Minha Escala | worker.js (canônico) | @owbuddy/domain | — | sim | não | paridade provada | manter testes |
| Exceções (dobra/férias) | sim | sim | LS / AsyncStorage | sim | não | ok | — |
| Cruzar escalas | sim (ícone por relação) | sim | local | sim | não | ok (ícone não preservado no codec — só visual) | S2 opcional |
| Datas pessoais / viagens de folga | sim | sim | local | sim | não | ok | — |
| Escala na conta OW | sim (`escala_config`) | preparado | user_metadata | — | sim | código pronto, tela não liga | Missão S4 |
| Certificados | sim | sim | local + `certificados` | sim | opcional | ok | S4 liga sync |
| Checklist / Meu Embarque | checklist | checklist | local | sim | não | vocabulário difere (D7) | Missão S2 |
| Notícias | SSR | feed nativo | `/api/buddy/feed` | cache 5m | não | ok | versionar `/api/v1/buddy/*` só quando houver quebra |
| Vagas | Radar 2.0 KV | lista nativa | `/api/buddy/vagas` | cache 1h | não | **divergente (D1)** | Missão S1 |
| Aeroportos/OffVoos | collector JSON | estático | collector | cache | não | **PRECISA PORTAR** | Missão S3 |
| Meteorologia pessoal | não | Open-Meteo | Open-Meteo | cache 30m | não | ok | persistir cidade (S3) |
| Meteorologia operacional (aeroporto) | METAR via collector | não | collector | — | não | FUTURO | S3 (≤48h do embarque prioriza aeroporto) |
| Ferramentas | não | nativo | — | sim | não | faltam velocidade/volume | S5 |
| Push | Web Push VAPID | não | worker | — | não | FUTURO | — |
| Command Center | sim | não | PageViews DO | — | senha CC | melhorado (métricas) | S6 "Usuários OW" |

## 7. Matriz de dados compartilhados

| DADO | FONTE DE VERDADE | OWNEWS CONSOME? | OWBUDDY CONSOME? | CACHE? | SINCRONIZAÇÃO? | RISCO |
|---|---|---|---|---|---|---|
| Artigos | Supabase `articles` (Editorial Engine) | sim (SSR) | sim (`/api/buddy/feed`) | web: edge; app: 5 min | n/a | baixo |
| Vagas | KV `vagas:cache` (Radar 2.0) | sim | **não (estático)** | 6h / 1h | n/a | **alto** — app mostra vagas velhas |
| Aeroportos/OffVoos | collector `/aeroportos` | sim | não | collector | n/a | médio — app desinformado |
| Escala do usuário | `user_metadata.escala_config` (quando logado) / local | sim | preparado | local | carimbo | médio (resolvido no código, falta ligar) |
| Certificados | `user_metadata.certificados` / local | sim | preparado | local | merge id | baixo |
| Perfil (nome, função) | `user_metadata` | sim | futuro | — | web | baixo |
| Aeroporto favorito | `escala_config.aeroporto` | sim (LS `ownews_meu_aeroporto` espelho) | sim | — | via escala | baixo |
| Cidade meteorologia pessoal | app `owbuddy_city_pref` | não | sim | — | não | nenhum |
| Métricas CC | PageViews DO | sim | não | — | n/a | ver `COMMAND_CENTER_METRICAS.md` |

---

## 8. Regra para qualquer nova alteração (obrigatória no PR/relatório)

```
IMPACTO WEB:      o que muda em worker.js / páginas / APIs
IMPACTO APP:      o que muda em apps/owbuddy / packages/ow-domain
COMPATIBILIDADE:  builds antigos do app continuam lendo? web antigo continua lendo user_metadata?
MIGRAÇÃO:         dados locais / user_metadata precisam de normalização? (nunca apagar; sempre ler formato antigo)
TESTES:           node --test (app + domínio), npx tsc --noEmit, python3 tests/production_guard.py --pre-deploy
```

## 9. Não fazer (permanente)

Reescrever OWNews ou OWBuddy · outro Supabase · outro sistema de usuários · duplicar pipelines (notícias, vagas,
aeroportos) · WebView · quebrar `/api/buddy/*` · apagar dados do usuário · mexer em infra crítica sem necessidade ·
publicar endpoint com dado pessoal (e-mail, telefone, nascimento, escala individual) · inventar métricas · EAS por
microajuste · cosmético sem valor.
