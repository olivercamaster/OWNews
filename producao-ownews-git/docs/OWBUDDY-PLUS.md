# OWBuddy Free + OWBuddy+ — assinatura (2026-10-25)

Status: arquitetura e UX prontas e testadas no preview com loja SIMULADA. **Nenhum produto criado nas lojas,
nenhuma cobrança real, nenhum APK/AAB gerado.** Próximos passos: configurar as lojas (checklists abaixo) → RC.

Princípio: o usuário sabe ANTES de qualquer compra o que é Free, o que é Plus, quanto custa, quando começa a
pagar, que renova, como cancelar, que o Free continua e que nada é apagado. Sem trial local, sem preço escrito
à mão, sem compra automática, sem urgência.

## 1. Arquitetura

```
UI (telas)            →  useOwBuddyPlus()  →  { plus, lido, acesso, produto, comprar, restaurar, gerenciar }
                              │  src/plus/acesso.tsx  (uma camada só; estado em módulo + useSyncExternalStore)
regras puras          →  @owbuddy/domain/plus.ts  (resolverAcessoPlus, produtoAndroid/IOS, ofertaTexto, recorteFree…)
loja (uma de três)    →  src/plus/loja.ts → lojaPlus()
                              ├─ loja-nativa.ts   Google Play Billing / StoreKit 2 via expo-iap (Android/iOS)
                              ├─ loja-teste.ts    cenários simulados (SÓ modo de teste)
                              └─ lojaIndisponivel web sem modo de teste (não vende nada)
```

- Entitlement único: `OWBUDDY_PLUS`. A UI só pergunta `plus` (true/false).
- Estados: `carregando` | `plus` | `free` | `erro` (+ `expirou`, `cancelado`, `pendente`, `fimDoPeriodo`, `motivoErro`).
- Portão: `src/components/PortaoPlus.tsx` envolve as telas Plus. Sem acesso a tela **nem monta** (nada é lido
  para edição, nada é gravado, nada é apagado) e mostra: recurso, benefício, "Seus N … continuam guardados",
  situação (terminou / pagamento pendente / não foi possível confirmar), **Conhecer OWBuddy+** (abre a tela
  informativa, nunca a compra) e **Agora não**.
- Tela `/owbuddy-plus` (modal): situação, o que o Plus libera, oferta da loja, aviso de cobrança imediatamente
  acima do botão, renovação, cancelamento, Free continua, dados não são apagados, Restaurar compras,
  Gerenciar assinatura, Continuar no Free, o que continua Free, Conta OW não é necessária, Termos/Privacidade.
- Meu Buddy → linha "OWBuddy+" com a situação. Nenhuma tela abre o paywall sozinha.

### Free × Plus

| Free (continua igual) | OWBuddy+ |
|---|---|
| Minha Escala, calendário, cálculo, contagem, dobra/férias, Cruzar escalas, eventos pessoais | Mala inteligente (aba Embarque) |
| Início contextual (com o recorte Free), clima, Buddy (voz, tom, apelido, personalização) | Minha Viagem / logística (aba Viagem) |
| Compartilhar escala | Documentos e vencimentos (aba Certificados) |
| Notícias, Vagas, Unidades, Aeroportos, Ferramentas, Meu Pagamento, Preciso de…, Loja | Meu Histórico + linha do tempo + estatísticas |
| Buddy Agora básico (escala, lembretes pessoais, pagamento) | Contatos de embarque |
| Lembretes de escala, eventos e pagamento | Buddy Agora completo + lembretes de mala, viagem e documentos |

Personalização do Buddy ficou **Free** (decisão conservadora: não degradar o básico). As 5 abas continuam;
Embarque/Viagem/Certificados abrem o portão quando sem acesso.

Sem Plus, Início, Buddy Agora e lembretes usam `recorteFree()` (mala/viagem/documentos fora do CÁLCULO).
Os dados continuam nas mesmas chaves; ao reassinar tudo reaparece, sem migração.

## 2. Biblioteca escolhida: `expo-iap` ~6.3.0

- **Por quê:** recomendada na doc do Expo (guia In-app purchases, ao lado de RevenueCat); módulo Expo com
  config plugin (CNG), Android Billing + StoreKit 2; **sem servidor e sem terceiro**: a conversa é só
  aparelho ↔ Google/Apple. Mantém o OWBuddy "local-first" e a política de privacidade atual verdadeira.
