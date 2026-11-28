const HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#061c2b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="OWNews">
<link rel="manifest" href="/manifest.webmanifest">
<title>OWNews — Informação para quem vive o offshore (PREVIEW)</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=Archivo:wght@500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>
/* ---------------------------------------------------------------
   OWNews — HOME v3 (redesign editorial, preview local — não publicado
   em produção). Identidade preservada: navy escuro + branco + azul/ciano.
   Laranja reservado exclusivamente para elementos ligados à OffshoreWorks.

   Vozes tipográficas:
   - Source Serif 4 = voz editorial (todo título de matéria, de manchete a
     linha de lista) — é o que dá o ar de jornal premium.
   - Archivo = voz de interface (nav, botões, rótulos de seção, metadados).
   - IBM Plex Mono = reservada só pra dado técnico (códigos ICAO na barra
     de aeroportos) — de propósito, não usamos mono em mais nada, pra
     tirar o ar de "dashboard".
------------------------------------------------------------------ */
:root{
  --navy-950:#061c2b;
  --navy-900:#08283a;
  --navy-800:#0a2c40;
  --navy-700:#0e3450;
  --line:#16445e;
  --line-soft:#123c53;
  --line-hair:#153a50;
  --cyan:#12a8ee;
  --cyan-dim:#5fc4ee;
  --white:#f7fafc;
  --muted:#9eb5c5;
  --muted-dim:#6f8b9c;
  --orange:#ff7a00;   /* somente OffshoreWorks */
  --orange-dim:#7a3f10;
  --green:#42d879;
  --yellow:#ffd44d;
  --red:#ff4b4b;

  --editorial: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  --ui: 'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'IBM Plex Mono', 'SF Mono', ui-monospace, monospace;

  color-scheme: dark;
}

*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;
  background:var(--navy-950);
  color:var(--white);
  font-family:var(--ui);
  -webkit-font-smoothing:antialiased;
  padding-bottom:64px;
}
@media(min-width:760px){ body{ padding-bottom:0; } }

a{text-decoration:none;color:inherit}
img{max-width:100%;display:block}
h1,h2,h3{text-wrap:balance;margin:0;font-family:var(--editorial)}
button{font-family:inherit}
:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}

.container{width:min(1180px,100% - 32px);margin-inline:auto}

.skip-link{
  position:absolute;left:12px;top:-48px;background:var(--cyan);color:var(--navy-950);
  font-weight:700;padding:10px 14px;border-radius:6px;z-index:100;transition:top .15s;
}
.skip-link:focus{top:12px}

/* ---------- topo institucional ---------- */
.topline{border-bottom:1px solid var(--line-soft);font-family:var(--ui);font-size:11.5px;letter-spacing:.02em;color:var(--muted-dim)}
.topline .container{display:flex;justify-content:space-between;gap:12px;padding-block:8px}

/* ---------- header ---------- */
header{
  background:rgba(6,28,43,.92);backdrop-filter:blur(10px);
  border-bottom:1px solid var(--line);position:sticky;top:0;z-index:30;
}
.nav{min-height:60px;display:flex;align-items:center;gap:16px}
.logo{font-family:var(--ui);font-size:24px;font-weight:800;letter-spacing:-.03em;white-space:nowrap;color:var(--white)}
.logo span{color:var(--cyan)}
.menu-btn{
  display:flex;align-items:center;justify-content:center;margin-left:auto;
  border:1px solid var(--line);background:var(--navy-900);color:var(--white);
  border-radius:8px;font-size:20px;width:42px;height:38px;
}
.links{
  display:none;position:absolute;left:0;right:0;top:60px;background:var(--navy-950);
  border-bottom:1px solid var(--line);padding:6px 16px 18px;flex-direction:column;gap:0;
}
.links.open{display:flex}
.links a{padding:13px 4px;border-bottom:1px solid var(--line-soft);font-size:13px;font-weight:700;letter-spacing:.02em}
.shop-btn{
  margin-top:10px;text-align:center;background:var(--orange);color:#1a0d02;
  font-weight:800;padding:12px;border-radius:6px;
}
@media(min-width:760px){
  .nav{min-height:76px}
  .logo{font-size:30px}
  .menu-btn{display:none}
  .links{
    display:flex;position:static;flex-direction:row;align-items:center;gap:22px;
    background:none;border:0;padding:0;margin-left:auto;
  }
  .links a{padding:0;border:0;font-size:13px}
  .shop-btn{margin-top:0;background:var(--navy-700);border:1px solid var(--orange-dim);color:var(--white);padding:11px 16px}
  .shop-btn:hover{border-color:var(--orange)}
}

/* ---------- ops strip: aeroportos (mantido como estava — sem mudanças de conceito) ---------- */
.ops{margin-block:16px}
.ops-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-inline:2px}
.ops-head .live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);flex:none}
.ops-head strong{
  font-family:var(--ui);font-size:11px;letter-spacing:.08em;color:var(--muted);
  text-transform:uppercase;font-weight:700;
}
.ops-strip{
  display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;
  padding-bottom:2px;-webkit-overflow-scrolling:touch;
}
.ops-strip::-webkit-scrollbar{display:none}
.airport{
  scroll-snap-align:start;flex:0 0 auto;display:flex;align-items:center;gap:8px;
  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;
  padding:9px 12px;white-space:nowrap;
}
.airport .dot{width:8px;height:8px;border-radius:50%;flex:none}
.airport .code{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--white)}
.airport .cidade{font-size:11px;color:var(--muted);font-family:var(--ui)}
.dot.green{background:var(--green);box-shadow:0 0 6px var(--green)}
.dot.yellow{background:var(--yellow);box-shadow:0 0 6px var(--yellow)}
.dot.red{background:var(--red);box-shadow:0 0 6px var(--red)}
.dot.unknown{background:var(--muted-dim)}
@media(min-width:760px){
  .ops-strip{display:grid;grid-template-columns:repeat(6,1fr);overflow:visible}
  .airport{justify-content:center}
}

/* ---------- assinatura institucional discreta ---------- */
.ow-kicker{
  margin:22px 0 6px;padding-top:16px;border-top:1px solid var(--line-hair);
  font-size:11px;letter-spacing:.04em;color:var(--muted-dim);text-align:center;
}
.ow-kicker b{color:var(--muted);font-weight:700}

