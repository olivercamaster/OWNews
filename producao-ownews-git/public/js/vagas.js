/* /vagas — busca, categorias, empresa, ordenação e favoritas (Radar de Vagas 2.0).
   Tudo no navegador, sobre os cards já renderizados: nenhuma chamada ao servidor.
   Estado simples refletido na URL (?categoria=&empresa=&q=&ordem=) para
   compartilhar e voltar do navegador. */
(function () {
  var grid = document.getElementById('vagasGrid');
  if (!grid) return;
  var $ = function (id) { return document.getElementById(id); };
  var cards = [].slice.call(grid.querySelectorAll('[data-cat]'));
  var busca = $('vagasBusca'), empresa = $('vagasEmpresa'), ordem = $('vagasOrdem'), chipsBox = $('vagasCats');
  var chips = chipsBox ? [].slice.call(chipsBox.querySelectorAll('[data-cat]')) : [];
  var mais = $('vagasMais'), limpar = $('vagasLimpar'), contagem = $('vagasContagem'), vazio = $('vagasVazio');
  var FAV = 'ownews_vagas_favoritas', cat = 'todas', espera = null;

  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function favs() { try { return JSON.parse(localStorage.getItem(FAV) || '[]'); } catch (e) { return []; } }
  function num(c, k) { return Number(c.getAttribute(k)) || 0; }

  function aplicar(gravar) {
    // Raiz simples: "mecânico" acha "Mecânica", "engenheiro" acha "Engenheira(o)".
    var termos = norm(busca && busca.value).split(/\s+/).filter(Boolean).map(function (t) { return t.length > 5 ? t.replace(/(as|os|es|a|o|e|s)$/, '') : t; });
    var emp = empresa ? empresa.value : '', fav = favs(), n = 0;
    var ord = ordem ? ordem.value : 'relevancia';
    cards.forEach(function (c) {
      var ccat = c.getAttribute('data-cat');
      var ok = (cat === 'todas' ? ccat !== 'banco' : cat === 'fav' ? fav.indexOf(c.getAttribute('data-vaga-slug')) !== -1 : ccat === cat) &&
        (!emp || c.getAttribute('data-vaga-empresa') === emp) &&
        termos.every(function (t) { return c.getAttribute('data-busca').indexOf(t) !== -1; });
      c.hidden = !ok;
      if (ok) n++;
    });
    // Relevância = ordem do servidor (empresas intercaladas); as outras são determinísticas.
    cards.slice().sort(function (a, b) {
      if (ord === 'recentes') return num(b, 'data-recente') - num(a, 'data-recente') || num(a, 'data-ordem') - num(b, 'data-ordem');
      if (ord === 'prazo') return a.getAttribute('data-prazo').localeCompare(b.getAttribute('data-prazo')) || num(a, 'data-ordem') - num(b, 'data-ordem');
      return num(a, 'data-ordem') - num(b, 'data-ordem');
    }).forEach(function (c) { grid.appendChild(c); });
    if (contagem) contagem.textContent = n + (n === 1 ? ' resultado' : ' resultados');
    if (vazio) vazio.hidden = n > 0;
    var filtrando = cat !== 'todas' || emp || termos.length || ord !== 'relevancia';
    if (limpar) limpar.hidden = !filtrando;
    if (gravar && history.replaceState) {
      var q = new URLSearchParams();
      if (cat !== 'todas' && cat !== 'fav') q.set('categoria', cat);
      if (emp) q.set('empresa', emp);
      if (busca && busca.value.trim()) q.set('q', busca.value.trim());
      if (ord !== 'relevancia') q.set('ordem', ord);
      var s = q.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
    }
  }

  function escolher(c) {
    cat = c;
    chips.forEach(function (b) { var a = b.getAttribute('data-cat') === c; b.classList.toggle('ativo', a); b.setAttribute('aria-pressed', a ? 'true' : 'false'); });
    var extra = chipsBox && chipsBox.querySelector('[data-cat="' + c + '"][data-extra]');
    if (extra && chipsBox) chipsBox.classList.add('aberto');
    aplicar(true);
  }

  chips.forEach(function (b) { b.addEventListener('click', function () { escolher(b.getAttribute('data-cat')); }); });
  if (mais) mais.addEventListener('click', function () { var a = chipsBox.classList.toggle('aberto'); mais.setAttribute('aria-expanded', a ? 'true' : 'false'); });
  if (busca) busca.addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(function () { aplicar(true); }, 120); });
  if (empresa) empresa.addEventListener('change', function () { aplicar(true); });
  if (ordem) ordem.addEventListener('change', function () { aplicar(true); });
  if (limpar) limpar.addEventListener('click', function () {
    if (busca) busca.value = '';
    if (empresa) empresa.value = '';
    if (ordem) ordem.value = 'relevancia';
    escolher('todas');
  });

  // Favoritas (mesma chave de sempre no navegador).
  cards.forEach(function (c) {
    var btn = c.querySelector('.vaga-fav-btn');
    if (!btn) return;
    var slug = btn.getAttribute('data-slug');
    function pinta() { var a = favs().indexOf(slug) !== -1; btn.classList.toggle('ativo', a); btn.setAttribute('aria-pressed', a ? 'true' : 'false'); btn.innerHTML = a ? '&#9733;' : '&#9734;'; }
    pinta();
    btn.addEventListener('click', function () {
      var f = favs(), i = f.indexOf(slug);
      if (i === -1) f.push(slug); else f.splice(i, 1);
      try { localStorage.setItem(FAV, JSON.stringify(f)); } catch (e) {}
      pinta();
      if (cat === 'fav') aplicar(false);
    });
  });

  // Estado inicial a partir da URL.
  var p = new URLSearchParams(location.search);
  if (busca && p.get('q')) busca.value = p.get('q');
  if (empresa && p.get('empresa')) empresa.value = p.get('empresa');
  if (ordem && /^(recentes|prazo)$/.test(p.get('ordem') || '')) ordem.value = p.get('ordem');
  var inicial = p.get('categoria');
  if (inicial && chips.some(function (b) { return b.getAttribute('data-cat') === inicial; })) escolher(inicial);
  else aplicar(false);
})();