- **Compatibilidade auditada:** peer `expo: *`, devDeps da própria lib em `expo ^57`, iOS 13.4+, Android
  minSdk do app; instalada com `npx expo install` (adicionou 1 pacote, 0 dependências); plugin `expo-iap` no
  app.json. Não funciona no Expo Go (precisa de build EAS/dev build, que já é o caso).
- **Custo:** zero (MIT). Não usamos IAPKit/verificação paga (`verifyPurchaseWithProvider` proibido por teste).
- **Chaves:** nenhuma. Nada de segredo no bundle (teste estático).
- **Alternativa avaliada:** RevenueCat (`react-native-purchases`) — validação no servidor e painel, mas adiciona
  um processador de dados (ID anônimo, recibos, IP/aparelho) e muda Data Safety/App Privacy e a política;
  gratuito até um teto de receita mensal e depois percentual (confirmar no site deles). Não necessário agora;
  a camada `LojaPlus` permite trocar sem mexer nas telas.
- **Limite conhecido (sem servidor):** a validação é a do aparelho (StoreKit 2 verifica a assinatura JWS; no
  Android vale o que o Play Billing devolve). Aparelho com root pode burlar — risco aceito para o valor do
  produto. Evolução possível: verificar no Worker do OWNews via Google Play Developer API / App Store Server
  API (credenciais só no servidor).

### Comportamento na loja real (loja-nativa.ts)

- Ativo = Android: compra `purchased` do produto (Play devolve só assinaturas ativas, incluindo canceladas ainda
  no período pago; suspensas não). iOS: `getActiveSubscriptions` (`isActive`, `willAutoRenew`, `expirationDateIOS`).
- Compra concluída é confirmada (`finishTransaction` = acknowledge no Android; senão a Google estorna em 3 dias).
  Compras sem confirmação encontradas ao consultar são confirmadas na hora.
- Pagamento pendente (boleto etc.) **não libera**; a tela explica.
- Período gratuito: Android = só se a Play devolver uma oferta cuja 1ª fase custa 0 e depois vira o preço
  base (a Play só devolve ofertas elegíveis). iOS = só se `isEligibleForIntroOfferIOS(grupo) === true` e a
  oferta introdutória for `free-trial`. Elegibilidade desconhecida → não promete grátis. Oferta com preço
  promocional PAGO é ignorada.
- Preço/periodicidade: texto da loja (`formattedPrice`/`displayPrice`), período da loja. Dados incompletos →
  "Não foi possível consultar o OWBuddy+ agora." (nunca preço inventado).
- Datas: "Próxima renovação"/"Ativo até" só quando a loja informa (iOS). Android no app: sem data.
- Gerenciar: `deepLinkToSubscriptions` (Play: página da assinatura do pacote; iOS: gestão do sistema);
  fallback para a central de assinaturas da loja.
- Restaurar: `restorePurchases` + nova consulta → encontrada / nenhuma / offline / erro.
- Duplo toque/duplicidade: botão de ação única; compra em andamento bloqueia outra; já assinante → não compra.

## 3. Offline, loading e erro

- Cache `owbuddy_plus_cache` = última resposta CONFIRMADA da loja `{v:1, plus, conferidoEm, fimDoPeriodo,
  jaTevePlus}`. Não é trial, não guarda token, recibo nem preço. Só é escrito quando a loja responde.
- Sem resposta da loja: quem a loja confirmou como Plus continua Plus por até **7 dias** desde a última
  confirmação (`CARENCIA_OFFLINE_DIAS`). Nunca vale para quem era Free. Passou disso → "não foi possível
  confirmar" (sem dizer que acabou).
- Abertura: a última confirmação é lida antes de pintar (Início espera; telas Plus mostram só um indicador
  discreto) → sem "cadeado → libera → cadeado". Primeira abertura sem cache: `carregando` (nem libera nem tranca).
- Reconsulta ao voltar para o app (no máx. 1×/min) e após compra/restauração.
- "Apagar dados deste aparelho" apaga o cache (a assinatura continua na loja; a próxima consulta restaura).

## 4. Conta OW

Não é necessária para assinar: a identidade de compra é a conta da loja. Nada da assinatura vai para
Supabase/sync (teste estático). Consequência honesta: Plus não "atravessa" Android ↔ iPhone (lojas
diferentes); em outro aparelho da mesma loja, "Restaurar compras".

