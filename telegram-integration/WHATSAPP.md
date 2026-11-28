# WhatsApp — preparação, sem automação (não ativo)

## O que já está no ar

Todo mundo com página `paginaChrome` (notícia, vagas, carreiras, salários,
funções, etc.) já tem um botão "Compartilhar" com:
- Link direto pro WhatsApp (`https://wa.me/?text=...`), com título + URL
  canônica da página atual — funciona em qualquer navegador, sem biblioteca
  nenhuma, sem script pesado.
- Botão de compartilhamento nativo (`navigator.share()`) quando o navegador
  suporta (a maioria dos celulares) — some automaticamente quando não
  suporta.

Isso já cumpre a parte de "compartilhamento" pedida nesta rodada.

## O que NÃO fizemos (de propósito)

Não existe canal oficial `OWNews | Radar Offshore` no WhatsApp ainda — não
inventamos essa URL. Não tentamos automatizar WhatsApp por WhatsApp Web,
bibliotecas não-oficiais ou qualquer método com risco de bloqueio da conta.
Isso é explicitamente contra a instrução recebida e contra boa prática de
segurança (contas de WhatsApp Business podem ser banidas por automação não
oficial).

## O que falta para o canal existir de verdade

1. Alguém do OWNews/OffshoreWorks cria o canal oficial no WhatsApp
   (funcionalidade "Canais" do próprio app/WhatsApp Business).
2. Assim que a URL existir, ela entra num lugar único e fácil de manter
   (ex.: uma constante no `paginaChrome`), e um CTA discreto "Siga o OWNews
   no WhatsApp ↗" pode aparecer nos mesmos lugares onde já tem Instagram —
   sem novo código de automação, só um link a mais.
3. Conteúdo do canal seguiria a mesma régua editorial do Telegram (ver
   `telegram.js`): maioria informação, comercial minoritário.

Nenhuma credencial, token ou URL de canal foi inventada neste documento.
