# OWBuddy Free + Premium — matriz de produto (2026-10-30)

Substitui a matriz do OWBuddy+ de 2026-10-25 (`docs/OWBUDDY-PLUS.md`), que trancava Mala,
Viagem, Documentos, Histórico e Contatos. A arquitetura técnica de loja daquele documento
(expo-iap, IDs de produto, cache, carência offline) continua valendo; a **matriz** e o
**período de 45 dias** valem a partir daqui.

## Princípio

- **Free não é demonstração.** É o produto que a pessoa usa por anos: o que se abre toda semana.
- **Premium é a camada que cruza os módulos**: conveniência, automação, memória e inteligência.
- **Entitlement controla recursos, nunca a posse dos dados.** Nada é apagado, escondido ou
  trancado quando o Premium acaba.

## Matriz

| Recurso | Free | Premium | Período 45d | Justificativa |
|---|---|---|---|---|
| Minha Escala (cadastro, edição, ciclo, calendário, contagem, offline) | SIM | — | — | Coração do app; uso diário; sem conta |
| Exceções, dobra, eventos da escala | SIM | — | — | Parte da escala real |
| Compartilhar escala | SIM | — | — | Indicação / crescimento |
| Cruzar escalas | SIM | — | — | Família/colegas: crescimento |
| Minha Mala completa (adicionar, editar, quantidade, ordem, recorrência, ocultar/restaurar padrão, offline) | SIM | — | — | Uso a cada ciclo; abandono alto se bloqueada |
| Minha Viagem (cadastro, mapa, localizador) | SIM | — | — | Logística essencial do embarque |
| Certificados e documentos (CRUD, status de validade na tela) | SIM | — | — | Básico existe grátis em qualquer lugar |
| Contatos do embarque | SIM | — | — | Custo zero; utilidade operacional |
| Meu Histórico básico (registrar, listar, abrir, editar, excluir, linha do tempo, finalizar embarque) | SIM | — | — | Dado da pessoa; nunca refém |
| Início: herói contextual, contagem embarque/casa, atalhos com os próprios números | SIM | — | — | "Deixa eu olhar no Buddy" |
| Lembretes da escala, datas importantes e pagamento | SIM | — | — | Notificação essencial |
| Meu Pagamento, Lembrar de algo, Presentes | SIM | — | — | Baixa frequência, custo zero |
| Notícias, Vagas, Unidades, Aeroportos, Loja | SIM | — | — | Funil do ecossistema OffshoreWorks |
| Aparência (auto/escuro/claro), Personalizar Início | SIM | — | — | Acessibilidade/usabilidade |
| Conta OW e sync atual (escala, certificados, mala, prefs) | SIM | — | — | Já existia; backup do que é Free (não sequestrar) |
| Privacidade: apagar dados, excluir conta | SIM | — | — | Nunca se cobra |
| **Buddy cruzando módulos**: "Onde preciso estar" pela viagem, preparação no pré-embarque (viagem + documentos), Buddy Agora com mala/viagem/documentos, transporte a partir da viagem | — | SIM | SIM | Companheiro operacional: o Buddy deixa de ser agenda |
| **Alertas inteligentes**: mala incompleta na véspera, horário da viagem, documento vencendo antes do ciclo | — | SIM | SIM | Automação; vale pelo esquecimento evitado |
| **Histórico de carreira**: resumo total (embarques, dias, unidades, desde), totais por ano, filtros ano/unidade, levar a viagem para o histórico | — | SIM | SIM | Memória da vida offshore; cresce com o tempo |

## Candidatos Premium — análise

| Recurso Premium | Valor percebido | Frequência | Custo operacional | Potencial de conversão | Risco de abandono se bloqueado |
|---|---|---|---|---|---|
| Buddy cruzando módulos (Início/Buddy Agora) | alto | alta (todo pré-embarque) | baixo (local, por regras) | alto | baixo — escala, mala e viagem continuam nas telas |
| Alertas de mala/viagem/documentos | alto | média | baixo (notificação local) | médio | baixo — lembretes da escala continuam |
| Histórico de carreira (resumo, totais, filtros) | médio hoje, alto com anos de registro | baixa–média | baixo | médio → alto | baixo — registros continuam abertos |
| Levar a viagem para o histórico | baixo–médio | baixa | baixo | baixo | baixo — dá para registrar à mão |
| Relatório anual PDF/CSV *(futuro)* | alto | baixa (1×/ano, mas desejado) | baixo (gerado no aparelho) | alto | — |
| Backup/sync de Histórico, Viagem e Contatos *(futuro)* | alto (troca de celular) | baixa | médio (nuvem + LGPD) | alto | — |
| Certificados sozinhos | baixo | baixa | baixo | baixo | médio — **não** é proposta Premium |
| Mala, Escala, Viagem básica | — | alta | — | — | **alto**: por isso ficam Free |