## 5. Privacidade

- O app não coleta dado novo. A compra é processada pela Google Play / App Store; o OWBuddy não recebe cartão
  nem dados de pagamento, não envia recibo/token a servidor algum e guarda no aparelho só o cache acima.
- Analytics (hoje só console em dev): `plus_tela_aberta{origem}`, `plus_bloqueio_visto{recurso}`,
  `plus_agora_nao{recurso}`, `plus_cta_tocado{com_periodo_gratuito}`, `plus_compra_resultado{resultado}`,
  `plus_restaurar_resultado{resultado}`, `plus_gerenciar_aberto` — valores fixos; nunca preço, moeda,
  token, recibo, pedido ou conta (teste).
- **Política de privacidade (/privacidade):** NÃO alterada nesta missão (a assinatura ainda não existe nas
  lojas). Ao publicar o Plus, acrescentar (texto proposto):
  > "Assinatura OWBuddy+: a compra, a renovação e o cancelamento são feitos pela Google Play ou pela App Store,
  > com a sua conta da loja. O OWBuddy não recebe dados do seu cartão nem do pagamento. Para liberar os
  > recursos, o app consulta a loja e guarda neste aparelho apenas se o OWBuddy+ está ativo e quando isso foi
  > confirmado. Se a assinatura terminar, nenhum dado seu é apagado."
- **Google Play Data Safety:** sem novo tipo de dado coletado pelo app. Dados de compra processados pelo
  sistema de faturamento da Google Play não precisam ser declarados pelo app (confirmar no formulário no
  momento do envio). Manter a declaração atual.
- **Apple App Privacy:** o app não coleta "Purchases"/"Purchase History" (StoreKit é da Apple; nada vai a
  servidor nosso ou de terceiro). Manter "Data Not Collected" para compras (confirmar no questionário).

## 6. Termos (pendência)

- `https://ownews.com.br/termos-de-uso` é do portal e **não cobre o OWBuddy nem assinatura**.
- Apple (guideline 3.1.2): app com assinatura auto-renovável precisa de link funcional para **Termos de Uso
  (EULA)** e **Política de Privacidade** no app e nos metadados. Enquanto não houver termos próprios, a tela
  mostra no iOS o **EULA padrão da Apple** (`URL_TERMOS_OWBUDDY = null` em `app/owbuddy-plus.tsx`).
- Pendência do dono: termos de uso do OWBuddy (assinatura, renovação, cancelamento pela loja, Free contínuo,
  dados locais) revisados juridicamente; depois preencher `URL_TERMOS_OWBUDDY`.

## 7. Google Play Console — configuração pendente (Oliver)

Pré-requisitos:
1. Perfil de pagamentos (merchant) ativo na conta de desenvolvedor.
2. O Console pode exigir um AAB **com a biblioteca de faturamento** já enviado a uma faixa (teste interno)
   antes de liberar a criação de produtos ("add the BILLING permission"). O expo-iap adiciona a permissão pelo
   manifesto da biblioteca. Se bloquear: gerar o AAB do RC e enviar SÓ para teste interno (não publicar).

Assinatura (Monetizar → Produtos → Assinaturas):
- **ID do produto:** `owbuddy_plus_monthly` (permanente; não pode ser reutilizado nem se excluído).
- **Nome:** OWBuddy+ · benefícios (até 4 linhas curtas, ex.: Mala inteligente, Viagem e documentos, Meu Histórico, Buddy Agora completo).
- **Plano básico:** ID `monthly` (minúsculas, números, hífen), renovação automática, período de cobrança 1 mês,
  preço em BRL definido pelo dono (o app NÃO tem preço no código; mostra o que a Play devolver),
  países/regiões de disponibilidade, período de carência e suspensão de conta (padrão da Play).
- **Oferta de teste gratuito (opcional):** no plano `monthly`, ID por ex. `trial-1m`, elegibilidade
  "Aquisição de novos clientes" (nunca teve esta assinatura), fase "Teste sem custo" com a duração escolhida
  (ex.: 1 mês). O app só mostra "grátis" se a Play devolver essa oferta para a pessoa.
- **Anual (futuro):** produto `owbuddy_plus_annual` já reservado no app; criar só quando decidido.
- Ativar o produto e o plano.
- **Testes:** Configuração → Teste de licença: adicionar contas Gmail testadoras (compras de teste sem
  cobrança, renovação acelerada). Instalar pela faixa de teste interno. NUNCA testar com cartão real.
