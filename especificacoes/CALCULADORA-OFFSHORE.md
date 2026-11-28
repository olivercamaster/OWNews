# Calculadora Offshore / "Minha Escala" — especificação (não implementada nesta rodada)

Decisão desta rodada: **especificar, não implementar**. A rodada já entregou
volume grande de páginas novas (Comece Aqui, Empresas Offshore, Cursos e
Escolas, Guias, busca, header mobile) e testá-las bem tem prioridade sobre
adicionar mais uma feature nova sob pressão de tempo. Abaixo fica pronta a
especificação pra implementação numa próxima rodada, sem exigir mais
pesquisa.

## Escopo permitido (baixo risco)

- Entrada do usuário: data do próximo embarque + padrão de escala
  (14x14, 14x21, 14x28 ou "personalizado: X dias embarcado / Y dias de
  folga").
- Saída: calendário simples dos próximos ciclos — datas de embarque,
  desembarque e período de folga, repetido N vezes (ex.: próximos 6
  ciclos, ~1 ano).
- 100% client-side: cálculo de datas é aritmética pura
  (`Date.now() + dias*86400000`), sem chamada de rede, sem conta, sem
  login, sem persistência em servidor. Puro JS na Home ou hub-page
  dedicada (`/minha-escala`), com o estado guardado só em memória da
  aba (ou, no máximo, `localStorage` do próprio navegador do usuário —
  nunca enviado ao servidor).

## Fora do escopo (explicitamente, por risco jurídico)

- Nenhum cálculo de: salário, adicional de periculosidade/confinamento,
  décimo terceiro proporcional, férias, ou qualquer direito trabalhista.
  Isso pertence à área de Salários/Funções, com as ressalvas já
  publicadas lá (ver `ADICIONAIS_PADRAO` em `worker.js`), não à
  calculadora de datas.
- Nenhuma alegação de que a escala informada é a que a empresa X pratica
  — o usuário informa a própria escala, o OWNews só faz a conta.

## Interface sugerida

```
/minha-escala
  [Data do próximo embarque: __/__/____]
  [Escala: (14x14) (14x21) (14x28) (Personalizado: __ x __)]
  [Calcular]

  → Próximos ciclos:
    Embarque: 05/10/2026 · Desembarque: 19/10/2026
    Folga: 19/10 a 02/11/2026
    Embarque: 02/11/2026 · Desembarque: 16/11/2026
    ...
```

## Por que ficou de fora nesta rodada

Tempo do round já concentrado nas páginas de aquisição/carreira (que têm
efeito de SEO e conversão mais direto) e nos ajustes de simplificação
pedidos (OFFVoos, Radar, header mobile, busca). Calculadora é aditiva,
não corretiva — cabe melhor como próxima prioridade dedicada, com teste
mobile completo (ela é candidata forte a ferramenta de retenção, conforme
já observado).
