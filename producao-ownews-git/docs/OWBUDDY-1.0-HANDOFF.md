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
| `owbuddy_aparencia` | aparência: `"auto"` \| `"escuro"` \| `"claro"` (só local, fora do sync; sem valor = Automático) |
| `owbuddy_historico` | Meu Histórico `{v:1, registros[], acontecimentos[], seq}` — SÓ local (fora do sync, analytics, log e notificação) |
| `owbuddy_historico_avisos` | anti-spam dos avisos do Histórico (sugestões dispensadas, finalização adiada) |
| `owbuddy_historico_backup` | cópia única do bruto se o histórico vier ilegível ou de versão mais nova (antes de regravar) |
| `owbuddy_plus_cache` | OWBuddy+: última confirmação da LOJA `{v:1, plus, conferidoEm, fimDoPeriodo, jaTevePlus}` — não é trial, sem token/recibo/preço; fora do sync |
| `owbuddy_plus_teste_cenario` | cenário simulado do OWBuddy+ — lido SÓ com modo de teste (dev / preview web com flag) |
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

## Camada parceiro pessoal + Home personalizável (2026-10-19)

Princípio: OWNews sabe o que acontece no offshore; o OWBuddy sabe o que acontece na vida
offshore do usuário. Tudo LOCAL, offline, determinístico — sem IA, sem rede para calcular.

### Buddy Agora (`packages/ow-domain/src/buddy-agora.ts`)
- `gerarAcontecimentos({escala, checklist, certs, viagem, eventos, pagamento})` → lista
  normalizada `Acontecimento {id, tipo, subtipo, titulo, dataISO, hora, dias, faixa,
  criticidade, recorrencia, origem, rota, rotaParams, acao, detalhe, notificavel, meta}`.
  Nada é armazenado: tudo derivado dos dados que já existem.
- Fontes: escala (embarque/desembarque via `resumoEscala`), checklist (só em folga, ≤ 7 dias,
  mesma regra de ciclo do Meu Embarque), viagem, certificados existentes (≤ 30 dias, nada
  duplicado), Datas importantes, Meu Pagamento.
- Ordem: faixa (Hoje → Amanhã → 7 dias → 30 dias → depois) → criticidade (certificado ≤ 7 d →
  viagem → embarque/desembarque → checklist → curso → consulta/compromisso/trabalho/documento e
  certificado > 7 d → aniversário → pessoal/outro → pagamento) → data → hora → título → id.
- Uma ação por item: aniversário → presente; viagem → transporte; certificado → ver certificado;
  curso → ver detalhes; pagamento → ver regra; embarque → ver checklist.
- Home (`acontecimentosParaHome`): até 3 (1 no compacto), ≤ 30 dias, sem embarque/desembarque
  (o card da escala já mostra; e o checklist também quando o card está NORMAL no
  pré-embarque); pagamento só dentro da janela de aviso. "Ver todos" → `/proximos`.

### Datas importantes (`datas-importantes.ts`, `ocorrencia.ts`)
- Estendem `EventoPessoal` (mesma chave `owbuddy_eventos_pessoais`, mesmo calendário):
  novos tipos ANIVERSARIO, CONSULTA, TRABALHO, DOCUMENTO, PESSOAL (+ CURSO, COMPROMISSO,
  OUTRO; VIAGEM e DATA_ESPECIAL continuam válidos como legado). Campos opcionais novos:
  `recorrencia` ('anual'), `pessoa`, `relacao`, `lembrete_dias` (ausente = padrão do tipo;
  [] = sem lembrete). Eventos antigos sem esses campos funcionam igual (sem migração).
- Anual: mesmo dia/mês; 29/02 → 28/02 em ano não bissexto. Calendário usa `eventoOcorreEm`.
- Relação com a escala: `estadoEscalaNoDia` (escala-calendario, mesma regra do calendário,
  respeita dobra/férias) → "Você estará embarcado/de folga/de férias nessa data", "É dia de
  embarque/desembarque".
- Cadastro: `/escala-evento-form` ("Lembrar de algo"); aniversário nasce anual; confirmação de
  exclusão funciona na web (`confirmarRemocao`).
- Presentes: `presentes.ts` — lista editorial fixa filtrada por faixa/categoria; à distância
  primeiro quando você estará embarcado. Sem preço real, loja, compra ou afiliado
  (cada ideia pode ganhar `destino` no futuro).

