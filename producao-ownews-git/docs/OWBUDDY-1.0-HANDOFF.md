# OWBuddy 1.0 — Handoff

> Documento principal do app. Escrito no fechamento do OWBuddy 1.0 RC
> (2026-10-18) para que qualquer pessoa ou agente — inclusive um modelo mais
> barato — continue o projeto sem depender de conversa anterior.
> Os demais `docs/OWBUDDY_*.md` são históricos; **em conflito, vale este arquivo.**

---

## 1. O que é

**OWBuddy — "Seu parceiro na vida offshore."** App Android/iOS (Expo / React
Native) para o trabalhador offshore: Minha Escala, Meu Embarque (checklist),
Minha Viagem, Certificados, Aeroportos, Notícias, Conta OW opcional e
ferramentas.

- **OWNews** (`ownews.com.br`, worker `ownews-git`) = conteúdo, descoberta, aquisição.
- **OWBuddy** = companheiro pessoal. **Consome** o OWNews; não tem cérebro editorial.

## 2. Decisões definitivas (não reabrir sem o dono do produto)

1. **Conta OW é opcional.** Tudo funciona sem cadastro, 100% local.
2. **Offline-first.** Sem internet o usuário não perde nada: escala, calendário,
   checklist, viagem, certificados, preferências e notícias já abertas continuam.
   Online-only (aeroportos ao vivo, vagas, feed novo) avisa com discrição.
3. **Uma regra de escala:** `calcEscalaISO()` em `packages/ow-domain`. Nenhuma
   tela faz aritmética de datas.
4. **Notícia = padrão OWNews:** Buddy resume + corpo OWNews + Impacto + fonte,
   vindos prontos do `/api/buddy/feed`. O app não gera, não resume, não completa
   e nunca mostra texto da fonte. Compartilhar usa a URL do OWNews.
5. **Buddy oficial e funcional** (ícone, splash, card "Buddy resume"). Nunca
   mascote novo. Asset: `assets/buddy-watermark.png`. Marca-d'água: SÓ na Home
   (`OWBackground watermark="home"`, canto superior direito, ~8,5%) — decisão do
   dono em 2026-10-19; nenhuma outra tela.
6. **Notificações só LOCAIS**, desligadas por padrão, cadência conservadora,
   texto sem dado privado. Sem push remoto na 1.0.
7. **Privacidade:** viagem, checklist, eventos, Cruzar e nickname nunca vão para
   analytics; viagem nunca vai para a conta.
8. **Fora da 1.0:** Buddy+, assinatura, B2B, chat IA, marketplace, rede social,
   gamificação.
9. **OWNews web está congelado** (AdSense). Mudança no worker só se for mínima e
   estritamente necessária para o app — e documentada (ver § 15).

## 3. Estrutura

```
producao-ownews-git/                 ← raiz do workspace npm (git root é ../)
├── worker.js                        ← OWNews (NÃO mexer sem auditoria)
├── package.json / package-lock.json ← workspaces: apps/*, packages/*
├── packages/ow-domain/              ← regras puras compartilhadas (TS, sem RN)
│   ├── src/escala.ts                ← REGRA CANÔNICA (calcEscalaISO, resumoEscala…)
│   ├── src/escala-calendario.ts     ← gerarMesDias / infoParaDia / feriados
│   ├── src/escala-cruzar.ts         ← folgas em comum (exceções contam)
│   ├── src/escala-codec.ts          ← lê TODOS os formatos de storage (web/v1/v2)
│   ├── src/lembretes.ts             ← planejador puro das notificações locais
│   ├── src/checklist.ts, certs.ts, viagem.ts, sync-merge.ts, buddy-voice.ts
│   └── tests/
├── apps/owbuddy/                    ← o app
│   ├── app.json / eas.json          ← config nativa e de build
│   ├── app/                         ← rotas (expo-router; cada arquivo é uma tela)
│   ├── src/                         ← serviços (api, net, storage, sync, auth, notifications…)
│   ├── assets/                      ← ícones, splash, ícone de notificação
│   └── tests/                       ← testes node:test (rodam no domínio real)
└── docs/OWBUDDY-1.0-HANDOFF.md      ← este arquivo
```

