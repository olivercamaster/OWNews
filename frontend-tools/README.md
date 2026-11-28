# Frontend OWNews

Produção: `producao-ownews-git/worker.js`, com a configuração dedicada no mesmo
diretório. Preview: `home-redesign/worker.js`. Não usar a configuração da raiz.

`home-redesign/index.html` contém a home de trabalho. Os Workers incluem também
CSS e código das páginas internas e a biblioteca de imagens: não substituir o
Worker inteiro pelo index nem copiar snapshots por cima dele. Alterações de
CSS da home que afetem páginas internas devem chegar também a `paginaChrome`.
As diferenças de identidade preview/produção são intencionais.

## Validação local

`node frontend-tools/validate.mjs`

Requer Playwright + Chromium; por padrão procura a instalação de teste em
`/tmp/ownews-frontend-tests`. Para outra instalação, definir
`OWNEWS_TEST_PACKAGE` com o caminho absoluto do package.json correspondente.
As dependências não fazem parte do bundle de produção. O teste inicia um
servidor em loopback, intercepta serviços externos e usa fixtures somente nos
testes. Não envia dados ao Supabase nem chama endpoints administrativos.
Resultados e screenshot ficam em `/tmp/ownews-frontend-tests/`.

A Pesquisa Salarial permanece em preparação. Nenhum deploy é executado por
estes testes. Configurações, collector, crons e snapshots não são modificados.

Neste ambiente, as bibliotecas e fontes auxiliares foram extraídas em /tmp.
Comando reproduzível para a suíte completa:

```bash
FONTCONFIG_FILE=/tmp/ownews-frontend-tests/fonts.conf \
LD_LIBRARY_PATH=/tmp/ownews-frontend-tests/libs/extracted/usr/lib/x86_64-linux-gnu \
node frontend-tools/validate.mjs
```

A suíte compara o HTML de todas as rotas entre produção e preview, admitindo
somente os rótulos conhecidos de preview. Confere a largura do documento e
rejeita ocultação de overflow em html/body. Veja PENDENCIAS.md antes de planejar
qualquer alteração de infraestrutura ou ativação da pesquisa.