### Meu Pagamento (`pagamento.ts`, tela `/pagamento`, chave `owbuddy_pagamento_v1`)
- Só a REGRA (nunca valor): último/primeiro/quinto dia útil, dia fixo, personalizado
  (n-ésimo dia útil 1–20). Dia fixo: antecipar / próximo dia útil / sem ajuste; dia 29–31 em
  mês menor = último dia. Aviso: 0/1/3/7/15 dias (padrão 7).
- Dias úteis = seg–sex menos, se marcado (padrão), os 10 FERIADOS NACIONAIS de lei derivados de
  `datasImportantesDoAno` (mesma lista do OWNews): 01/01, Sexta-feira Santa, 21/04, 01/05,
  07/09, 12/10, 02/11, 15/11, 20/11, 25/12. Carnaval (ponto facultativo), Páscoa e datas
  estaduais/municipais NÃO entram — a tela diz isso.
- Textos: "Pagamento previsto", "Pela regra que você cadastrou", "Estimativa…". Nunca
  "será pago". "Antecipar" pode puxar o pagamento para o fim do mês anterior (tratado).

### Transporte (`src/transporte.ts`, `TransporteSheet`, Minha Viagem, Preciso de…)
- Uber: link universal OFICIAL `https://m.uber.com/looking?drop[0]={lat,long,addressLine1,
  addressLine2}` (developer.uber.com › Ride Requests › Deep links). Abre o app se instalado;
  senão loja/m.uber.com. Origem fica com a Uber. Destino só com coordenadas conhecidas:
  aeroporto de PARTIDA da viagem de avião reconhecido por código IATA/ICAO ou nome (tabela de
  19 aeroportos) e a base da escala (`AEROPORTOS_ESCALA`). Sem destino: abre sem `drop`.
  `UBER_CLIENT_ID` vazio (opcional; preencher se registrarmos app na Uber).
- 99: SEM deep link/link universal documentado (auditado 2026-10-19). Não inventamos esquema.
  O botão abre a página oficial: Android `play.google.com/...id=com.taxis99`, iOS
  `apps.apple.com/br/app/id553663691` (ambas mostram "Abrir" se instalado), web `99app.com`.
  O usuário informa o destino dentro da 99.
- Nenhuma localização pedida, nenhum histórico, nada de background location. Nenhuma corrida
  ou pagamento é feito pelo OWBuddy.

### Notificações (`lembretes.ts`, `src/notifications.ts`)
- Categorias (Meu Buddy → Lembretes): Escala, Viagem, Checklist, Certificados, Datas
  importantes, Pagamento. Prefs antigas são mescladas com o padrão (as novas nascem ligadas;
  o interruptor geral continua DESLIGADO por padrão).
- Datas: dias antes conforme o evento (aniversário/curso 7 e 1; compromisso/consulta 1) às
  09:00; pagamento: N dias antes às 09:00. Um aviso por evento por dia (id estável). Texto
  na tela bloqueada só com o TIPO e a data ("Aniversário em 7 dias") — nunca nome, pessoa,
  título ou observação. Teto 30 agendados. Na web: só preferências (não há notificação).
- Rotas permitidas ao tocar: /escala, /mala, /viagem, /certs, /proximos, /pagamento.
- Validar no APK RC (não validável no navegador).

### Home personalizável (`home-prefs.ts`, `/personalizar-home`, chave `owbuddy_home_prefs`)
- Schema v1: `{v, ordem, ocultos, tamanhos, estiloSaudacao, fraseDoDia, clima, preset,
  dicaVista}`. `normalizarPrefsHome` migra qualquer coisa: descarta módulo desconhecido,
  insere módulo novo após o vizinho da ordem padrão, nunca oculta 'momento', ignora tamanho
  fora dos presets. Upgrade não reseta a Home.
- Módulos: momento (NORMAL/COMPACTO, nunca oculto), escala, embarque, viagem, certs
  (NORMAL/COMPACTO), proximos (NORMAL=3 / COMPACTO=1), vagas e unidades (COMPACTO/NORMAL/
  DESTAQUE), noticias (NORMAL com manchete / COMPACTO), aeroportos, ferramentas (atalhos
  Preciso de… · Ferramentas · Loja). Protegidos fora do sistema: topo (saudação/frase/clima),
  botões Personalizar e Meu Buddy, barra inferior.
