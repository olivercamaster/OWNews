/**
 * OFFSHORE DATA SOURCES — catálogo único das fontes do Radar Offshore.
 *
 * Toda URL, formato e regra de leitura mora aqui. A ingestão (ingestao/) só consome este
 * catálogo; o worker nunca baixa nada da ANP. Fonte: dados abertos da ANP
 * (https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos), licença aberta de
 * dados públicos; auditado em 31/10/2026.
 *
 * Arquivos mensais mudam de nome a cada mês (ex.: "-set.csv", "_abr_2026.csv", "-fev-26.csv"):
 * `pagina` + `padrao` descobrem o arquivo vigente lendo a página oficial; o mais recente vence.
 */
const BASE = 'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos';

export const MESES_ARQUIVO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const FONTES = {
  plataformas: {
    nome: 'Plataformas em operação',
    pagina: `${BASE}/fase-de-desenvolvimento-e-producao`,
    padrao: /\/lpo\/dados-abertos-plataformas-operacao\.csv$/,
    formato: 'csv', encoding: 'utf-8', separador: ',',
    periodicidade: 'irregular (atualizada pela ANP quando há mudança)',
    essenciais: ['SIGLA DA INSTALAÇÃO', 'NOME DA INSTALAÇÃO', 'CAMPOS', 'BACIA', 'OPERADOR', 'CLASSIFICAÇÃO', 'LATITUDE', 'LONGITUDE'],
    minimo: 40, maximo: 400,
    chave: 'SIGLA DA INSTALAÇÃO',
  },
  sondas: {
    nome: 'Sondas em operação por período',
    pagina: `${BASE}/fase-de-desenvolvimento-e-producao`,
    padrao: /\/informacoes-sobre-pocos\/sondas[-_]em[-_]operacao[-_]por[-_]periodo[-_](\d{4})\.csv$/,
    ordenar: 'ano',
    formato: 'csv', encoding: 'utf-8', separador: ',',
    periodicidade: 'anual, com atualizações ao longo do ano',
    essenciais: ['Sigla_da_sonda', 'Nome_da_sonda', 'Campo', 'Operador_da_sonda'],
    minimo: 50, maximo: 2000,
    chave: 'Sigla_da_sonda',
  },
  campos: {
    nome: 'Campos de produção (dados cadastrais)',
    pagina: `${BASE}/fase-de-desenvolvimento-e-producao`,
    padrao: /\/informacoes-sobre-campos\/extracao-campo\.csv$/,
    formato: 'csv', encoding: 'utf-8', separador: ',',
    periodicidade: 'irregular',
    essenciais: ['CODIGO_CAMPO', 'CAMPO', 'BACIA', 'OPERADOR', 'AMBIENTE', 'SITUACAO_CAMPO'],
    minimo: 200, maximo: 3000,
    chave: 'CODIGO_CAMPO',
  },
  concessionarios: {
    nome: 'Campos — concessionários e participações',
    pagina: `${BASE}/fase-de-desenvolvimento-e-producao`,
    padrao: /\/informacoes-sobre-campos\/extracao-campo-concessionarios\.csv$/,
    formato: 'csv', encoding: 'utf-8', separador: ',',
    periodicidade: 'irregular',
    essenciais: ['CODIGO_CAMPO', 'CAMPO', 'RAZAO_SOCIAL/CONCESSIONARIO', 'CNPJ', 'PARTICIPACAO (%)', 'OPERADOR'],
    minimo: 200, maximo: 5000,
    chave: 'CODIGO_CAMPO',
  },
  producao_mar: {
    nome: 'Produção de petróleo e gás natural no mar, por poço (mensal)',
    pagina: `${BASE}/fase-de-desenvolvimento-e-producao`,
    padrao: /\/pm\/producao-mar-(\d{4})\.csv$/,
    ordenar: 'ano', quantos: 2, // ano corrente + anterior: série de 12 meses
    formato: 'csv', encoding: 'utf-8', separador: ',',
    periodicidade: 'mensal (com defasagem de cerca de 2 meses)',
    essenciais: ['Mês/Ano', 'Bacia', 'Campo', 'Poço', 'Instalação', 'Produção de Óleo (m³)', 'Produção de Condensado (m³)', 'Produção de Gás Associado (Mm³)', 'Produção de Gás Não Associado (Mm³)'],
    minimo: 1000, maximo: 60000,
    chave: 'Poço',
  },
  pocos_exploratorios: {
    nome: 'Poços exploratórios (painel da fase de exploração)',
    pagina: `${BASE}/fase-exploracao`,
    padrao: /\/pocos-exploratorios\/(\d{4})\/pocos-exploratorios[-_]([a-z]{3})/,
    ordenar: 'ano-mes',
    formato: 'csv', encoding: 'iso-8859-1', separador: ';',
    periodicidade: 'mensal',
    essenciais: ['POÇO ANP', 'BLOCO', 'BACIA', 'AMBIENTE', 'OPERADOR', 'INÍCIO DA PERFURAÇÃO', 'CONCLUSÃO DO POÇO', 'NOTIFICAÇÃO DE DESCOBERTA ?'],
    minimo: 200, maximo: 20000,
    chave: 'POÇO ANP',
  },
  pads_andamento: {
    nome: 'Planos de Avaliação de Descobertas (PAD) em andamento',
    pagina: `${BASE}/fase-exploracao`,
    padrao: /\/pads-andamento\/(\d{4})\/pads-andamento[-_]([a-z]{3})/,
    ordenar: 'ano-mes',
    formato: 'csv', encoding: 'iso-8859-1', separador: ';',
    periodicidade: 'mensal',
    essenciais: ['CÓDIGO DO PAD', 'BLOCO', 'BACIA', 'AMBIENTE', 'OPERADOR', 'SITUAÇÃO', 'TÉRMINO PREVISTO'],
    minimo: 5, maximo: 500,
    chave: 'CÓDIGO DO PAD',
  },
  declaracoes_comercialidade: {
    nome: 'Declarações de comercialidade',
    pagina: `${BASE}/fase-exploracao`,
    padrao: /\/dcfe\/(\d{4})\/declaracoes-comercialidade-fase-exploracao[-_]([a-z]{3})/,
    ordenar: 'ano-mes',
    formato: 'csv', encoding: 'iso-8859-1', separador: ';',
    periodicidade: 'mensal',
    essenciais: ['CÓDIGO DO PAD', 'BACIA', 'AMBIENTE', 'OPERADOR', 'DATA DECLARAÇÃO COMERCIALIDADE', 'ÁREA DE DESENVOLVIMENTO'],
    minimo: 50, maximo: 3000,
    chave: 'ÁREA DE DESENVOLVIMENTO',
  },
  blocos: {
    nome: 'Blocos exploratórios sob contrato',
    pagina: `${BASE}/fase-exploracao`,
    padrao: /\/bsc\/(\d{4})\/blocos-sob-contrato[-_]([a-z]{3})/,
    ordenar: 'ano-mes',
    formato: 'csv', encoding: 'iso-8859-1', separador: ';',
    periodicidade: 'mensal',
    essenciais: ['BLOCO', 'OPERADOR', 'AMBIENTE', 'BACIA', 'PERÍODO', 'QTD POÇOS PERFURADOS'],
    minimo: 100, maximo: 3000,
    chave: 'BLOCO',
  },
  investimento_bacia: {
    nome: 'Previsão de investimentos por bacia (desenvolvimento e produção)',
    pagina: `${BASE}/fase-de-desenvolvimento-e-producao`,
    padrao: /\/arquivos-previsao\/investimento-bacia\.csv$/,
    formato: 'csv', encoding: 'utf-8', separador: ',',
    periodicidade: 'anual (informado pelas operadoras)',
    essenciais: ['BACIA', 'AMBIENTE', 'ANO', 'INVESTIMENTO R$'],
    minimo: 20, maximo: 2000,
    chave: 'BACIA',
  },
  previsao_atividade: {
    nome: 'Previsão de atividades por bacia (desenvolvimento e produção)',
    pagina: `${BASE}/fase-de-desenvolvimento-e-producao`,
    padrao: /\/arquivos-previsao\/previsao-atividade-bacia\.csv$/,
    formato: 'csv', encoding: 'utf-8', separador: ',',
    periodicidade: 'anual (informado pelas operadoras)',
    essenciais: ['BACIA', 'AMBIENTE', 'ANO', 'TIPO ATIVIDADE', 'QUANTIDADE ATIVIDADE', 'UNIDADE DA ATIVIDADE'],
    minimo: 50, maximo: 20000,
    chave: 'BACIA',
  },
  previsao_producao: {
    nome: 'Previsão de produção por bacia',
    pagina: `${BASE}/fase-de-desenvolvimento-e-producao`,
    padrao: /\/arquivos-previsao\/previsao-producao\.csv$/,
    formato: 'csv', encoding: 'utf-8', separador: ',',
    periodicidade: 'anual (informado pelas operadoras)',
    essenciais: ['BACIA', 'AMBIENTE', 'ANO', 'VAZÃO PETRÓLEO', 'VAZÃO GÁS'],
    minimo: 20, maximo: 2000,
    chave: 'BACIA',
  },
  previsao_exploracao: {
    nome: 'Previsão de atividades e investimentos exploratórios (PTE)',
    pagina: `${BASE}/previsao-de-exploracao`,
    padrao: /\/previsao-atividades-investimentos-pte\.csv$/,
    formato: 'csv', encoding: 'utf-8', separador: ';',
    periodicidade: 'anual (informado pelas operadoras)',
    essenciais: ['ATIVIDADE (Unidade)', 'AMBIENTE', 'ETAPA', 'Ano Referência', 'Ano Atividade', 'QUANTIDADE', 'INVESTIMENTO (milhares R$)'],
    minimo: 50, maximo: 20000,
    chave: 'ATIVIDADE (Unidade)',
  },
};