`apps/owbuddy/android/` é gerado (prebuild) e está no `.gitignore`. Nunca editar à mão.

## 4. Stack (versões reais)

| Item | Versão |
|---|---|
| Expo SDK | 57 (`expo ~57.0.26`) |
| React Native | 0.86.3 (Hermes) |
| React | 19.2.3 (app) — `react-dom` fixado em 19.2.3 |
| Expo Router | ~57.0.24 (typed routes) |
| expo-notifications | ~57.0.23 |
| expo-splash-screen | ~57.0.10 |
| Supabase JS | ^2.117 |
| TypeScript | ~6.0 |
| EAS | projeto `@offshoreworks/owbuddy`, id `6dd5c107-84cf-4e90-a05c-71697c9d9b2f` |

Atenção ao monorepo: a raiz tem `react@19.3.0` (puxado por `expo-network` no
package.json raiz). O bundle nativo resolve só o 19.2.3 do app (conferido:
1 cópia no bundle Android). Não adicione `react` na raiz.

## 5. Telas e rotas

Tabs (`app/(tabs)/`): `index` Início · `escala` Escala · `mala` Embarque · `viagem` Viagem · `certs` Certificados. `loja` continua como rota (`/loja`), fora da barra (`href: null`), acessível pelo link secundário da Home.

Stack (`app/`): `escala` (calendário) · `escala-config` · `escala-excecao-form`
(dobra/férias) · `escala-evento-form` (viagem/curso/data especial/compromisso) ·
`escala-cruzar` · `escala-secundaria-form` · `noticias` · `noticia/[id]` ·
`aeroportos` · `vagas` · `unidades` · `unidade/[slug]` · `ferramentas` ·
`buddy-config` (Meu Buddy: tom, lembretes, Conta OW) · `+not-found`.

`tests/routes.test.mjs` varre todo `router.push/replace/navigate` e falha se
alguma rota não tiver tela.

## 6. Domínio da escala

- `calcEscalaISO(config, "YYYY-MM-DD")` — **única** regra. Trabalha em dias de
  calendário; não converte fuso. `calcEscala(config, date)` só resolve "hoje"
  no fuso do aparelho e delega.
- "Embarquei em 12" → dia 12 = EMB D1. "Desembarquei em 12" → dia 12 = 1º dia de folga.
- Dobra/férias são **visuais** (não deslocam o ciclo — paridade com o web).
  No Cruzar, dobra conta como a bordo e férias como livre.
- Ciclo personalizado: inteiro 1..120 (`validarDiasBloco`). Data de referência
  tem de existir (`isoValido`). Inválido ⇒ `SEM_ESCALA` (nunca "sempre de folga").
- Testes: `tests/escala-matriz.test.mjs` compara com um **oráculo independente**
  (calendário próprio, sem `Date`) em >200 mil dias, 12 ciclos, 8 referências
  (inclui 29/02, 31/12, 31/01); `_fuso-probe.mjs` roda em 13 fusos (BR, DST de
  Londres/NY/Auckland, +14, −11).

## 7. Storage (AsyncStorage) — NUNCA renomear chaves

| Chave | Conteúdo |
|---|---|
| `ownews_minha_escala` | escala (envelope `{v:2,data,updated_at}`; codec lê formatos antigos) |
| `ownews_certificados` | certificados (tombstone `_deleted`) |
| `ownews_checklist_mala` | checklist `{items, ciclo}` |
| `ownews_minha_viagem` | viagem |
| `ownews_buddy_prefs` | tom/tratamento/apelido |
| `owbuddy_eventos_pessoais` | eventos (migrados de `ownews_minha_escala_datas_pessoais` + `owbuddy_viagens_folga`) |
| `ownews_cruzar_v2` | escalas secundárias |
| `owbuddy_city_pref`, `owbuddy_weather_cache` | cidade e clima da Home |
| `owbuddy_lembretes_prefs` | preferências de lembrete |
| `owbuddy_cache_feed_v3`, `owbuddy_noticias_abertas_v1` | notícias (cache) |
| `owbuddy_cache_aeroportos_v1`, `owbuddy_cache_vagas`, `owbuddy_cache_unidades_v1` | caches online |
| `sb-…-auth-token` | sessão Supabase (gerida pelo supabase-js) |