- Composição: tiles consecutivos do mesmo grupo viram grade 2×2 (ímpar no fim ocupa a
  largura); linhas consecutivas viram um cartão de lista; rótulo de seção quando o grupo muda.
- Reordenar: alça ≡ (PanResponder — toque e mouse) e ↑/↓ (+ ações de acessibilidade).
- Presets: Equilibrado (padrão), Minha rotina, Carreira, Minimalista — só ordem/visibilidade/
  tamanhos; depois tudo é editável. "Restaurar layout padrão" não mexe em saudação, clima,
  nem em dado nenhum.
- Prefs carregam junto com os dados (um Promise.all) → sem cards trocando de lugar.
  Vagas/Notícias só buscam rede se o módulo estiver visível.
- Ocultar card ≠ desligar acontecimentos/lembretes (Buddy Agora calcula com todos os dados).
- Saudação (`saudacoes.ts`): Bom dia (5–11h) / Boa tarde (12–17h) / Boa noite; nome = apelido
  de Meu Buddy (sem segunda preferência). Estilos Parceiro, Direto, Motivacional, Discreto.
  Frase do dia: 96 frases editoriais locais; índice = dia local % tamanho do pool (estilo +
  período) → muda todo dia e só repete após percorrer a lista. Sem IA, sem religião/política.