/* ---------- MASTHEAD: manchete dominante + 3 destaques ---------- */
.masthead{display:grid;gap:22px;margin-top:8px}
.lead{
  position:relative;border-radius:4px;overflow:hidden;min-height:400px;
  background:var(--navy-900);cursor:pointer;
}
.lead .cover{position:absolute;inset:0;background-size:cover;background-position:center center}
.lead .cover::after{
  content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(4,12,18,0) 32%,rgba(3,10,15,.94) 100%);
}
.lead-copy{position:relative;z-index:2;padding:26px 22px 24px;display:flex;flex-direction:column;justify-content:flex-end;min-height:400px}
.eyebrow{
  font-family:var(--ui);font-size:11.5px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--cyan-dim);margin-bottom:12px;
}
.lead h1{font-size:30px;line-height:1.08;font-weight:600;letter-spacing:-.01em;margin-bottom:12px;color:var(--white)}
.lead p{font-family:var(--editorial);font-size:17px;line-height:1.5;color:#dbe8ef;max-width:60ch;margin-bottom:12px}
.byline{font-family:var(--ui);font-size:12px;color:var(--muted)}
.illustration-note{
  position:absolute;left:22px;top:20px;z-index:2;font-family:var(--ui);
  font-size:10.5px;letter-spacing:.03em;color:var(--muted-dim);
  background:rgba(6,28,43,.6);padding:4px 9px;border-radius:99px;
}

.highlights{display:flex;flex-direction:column}
.highlight{
  display:grid;grid-template-columns:64px 1fr;gap:14px;align-items:start;
  padding-block:16px;border-top:1px solid var(--line-hair);cursor:pointer;
}
.highlight:first-child{border-top:0;padding-top:0}
.highlight .thumb{width:64px;height:64px;border-radius:4px;background-size:cover;background-position:center;background-color:var(--navy-800);flex:none}
.highlight .eyebrow{margin-bottom:6px;font-size:10.5px}
.highlight h3{font-size:16px;line-height:1.3;font-weight:600;color:var(--white)}
.highlight .byline{margin-top:6px;display:block}

@media(min-width:760px){
  .masthead{grid-template-columns:1.7fr 1fr}
  .lead{min-height:520px}
  .lead-copy{min-height:520px;padding:40px}
  .lead h1{font-size:42px}
  .lead p{font-size:18px}
}

/* ---------- seções editoriais ---------- */
.ed-section{margin-top:52px}
.ed-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:22px;padding-bottom:14px;border-bottom:2px solid var(--line)}
.ed-head h2{font-family:var(--ui);font-size:22px;font-weight:800;color:var(--white);letter-spacing:-.01em}
.ed-sub{font-family:var(--ui);font-size:12px;color:var(--muted-dim);white-space:nowrap}

/* Últimas Notícias: 1 item em destaque + lista tipográfica, sem caixas */
.latest-body{display:grid;gap:28px}
.latest-feature{display:grid;gap:14px;cursor:pointer;padding-bottom:22px;border-bottom:1px solid var(--line-hair)}
.latest-feature .thumb{width:100%;aspect-ratio:16/8;border-radius:4px;background-size:cover;background-position:center;background-color:var(--navy-900);position:relative}
.latest-feature h3{font-size:24px;line-height:1.15;font-weight:600}
.latest-feature p{font-family:var(--editorial);font-size:15.5px;line-height:1.5;color:var(--muted);max-width:68ch}
.row-list{display:flex;flex-direction:column}
.row{display:flex;gap:14px;align-items:baseline;padding-block:14px;border-top:1px solid var(--line-hair);cursor:pointer}
.row:first-child{border-top:0}
.row .row-index{font-family:var(--ui);font-size:12px;color:var(--muted-dim);flex:none;width:16px}
.row-main h3{font-size:16.5px;line-height:1.35;font-weight:600}
.row-main .byline{margin-top:5px}

@media(min-width:760px){
  .latest-body{grid-template-columns:1.3fr 1fr;align-items:start}
  .latest-feature{border-bottom:0;padding-bottom:0}
  .latest-feature h3{font-size:27px}
}

/* Mercado & Energia: assimétrico, item maior + lista compacta ao lado */
.market-body{display:grid;gap:26px}
.market-feature{display:grid;gap:12px;cursor:pointer}
.market-feature .thumb{width:100%;aspect-ratio:16/9;border-radius:4px;background-size:cover;background-position:center;background-color:var(--navy-900)}
.market-feature h3{font-size:22px;line-height:1.18;font-weight:600}
.market-feature p{font-family:var(--editorial);font-size:15px;line-height:1.5;color:var(--muted)}
@media(min-width:760px){
  .market-body{grid-template-columns:1fr 1fr;gap:40px}
  .market-feature h3{font-size:25px}
}

/* Operações Offshore: trilho horizontal cinematográfico */
.ops-rail{display:flex;gap:16px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.ops-rail::-webkit-scrollbar{display:none}
.ops-card{
  scroll-snap-align:start;flex:0 0 auto;width:280px;border-radius:6px;overflow:hidden;
  position:relative;min-height:340px;cursor:pointer;background:var(--navy-900);
}
.ops-card .cover{position:absolute;inset:0;background-size:cover;background-position:center}
.ops-card .cover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,12,18,0) 40%,rgba(3,10,15,.92) 100%)}
.ops-card-copy{position:relative;z-index:2;padding:18px;display:flex;flex-direction:column;justify-content:flex-end;min-height:340px}
.ops-card h3{font-size:18px;line-height:1.25;font-weight:600;color:var(--white)}
@media(min-width:760px){ .ops-card{width:320px;min-height:380px} .ops-card-copy{min-height:380px} }

/* Carreiras: lista limpa, sem grade de caixas */
.career-list{display:flex;flex-direction:column}
.career-row{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:16px;padding-block:18px;border-top:1px solid var(--line-hair)}
.career-row:first-child{border-top:0}
.career-row .ic{font-size:22px}
.career-row h3{font-family:var(--ui);font-size:16px;font-weight:700;color:var(--white)}
.career-row p{font-family:var(--ui);font-size:12.5px;color:var(--muted-dim);margin-top:3px}
.career-row .go{color:var(--cyan);font-size:18px}