Leitura sempre tolerante: valor ilegível vira "sem dado", **nunca é apagado**.

## 8. Offline (testado em navegador com a rede cortada)

| Tela | Sem internet |
|---|---|
| Início, Escala, calendário, Cruzar | 100% local |
| Meu Embarque, Viagem, Certificados, Meu Buddy | 100% local |
| Notícias | lista em cache com "notícias salvas às HH:MM"; matéria aberta antes abre |
| Matéria nunca aberta | "Sem conexão e esta notícia não está salva" + Tentar novamente |
| Aeroportos | último dado salvo com "dados salvos às …"; sem cache: mensagem curta |
| Vagas / Unidades | cache; sem cache: "Sem conexão" |

Toda chamada passa por `src/net.ts` (`buscarJson`): timeout próprio, nunca lança.
Cache bom nunca é sobrescrito por resposta vazia.

## 9. Sync (Conta OW) — o que REALMENTE sincroniza

Arquivo: `src/sync.ts` (chamado no login e no botão Sincronizar). Dados em
`user_metadata` do Supabase Auth (mesma conta do `ownews.com.br/meu-ownews`).

| Sincroniza | Nunca sai do aparelho |
|---|---|
| `escala_config` (formato do web) + `ownews_minha_escala` (legado) | Minha Viagem (e a cópia antiga é apagada) |
| `certificados` (merge por id, mais novo vence, tombstones) | eventos pessoais do app, escalas do Cruzar |
| `ownews_checklist_mala` (só preenche aparelho sem lista) | cidade, clima, notícias, lembretes |
| `ownews_buddy_prefs` (mais novo vence) | |

Conflito de escala: a conta só substitui o aparelho se for **estritamente mais
nova** (`nuvemDeveSubstituirLocal`). Falha de login/sync nunca toca dado local.
Sair (`signOut({scope:'local'})`) não apaga nada do aparelho.

Fluxos de conta: Entrar, Criar conta, Esqueci minha senha (link abre na web).
**Não há link mágico** (não existe rota de callback no app).

## 10. Notificações (LOCAIS)

- Código: `src/notifications.ts` (expo) + `packages/ow-domain/src/lembretes.ts` (puro).
- Liga em Meu Buddy → Lembretes (pede permissão nessa hora). Negou → app segue normal,
  com atalho para as configurações do sistema.
- Cadência: embarque D-3 09:00 e véspera 18:00 · checklist D-2 19:00 (se faltar item)
  · certificado 30 e 7 dias antes 09:00 · viagem véspera 20:00 e 3 h antes. Máx. 20.
- Replaneja (cancela tudo + agenda) ao abrir, ao voltar para o app e após salvar
  escala/checklist/certs/viagem. Toque abre `/escala`, `/mala`, `/viagem` ou `/certs`.
- Android: canal `lembretes`; sem `SCHEDULE_EXACT_ALARM` (bloqueado) — o sistema
  pode atrasar alguns minutos, aceitável para lembrete.
- **Push remoto não existe** (nem token). O web tem Web Push próprio (Central de
  Alertas) — não relacionado.

## 11. Privacidade

| Dado | Local | Conta (se logado) | Analytics | Notificação |
|---|---|---|---|---|
| Escala | ✔ | ✔ | só `scale_configured {tipo}` | data do embarque |
| Certificados | ✔ | ✔ | só `certificate_created/deleted` (sem nome) | sem nome |
| Checklist | ✔ | ✔ | nada do conteúdo | só a contagem |
| Viagem | ✔ | ✘ | `trip_created {tipo}` | tipo + hora, sem destino/localizador |
| Eventos, Cruzar | ✔ | ✘ | ✘ | ✘ |
| Apelido | ✔ | ✔ (prefs) | ✘ | ✘ |

`src/analytics.ts` hoje só imprime em `__DEV__` (nada é enviado). Se um dia ligar
um provedor: apenas eventos genéricos, nunca payload privado.

