# Pesquisa Salarial — revisão da proposta, sem execução

A coleta permanece em preparação. O frontend não envia respostas e não deve
ser ativado apenas porque uma tabela foi criada. Nenhuma instrução deste
documento foi aplicada ao Supabase.

## Melhorias propostas antes de ativar

- Remover o INSERT público irrestrito (`with check (true)`). Um endpoint de
  ingestão validado deve ser o único caminho de escrita; RLS e grants devem
  negar escrita/leitura direta de respostas aos clientes públicos.
- Validar desafio antiautomação no servidor, aplicar limites por janela de
  tempo, limite global e tamanho máximo do corpo. Requisições diretas ao banco
  não podem contornar esses controles. Isso requer trabalho backend separado.
- Adotar chave de idempotência com restrição UNIQUE, gerada por tentativa
  lógica e reutilizada em retries. Ela evita retransmissão acidental, não
  comprova que cada participante é uma pessoa diferente.
- Definir estratégia de duplicidade editorial: não rejeitar automaticamente
  pessoas distintas com a mesma função/faixa salarial. Desafio e limites não
  garantem uma pessoa/uma resposta; documentar essa limitação metodológica.
- Restringir valores de função, experiência, unidade, vínculo, UF e faixas via
  CHECK ou tabelas de referência. Validar área/função, limitar todos os textos,
  exigir função livre apenas para `outro`, proibir adicionais repetidos e
  `nenhum` combinado com outros adicionais.
- Impedir que o cliente escolha `id`, `created_at`, estado de revisão ou outros
  metadados internos. Defaults por si só não impedem valores enviados.
- Considerar retirar empresa e observação livre, ou moderar/remover PII antes
  de qualquer uso estatístico. Não prometer anonimato absoluto com texto livre.
- Caso algum identificador técnico temporário seja necessário para proteção,
  definir retenção curta e acesso restrito; não guardar IP bruto ou fingerprint
  permanente junto às respostas. Documentar o tratamento antes da coleta.
- Definir fluxo de validação/exclusão de respostas e contar apenas respostas
  válidas na amostra. Publicar somente agregados com tamanho mínimo e proteção
  contra identificação por filtros pequenos e diferença entre consultas.
- Agregar faixas exige metodologia: intervalo de mediana ou aproximação
  explícita, nunca apresentar ponto médio arbitrário como salário exato.
- Se houver SECURITY DEFINER: proprietário restrito, search_path fixo, objetos
  qualificados, grants EXECUTE mínimos; nenhuma função deve expor linhas cruas.
- Planejar migration transacional revisada e testar negação de SELECT/UPDATE/
  DELETE/INSERT direto para anon e authenticated, caminhos via views/RPC,
  payload inválido, duplicidade, excesso de volume e limiar de agregação.

O arquivo schema.sql é um rascunho histórico com aviso atualizado. O INSERT
irrestrito nele é um ponto a substituir, não uma recomendação de publicação.