/** Geometrias oficiais (GeoServer da ANP, WFS → GeoJSON). Só ambiente marítimo. */
export const GEO = {
  pagina: 'https://gishub.anp.gov.br/geoserver/BD_ANP/ows',
  campos: { typeName: 'BD_ANP:CAMPOS_PRODUCAO_SIRGAS', filtroCql: "AMBIENTE LIKE 'M%'", props: ['NOM_CAMPO', 'NOM_BACIA', 'OPERADOR_C'], minKm: 0.5 },
  blocos: { typeName: 'BD_ANP:BLOCOS_EXPLORATORIOS_SIRGAS', filtroCql: "AMBIENTE LIKE 'M%'", props: ['NOM_BLOCO', 'NOM_BACIA', 'OPERADOR_C'], minKm: 1 },
  presal: { typeName: 'BD_ANP:POLIGONO_PRESAL_PLSIRGAS', filtroCql: null, props: [], minKm: 2 },
};

/** Notícias OWNews (para relacionar entidades). Leitura pública (chave publicável do site). */
export const NOTICIAS = {
  url: 'https://awyowuhwkqfyhwgdpepp.supabase.co/rest/v1/articles',
  chave: 'sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt',
  limite: 1500,
};

export const ATRIBUICAO = 'Agência Nacional do Petróleo, Gás Natural e Biocombustíveis (ANP)';