## 12. Segurança

- Único "segredo" no bundle: chave **publicável** do Supabase (pública por desenho,
  protegida por RLS). Nenhuma `service_role`, token admin ou chave Cloudflare no app.
- Links vindos da API só abrem se forem `http(s)` (`urlExternaSegura`).
- Sessão em AsyncStorage (padrão supabase-js RN). Refresh só em primeiro plano.
- Segredos de infraestrutura ficam FORA do repo, em `~/.config/ownews/` (só nomes):
  `expo.env` (EXPO_TOKEN), `cloudflare.env`, `github.env`, `admin-token.env`,
  usados via `with-expo-token.sh`, `with-cf-token.sh`, `with-github-token.sh`,
  `with-admin-token.sh`. Nunca imprimir os valores.

## 13. Deep links

Esquema `owbuddy://` (expo-router resolve sozinho): `owbuddy://escala`,
`owbuddy://mala`, `owbuddy://certs`, `owbuddy://viagem`, `owbuddy://noticia/<id>`.
Link desconhecido → `+not-found` (tela amigável). Links https do OWNews não
abrem o app (sem App Links/Universal Links — exigiria `assetlinks.json` no site).

## 14. Testes

```bash
cd producao-ownews-git/apps/owbuddy
npm run verificar            # tsc + todos os testes (app + domínio)
npm run test:contrato        # contrato ao vivo com ownews.com.br (precisa de rede)
```

Validação visual (opcional): `npx expo export --platform web`, servir `dist/` e
abrir em 360/375/393/412/430/480 px (Playwright). O web não é produto; serve só
para enxergar layout e offline.

## 15. OWNews — o que o app usa e o que NÃO mexer

- Endpoints: `docs/OWBUDDY-CONTRATOS.md`.
- Única mudança no worker feita para o app (2026-10-18, commit `069830b`):
  `/api/buddy/feed` passou a mandar `corpo`, `summary:null`, só INDEXABLE e
  `image_url` sem `&amp;`. Guard: `tests/production_guard.py` (check do feed).
- Antes de deploy do worker: `python3 tests/production_guard.py --pre-deploy`
  (o modo completo tem 2 checagens de smoke antigas da Home que falham desde a Home 3.0).

## 16. Build, OTA e versões

### Regra de ouro
`runtimeVersion = appVersion` ⇒ uma OTA só chega a binários com **a mesma
`version`**. Mudou algo nativo (pacote com código nativo, permissão, ícone,
splash, plugin, `app.json` nativo) ⇒ **novo build nativo** com `version` nova
(ou mesma version + versionCode novo, se nada nativo mudou desde o último build).

| Pode ir por OTA (`eas update`) | Exige BUILD NATIVO |
|---|---|
| JS/TS de telas, textos, estilos | adicionar/atualizar pacote com código nativo (ex.: expo-notifications) |
| regras do domínio | permissões Android / strings iOS |
| imagens importadas pelo JS | ícone, splash, nome, package/bundle id |
| | plugins em `app.json`, SDK do Expo |

### Canais
`eas.json`: perfil `preview` → canal `preview`; `production` → `production`;
`development` → `development`. **Builds até 0.1.8 não tinham canal** e por isso
nunca receberam as OTAs publicadas em 10/2026.

### Publicar OTA
```bash
cd producao-ownews-git/apps/owbuddy
~/.config/ownews/with-expo-token.sh npx eas-cli@latest update --channel preview --message "texto" --non-interactive
```
(Use `--channel production` quando houver build de produção instalado.)