- **Política:** página da assinatura e textos já seguem a política de assinaturas (preço, período, renovação,
  como cancelar antes da compra). Data Safety conforme seção 5.

## 8. App Store Connect — configuração pendente (Oliver)

Pré-requisitos: contrato **Paid Apps** assinado (Business/Agreements, Tax and Banking) com dados bancários e fiscais.

App → Monetização → Assinaturas:
1. **Grupo de assinaturas:** nome de referência "OWBuddy+"; localização do grupo (pt-BR): nome exibido "OWBuddy+".
2. **Assinatura auto-renovável:** nome de referência "OWBuddy+ mensal"; **Product ID `owbuddy_plus_monthly`**
   (permanente); **duração 1 mês**; disponibilidade (países); **preço** (escolhido pelo dono no quadro de preços).
3. **Localização (pt-BR):** nome exibido e descrição curta (ex.: "Mala, viagem, documentos, histórico e Buddy Agora completo").
4. **Oferta introdutória (opcional):** tipo **Teste gratuito**, duração escolhida (ex.: 1 mês), países e
   início. O app só promete o grátis se a App Store disser que a pessoa é elegível.
5. **Informações para revisão:** captura da tela OWBuddy+ e nota ao revisor (como chegar: Meu Buddy → OWBuddy+
   ou tocar em Embarque; Restaurar compras e Gerenciar assinatura ficam na mesma tela).
6. **Primeira assinatura** precisa ser enviada junto com uma versão do app (na página da versão, seção
   "Compras no app e assinaturas").
7. Metadados da versão: links de **Política de privacidade** e **Termos de uso (EULA)** — ver seção 6.
8. **Testes:** usuários Sandbox (Usuários e acesso → Sandbox) e/ou TestFlight; nunca conta real com cobrança.
   Opcional: arquivo StoreKit Configuration para testes locais no Xcode.

## 9. Modo de teste (somente desenvolvimento)

- Ligado só se `__DEV__` **ou** (`Platform.OS === 'web'` **e** `EXPO_PUBLIC_OWBUDDY_PLUS_TESTE=1` no export).
  Build nativo de produção: `__DEV__` falso e plataforma não-web → impossível (teste de unidade + estático:
  eas.json/app.json não definem a flag).
- Prova no build web sem a flag (E2E): nenhum painel, `?plus=` ignorado e um cenário "plus" gravado no
  localStorage não libera nada (o código da loja simulada vai no bundle, mas nunca é escolhido).
- Cenários: Free · trial elegível, Free · trial não elegível, Plus ativo, Plus cancelado (ainda ativo),
  Expirado, Plus sem internet, Carregando, Erro da loja. Troca pelo painel no topo da tela OWBuddy+ ou
  `?plus=<id>` na URL do preview. Preço fictício "R$ 0,00" com aviso "Modo de teste: preço e período fictícios".
- **Export do preview:** `EXPO_PUBLIC_OWBUDDY_PLUS_TESTE=1 npx expo export --platform web --output-dir dist --clear`
  (o `--clear` é obrigatório: o cache do Metro guarda o valor embutido de EXPO_PUBLIC_*).

## 10. Testes

- `tests/plus.test.mjs` (38): estados, trial elegível/não, preço localizado, ausência de preço, cancelado,
  expirado, restauração, offline/carência, erro, loading, dados preservados, recorte Free, sem trial local,
  sem preço/trial fixo, sem compra automática, sem exclusão, analytics sem PII, Conta OW opcional, sem segredo,
  modo de teste impossível em produção, dependência e IDs.
- `tests/e2e/plus-preview.cjs`: todos os cenários no navegador, compra simulada (cancelar/duplo toque),
  dados idênticos antes/depois, 320–430 px escuro/claro, build sem flag.
- As suítes E2E antigas rodam com Plus simulado (`tests/e2e/_plus.cjs`).

## 11. Pendências

- Configurar produtos nas lojas (seções 7 e 8) e decidir preço/teste gratuito.
- Termos de uso do OWBuddy (seção 6) e o parágrafo da política (seção 5) — publicar junto com o Plus.
- RC nativo: validar compra de teste (license tester / Sandbox), restaurar, gerenciar, pendente, offline,
  renovação acelerada e expiração em aparelho real.
