/* OWNews · Eleições 2026 — totalização ao vivo (2º turno).
   Lê SOMENTE /api/eleicoes-2026/* (snapshot OWNews dos arquivos oficiais do TSE).
   Não calcula, não projeta, não interpreta: exibe os campos oficiais. */
(function () {
  'use strict';
  var INTERVALO = 30000;
  var UF_NOME = { ac:'Acre', al:'Alagoas', am:'Amazonas', ap:'Amapá', ba:'Bahia', ce:'Ceará', df:'Distrito Federal', es:'Espírito Santo', go:'Goiás', ma:'Maranhão', mg:'Minas Gerais', ms:'Mato Grosso do Sul', mt:'Mato Grosso', pa:'Pará', pb:'Paraíba', pe:'Pernambuco', pi:'Piauí', pr:'Paraná', rj:'Rio de Janeiro', rn:'Rio Grande do Norte', ro:'Rondônia', rr:'Roraima', rs:'Rio Grande do Sul', sc:'Santa Catarina', se:'Sergipe', sp:'São Paulo', to:'Tocantins' };
  var app = document.getElementById('eleiApp');
  var raiz = document.getElementById('elei');
  var abertos = {};
  var estado = { cfg: null, uf: null, br: null, ufPres: null, ufGov: null, erro: {} };
  var lerUf = function () { try { var u = new URLSearchParams(location.search).get('uf'); return u && UF_NOME[u.toLowerCase()] ? u.toLowerCase() : null; } catch (e) { return null; } };
  estado.uf = lerUf();

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function num(s) { var n = Number(String(s == null ? '' : s)); return isFinite(n) && String(s) !== '' ? n.toLocaleString('pt-BR') : '—'; }
  function pctNum(s) { var n = parseFloat(String(s || '').replace(',', '.')); return isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; }
  function hora(ms) { try { return new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }); } catch (e) { return ''; } }
  function iniciada(d) { return d && d.totalizadoEm && d.andamento !== 'n'; }

  function api(caminho) {
    return fetch(caminho, { cache: 'no-store' }).then(function (r) { return r.json().then(function (j) { if (!j || !j.ok) throw new Error('indisponivel'); return j; }); });
  }

  function barra(pct, cls) {
    var b = el('div', 'elei-barra ' + (cls || ''));
    var f = el('span'); f.style.width = pctNum(pct) + '%'; b.appendChild(f);
    b.setAttribute('role', 'presentation');
    return b;
  }

  function blocoProgresso(d) {
    var w = el('div', 'elei-prog');
    var topo = el('div', 'elei-prog-topo');
    var v = el('strong', 'elei-prog-pct', (d.secoes.pct || '0,00') + '%');
    topo.appendChild(v);
    topo.appendChild(el('span', 'elei-prog-rot', 'das seções totalizadas'));
    w.appendChild(topo);
    w.appendChild(barra(d.secoes.pct, 'elei-barra-prog'));
    w.appendChild(el('p', 'elei-prog-det', num(d.secoes.totalizadas) + ' de ' + num(d.secoes.total) + ' seções · ' + num(d.secoes.pendentes) + ' pendentes'));
    return w;
  }

  function blocoHora(resp) {
    var d = resp.dados, w = el('div', 'elei-hora');
    var t = d.totalizadoEm ? d.totalizadoEm.split(' ')[1] : null;
    w.appendChild(el('span', 'elei-hora-p', t ? 'Atualizado às ' + t : 'Totalização ainda não iniciada'));
    w.appendChild(el('span', 'elei-hora-s', (t ? 'horário do dado no TSE (Brasília) · ' : '') + 'consulta OWNews às ' + hora(resp.consultadoEm)));
    if (resp.falhaEm) w.appendChild(el('span', 'elei-aviso', 'Atualização temporariamente indisponível. Tentando novamente… Exibindo o último dado oficial recebido.'));
    return w;
  }

  function cartao(c, d) {
    var w = el('article', 'elei-cand');
    var cab = el('div', 'elei-cand-cab');
    cab.appendChild(el('span', 'elei-cand-n', c.n));
    var nomes = el('div', 'elei-cand-nomes');
    nomes.appendChild(el('h3', 'elei-cand-nome', c.nome));
    var partido = c.partido + (c.coligacao ? ' · ' + c.coligacao : '');
    nomes.appendChild(el('p', 'elei-cand-partido', partido));
    if (c.vice) nomes.appendChild(el('p', 'elei-cand-vice', 'Vice: ' + c.vice + (c.viceP ? ' (' + c.viceP + ')' : '')));
    cab.appendChild(nomes);
    w.appendChild(cab);
    // Rótulo de situação SOMENTE quando o TSE o informa no arquivo oficial.
    if (c.eleito === 's' || (c.situacao && c.situacao.trim())) {
      w.appendChild(el('span', 'elei-cand-sit', (c.situacao && c.situacao.trim()) || 'Eleito'));
    }
    if (iniciada(d)) {
      w.appendChild(el('strong', 'elei-cand-pct', c.pct + '%'));
      w.appendChild(barra(c.pctn || c.pct, 'elei-barra-cand'));
      w.appendChild(el('p', 'elei-cand-votos', num(c.votos) + ' votos'));
    } else {
      w.appendChild(el('p', 'elei-cand-votos', 'Aguardando totalização'));
    }
    return w;
  }

  function detalhes(d, chave) {
    var det = el('details', 'elei-det');
    // O painel é redesenhado a cada atualização: mantém aberto o que o leitor abriu.
    if (abertos[chave]) det.open = true;
    det.addEventListener('toggle', function () { abertos[chave] = det.open; });
    det.appendChild(el('summary', null, 'Detalhes da totalização'));
    var dl = el('dl');
    var linhas = [
      ['Seções totalizadas', num(d.secoes.totalizadas) + ' de ' + num(d.secoes.total) + ' (' + (d.secoes.pct || '0,00') + '%)'],
      ['Seções pendentes', num(d.secoes.pendentes) + ' (' + (d.secoes.pctPendentes || '—') + '%)'],
      ['Eleitorado', num(d.eleitorado)],
      ['Comparecimento', num(d.comparecimento) + ' (' + (d.pctComparecimento || '—') + '%)'],
      ['Abstenção', num(d.abstencao) + ' (' + (d.pctAbstencao || '—') + '%)'],
      ['Votos válidos', num(d.votos.validos) + ' (' + (d.votos.pctValidos || '—') + '%)'],
      ['Votos em branco', num(d.votos.brancos) + ' (' + (d.votos.pctBrancos || '—') + '%)'],
      ['Votos nulos', num(d.votos.nulos) + ' (' + (d.votos.pctNulos || '—') + '%)']
    ];
    linhas.forEach(function (l) { dl.appendChild(el('dt', null, l[0])); dl.appendChild(el('dd', null, l[1])); });
    det.appendChild(dl);
    det.appendChild(el('p', 'elei-det-nota', 'Números e percentuais exatamente como publicados no arquivo oficial do TSE.'));
    return det;
  }

  function painel(titulo, sub, resp, principal) {
    var s = el('section', 'elei-painel' + (principal ? ' elei-principal' : ''));
    var h = el('div', 'elei-painel-cab');
    h.appendChild(el('h2', null, titulo));
    h.appendChild(el('span', 'elei-painel-sub', sub));
    s.appendChild(h);
    if (!resp) { s.appendChild(el('p', 'elei-msg', 'Dados oficiais temporariamente indisponíveis.')); return s; }
    var d = resp.dados;
    s.appendChild(blocoProgresso(d));
    var g = el('div', 'elei-cands');
    d.candidatos.forEach(function (c) { g.appendChild(cartao(c, d)); });
    s.appendChild(g);
    s.appendChild(blocoHora(resp));
    s.appendChild(detalhes(d, titulo));
    s.appendChild(el('p', 'elei-painel-fonte', 'Fonte: Tribunal Superior Eleitoral (TSE) · dados oficiais'));
    return s;
  }

  function seletor() {
    var w = el('section', 'elei-painel elei-estados');
    var h = el('div', 'elei-painel-cab');
    h.appendChild(el('h2', null, 'Resultado por estado'));
    h.appendChild(el('span', 'elei-painel-sub', 'Presidente na UF e Governador onde há 2º turno'));
    w.appendChild(h);
    var lab = el('label', 'elei-sel');
    lab.appendChild(el('span', null, 'Escolha o estado'));
    var sel = el('select'); sel.setAttribute('aria-label', 'Escolha o estado');
    var o0 = el('option', null, 'Selecione…'); o0.value = ''; sel.appendChild(o0);
    var gov = (estado.cfg && estado.cfg.governadorUfs) || [];
    Object.keys(UF_NOME).sort(function (a, b) { return UF_NOME[a].localeCompare(UF_NOME[b], 'pt-BR'); }).forEach(function (u) {
      var o = el('option', null, UF_NOME[u] + ' (' + u.toUpperCase() + ')' + (gov.indexOf(u) >= 0 ? ' · Governador' : ''));
      o.value = u; if (u === estado.uf) o.selected = true; sel.appendChild(o);
    });
    sel.addEventListener('change', function () { escolher(sel.value || null); });
    lab.appendChild(sel); w.appendChild(lab);
    if (gov.length) {
      var chips = el('div', 'elei-chips');
      chips.appendChild(el('span', 'elei-chips-rot', 'Governador · 2º turno:'));
      gov.forEach(function (u) {
        var b = el('button', 'elei-chip' + (u === estado.uf ? ' ativo' : ''), u.toUpperCase());
        b.type = 'button'; b.setAttribute('aria-label', 'Ver ' + UF_NOME[u]);
        b.addEventListener('click', function () { escolher(u); });
        chips.appendChild(b);
      });
      w.appendChild(chips);
    }
    if (estado.uf) {
      var nome = UF_NOME[estado.uf];
      if (gov.indexOf(estado.uf) >= 0) w.appendChild(painel(nome + ' · Governador', '2º turno · ' + estado.uf.toUpperCase(), estado.ufGov, false));
      w.appendChild(painel(nome + ' · Presidente', 'Votação para Presidente na UF', estado.ufPres, false));
    }
    return w;
  }

  function render() {
    if (!estado.br && !estado.erro.br) return;
    raiz.setAttribute('data-estado', estado.br ? 'ok' : 'erro');
    var frag = document.createDocumentFragment();
    frag.appendChild(painel('Presidente', 'Brasil · totalização nacional', estado.br, true));
    frag.appendChild(seletor());
    app.textContent = '';
    app.appendChild(frag);
  }

  function carregarUf() {
    var u = estado.uf; if (!u) return Promise.resolve();
    var gov = estado.cfg && estado.cfg.governadorUfs.indexOf(u) >= 0;
    return Promise.all([
      api('/api/eleicoes-2026/resultado?cargo=presidente&abr=' + u).then(function (j) { if (estado.uf === u) estado.ufPres = j; }).catch(function () {}),
      gov ? api('/api/eleicoes-2026/resultado?cargo=governador&abr=' + u).then(function (j) { if (estado.uf === u) estado.ufGov = j; }).catch(function () {}) : null
    ]);
  }

  function escolher(u) {
    if (u === estado.uf) return;
    estado.uf = u; estado.ufPres = null; estado.ufGov = null;
    try { var url = new URL(location.href); if (u) url.searchParams.set('uf', u); else url.searchParams.delete('uf'); history.replaceState(null, '', url); } catch (e) {}
    render();
    carregarUf().then(render);
  }

  function atualizar() {
    return Promise.all([
      api('/api/eleicoes-2026/resultado?cargo=presidente&abr=br').then(function (j) { estado.br = j; estado.erro.br = false; })
        .catch(function () { estado.erro.br = true; if (estado.br) estado.br.falhaEm = Date.now(); }),
      carregarUf()
    ]).then(render);
  }

  api('/api/eleicoes-2026/config').then(function (j) { estado.cfg = j; }).catch(function () { estado.cfg = { governadorUfs: [] }; })
    .then(atualizar)
    .then(function () {
      setInterval(function () { if (!document.hidden) atualizar(); }, INTERVALO);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) atualizar(); });
    });
})();