/* ---------- CTA único (o único lugar, além do header/footer, com laranja) ---------- */
.ow-cta-block{
  margin-top:56px;border-radius:8px;overflow:hidden;position:relative;
  background:linear-gradient(120deg,var(--navy-900) 0%,#0b2416 140%);
  border:1px solid var(--orange-dim);padding:28px 24px;
}
.ow-cta-eyebrow{font-family:var(--ui);font-size:11px;letter-spacing:.08em;color:var(--orange);text-transform:uppercase;font-weight:800}
.ow-cta-block h3{font-family:var(--ui);font-size:23px;font-weight:800;margin:8px 0 8px;color:var(--white)}
.ow-cta-block p{font-family:var(--editorial);color:#d8e5eb;font-size:15px;line-height:1.5;margin:0 0 18px;max-width:56ch}
.ow-cta-btn{
  display:inline-block;background:var(--orange);color:#1a0d02;font-weight:800;font-size:13.5px;
  padding:13px 20px;border-radius:6px;font-family:var(--ui);
}
@media(min-width:760px){
  .ow-cta-block{display:grid;grid-template-columns:1fr auto;align-items:center;gap:24px;padding:34px 36px}
  .ow-cta-block p{margin-bottom:0}
}

/* ---------- Ecossistema OffshoreWorks ---------- */
.eco-section{margin-top:52px}
.eco-head{text-align:center;margin-bottom:26px}
.eco-head .eyebrow{justify-content:center;display:block;text-align:center;color:var(--muted-dim)}
.eco-head h2{font-family:var(--ui);font-size:21px;font-weight:800;color:var(--white)}
.eco-grid{display:grid;gap:14px}
.eco-card{
  border:1px solid var(--line-soft);border-radius:8px;padding:22px 20px;background:var(--navy-900);
  display:flex;flex-direction:column;gap:8px;
}
.eco-card.active{border-color:var(--cyan-dim)}
.eco-mark{font-family:var(--ui);font-size:20px;font-weight:800}
.eco-mark span{color:var(--cyan)}
.eco-card p{font-family:var(--ui);font-size:12.5px;color:var(--muted);line-height:1.5;margin:0}
.eco-status{font-family:var(--ui);font-size:10px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin-top:auto;padding-top:10px}
.eco-status.on{color:var(--green)}
.eco-status.soon{color:var(--muted-dim)}
.eco-card .eco-link{color:var(--cyan);font-size:12.5px;font-weight:700;margin-top:2px}
@media(min-width:760px){ .eco-grid{grid-template-columns:repeat(3,1fr)} }

/* ---------- newsletter ---------- */
.newsletter{margin-top:52px;padding-top:26px;border-top:1px solid var(--line-hair)}
.newsletter h3{font-family:var(--ui);font-size:13px;color:var(--muted);font-weight:700;letter-spacing:.02em;text-transform:uppercase;margin-bottom:12px}
.subscribe{display:flex;max-width:440px}
.subscribe input{min-width:0;flex:1;padding:12px;border:1px solid var(--line-soft);border-right:0;border-radius:6px 0 0 6px;background:var(--navy-900);color:var(--white);font-family:inherit}
.subscribe button{border:0;background:var(--cyan);color:var(--navy-950);font-weight:800;padding:0 16px;border-radius:0 6px 6px 0}

footer{margin-top:40px;border-top:1px solid var(--line-soft);padding:24px 0 20px;color:var(--muted-dim);font-size:12px}
.footer{display:flex;flex-direction:column;gap:6px}
@media(min-width:760px){.footer{flex-direction:row;align-items:center;justify-content:space-between}}

/* ---------- tab bar fixa (mobile / futuro app) ---------- */
.tabbar{
  position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;
  background:rgba(8,28,40,.96);backdrop-filter:blur(10px);border-top:1px solid var(--line);
  padding-bottom:env(safe-area-inset-bottom);
}
.tabbar a{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px 8px;
  font-size:10px;font-weight:700;color:var(--muted-dim);font-family:var(--ui);
}
.tabbar a .ti{font-size:18px}
.tabbar a.active{color:var(--cyan)}
@media(min-width:760px){.tabbar{display:none}}
</style>
</head>
<body>

<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

<div class="topline"><div class="container"><span>OWNews • Informação para quem vive o offshore.</span><span>by OffshoreWorks</span></div></div>

<header>
  <div class="container nav">
    <a class="logo" href="#inicio">OW<span>News</span></a>
    <button class="menu-btn" aria-label="Abrir menu" aria-expanded="false" id="menuBtn">☰</button>
    <nav class="links" id="navLinks">
      <a href="#destaque">NOTÍCIAS</a>
      <a href="#mercado">MERCADO</a>
      <a href="#operacoes">OFFSHORE</a>
      <a href="#carreiras">CARREIRAS</a>
      <a class="shop-btn" href="https://www.offshoreworks.com.br">LOJA OFFSHOREWORKS →</a>
    </nav>
  </div>
</header>

<main class="container" id="conteudo">

  <section class="ops" aria-label="Condições nos aeroportos offshore">
    <div class="ops-head">
      <span class="live-dot"></span>
      <strong>Condições nos aeroportos offshore</strong>
    </div>
    <div class="ops-strip" id="opsStrip"></div>
  </section>

  <section class="masthead" id="destaque" aria-label="Destaque">
    <article class="lead" id="heroCard"></article>
    <aside class="highlights" id="highlightsList"></aside>
  </section>

  <p class="ow-kicker">OWNews é uma publicação <b>OffshoreWorks</b> — informação selecionada para quem vive o offshore.</p>

  <section class="ed-section" id="ultimas">
    <div class="ed-head"><h2>Últimas Notícias</h2><span class="ed-sub">Direto das fontes oficiais</span></div>
    <div class="latest-body" id="ultimasBody"></div>
  </section>

  <section class="ed-section" id="mercado">
    <div class="ed-head"><h2>Mercado &amp; Energia</h2><span class="ed-sub">Royalties, leilões e regulação</span></div>
    <div class="market-body" id="mercadoBody"></div>
  </section>

  <section class="ed-section" id="operacoes">
    <div class="ed-head"><h2>Operações Offshore</h2><span class="ed-sub">Plataformas, poços e campo</span></div>
    <div class="ops-rail" id="operacoesBody"></div>
  </section>

  <section class="ed-section" id="carreiras">
    <div class="ed-head"><h2>Carreiras</h2><span class="ed-sub">Para quem quer entrar ou evoluir no offshore</span></div>
    <div class="career-list">
      <a class="career-row" href="#funcoes"><span class="ic">👷</span><div><h3>Funções a bordo</h3><p>O que cada profissional faz</p></div><span class="go">→</span></a>
      <a class="career-row" href="#cursos"><span class="ic">🎓</span><div><h3>Cursos necessários</h3><p>O que você precisa pra começar</p></div><span class="go">→</span></a>
      <a class="career-row" href="#escolas"><span class="ic">🏢</span><div><h3>Escolas e centros</h3><p>Instituições e faixas de preço</p></div><span class="go">→</span></a>
      <a class="career-row" href="#dicas"><span class="ic">🧭</span><div><h3>Carreira &amp; dicas</h3><p>Conteúdo pra evoluir</p></div><span class="go">→</span></a>
      <a class="career-row" href="#vagas"><span class="ic">💼</span><div><h3>Vagas offshore</h3><p>Oportunidades em destaque</p></div><span class="go">→</span></a>
    </div>
  </section>

  <section class="ow-cta-block" id="loja">
    <div>
      <div class="ow-cta-eyebrow">OffshoreWorks</div>
      <h3>Equipamentos e identidade para quem vive o offshore</h3>
      <p>Espaço oficial para campanhas, lançamentos e produtos OffshoreWorks.</p>
    </div>
    <a class="ow-cta-btn" href="https://www.offshoreworks.com.br">Conheça a loja →</a>
  </section>

  <section class="eco-section" id="ecossistema">
    <div class="eco-head">
      <span class="eyebrow">Ecossistema</span>
      <h2>OffshoreWorks</h2>
    </div>
    <div class="eco-grid">
      <article class="eco-card active">
        <div class="eco-mark">Offshore<span>Works</span></div>
        <p>Equipamentos, lifestyle e identidade para quem vive o offshore.</p>
        <a class="eco-link" href="https://www.offshoreworks.com.br">Visitar →</a>
        <span class="eco-status on">● Ativo</span>
      </article>
      <article class="eco-card">
        <div class="eco-mark">OW</div>
        <p>A marca por trás do ecossistema offshore.</p>
        <span class="eco-status soon">Em breve</span>
      </article>
      <article class="eco-card">
        <div class="eco-mark">OW <span>Lab</span></div>
        <p>Inovação e novos projetos para o setor offshore.</p>
        <span class="eco-status soon">Em breve</span>
      </article>
    </div>
  </section>

  <section class="newsletter">
    <h3>Receba as principais notícias</h3>
    <div class="subscribe"><input type="email" placeholder="Seu e-mail" id="newsletterEmail"><button>Inscrever</button></div>
  </section>

</main>

<footer><div class="container footer"><span>OWNews • Informação para quem vive o offshore. • © 2026 OffshoreWorks</span><span>v3 — home em redesign editorial, ainda não publicada</span></div></footer>

<nav class="tabbar" aria-label="Navegação principal">
  <a href="#inicio" class="active"><span class="ti">🏠</span>Home</a>
  <a href="#destaque"><span class="ti">📰</span>Notícias</a>
  <a href="#carreiras"><span class="ti">💼</span>Carreiras</a>
  <a href="https://www.offshoreworks.com.br"><span class="ti">🛒</span>Loja</a>
</nav>

<script>
document.getElementById('menuBtn').addEventListener('click', () => {
  const nav = document.getElementById('navLinks');
  const btn = document.getElementById('menuBtn');
  const open = nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.links a').forEach(a => a.addEventListener('click', () => {
  document.getElementById('navLinks').classList.remove('open');
}));

const SUPABASE_URL = 'https://awyowuhwkqfyhwgdpepp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt';
const AEROPORTOS_URL = 'https://shrill-pond-a915.olivercamaster.workers.dev/aeroportos';

/* Snapshot real (mesmos endpoints públicos que o site já consome ao vivo),
   usado como estado inicial pra não haver "flash" de placeholder — e como
   fallback caso o fetch ao vivo não seja possível neste ambiente. */
const SEED_ARTICLES = [{"id": "25caaee6-4963-4a48-b61f-d0c9db2e3074", "title": "VÍDEO - Coletiva de imprensa sobre a descoberta de petróleo em águas profundas do Amapá, na margem equatorial brasileira", "summary": "Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás.", "image_url": null, "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/v%C3%ADdeo-coletiva-de-imprensa-sobre-a-descoberta-de-petr%C3%B3leo-em-%C3%A1guas-profundas-do-amap%C3%A1-na-margem-equatorial-brasileira", "published_at": "2026-09-12T18:50:20.664+00:00"}, {"id": "bfa73887-df22-4305-823c-4a286853f478", "title": "Navio-plataforma Alexandre de Gusmão atinge topo de produção no pré-sal", "summary": "Plataforma foi a quinta instalada em Mero, o terceiro maior campo da Petrobras", "image_url": "https://agencia.petrobras.com.br/documents/10623376/0/FPSO%20Alexandre%20de%20Gusm%C3%A3o_Foto7_Divulga%C3%A7%C3%A3o%20Petrobras/677273e5-92ce-fae4-e6c9-ca09e5692af3", "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/navio-plataforma-alexandre-de-gusm%C3%A3o-atinge-topo-de-produ%C3%A7%C3%A3o-no-pr%C3%A9-sal", "published_at": "2026-09-12T18:50:19.9+00:00"}, {"id": "bfd9e2c9-d7c2-42dd-9a1f-636d6d4ffbe8", "title": "Plataformas da Petrobras P-80 e P-82, que vão operar em Búzios, são batizadas em estaleiro em Singapura", "summary": "Em fase final de integração, as unidades iniciarão navegação para o Brasil nas próximas semanas. P-80 será a primeira a zarpar", "image_url": "https://agencia.petrobras.com.br/o/adaptive-media/image/45374257/Thumbnail-300x300/P80_Estaleiro_Foto1_Divulgacao_Seatrium.jpg?t=1787772215000", "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/plataformas-da-petrobras-p-80-e-p-82-que-v%C3%A3o-operar-em-b%C3%BAzios-s%C3%A3o-batizadas-em-estaleiro-em-singapura", "published_at": "2026-09-12T18:50:17.497+00:00"}, {"id": "fa55970d-2f6d-47e3-a69d-f117dec76c33", "title": "Royalties: ANP publica resolução sobre distribuição a municípios afetados por instalações de embarque e desembarque", "summary": "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/royalties-anp-publica-resolucao-sobre-distribuicao-a-municipios-afetados-por-instalacoes-de-embarque-e-desembarque", "published_at": "2026-09-12T18:50:14.927+00:00"}, {"id": "1d3a5e9a-f75b-48d5-9025-25d06e0dd3f2", "title": "Eólica offshore: publicada metodologia de seleção de áreas ofertadas no país", "summary": "Documento, disponível no site do MME, estabelece critérios para definição, conciliando o desenvolvimento do setor com os demais usos do espaço marinho e as exigências da Lei nº 15.097/2025", "image_url": null, "image_credit": "MME", "original_url": "https://www.gov.br/mme/pt-br/assuntos/noticias/eolica-offshore-publicada-metodologia-de-selecao-de-areas-ofertadas-no-pais", "published_at": "2026-09-08T13:44:17.752+00:00"}, {"id": "e683febd-2b17-488d-9d8c-155a2c3cd628", "title": "MME amplia adesão ao Pacto Nacional de Harmonização Regulatória do Mercado de Gás Natural", "summary": "Acordo de cooperação técnica firmado durante evento em Sergipe formalizou a entrada de novas agências reguladoras estaduais na iniciativa", "image_url": null, "image_credit": "MME", "original_url": "https://www.gov.br/mme/pt-br/assuntos/noticias/mme-amplia-adesao-ao-pacto-nacional-de-harmonizacao-regulatoria-do-mercado-de-gas-natural", "published_at": "2026-09-08T13:44:16.886+00:00"}, {"id": "8a0008ff-6e06-4cfe-beb5-58bf3eaac8af", "title": "Participação Especial: valores referentes à produção do segundo trimestre de 2026 foram distribuídos hoje a estados e municípios", "summary": "O montante total destinado aos municípios, estados e União, no período, foi de R$ 11,83 bilhões", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/participacao-especial-valores-referentes-a-producao-do-segundo-trimestre-de-2026-foram-distribuidos-hoje-a-estados-e-municipios", "published_at": "2026-09-08T13:28:16.783+00:00"}, {"id": "8b97c710-fbb6-4a91-acac-3b4999d1efb3", "title": "Royalties: valores referentes à produção de junho foram distribuídos hoje a estados e municípios", "summary": "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/royalties-valores-referentes-a-producao-de-junho-foram-distribuidos-hoje-a-estados-e-municipios", "published_at": "2026-09-08T13:28:16.167+00:00"}, {"id": "fea2fc47-4bee-47bd-9987-78f6ec40b4ae", "title": "Painel de previsões da fase de produção traz novos filtros para atividades de descomissionamento", "summary": "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/painel-de-previsoes-da-fase-de-producao-traz-novos-filtros-para-atividades-de-descomissionamento", "published_at": "2026-09-08T13:28:15.766+00:00"}, {"id": "2e11fcf1-727b-4469-9f27-31b08c568ffc", "title": "Petrobras inicia negociação para blocos exploratórios em Gana", "summary": "Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás.", "image_url": null, "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/petrobras-inicia-negocia%C3%A7%C3%A3o-para-blocos-explorat%C3%B3rios-em-gana", "published_at": "2026-09-08T11:48:06.862+00:00"}, {"id": "5b9dc5e8-67cd-4d0b-808e-42bc2639578a", "title": "Campo de Búzios bate recordes mensal e diário de exportação de gás natural", "summary": "Pela primeira vez, marca supera 10 milhões de m³/d em um mês", "image_url": "https://agencia.petrobras.com.br/o/adaptive-media/image/23124790/Thumbnail-300x300/P-74+%284%29.jpg?t=1724083784000", "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/campo-de-b%C3%BAzios-bate-recordes-mensal-e-di%C3%A1rio-de-exporta%C3%A7%C3%A3o-de-g%C3%A1s-natural", "published_at": "2026-09-08T11:48:05.657+00:00"}, {"id": "a1517de9-b259-4a31-9b22-3b6b04b9199e", "title": "Gás natural: prorrogado até 14/9 o prazo da consulta pública sobre acesso de terceiros a gasodutos de escoamento e instalações de processamento", "summary": "A audiência pública sobre o tema será em 1/10", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/gas-natural-prorrogado-ate-14-9-o-prazo-da-consulta-publica-sobre-acesso-de-terceiros-a-gasodutos-de-escoamento-e-instalacoes-de-processamento", "published_at": "2026-09-08T11:20:29.148+00:00"}, {"id": "99b0b760-e786-4b3f-aa22-c5719248483c", "title": "ANP divulga dados consolidados da produção de petróleo e gás em julho de 2026", "summary": "No mês, foram produzidos 5,851milhões de barris de óleo equivalente por dia (boe/d) de petróleo e gás natural.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/anp-divulga-dados-consolidados-da-producao-de-petroleo-e-gas-em-julho-de-2026", "published_at": "2026-09-08T11:20:26.632+00:00"}, {"id": "01e00bd1-3f0e-456b-861a-39f8cf48042e", "title": "CGOB: ANP publica Informes Técnicos que permitem início da certificação de produtores e importadores de biometano", "summary": "Documentos detalham procedimentos e documentação para certificação de origem do biometano com vistas à emissão do CGOB", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/cgob-anp-publica-informes-tecnicos-que-permitem-inicio-da-certificacao-de-produtores-e-importadores-de-biometano", "published_at": "2026-09-08T11:20:26.033+00:00"}, {"id": "efb7328e-d57b-478b-8c62-478601c58ba6", "title": "Aprovada a indicação de 24 blocos na Bacia Potiguar para futuros ciclos da Oferta Permanente de Concessão (OPC)", "summary": "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/aprovada-a-indicacao-de-24-blocos-na-bacia-potiguar-para-futuros-ciclos-da-oferta-permanente-de-concessao-opc", "published_at": "2026-09-08T11:20:25.658+00:00"}, {"id": "90f0146a-c08a-4b4a-8e48-58c8dd5b7a84", "title": "ANP, em parceria com o Banco Mundial, lança campanha de medição de metano", "summary": "Ação visa promover a capacitação técnica em tecnologias de medição, detecção e quantificação de metano", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/anp-em-parceria-com-o-banco-mundial-lanca-campanha-de-medicao-de-metano", "published_at": "2026-09-08T11:20:23.137+00:00"}, {"id": "91566f57-a883-467e-b0de-0d13d7ad034d", "title": "Produção brasileira de petróleo e gás alcança 5,851 milhões de boe/d em julho", "summary": "A produção brasileira de petróleo e gás natural alcançou 5,851 milhões de barris de óleo equivalente por dia em julho de 2026. Segundo a ANP, a produção de petróleo foi de 4,498 milhões de barris por dia, alta de 13,6% em relação a julho de 2025.", "image_url": null, "image_credit": null, "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/anp-divulga-dados-consolidados-da-producao-de-petroleo-e-gas-em-julho-de-2026/", "published_at": "2026-09-08T00:43:32.229039+00:00"}];
const SEED_AIRPORTS_STATUS = {"SBFS": "g", "SBMI": "g", "SBCB": "g", "SBVT": "g", "SBME": "g", "SBJR": "g"};

const AEROPORTOS_ORDEM = [
  { codigo:'SBJR', nome:'Jacarepaguá' },
  { codigo:'SBMI', nome:'Maricá' },
  { codigo:'SBCB', nome:'Cabo Frio' },
  { codigo:'SBME', nome:'Macaé' },
  { codigo:'SBFS', nome:'Farol de São Tomé' },
  { codigo:'SBVT', nome:'Vitória' }
];

function tempoRelativo(iso){
  try{
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric:'auto' });
    if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
    const diffH = Math.round(diffMin / 60);
    if (Math.abs(diffH) < 24) return rtf.format(-diffH, 'hour');
    return rtf.format(-Math.round(diffH / 24), 'day');
  } catch { return ''; }
}

function escaparHTML(t){
  return String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderAirports(statusMap){
  const strip = document.getElementById('opsStrip');
  strip.innerHTML = AEROPORTOS_ORDEM.map(a => {
    const s = statusMap[a.codigo];
    const classe = s === 'g' ? 'green' : s === 'y' ? 'yellow' : s === 'r' ? 'red' : 'unknown';
    return \`<div class="airport"><span class="dot \${classe}"></span><span class="code">\${a.codigo}</span><span class="cidade">\${a.nome}</span></div>\`;
  }).join('');
}

function statusMapFromApi(retorno){
  const map = {};
  const lista = Array.isArray(retorno && retorno.aeroportos) ? retorno.aeroportos : [];
  lista.forEach(item => {
    const info = Array.isArray(item.dados) ? item.dados : [];
    if (info[0]) map[info[0]] = info[4];
  });
  return map;
}

/* ---------------------------------------------------------------
   Imagem em 3 níveis (nunca "sem imagem"), mas usada com moderação:
   só manchete, destaques, item em foco de cada seção e trilho de
   Operações Offshore recebem tratamento visual — o resto da lista é
   tipografia pura. Isso evita a "grade de cards iguais".
   Quando não há foto real, a ilustração de fallback nunca finge ser
   fotografia (selo "ilustração editorial") e varia por matéria (espelho +
   leve variação de matiz a partir de um hash do id), pra não repetir o
   mesmo desenho em sequência.
------------------------------------------------------------------ */
function hashSimples(str){
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

function svgDataUri(svg){
  return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\\s{2,}/g, ' '));
}

const FALLBACK_SVGS = {
  Petrobras: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="skyP" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0a2c40"/><stop offset="1" stop-color="#061c2b"/>
      </linearGradient>
      <radialGradient id="glowP" cx="74%" cy="26%" r="42%">
        <stop offset="0" stop-color="#12a8ee" stop-opacity="0.22"/><stop offset="1" stop-color="#12a8ee" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="450" fill="url(#skyP)"/>
    <rect width="800" height="450" fill="url(#glowP)"/>
    <rect y="298" width="800" height="152" fill="#0a2c40"/>
    <line x1="0" y1="298" x2="800" y2="298" stroke="#16445e" stroke-width="1"/>
    <g stroke="#123c53" stroke-width="2" fill="none" opacity="0.7">
      <path d="M0 320 Q100 310 200 320 T400 320 T600 320 T800 320"/>
      <path d="M0 350 Q100 340 200 350 T400 350 T600 350 T800 350"/>
    </g>
    <g stroke="#1c4f6c" stroke-width="3" fill="none">
      <path d="M520 298 L520 214 M600 298 L600 202 M680 298 L680 214"/>
      <path d="M500 298 L560 214 M640 298 L600 202 M700 298 L640 214"/>
    </g>
    <rect x="500" y="196" width="180" height="16" rx="2" fill="#123c53"/>
    <rect x="585" y="150" width="6" height="46" fill="#123c53"/>
    <circle cx="588" cy="146" r="5" fill="#5fc4ee"/>
    <circle cx="588" cy="146" r="13" fill="#12a8ee" opacity="0.25"/>
  </svg>\`,

  MME: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="skyM" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0a2c40"/><stop offset="1" stop-color="#061c2b"/>
      </linearGradient>
      <radialGradient id="glowM" cx="26%" cy="20%" r="46%">
        <stop offset="0" stop-color="#5fc4ee" stop-opacity="0.20"/><stop offset="1" stop-color="#5fc4ee" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="450" fill="url(#skyM)"/>
    <rect width="800" height="450" fill="url(#glowM)"/>
    <rect y="300" width="800" height="150" fill="#0a2c40"/>
    <line x1="0" y1="300" x2="800" y2="300" stroke="#16445e" stroke-width="1"/>
    <g stroke="#1c4f6c" stroke-width="3" fill="none" stroke-linecap="round">
      <line x1="200" y1="300" x2="200" y2="140"/>
      <line x1="200" y1="150" x2="150" y2="120"/>
      <line x1="200" y1="150" x2="245" y2="105"/>
      <line x1="200" y1="150" x2="215" y2="200"/>
      <line x1="430" y1="300" x2="430" y2="110"/>
      <line x1="430" y1="120" x2="378" y2="86"/>
      <line x1="430" y1="120" x2="478" y2="70"/>
      <line x1="430" y1="120" x2="446" y2="176"/>
      <line x1="630" y1="300" x2="630" y2="160"/>
      <line x1="630" y1="170" x2="584" y2="140"/>
      <line x1="630" y1="170" x2="670" y2="122"/>
      <line x1="630" y1="170" x2="644" y2="222"/>
    </g>
  </svg>\`,

  ANP: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0a2c40"/><stop offset="1" stop-color="#061c2b"/>
      </linearGradient>
    </defs>
    <rect width="800" height="450" fill="url(#skyA)"/>
    <g stroke="#123c53" stroke-width="1.5" fill="none" opacity="0.6">
      <path d="M-20 120 Q200 90 420 130 T820 110"/>
      <path d="M-20 180 Q200 150 420 190 T820 170"/>
      <path d="M-20 240 Q200 215 420 250 T820 230"/>
    </g>
    <g stroke="#1c4f6c" stroke-width="3" fill="none">
      <path d="M560 380 L620 190 L680 380"/>
      <path d="M578 330 L662 330 M588 280 L652 280 M598 235 L642 235"/>
    </g>
    <circle cx="620" cy="176" r="5" fill="#5fc4ee"/>
    <circle cx="620" cy="176" r="13" fill="#12a8ee" opacity="0.22"/>
  </svg>\`,

  default: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <defs>
      <radialGradient id="glowD" cx="78%" cy="8%" r="60%">
        <stop offset="0" stop-color="#12a8ee" stop-opacity="0.16"/><stop offset="1" stop-color="#12a8ee" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="skyD" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#061c2b"/><stop offset="0.78" stop-color="#0a2c40"/>
      </linearGradient>
    </defs>
    <rect width="800" height="450" fill="url(#skyD)"/>
    <rect width="800" height="450" fill="url(#glowD)"/>
    <line x1="0" y1="290" x2="800" y2="290" stroke="#16445e" stroke-width="1"/>
    <g stroke="#16445e" stroke-width="2" fill="none">
      <path d="M600 290 L600 210 M660 290 L660 200 M720 290 L720 210"/>
      <path d="M580 290 L620 210 M700 290 L660 200 M740 290 L700 210"/>
    </g>
    <rect x="580" y="192" width="160" height="14" rx="2" fill="#123c53"/>
  </svg>\`
};

const FALLBACK_IMAGES = Object.fromEntries(
  Object.entries(FALLBACK_SVGS).map(([fonte, svg]) => [fonte, svgDataUri(svg)])
);

function imagemDe(noticia){
  if (noticia.image_url) return { src: noticia.image_url, ilustracao: false, variant: '' };
  const h = hashSimples(noticia.id || noticia.title || '');
  const flip = (h % 2 === 0) ? 'scaleX(-1)' : 'none';
  const hue = (h % 5) * 6 - 12; // leve variação, não muda a paleta de marca
  return {
    src: FALLBACK_IMAGES[noticia.image_credit] || FALLBACK_IMAGES.default,
    ilustracao: true,
    variant: \`transform:\${flip};filter:hue-rotate(\${hue}deg)\`
  };
}

function coverStyle(img){
  return img.ilustracao
    ? \`background-image:url('\${img.src}');\${img.variant}\`
    : \`background-image:url('\${img.src}')\`;
}

function cartaoFonte(fonte){
  return escaparHTML((fonte || 'OWNews').toUpperCase());
}

function irPara(id){
  return \`window.location.href='/noticia?id=\${encodeURIComponent(id)}'\`;
}

/* ---------------------------------------------------------------
   Classificação editorial leve, só pra organizar as seções (o banco não
   tem campo de categoria — é inferida do título/resumo).
------------------------------------------------------------------ */
const PALAVRAS_OPERACOES = [
  "plataforma","navio-plataforma","fpso","sonda","poço","poco","perfuração","perfuracao",
  "descomissionamento","pré-sal","pre-sal","margem equatorial","búzios","buzios","campo",
  "águas profundas","aguas profundas","uep","mero","tupi"
];
const PALAVRAS_MERCADO = [
  "royalties","participação especial","participacao especial","licitação","licitacao",
  "leilão","leilao","concessão","concessao","oferta permanente","bloco","bacia",
  "gás natural","gas natural","eólica offshore","eolica offshore","exportação","exportacao",
  "hidrocarbonetos","gasoduto","mercado"
];

function classificar(n){
  const t = ((n.title || '') + ' ' + (n.summary || '')).toLowerCase();
  if (PALAVRAS_OPERACOES.some(p => t.includes(p))) return 'operacoes';
  if (PALAVRAS_MERCADO.some(p => t.includes(p))) return 'mercado';
  return 'geral';
}

function renderHero(noticia){
  const hero = document.getElementById('heroCard');
  const img = imagemDe(noticia);
  hero.innerHTML = \`
    <div class="cover" style="\${coverStyle(img)}"></div>
    \${img.ilustracao ? '<span class="illustration-note">Ilustração editorial OWNews</span>' : ''}
    <div class="lead-copy">
      <span class="eyebrow">\${cartaoFonte(noticia.image_credit)} · Destaque</span>
      <h1>\${escaparHTML(noticia.title)}</h1>
      <p>\${escaparHTML(noticia.summary)}</p>
      <span class="byline">\${tempoRelativo(noticia.published_at)}</span>
    </div>\`;
  hero.onclick = () => { window.location.href = '/noticia?id=' + encodeURIComponent(noticia.id); };
}

function renderHighlights(lista){
  const el = document.getElementById('highlightsList');
  el.innerHTML = lista.map(n => {
    const img = imagemDe(n);
    return \`
    <article class="highlight" onclick="\${irPara(n.id)}">
      <div class="thumb" style="\${coverStyle(img)}"></div>
      <div>
        <span class="eyebrow">\${cartaoFonte(n.image_credit)}</span>
        <h3>\${escaparHTML(n.title)}</h3>
        <span class="byline">\${tempoRelativo(n.published_at)}</span>
      </div>
    </article>\`;
  }).join('');
}

function renderUltimas(lista){
  const el = document.getElementById('ultimasBody');
  if (!lista.length) { el.innerHTML = ''; return; }
  const [destaque, ...resto] = lista;
  const img = imagemDe(destaque);
  el.innerHTML = \`
    <article class="latest-feature" onclick="\${irPara(destaque.id)}">
      <div class="thumb" style="\${coverStyle(img)}"></div>
      <span class="eyebrow">\${cartaoFonte(destaque.image_credit)}</span>
      <h3>\${escaparHTML(destaque.title)}</h3>
      <p>\${escaparHTML(destaque.summary)}</p>
      <span class="byline">\${tempoRelativo(destaque.published_at)}</span>
    </article>
    <div class="row-list">
      \${resto.map((n,i) => \`
        <article class="row" onclick="\${irPara(n.id)}">
          <span class="row-index">\${String(i+2).padStart(2,'0')}</span>
          <div class="row-main">
            <h3>\${escaparHTML(n.title)}</h3>
            <span class="byline">\${cartaoFonte(n.image_credit)} · \${tempoRelativo(n.published_at)}</span>
          </div>
        </article>\`).join('')}
    </div>\`;
}

function renderMercado(lista){
  const el = document.getElementById('mercadoBody');
  const section = document.getElementById('mercado');
  if (!lista.length) { section.hidden = true; return; }
  section.hidden = false;
  const [destaque, ...resto] = lista;
  const img = imagemDe(destaque);
  el.innerHTML = \`
    <article class="market-feature" onclick="\${irPara(destaque.id)}">
      <div class="thumb" style="\${coverStyle(img)}"></div>
      <span class="eyebrow">\${cartaoFonte(destaque.image_credit)}</span>
      <h3>\${escaparHTML(destaque.title)}</h3>
      <p>\${escaparHTML(destaque.summary)}</p>
      <span class="byline">\${tempoRelativo(destaque.published_at)}</span>
    </article>
    <div class="row-list">
      \${resto.map((n,i) => \`
        <article class="row" onclick="\${irPara(n.id)}">
          <span class="row-index">\${String(i+2).padStart(2,'0')}</span>
          <div class="row-main">
            <h3>\${escaparHTML(n.title)}</h3>
            <span class="byline">\${cartaoFonte(n.image_credit)} · \${tempoRelativo(n.published_at)}</span>
          </div>
        </article>\`).join('')}
    </div>\`;
}

function renderOperacoes(lista){
  const el = document.getElementById('operacoesBody');
  const section = document.getElementById('operacoes');
  if (!lista.length) { section.hidden = true; return; }
  section.hidden = false;
  el.innerHTML = lista.map(n => {
    const img = imagemDe(n);
    return \`
    <article class="ops-card" onclick="\${irPara(n.id)}">
      <div class="cover" style="\${coverStyle(img)}"></div>
      \${img.ilustracao ? '<span class="illustration-note">Ilustração editorial</span>' : ''}
      <div class="ops-card-copy">
        <span class="eyebrow">\${cartaoFonte(n.image_credit)}</span>
        <h3>\${escaparHTML(n.title)}</h3>
        <span class="byline">\${tempoRelativo(n.published_at)}</span>
      </div>
    </article>\`;
  }).join('');
}

function renderTudo(noticias){
  if (!noticias.length) return;

  const hero = noticias.slice(0, 8).find(n => n.image_url) || noticias[0];
  const restantesPosHero = noticias.filter(n => n.id !== hero.id);
  const destaques = restantesPosHero.slice(0, 3);
  const usados = new Set([hero.id, ...destaques.map(n => n.id)]);
  const pool = noticias.filter(n => !usados.has(n.id));

  renderHero(hero);
  renderHighlights(destaques);
  renderUltimas(pool.slice(0, 6));

  const mercado = pool.filter(n => classificar(n) === 'mercado').slice(0, 5);
  const operacoes = pool.filter(n => classificar(n) === 'operacoes').slice(0, 6);
  renderMercado(mercado);
  renderOperacoes(operacoes);
}

/* 1) estado inicial imediato, com o snapshot real — sem tela em branco */
renderAirports(SEED_AIRPORTS_STATUS);
renderTudo(SEED_ARTICLES);

/* 2) tentativa de dado ao vivo (mesmos endpoints públicos da produção). */
(async () => {
  try {
    const url = SUPABASE_URL + '/rest/v1/articles?select=id,title,summary,image_url,image_credit,original_url,published_at&status=eq.published&order=published_at.desc&limit=20';
    const resposta = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    if (!resposta.ok) throw new Error('Supabase ' + resposta.status);
    const noticias = await resposta.json();
    if (noticias.length) renderTudo(noticias);
  } catch (erro) {
    console.warn('OWNews: usando snapshot local de notícias (fetch ao vivo indisponível).', erro);
  }
})();

(async () => {
  try {
    const resposta = await fetch(AEROPORTOS_URL);
    if (!resposta.ok) throw new Error('REDEMET ' + resposta.status);
    const retorno = await resposta.json();
    renderAirports(statusMapFromApi(retorno));
  } catch (erro) {
    console.warn('OWNews: usando snapshot local de aeroportos (fetch ao vivo indisponível).', erro);
  }
})();
</script>

</body>
</html>
`;

const MANIFEST = '{\n  "name": "OWNews — Offshore",\n  "short_name": "OWNews",\n  "description": "Notícias e condições operacionais para quem vive o offshore.",\n  "start_url": "/",\n  "scope": "/",\n  "display": "standalone",\n  "orientation": "portrait",\n  "background_color": "#061c2b",\n  "theme_color": "#061c2b",\n  "lang": "pt-BR",\n  "icons": []\n}\n';

function escaparHTML(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/manifest.webmanifest") {
      return new Response(MANIFEST, {
        headers: { "Content-Type": "application/manifest+json; charset=UTF-8" }
      });
    }

    if (url.pathname === "/noticia") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response("Notícia não encontrada", { status: 404 });
      }

      const supabaseUrl = 'https://awyowuhwkqfyhwgdpepp.supabase.co';
      const supabaseKey = 'sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt';

      const apiUrl =
        supabaseUrl +
        '/rest/v1/articles?id=eq.' +
        encodeURIComponent(id) +
        '&status=eq.published&select=id,title,summary,content,image_url,image_caption,image_credit,original_url,published_at,slug';

      const resposta = await fetch(apiUrl, { headers: { apikey: supabaseKey } });

      if (!resposta.ok) {
        return new Response("Erro ao carregar notícia", { status: 500 });
      }

      const artigos = await resposta.json();

      if (!artigos.length) {
        return new Response("Notícia não encontrada", { status: 404 });
      }

      const artigo = artigos[0];
      const data = artigo.published_at
        ? new Date(artigo.published_at).toLocaleDateString('pt-BR')
        : '';

      const pagina =
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>' + escaparHTML(artigo.title) + ' | OWNews (preview)</title>' +
        '<style>body{margin:0;background:#061c2b;color:#fff;font-family:Arial,Helvetica,sans-serif;padding:24px}' +
        'a{color:#12a8ee}h1{font-size:32px;line-height:1.2}.meta{color:#9eb5c5;margin-bottom:20px}' +
        '.conteudo{font-size:18px;line-height:1.7;max-width:720px}img{max-width:100%;border-radius:8px}</style>' +
        '</head><body>' +
        '<a href="/">← Voltar ao preview OWNews</a>' +
        '<div class="meta">OWNews (preview) • ' + escaparHTML(data) + '</div>' +
        '<h1>' + escaparHTML(artigo.title) + '</h1>' +
        (artigo.image_url ? '<img src="' + escaparHTML(artigo.image_url) + '" alt="">' : '') +
        '<div class="conteudo">' + escaparHTML(artigo.content || artigo.summary).replace(/\n\n/g, '</p><p>') + '</div>' +
        '</body></html>';

      return new Response(pagina, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
    }

    return new Response("Página não encontrada (preview OWNews)", { status: 404 });
  }
};