- Clima: o mesmo Open-Meteo de antes (`src/weather.ts`, cidade escolhida à mão, cache 30 min).
  `frescorClima`: ≤ 1 h atual; ≤ 6 h "às HH:MM"; mais antigo → só a cidade ("clima sem
  atualização recente"). É clima urbano — nunca meteorologia offshore/operacional.
- Buddy+ (futuro): `DefModulo.plano` existe; no 1.0 tudo é 'free'. Candidatos: temas, estilos
  visuais, widgets, presets extras, sincronização entre aparelhos. Nada bloqueado agora.

### Privacidade e analytics
- Datas, pessoa, relação, empresa, regra, viagem, layout: só no aparelho; não sincronizam.
- Analytics (console, sem envio) só com tipo/ação: event_created/updated/deleted (event_type),
  payment_rule_configured (regra/ajuste/aviso), transport_opened (serviço, com_destino),
  gift_ideas_opened, preciso_de_opened, proximos_opened, home_* , greeting_style_changed,
  daily_phrase_toggled, weather_enabled/disabled. Nunca nome, pessoa, título, obs, cidade.

### Limitações conhecidas
- 99 sem destino pré-preenchido (sem integração oficial). Uber sem `client_id` próprio.
- Feriados só nacionais; estaduais/municipais e Carnaval não entram no "dia útil".
- Destino do Uber só para aeroportos da tabela e base da escala; texto livre não é geocodificado.
- Notificações nativas, link universal da Uber abrindo o app e loja da 99: validar no APK RC.


## Premium Material Pass (2026-10-20)

Camada só visual: nenhuma rota, dado, ordem de módulo ou regra mudou. Commit isolado, tag de antes: `owbuddy-pre-premium-material`.

- **Linguagem:** preto azulado, navy profundo, grafite azulado, cinza frio e branco frio. O ciano OW (`#12a8ee` / `#5fc4ee`) é **acento**: ação, aba ativa, seleção, estado. Não é cor de área nem de título.
- **Tokens:** `src/theme.ts` → `tone`. Os nomes antigos (`colors`, `surface`, `maritime`) foram mantidos e apontam para `tone`.
- **Três níveis:**
  - N0 fundo: `bg0..bg3`, `#02090f` → `#061a26`;
  - N1 superfície: `surface` `#0a1923`, card `maritime.glass`;
  - N2 elevada: `elevated` `#0d2130`, card da escala, `glassElevated`.
  - Recuado: `sunken` `#050f17` (campos e trilhos).
- **Material:**
  - aresta superior clara (`edgeLight`) e inferior escura (`edgeDark`);
  - reflexo frio só no topo (`sheenGradient`, some até 60%);
  - sombra profunda e difusa (`cardShadow` 0/8/18, 0,34);
  - nada de blur nem textura.
- **Bordas:** `borderSubtle` 0,10 e `border` 0,16 (frio); destaque `accentBorder` 0,30; ativo `borderActive` 0,42.
- **Texto:** primário `#f2f6f8`, secundário `#91a5b2`, terciário `#8296a7`, ênfase de dado `#c4d1da`. Contraste mínimo de 4,89:1 em todos os níveis, inclusive sobre N2.
- **Pastilhas de ícone:** neutras (`iconTile`); o ícone leva a cor. Ações secundárias usam material escuro, borda sutil e rótulo ciano. A ação primária continua ciano sólido.
- **Campos:** fundo `sunken` e borda `fieldBorder`. No web há foco ciano e halo fino, via regra CSS única injetada em `app/_layout.tsx`. No nativo vale o foco do sistema.
- **Nav inferior:** `navBg` preto azulado, linha superior fina (`edgeLight`), sombra difusa, sem glow; ativo ciano, inativo cinza azulado.
- **Cabeçalhos de Stack:** sem a linha clara padrão (`headerShadowVisible: false`); a separação é tonal.
- **Marca-d'água:** Buddy só na Home, tom frio-acinzentado com opacidade 0,055 (gravação no material).
- **Cores funcionais mantidas:** EMB/embarcado verde, DEB âmbar, dobra, férias, feriado, eventos, Uber branco e Loja.

**Para reverter só esta camada:** `git revert <commit do premium pass>`. O que entrou depois continua.

## Cruzar Escalas 2.1 — gerenciamento (2026-10-20)

- `Escala → Cruzar` abre **Escalas cruzadas** (`app/escala-cruzar.tsx`): por pessoa mostra ícone, nome, relação · ciclo, próximo embarque, folgas em comum e as ações **Editar / Ocultar|Mostrar / Excluir**; no fim, **Cruzar outra escala**.
- Editar reutiliza `app/escala-secundaria-form.tsx` e grava no **mesmo id** (`salvarEscalaSecundaria`). A posição na lista é mantida. A relação ganhou **Cunhado/a**, e o texto livre continua preservado. O ícone escolhido não é trocado ao mudar a relação. A data é "Data de referência da escala" (Embarque/Desembarque) e mostra uma prévia do próximo embarque.
- `EscalaSecundaria.oculta?: true` esconde a pessoa do calendário sem apagar dados. Ausente quer dizer visível, então dado antigo não precisa de migração.
- Calendário: a célula com folga em comum ganha o ícone da pessoa (2+ pessoas: `people`) na linha de ícones já existente, sem mudar o tamanho. A legenda mostra **Juntos**. O detalhe do dia lista cada pessoa visível com o estado real (`cruzamentosDoDia`), com **Editar** e **Ver escalas cruzadas**. No hub há a seção "Escalas cruzadas" com **Gerenciar**.
- Matemática: sempre `secundariaParaConfig` + `estaLivreNoDia` / `encontrarJanelasJuntos` (`packages/ow-domain/src/escala-cruzar.ts`). Sua escala principal nunca é gravada por estas telas.
- Emoji antigo salvo (🤝, ❤️, 🤜🤛…) continua salvo e é exibido como ícone vetorial (`src/relacao-icones.ts`, mapa LEGADO). O `🤝 CRUZAR ESCALAS` visto em print é da página **OWNews web /minha-escala** (`worker.js`), que não foi alterada nesta missão.
- Testes: `apps/owbuddy/tests/cruzar.test.mjs`.

## Premium Dark / Light / Auto (2026-10-20)

Aparência escolhida pelo usuário: **Automático** (padrão para todos, inclusive quem já usava o app — não havia preferência salva antes), **Escuro** ou **Claro**. A identidade continua sendo o escuro premium; o claro é o mesmo design system com outro material, não uma inversão. Tag de antes: `owbuddy-pre-dark-light`.

- **Onde trocar:** Meu Buddy (ícone de pessoa na Home) → primeira seção **Aparência**. Vale na hora, sem Salvar.
- **Arquitetura (`src/theme.ts`):**
  - `TOKENS_POR_TEMA.escuro|claro` — tokens semânticos (`background`, `surface`, `surfaceElevated`, `textPrimary`…, `accent`, `onAccent`, `success/warning/danger/info` + `*Soft`, `overlay`, `navigation*`, `input*`, `controlBorder`, `calendar*`, `evento*`, `brandUber*`).
  - Material por tema (gradientes, sombra, aresta, nav, marca-d'água) em `MATERIAL_ESCURO|CLARO`.
  - As camadas antigas (`colors`, `tone`, `surface`, `maritime`, `typography`, `elevation`) continuam com os mesmos nomes; `aplicarTema()` troca os valores **no lugar** (substitui objetos aninhados, nunca muta — o `StyleSheet.create` congela o que recebe).
  - `themed(() => StyleSheet.create({...}))` monta uma folha por tema (cache) — **toda** folha de estilo e mapa de cor de módulo usa isso.
  - `colors.white` = texto primário do tema (nome histórico). Texto/ícone sobre botão primário = `colors.onAccent` (nunca `navy950`).
- **Troca em tempo real (`src/tema.tsx`):** `TemaProvider` (em `app/_layout.tsx`) resolve o tema (`src/aparencia.ts` → `resolverTema`), aplica os tokens antes de renderizar e avisa pelo contexto. **Todo componente com estilos chama `useTema()` na primeira linha** (teste em `tests/aparencia.test.mjs` cobra). Em Automático segue `useColorScheme()` ao vivo.
- **Navegação:** `ThemeProvider` do expo-router com as cores do tema (fundo atrás das transições e dos modais).
- **Web:** `public/index.html` lê `owbuddy_aparencia` + `prefers-color-scheme` antes do JS (sem flash); `theme-color` e o fundo do documento seguem o tema.
- **Contraste:** testado por token (≥ 4,5:1 para texto primário, secundário, muted, acento, status e números do calendário, nos dois temas). O azul OW do claro é mais profundo (`#086aa0`) para ler sobre branco; mesmo matiz do ciano do escuro (`#14a9ec`).
- **Uber:** botão da marca branco no escuro e preto no claro (`brandUber*`).

### Nativo — validar no APK RC (o preview web não cobre)
- `app.json`: `userInterfaceStyle` passou de `dark` para `automatic` (precisa de **novo build nativo**). Sem isso o Android/iOS reportam sempre escuro e o Automático fica escuro.
- Barra de status: `expo-status-bar` com `style` do tema efetivo (ícones claros no escuro, escuros no claro).
- Splash: continua escuro nos dois temas (o Buddy do splash é branco). O app segura o splash até ler a aparência (`SplashScreen.preventAutoHideAsync` + `hideAsync`, rede de segurança de 2,5 s), então não pisca o tema errado depois do splash.
- Barra de navegação do Android (gestos/botões) não é controlada (exigiria `expo-navigation-bar`, nativo).
- Alertas nativos (`Alert`) seguem o tema do sistema, não a escolha forçada no app.

### Testes
- Unitários: `apps/owbuddy/tests/aparencia.test.mjs` (preferência, migração, tokens, contraste, troca, telas sem hex).
- Preview web (Playwright, fora do `npm test`): `tests/e2e/aparencia-preview.cjs` (fluxo Automático/Escuro/Claro, sistema mudando, persistência, dados intactos, 320–430 px) e `tests/e2e/rc-preview.cjs` (suíte RC, datas relativas a hoje).

**Para reverter só esta camada:** `git revert <commit do dark/light>`.

## Configuração de Escala 2.0 (2026-10-24)

- **Bug do teste real:** "embarque 16/10" configurado em 24/10 virava "embarquei hoje". A matemática (`calcEscalaISO`) sempre esteve certa; o defeito estava no `OWDatePicker`:
  - `scrollToIndex` com `viewPosition: 0.5`, somado ao padding de 2 linhas, mostrava o seletor 2 itens deslocado. Abria em "22 Ago 2024" enquanto o estado era 24 Out 2026.
  - Na web, a seleção só mudava em `onMomentumScrollEnd`, que não dispara. O OK salvava o dia inicial (hoje).
- **Correção:**
  - o offset é calculado por `i * ITEM_H`;
  - a seleção acompanha `onScroll`;
  - a rolagem programática é ignorada como gesto;
  - as colunas só montam depois de sincronizar a abertura.
- **Regras puras** (testáveis) ficam em `src/data-seletor.ts`:
  - sem valor salvo, abre em hoje LOCAL;
  - com valor salvo, abre no valor;
  - anos de −8 a +10, sempre incluindo o ano salvo.
- **Tela `escala-config`:**
  - perguntas "Qual é a sua escala?", "Qual data você sabe?" e "Quando foi seu último embarque?";
  - resumo `confirmacaoEscala()` (domínio, regra canônica) antes de "Confirmar escala";
  - nada é gravado antes disso;
  - data futura é aceita (pode ser o próximo embarque) e sinalizada.
- **Home** (`contextoHome`):
  - Dia 1: "Hoje é dia de embarque";
  - Dia 2: "Você embarcou ontem";
  - depois disso: "Você está embarcado";
  - folga Dia 1: "Hoje é dia de desembarque".
- **Saudação:** `saudacaoTopo(agora, estilo, nome, trat)`. Nos estilos Parceiro/Motivacional entra um vocativo do dia (`VOCATIVOS`). O feminino tem lista menor e nunca usa "amiga".
- **Testes:**
  - `tests/escala-config-2.test.mjs`;
  - preview: `tests/e2e/escala-config-preview.cjs` (relógio fixo em 24/10/2026).

## Auditoria final pré-RC + Companheiro offshore (2026-10-24)

Checkpoint antes: tag `owbuddy-pre-auditoria-rc`. Nada de APK nesta rodada.

**Correções (P0/P1)**
- Mala zerava na MANHÃ do embarque (alvo era o próximo embarque já no Dia 1). Agora `cicloAlvoChecklist(resumo)` = hoje no Dia 1, próximo embarque a partir do Dia 2; `sincronizarChecklistComCiclo(lista, alvo, hoje)` só reseta quando o embarque da lista JÁ PASSOU. Escala editada só re-chaveia; relógio para trás nunca apaga marcações; lista sem ciclo adota o alvo sem desmarcar.
- Web: `Alert.alert` não existe no navegador → Salvar/Remover de Certificados e Viagem eram botões mortos no preview. Erros agora inline; exclusões via `confirmar()`.
- Toque duplo: `useAcaoUnica` (src/acoes.ts) em todo Salvar/Confirmar; ids com sufixo aleatório; item de mala repetido não duplica.
- Android Voltar fecha os formulários internos de Certificados e Viagem (`useVoltarAndroid`). Modais já usam `onRequestClose`.
- Build RC: `expo-network` estava por engano no package.json da RAIZ e puxava react 19.3.0 duplicado (era o erro do expo-doctor/APK). Removido; `overrides` react/react-dom 19.2.3 na raiz; patches do SDK 57 alinhados (`expo install --fix`); flag redundante de symlinks saiu do metro.config. `expo-doctor`: 21/21.
- Conta OW: "Excluir minha Conta OW" abre e-mail de pedido para suporte@ownews.com.br (o app não apaga conta sem backend — ver pendências). Seção "Privacidade e dados": política + "Apagar dados deste aparelho" (só chaves `owbuddy_*`/`ownews_*`, confirmação explícita). Sair ≠ apagar dados ≠ excluir conta.
- Conectividade reage na hora (listener do expo-network + eventos online/offline na web).

**Padrões de UX (aprender uma vez)**
- Adicionar: botão visível no topo/fim da lista + estado vazio com a ação.
- Editar: tocar no item abre a edição (mala: ⋯ abre o painel do item; o toque marca/desmarca).
- Excluir: dentro da edição, palavra "Excluir" em todo o app, com confirmação curta.
- Voltar: cabeçalho com "<" nos formulários internos + Cancelar + Voltar do Android.
- Feedback: faixa discreta `avisar()` (src/feedback.tsx): "Salvo", "Atualizado", "Excluído".

**Funções aprovadas**
- Mala inteligente (aba Embarque): "Usar em todos os embarques" ao criar/editar (desmarcado = `rec:false`, sai no próximo ciclo); progresso "N de M itens prontos" / "Mala pronta".
- Documentos (aba Certificados, mesma chave `ownews_certificados`): `tipo` (Certificado, Passaporte, CNH, ASO, Outro) + `aviso_dias` (7/15/30/60/90, padrão 30). Sem foto/número. Dado antigo sem `aviso_dias` mantém a janela de 90 dias.
- Onde preciso estar? (`src/onde-estar.ts`): véspera/dia da viagem já cadastrada; só campos preenchidos; base da escala no dia do embarque; Abrir no mapa (`geo:` Android, Apple Maps iOS, Google Maps web; aeroporto conhecido usa coordenadas da tabela; texto vira busca — sem geocodificar).
- Contatos do embarque (aba Viagem, `owbuddy_contatos_embarque`, só local): Ligar (`tel:`) e WhatsApp (`wa.me`, sem mensagem).
- Falta quanto pra casa? (`faltaPraCasa`): "Faltam 6 dias pra casa" / "Mais 9 dias em casa" — derivado, nunca persistido.
- Compartilhar escala (aba Escala → "Compartilhar minha escala"): imagem do mês via `mesCompartilhado()` (só o ciclo). Nativo: react-native-view-shot + expo-sharing (menu do sistema). Web: Web Share com arquivo ou download do PNG.

**Retenção contextual (ciclo = loop)**: Home muda prioridade/cópia, não layout: 3 dias antes → linha Viagem + Documentos; véspera/dia → card "onde preciso estar" (dia: acima do card da escala); embarcado → Dia N + "Faltam N dias pra casa"; desembarque → "Desembarque hoje · 14 dias embarcado concluídos"; dia seguinte → "Primeiro dia em casa". Lembretes da véspera viram UM aviso (embarque + voo + mala). Sem streak, pontos ou notificação de "volte ao app".

**Testes**: `tests/companheiro.test.mjs` (29) + `tests/e2e/companheiro-preview.cjs` (jornada completa no navegador, relógio 24/10/2026).

## Conta OW: exclusão real + privacidade (Play Store, 2026-10-24)

- **Bug confirmado**: o OWNews web chamava `DELETE /auth/v1/user` com o token do usuário — o Supabase Auth não oferece isso (só a API admin apaga usuário), então caía sempre em "Contate suporte@ownews.com.br". E **ownews.com.br tem MX nulo** (`0 .`): nenhum e-mail @ownews.com.br é recebido — o mailto do app 1.0 ia para o vazio.
- **Exclusão real**: página pública `https://ownews.com.br/excluir-conta` (instruções sem JS e sem login; formulário e-mail + senha) → `POST /api/conta/excluir` (front, repassa SÓ o Authorization) → coletor `shrill-pond-a915` `POST /conta/excluir` (único lugar com `SUPABASE_SERVICE_ROLE_KEY`). O coletor: pré-valida o JWT sem rede (formato, exp, iss, role, `amr` password ≤ 10 min), confirma o usuário em `GET /auth/v1/user` e apaga `admin/users/{id do token}`. Nada do corpo/URL é usado — A nunca apaga B. Teste: `shrill-pond-a915-fix/tests/conta_exclusao_test.js`.
- `/admin/conta-teste` (admin token) cria contas confirmadas SÓ `owbuddy-teste-*@example.com`, para validar em produção.
- App: "Excluir minha Conta OW" abre a página pública (não mais mailto). Minha Escala web: botão leva à página.
- `/privacidade` reescrita com seção OWBuddy (#owbuddy) e exclusão (#exclusao) conforme o código real; mapa Data Safety no relatório da missão.

## Meu Histórico (2026-10-24)

**Escala = planejado. Histórico = realizado.** Nada do Histórico grava na escala, e a escala nunca vira histórico sozinha.

- Regras puras: `packages/ow-domain/src/historico.ts`. Telas: `/historico` (lista por ano), `/historico-registro?id=` (registro + LINHA DO TEMPO), `/historico-form` (`?sugestao=1` revisão do ciclo atual, `?id=` edição, `&finalizar=1` desembarque), `/historico-acontecimento?registro=&id=`. Avisos compartilhados: `src/components/HistoricoAvisos.tsx`; ações: `src/historico-acoes.ts`.
- **Entrada**: aba Escala → linha "Meu Histórico" logo abaixo da barra de ações (sem sexta aba; a barra de 5 ações não comporta mais um item em 320 px). Também no estado "sem escala" da aba.
- **Duração** (mesma convenção da escala): `desembarque − embarque` — 16/10 → 30/10 = 14 dias (Dia 1 = 16, Dia 14 = 29). Em andamento: "Dia N registrado" = dias desde o embarque REAL + 1 (independe do Dia N da escala). Ano = ano do embarque.
- **Sugestão** (`sugestaoCicloAtual`): só o ciclo atual (embarcado) ou o que terminou há ≤ 7 dias; some se já há registro a ±4 dias ou outro em andamento. NUNCA cria registros de ciclos passados calculáveis. A revisão mostra "O Buddy já sabe" (datas previstas, Minha Viagem do ciclo — marcada, base/aeroporto da escala — desmarcada) e o usuário confirma/corrige.
- **Previsto ≠ realizado**: `previsto {embarque, desembarque}` é uma foto do planejado no momento do registro. Data futura pede confirmação ("Essa data ainda não chegou."): embarque futuro → registro `planejado` (fora das estatísticas, sem Embarque automático); desembarque futuro → vira desembarque previsto e o registro segue em andamento. Acontecimento futuro → "Planejado" até a pessoa marcar "Aconteceu".
- **Finalização**: desembarque previsto chegou → Home mostra UM aviso ("Registrar hoje / Alterar data / Agora não"; atrasado: "Confirmar 30/10 / Escolher outra data"). "Agora não" adia para amanhã (no dia) ou 3 dias (atrasado). Próximos dias mostra a mesma ação como linha. Sugestão de registrar o embarque atual só na Home nos dias 1–3 do embarque; depois de 2 sugestões dispensadas a Home para de sugerir (a tela do Histórico continua).
- **Linha do tempo**: data → horário → ordem de criação (`seq`). Sem horário: Desembarque abre o dia; Hotel, Embarque e Casa fecham; os demais ficam após os com horário, em ordem de criação. Antes do embarque e depois do desembarque entram normalmente. Embarque/Desembarque são acontecimentos automáticos (`auto`) mantidos pelo registro (sem duplicar; editar a data deles corrige o registro). Dobra só quando a pessoa escolhe "Registrar como dobra" (desembarque depois do previsto) — sem inferir causa. "Transferido" é um tipo próprio (nunca "cancelado").
- **Importar Minha Viagem**: copia só trajeto (tipo, data, hora, origem, destino, nº do voo) — sem localizador, assento ou observação. Deduplicação por `importadoDe`.
- **Duplicidade/sobreposição**: aviso "Revisar / Salvar mesmo assim" (não bloqueia). Duplo toque: id criado na abertura do formulário + `useAcaoUnica` + `alterarHistorico` em fila.
- **Privacidade**: local-first. `sync.ts` não conhece o Histórico; analytics só `historico_aberto`, `embarque_registrado/editado/excluido`, `acontecimento_registrado/editado/excluido` com `origem` literal ou o tipo do acontecimento. "Apagar dados deste aparelho" apaga (prefixo `owbuddy_`); Sair e Excluir Conta OW não. `/privacidade` continua correta (tudo que se cadastra no OWBuddy fica no celular; o Histórico não está na lista do que sincroniza).
- **Futuro (estrutura pronta, não implementado)**: exportação PDF/CSV/backup, tempo por função/unidade, relatório pessoal. Não é documento oficial.
- **Correção junto**: `OWTimePicker` posiciona por offset (como o `OWDatePicker`) e renderiza as 24/60 linhas — no navegador as horas antes da inicial (00–07) não eram desenhadas. `OWDatePicker` ganhou `anosAtras` (Histórico usa 40 anos).
- Testes: `tests/historico.test.mjs` (31) + `tests/e2e/historico-preview.cjs` (jornada completa, 320–430 px, escuro e claro).

## OWBuddy Free + OWBuddy+ (2026-10-25)

Documento completo: `docs/OWBUDDY-PLUS.md` (arquitetura, Free × Plus, expo-iap, offline, privacidade, termos,
checklists Play Console / App Store Connect, modo de teste).

- Uma camada só: `useOwBuddyPlus()` (`src/plus/acesso.tsx`) + regras puras `ow-domain/plus.ts`. Telas Plus
  envolvidas por `<PortaoPlus recurso=…>` (Embarque, Viagem, Certificados, Histórico×4, contato-form).
- Assinatura e período gratuito SÓ da loja (expo-iap ~6.3.0: Play Billing + StoreKit 2, sem servidor/terceiro).
  Produto `owbuddy_plus_monthly` (anual `owbuddy_plus_annual` reservado). Nada criado nas lojas ainda.
- Sem Plus, Início/Buddy Agora/lembretes usam `recorteFree()`; dados Plus nunca apagados.
- Modo de teste: `__DEV__` ou web exportado com `EXPO_PUBLIC_OWBUDDY_PLUS_TESTE=1` (export com `--clear`).
  Nunca em build nativo de produção.
- Não alterar sem auditoria: IDs de produto, `PortaoPlus` (não montar tela Plus sem acesso), carência offline
  de 7 dias, regra "grátis só se a loja disser que é elegível".