## Por que alguém pagaria

1. **O Buddy cuida do meu ciclo**: cruza escala, mala, viagem e documentos e me diz, na hora
   certa, o que falta ("embarque em 3 dias, faltam 4 itens", "seu voo é amanhã às 08:40",
   "o CBSP vence antes do próximo embarque").
2. **Minha vida offshore registrada**: quantos dias embarquei por ano e na carreira, por onde passei.
3. **(Antes de ligar a cobrança) Relatório anual + backup do histórico**: o 3º motivo forte. Hoje os
   pilares 1 e 2 existem; o 3º está no roadmap e é **pré-requisito recomendado para vender**.

## Período Premium de 45 dias

- **Começa quando a pessoa configura a escala pela primeira vez** (primeiro uso de verdade), sem
  cartão, sem conta e sem rede. Quem já tem escala começa ao abrir esta versão.
- 45 dias cobrem um ciclo inteiro até 21×21: a pessoa vê o Buddy cruzando mala/viagem/documentos
  em pelo menos um pré-embarque.
- Local (`owbuddy_premium_trial`: início + maior relógio já visto). Voltar a data do celular não
  devolve dias. Reinstalar ou "Apagar dados" zera o período — e zera também os dados que o Premium
  analisa; o custo do Premium 1.0 por pessoa é zero (tudo local). Risco aceito e documentado.
- Comunicação: só "Premium ativo · N dias restantes" em Meu Buddy; um aviso no Início com ≤ 3 dias;
  um aviso no fim com [Conhecer Premium] e [Continuar no Free]. Cada aviso aparece uma vez.
- Alternativas descartadas: começar na instalação (gasta dias de quem ainda não configurou),
  na Conta OW (login obrigatório), por ativação explícita (pouca gente descobre), trial da loja
  (exige cartão e Play Billing). Quando houver recursos de nuvem, o acesso a eles exige Conta OW
  + assinatura verificada pela loja.

## Arquitetura (centralizada)

- `@owbuddy/domain/plus.ts`: `RECURSO_PLUS` (3 recursos), `NivelPremium`
  (`free | premium_trial | premium_active | premium_expired`), `combinarComTrial`, período de 45 dias.
- `src/plus/acesso.tsx`: `useOwBuddyPlus()` é a única pergunta da UI (`plus`, `nivel`, `trial`).
- `CartaoPremium` (em `src/components/PortaoPlus.tsx`): cartão discreto no lugar do recurso;
  ao tocar explica e oferece [Conhecer Premium] / [Agora não]. Nenhuma tela é trancada.
- `recorteFree()`: o cruzamento entre módulos só acontece com Premium; os dados nunca mudam.
- `ASSINATURA_PREMIUM_LIBERADA = false`: o app não fala com a loja (nenhuma consulta, nenhuma
  compra) até a missão "OWBuddy Premium / Play Billing". O preview usa a loja simulada.

## Preço e Google Play (para a próxima missão)

- Nada de preço no código: o texto vem sempre da loja.
- Estrutura recomendada: **mensal + anual** (anual com desconto claro), e uma eventual condição
  de lançamento definida na Play Console — nunca contagem regressiva no app.
- Como o app já dá 45 dias, recomenda-se **não** configurar trial grátis da loja no lançamento
  (ou configurá-lo curto e só para quem nunca teve o período), para não somar 45 + N dias.
- Antes de vender: produtos na Play Console (`owbuddy_plus_monthly`, `owbuddy_plus_annual`),
  termos de uso do OWBuddy publicados, parágrafo de assinatura na /privacidade, Data Safety
  revisada, e ligar `ASSINATURA_PREMIUM_LIBERADA`.

## O que nunca é cobrado

Abrir o app; ver e editar a escala; usar e editar a Minha Mala; funcionamento offline básico;
acessar, editar e excluir os próprios dados; apagar dados; excluir conta; privacidade;
acessibilidade (inclusive tema claro/escuro).

## Roadmap Premium (não é 1.0)

Relatório anual (PDF/CSV, "registro pessoal, não é documento oficial"); resumo de carreira
exportável; backup/sync do Histórico, Viagem e Contatos (exige atualizar a política de privacidade
e a Data Safety **antes**); viagem com várias etapas e acompanhamento; comparação entre anos;
temas especiais. Sem ranking entre usuários, streak, pontos ou moedas.