### Gerar APK de teste (sem cota EAS)
A cota gratuita de builds na nuvem acaba rápido (out/2026: esgotada). Build local:
```bash
# uma vez: JDK 17 + Android SDK 36 + NDK 27.1 (sem root)
/home/offshore/android-build/setup.sh
# APK de teste (só arm64 — todo Android atual)
ABIS=arm64-v8a /home/offshore/android-build/build-local.sh preview /home/offshore/android-build/owbuddy.apk
# AAB de loja (todas as ABIs)
/home/offshore/android-build/build-local.sh production /home/offshore/android-build/owbuddy.aab
```
Ambiente da VPS (8 GB, 2 CPUs, sem swap, sem KVM — não roda emulador):
`~/.gradle/gradle.properties` limita memória (1 worker, Kotlin in-process) e
`~/.gradle/init.d/sem-lint-vital.gradle` desliga o lint-vital do release (estourava
Metaspace; não muda o APK). Antes de um build, confira que não sobrou daemon:
`pgrep -fa jdk17` — mate só esses PIDs. Daemons esquecidos (~2 GB) derrubam o próximo build.

O build local assina com a **keystore remota do EAS** (a mesma de todos os APKs),
então instala por cima das versões anteriores. Requer commit limpo do app.
Antes de cada build nativo: subir `android.versionCode` (e `version` se for novo
runtime) em `app.json` — `autoIncrement` está desligado de propósito.

Build na nuvem (quando houver cota): `npx eas-cli@latest build -p android --profile preview`.
**Nunca** habilitar cobrança por uso sem decisão do dono.

### iOS
Bundle `br.com.ownews.owbuddy`, sem iPad, `usesNonExemptEncryption=false`.
**Bloqueado:** não há Apple Developer Program (US$ 99/ano). Sem ele não há build
para aparelho nem TestFlight. Quando houver conta: `eas build -p ios --profile preview`
(EAS cria certificados). Notificações locais não pedem string de permissão no iOS.

### Rollback
- App: reinstalar o APK anterior (lista em `eas build:list`) ou OTA anterior com
  `eas update:republish`.
- Worker OWNews: `wrangler rollback <version-id>` (ver relatório da missão).

## 17. Troubleshooting

| Sintoma | Causa provável / ação |
|---|---|
| OTA não chega | `version` do binário ≠ da OTA, ou build sem canal (≤0.1.8) |
| Notícia sumiu do app | API mudou → `npm run test:contrato` |
| Calendário deslocado 1 dia | alguém usou `Date`/`toISOString` em vez de `calcEscalaISO` |
| "Invalid hook call" | segunda cópia de React — não pôr `react` na raiz |
| Lembretes não disparam | permissão negada; ou binário < versionCode 12 (sem módulo nativo) |
| Export web erro React #527 | `react-dom` diferente de `react` — mantenha 19.2.3 nos dois |
| Login "sem conexão" | rede; dados locais intactos por desenho |

## 18. Coisas que NÃO devem ser alteradas sem auditoria

1. Nomes das chaves de storage (§ 7) e o codec da escala.
2. `calcEscalaISO` / convenção embarquei-desembarquei (há usuários reais).
3. Regras de merge do sync (`sync-merge.ts`) e a lista "nunca sai do aparelho".
4. `package`/`bundleIdentifier`, keystore do EAS, `projectId`.
5. Contrato `/api/buddy/feed` e o gate editorial do OWNews (worker congelado).
6. Notificações desligadas por padrão e sem dado privado no texto.

## 19. O que um modelo mais barato pode fazer com segurança

- Textos, cores e espaçamentos pontuais (rodar `npm run verificar` + olhar o web export).
- Novas OTAs de correção JS (mesma `version`).
- Adicionar casos de teste à matriz da escala.
- Atualizar este documento e o de contratos.

Sempre com: commit por área, `git add <caminhos>` (nunca `git add .`), sem
`reset --hard`, sem apagar arquivos não versionados do repo.

## 20. Checkpoint 1.0 RC1 (2026-10-18)

| Item | Valor |
|---|---|
| Versão / versionCode | 1.0.0 / 12 (runtime OTA `1.0.0`) |
| Commit do build | `7a57db2` (branch `owbuddy/dev`) — tag `owbuddy-v1.0-rc1` |
| APK de teste | `/home/offshore/android-build/owbuddy-1.0.0-vc12-preview.apk` (47 MB, arm64, canal `preview`) |
| SHA-256 do APK | `d7973381a82a06751b2672d6a412bffdbcb84554ded3f6bfee62e7668d1d74f8` |
| Certificado | SHA-256 `3c776bb3dd367d5f870fdb9fcd86740e18b959ba36587e73b1b167f09323d92e` (igual ao 0.1.8 → instala por cima) |
| AAB (release candidate) | `/home/offshore/android-build/owbuddy-1.0.0-vc12-release.aab` (78 MB, arm64-v8a/armeabi-v7a/x86/x86_64, canal `production`, SHA-256 `5f384e1e4d1b5b040c39629c3cbef893695dd29edf152c506ddb71f6086dfbf4`, mesmo certificado) |
| EAS | build LOCAL: não gera Build ID nem página no expo.dev |

Baixar o APK para o computador: `scp offshore@<servidor>:/home/offshore/android-build/owbuddy-1.0.0-vc12-preview.apk .`
(o repositório GitHub é público — não publicar APK em release lá).

## Polimento Home + Meu Embarque (2026-10-19)

- **Home contextual:** `contextoHome()` (ow-domain/home-contexto.ts) transforma
  `resumoEscala()` + `calcularMomento()` em SEM_ESCALA / PRE_EMBARQUE (≤ 5 dias,
  mesmo corte do momento) / EMBARCADO / FOLGA. Só texto — nenhuma conta de datas.
  A contagem do checklist na Home passa por `sincronizarChecklistComCiclo` (só
  exibe; quem grava é o Meu Embarque).
- **Home:** hero contextual → "Meu offshore" (grade 2 × 2) → "Offshore agora"
  (Vagas e Unidades em destaque, Notícias/Aeroportos em lista, Ferramentas como
  link). O contador de Vagas é o tamanho real de `/api/buddy/vagas` (cache 1 h);
  sem dado, sem número. Unidades não carrega nada na Home.
- **Meu Embarque:** botão ⋯ em cada item (e toque longo) abre um sheet próprio
  (Modal) — Alert com botões não existe na web. Personalizado: editar / excluir
  (2º toque confirma). Padrão: editar / ocultar (sai da lista; volta com
  "Restaurar itens padrão" → `restaurarItensPadrao`). Formato `{items, ciclo}`
  inalterado. Lista vazia não é mais recriada (era escolha do usuário).
- **Concluídos:** sem riscado; 100% vira "11 / 11 · Tudo preparado · Tudo pronto.
  Bom embarque!". "Ocultar concluídos" é preferência local
  (`owbuddy_mala_ocultar_concluidos`), nunca apaga nem sincroniza.
- **Web:** `app/_layout.tsx` limita a coluna a 560 px no navegador (no app é View neutro).
- Categorias: mantidas; item novo continua em Personalizados (escolher categoria
  ficou para depois, para não complicar o fluxo).

## Rodada pré-RC (2026-10-19)

- **Barra inferior:** Início · Escala · Embarque · Viagem · Certificados. `app/escala.tsx`
  virou `app/(tabs)/escala.tsx` (mesma rota `/escala`; deep link `owbuddy://escala` igual).
  Loja fora da barra, rota mantida.
- **Calendário:** células por `flex: 1` + `aspectRatio: 1` (antes: `Dimensions` lido uma vez no
  load do módulo → células gigantes no navegador largo / rotação). 7 colunas sempre.
- **Convenção da escala (inalterada, com teste):** 14×14 "embarquei 19/10" → Dia 1 = 19/10,
  Dia 14 = 01/11 (último dia a bordo), desembarque 02/11 = Dia 1 da folga, próximo embarque
  16/11; no Dia 1 faltam 14 dias para o desembarque. Mesma regra do OWNews web.
- **Frescor da Home (`src/frescor.ts`):** contador de Vagas só com lista obtida ≤ 24 h E
  `updated_at` (última verificação nos portais) ≤ 72 h; senão só "Vagas". Manchete de
  Notícias só se publicada ≤ 48 h; senão copy neutra.
- **Cruzar:** ícones vetoriais (`src/relacao-icones.ts`); emojis antigos salvos são lidos pelo
  mapa legado (🤜🤛 → `people`).
- **Rótulos da barra:** tamanho por largura de tela (`useWindowDimensions`), igual em todas as
  plataformas — `adjustsFontSizeToFit` não existe na web.

