const HTML = String.raw`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#061c2b">
<title>OWNews — Informação para quem vive o offshore</title>
<style>
:root{
 --bg:#061c2b; --bg2:#08283a; --card:#0a2c40; --line:#16445e;
 --blue:#12a8ee; --white:#f7fafc; --muted:#9eb5c5; --orange:#ff7a00;
 --green:#42d879; --yellow:#ffd44d; --red:#ff4b4b;
}
*{box-sizing:border-box} html{scroll-behavior:smooth}
body{margin:0;background:linear-gradient(180deg,#051a28 0%,#08283a 100%);color:var(--white);font-family:Arial,Helvetica,sans-serif}
a{text-decoration:none;color:inherit} img{max-width:100%;display:block}
.container{width:min(1180px,calc(100% - 32px));margin:auto}
.topline{border-bottom:1px solid var(--line);color:#b9c9d4;font-size:12px}
.topline .container{display:flex;justify-content:space-between;gap:15px;padding:9px 0}
header{background:rgba(5,26,40,.97);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
.nav{min-height:76px;display:flex;align-items:center;gap:24px}
.logo{font-size:38px;font-weight:900;letter-spacing:-3px;white-space:nowrap}.logo span{color:var(--blue)}
.links{display:flex;align-items:center;gap:23px;margin-left:auto}.links a{font-size:13px;font-weight:800}
.shop-btn{background:#087cb9;border:1px solid #1599d5;border-radius:5px;padding:14px 17px}
.menu-btn{display:none;margin-left:auto;border:1px solid var(--line);background:#08283a;color:white;border-radius:6px;font-size:24px;width:46px;height:42px}

.air-wrap{margin:14px 0;background:#061a29;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.air-head{display:flex;align-items:center;justify-content:space-between;padding:13px 17px;border-bottom:1px solid #123c53}
.air-head strong{font-size:13px}.air-head small{color:var(--muted)}
.air-grid{display:grid;grid-template-columns:repeat(6,1fr)}
.airport{padding:11px 8px;border-right:1px solid #123c53;text-align:center;min-height:auto}
.airport:last-child{border-right:0}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:1px}
.green{background:var(--green);box-shadow:0 0 7px var(--green)}
.yellow{background:var(--yellow);box-shadow:0 0 7px var(--yellow)}
.red{background:var(--red);box-shadow:0 0 7px var(--red)}
.airport b{font-size:12px;white-space:nowrap}
.airport b em{font-style:normal;font-size:9px;color:var(--blue);margin-left:3px}
.airport small{display:none}

.hero{display:grid;grid-template-columns:1.55fr .9fr;gap:14px}
.main-story{min-height:430px;border-radius:8px;overflow:hidden;position:relative;
 background:
 linear-gradient(180deg,rgba(2,12,18,.02) 20%,rgba(2,12,18,.92) 100%),
 radial-gradient(circle at 22% 38%,#b55d24 0 5%,#244b58 22%,#0b2637 55%,#061722 100%);
 border:1px solid #153d52}
.rig-art{position:absolute;inset:0;opacity:.9;overflow:hidden}
.rig-art.has-image{opacity:1;background-size:cover;background-position:center;background-repeat:no-repeat}
.rig-art.has-image:before,.rig-art.has-image:after{display:none}
.rig-art:before{content:"";position:absolute;left:22%;bottom:31%;width:50%;height:16%;background:#07131a;border-top:5px solid #203b47;box-shadow:0 18px 0 #050d12}
.rig-art:after{content:"";position:absolute;left:47%;bottom:45%;width:5px;height:41%;background:#07131a;box-shadow:-25px 60px 0 #07131a,32px 77px 0 #07131a;transform:skew(-7deg)}
.story-copy{position:absolute;left:25px;right:25px;bottom:24px;z-index:2;max-width:700px}
.tag{display:inline-block;background:#078dcc;padding:6px 9px;border-radius:3px;font-size:11px;font-weight:900}
.story-copy h1{font-size:32px;line-height:1.08;margin:11px 0}.story-copy p{font-size:17px;line-height:1.42;margin:0 0 13px;color:#e3edf2}
.meta{color:var(--muted);font-size:12px}
.side{display:grid;gap:10px}
.side-card{background:var(--card);border:1px solid #153d52;border-radius:7px;padding:20px;display:flex;flex-direction:column;justify-content:center}
.side-card em{font-style:normal;color:var(--blue);font-size:11px;font-weight:900}.side-card h3{font-size:18px;line-height:1.3;margin:7px 0}

.ad{margin:14px 0 20px;border:1px solid #0e76a7;background:linear-gradient(90deg,#09283a,#0b4059);border-radius:8px;padding:18px 22px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:25px}
.ad-logo{font-size:29px;font-weight:900;white-space:nowrap}.ad-logo span{color:var(--orange)}.ad p{margin:0;color:#d8e5eb;line-height:1.4}.ad small{color:#9fc1d1}
.orange{background:var(--orange);padding:13px 18px;border-radius:5px;font-weight:900;white-space:nowrap}

.section-title{display:flex;align-items:center;justify-content:space-between;margin:24px 0 13px}.section-title h2{margin:0;font-size:21px}.section-title a{color:var(--blue);font-size:12px;font-weight:800}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}
.card{background:var(--card);border:1px solid #153d52;border-radius:7px;overflow:hidden}
.card-art{height:125px;background:linear-gradient(145deg,#28647e,#0a2a3d);display:flex;align-items:end;padding:12px}
.card-art span{font-size:11px;font-weight:900;background:#078dcc;padding:5px 8px;border-radius:3px}
.card-body{padding:14px}.card h3{font-size:16px;line-height:1.35;margin:0 0 15px}

.quick{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:#17445a;margin:20px 0;border:1px solid #17445a;border-radius:8px;overflow:hidden}
.quick a{background:#061c2b;padding:18px 10px;text-align:center;font-weight:800}.quick .icon{display:block;font-size:25px;margin-bottom:7px}.quick small{display:block;color:var(--muted);font-weight:400;margin-top:4px}

.bottom{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;margin-bottom:30px}.box{background:var(--card);border:1px solid #153d52;border-radius:7px;padding:20px;min-height:165px}.box h3{color:var(--blue);font-size:13px}.box p{line-height:1.4}
.btn{display:inline-block;border:1px solid var(--blue);padding:10px 14px;border-radius:4px;font-size:12px;font-weight:800}
.subscribe{display:flex}.subscribe input{min-width:0;flex:1;padding:12px;border:0;border-radius:4px 0 0 4px}.subscribe button{border:0;background:#078dcc;color:white;font-weight:800;padding:0 13px;border-radius:0 4px 4px 0}

footer{border-top:1px solid var(--line);padding:25px 0;color:#a8bdca}.footer{display:flex;align-items:center;justify-content:space-between;gap:20px}.footer .logo{font-size:28px}

@media(max-width:760px){
 .container{width:min(100% - 24px,1180px)}
 .topline .container{font-size:11px}.topline span:last-child{display:none}
 .nav{min-height:64px}.logo{font-size:31px}.menu-btn{display:block}
 .links{display:none;position:absolute;left:0;right:0;top:64px;background:#061c2b;border-bottom:1px solid var(--line);padding:10px 12px 16px;flex-direction:column;align-items:stretch;gap:0}
 .links.open{display:flex}.links a{padding:13px 12px;border-bottom:1px solid #10384d}.shop-btn{margin-top:8px;text-align:center}
 .air-head{align-items:flex-start;gap:8px;flex-direction:column}.air-grid{grid-template-columns:1fr 1fr}
 .airport{border-bottom:1px solid #123c53}.airport:nth-child(2){border-right:0}.airport:nth-child(3),.airport:nth-child(4){border-bottom:0}
 .hero{grid-template-columns:1fr}.main-story{min-height:380px}.story-copy{left:18px;right:18px;bottom:20px}.story-copy h1{font-size:27px}.story-copy p{font-size:15px}
 .side{grid-template-columns:1fr}.side-card{min-height:120px}
 .ad{grid-template-columns:1fr;gap:12px}.ad-logo{font-size:27px}.orange{text-align:center}
 .cards{grid-template-columns:1fr 1fr}.quick{grid-template-columns:1fr 1fr}.quick a:last-child{grid-column:1/-1}
 .bottom{grid-template-columns:1fr}.footer{align-items:flex-start;flex-direction:column}
}
@media(max-width:430px){
.air-grid{grid-template-columns:repeat(2,1fr)}.airport{border-right:1px solid #123c53!important;border-bottom:1px solid #123c53!important;min-height:auto;padding:10px 6px}.airport:nth-child(2n){border-right:0!important}.airport:nth-child(n+5){border-bottom:0!important}.airport b{font-size:11px}.airport b em{font-size:8px}
 .cards{grid-template-columns:1fr}.main-story{min-height:400px}.story-copy h1{font-size:25px}
}
</style>
</head>
<body>
<div class="topline"><div class="container"><span>OWNews • Informação para quem vive o offshore.</span><span>by OffshoreWorks</span></div></div>
<header><div class="container nav">
<a class="logo" href="#inicio">OW<span>News</span></a>
<button class="menu-btn" aria-label="Abrir menu" onclick="document.querySelector('.links').classList.toggle('open')">☰</button>
<nav class="links">
<a href="#noticias">NOTÍCIAS</a><a href="#carreiras">CARREIRAS</a><a href="#cursos">CURSOS</a><a href="#escolas">ESCOLAS</a><a href="#videos">VÍDEOS</a>
<a class="shop-btn" href="https://www.offshoreworks.com.br">LOJA OFFSHOREWORKS →</a>
</nav></div></header>

<main class="container" id="inicio">
<section class="air-wrap">
<div class="air-head"><strong>🚁 CONDIÇÕES NOS AEROPORTOS OFFSHORE</strong></div>
<div class="air-grid">
<div class="airport" id="airport-sbjr"><span class="dot"></span><b>Jacarepaguá <em>SBJR</em></b><small>Consultando REDEMET...</small></div>
<div class="airport" id="airport-sbmi"><span class="dot"></span><b>Maricá <em>SBMI</em></b><small>Consultando REDEMET...</small></div>
<div class="airport" id="airport-sbcb"><span class="dot"></span><b>Cabo Frio <em>SBCB</em></b><small>Consultando REDEMET...</small></div>
<div class="airport" id="airport-sbme"><span class="dot"></span><b>Macaé <em>SBME</em></b><small>Consultando REDEMET...</small></div>
<div class="airport" id="airport-sbfs"><span class="dot"></span><b>Farol de São Tomé <em>SBFS</em></b><small>Consultando REDEMET...</small></div>
<div class="airport" id="airport-sbvt"><span class="dot"></span><b>Vitória <em>SBVT</em></b><small>Consultando REDEMET...</small></div>
</div></section>

<section class="hero" id="noticias">
<article class="main-story"><div class="rig-art"></div><div class="story-copy"><span class="tag">DESTAQUE</span>
<h1>O offshore em um só lugar</h1><p>Notícias, operações, mercado, carreira e informações úteis para quem vive o setor offshore.</p><span class="meta">OWNews • Conteúdo em destaque</span></div></article>
<div class="side">
<article class="side-card"><em>OPERAÇÕES</em><h3>Notícias e movimentações das operações offshore</h3><span class="meta">Atualizações do setor</span></article>
<article class="side-card"><em>SEGURANÇA</em><h3>Segurança operacional e boas práticas a bordo</h3><span class="meta">Segurança</span></article>
<article class="side-card"><em>TECNOLOGIA</em><h3>Tecnologias que estão transformando o offshore</h3><span class="meta">Tecnologia</span></article>
</div></section>

<section class="ad" id="loja"><div class="ad-logo">⚙ Offshore<span>Works</span></div><p><b>EQUIPAMENTOS • LIFESTYLE • IDENTIDADE OFFSHORE</b><br><small>Espaço oficial para campanhas, lançamentos e produtos OffshoreWorks.</small></p><a class="orange" href="https://www.offshoreworks.com.br">CONHEÇA A LOJA →</a></section>

<div class="section-title"><h2>Mais notícias</h2><a href="#noticias">VER TODAS →</a></div>
<section class="cards">
<article class="card"><div class="card-art"><span>MERCADO</span></div><div class="card-body"><h3>Mercado de óleo e gás e os principais movimentos do setor</h3><span class="meta">Mercado</span></div></article>
<article class="card"><div class="card-art"><span>EXPLORAÇÃO</span></div><div class="card-body"><h3>Novos projetos, campanhas e exploração offshore</h3><span class="meta">Exploração</span></div></article>
<article class="card"><div class="card-art"><span>CARREIRA</span></div><div class="card-body"><h3>Funções a bordo e requisitos para cada posição</h3><span class="meta">Carreira</span></div></article>
<article class="card"><div class="card-art"><span>ENERGIA</span></div><div class="card-body"><h3>Energia offshore, inovação e sustentabilidade</h3><span class="meta">Energia</span></div></article>
</section>

<section class="quick" id="carreiras">
<a href="#funcoes"><span class="icon">👷</span>Funções a bordo<small>O que cada profissional faz</small></a>
<a href="#cursos" id="cursos"><span class="icon">🎓</span>Cursos necessários<small>O que você precisa</small></a>
<a href="#escolas" id="escolas"><span class="icon">🏢</span>Escolas e centros<small>Instituições e faixas de preço</small></a>
<a href="#dicas"><span class="icon">🧭</span>Carreira & Dicas<small>Conteúdo para evoluir</small></a>
<a href="#vagas"><span class="icon">💼</span>Vagas Offshore<small>Oportunidades em destaque</small></a>
</section>

<section class="bottom">
<div class="box"><h3>COLUNAS OWNEWS</h3><p>Mercado, bastidores, experiências e perspectivas do offshore.</p><a class="btn" href="#">VER COLUNAS</a></div>
<div class="box" id="videos"><h3>VÍDEOS EM DESTAQUE</h3><p>Operações, carreira e conteúdo audiovisual para a comunidade offshore.</p><a class="btn" href="#">ASSISTIR</a></div>
<div class="box"><h3>RECEBA AS PRINCIPAIS NOTÍCIAS</h3><p>Newsletter OWNews.</p><div class="subscribe"><input type="email" placeholder="Seu e-mail"><button>INSCREVER</button></div></div>
</section>
</main>
<footer><div class="container footer"><div class="logo">OW<span>News</span></div><span>Informação para quem vive o offshore. • © 2026 OWNews</span></div></footer>
<script>
document.querySelectorAll('.links a').forEach(a=>a.addEventListener('click',()=>document.querySelector('.links').classList.remove('open')));

const SUPABASE_URL = 'https://awyowuhwkqfyhwgdpepp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt';

async function carregarNoticias(){
  try {
  const url = SUPABASE_URL + '/rest/v1/articles?select=id,title,summary,image_url,original_url,published_at&status=eq.published&order=published_at.desc&limit=20';
    const resposta = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
if (!resposta.ok) throw new Error('Supabase ' + resposta.status);
    const noticias = await resposta.json();
    if (!noticias.length) return;

    const destaque = noticias[0];
    const imagemDestaque = document.querySelector('.main-story .rig-art');

if (imagemDestaque && destaque.image_url) {
  imagemDestaque.classList.add('has-image');
  imagemDestaque.style.backgroundImage = 'url("' + destaque.image_url + '")';
}
    const titulo = document.querySelector('.main-story h1');
    const resumo = document.querySelector('.main-story p');
    const meta = document.querySelector('.main-story .meta');
    titulo.textContent = destaque.title;
    resumo.textContent = destaque.summary;
    meta.textContent = 'OWNews • Fonte oficial';
    document.querySelector('.main-story').style.cursor = 'pointer';
document.querySelector('.main-story').onclick = () => window.location.href = '/noticia?id=' + encodeURIComponent(destaque.id);
const cards = document.querySelectorAll('.side-card');
   noticias.slice(1,5).forEach((noticia, i) => {
      if (!cards[i]) return;
      cards[i].querySelector('h3').textContent = noticia.title;
      cards[i].querySelector('.meta').textContent = 'OWNews';
      cards[i].style.cursor = 'pointer';
      cards[i].onclick = () => window.location.href = '/noticia?id=' + encodeURIComponent(noticia.id);
    });
     const maisNoticias = document.querySelectorAll('.cards .card');

    noticias.slice(4,8).forEach((noticia, i) => {
      if (!maisNoticias[i]) return;

      const tituloCard = maisNoticias[i].querySelector('h3');
      const metaCard = maisNoticias[i].querySelector('.meta');

      if (tituloCard) tituloCard.textContent = noticia.title;
      if (metaCard) metaCard.textContent = 'OWNews • Fonte oficial';

      maisNoticias[i].style.cursor = 'pointer';
      maisNoticias[i].onclick = () =>
        window.location.href = '/noticia?id=' + encodeURIComponent(noticia.id);
    }); } catch (erro) {
    console.error('OWNews: não foi possível carregar as notícias.', erro);
  }
}
  async function carregarAeroportos() {
  try {
    const resposta = await fetch(
      'https://shrill-pond-a915.olivercamaster.workers.dev/aeroportos'
    );

    if (!resposta.ok) throw new Error('REDEMET ' + resposta.status);

const retorno = await resposta.json();

const dados = Array.isArray(retorno.aeroportos)
  ? retorno.aeroportos
  : [];

    const ids = {
  SBJR: 'airport-sbjr',
  SBMI: 'airport-sbmi',
  SBCB: 'airport-sbcb',
  SBME: 'airport-sbme',
  SBFS: 'airport-sbfs',
  SBVT: 'airport-sbvt'
};

dados.forEach(item => {
  const info = Array.isArray(item.dados) ? item.dados : [];
  const codigo = info[0];
  const status = info[4];

  const elemento = document.getElementById(ids[codigo]);
  if (!elemento) return;

  const dot = elemento.querySelector('.dot');

  dot.classList.remove('green', 'yellow', 'red');

  if (status === 'g') {
    dot.classList.add('green');
  } else if (status === 'y') {
    dot.classList.add('yellow');
  } else if (status === 'r') {
    dot.classList.add('red');
  }
});

  } catch (erro) {
    console.error('OWNews: erro ao consultar REDEMET.', erro);
  }
}

carregarAeroportos();

carregarNoticias();
</script>
</body></html>
`;
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
        headers: {
          "Content-Type": "text/html; charset=UTF-8"
        }
      });
    }

    if (url.pathname === "/noticia") {
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Notícia não encontrada", {
      status: 404
    });
  }

 const supabaseUrl = 'https://awyowuhwkqfyhwgdpepp.supabase.co';
const supabaseKey = 'sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt';

const apiUrl =
  supabaseUrl +
  '/rest/v1/articles?id=eq.' +
  encodeURIComponent(id) +
'&status=eq.published&select=id,title,summary,content,image_url,image_caption,image_credit,original_url,published_at,slug';

const resposta = await fetch(apiUrl, {
  headers: {
    apikey: supabaseKey
  }
});

if (!resposta.ok) {
  return new Response("Erro ao carregar notícia", {
    status: 500
  });
}

const artigos = await resposta.json();

if (!artigos.length) {
  return new Response("Notícia não encontrada", {
    status: 404
  });
}

const artigo = artigos[0];

const camposNavegacao = 'id,title,published_at';

const urlAnterior =
  supabaseUrl +
  '/rest/v1/articles?status=eq.published' +
  '&published_at=lt.' + encodeURIComponent(artigo.published_at) +
  '&select=' + camposNavegacao +
  '&order=published_at.desc&limit=1';

const urlProxima =
  supabaseUrl +
  '/rest/v1/articles?status=eq.published' +
  '&published_at=gt.' + encodeURIComponent(artigo.published_at) +
  '&select=' + camposNavegacao +
  '&order=published_at.asc&limit=1';

const [resAnterior, resProxima] = await Promise.all([
  fetch(urlAnterior, { headers: { apikey: supabaseKey } }),
  fetch(urlProxima, { headers: { apikey: supabaseKey } })
]);

const dadosAnterior = resAnterior.ok ? await resAnterior.json() : [];
const dadosProxima = resProxima.ok ? await resProxima.json() : [];

const noticiaAnterior = dadosAnterior[0] || null;
const proximaNoticia = dadosProxima[0] || null;

const data = artigo.published_at
  ? new Date(artigo.published_at).toLocaleDateString('pt-BR')
  : '';

const pagina =
  '<!doctype html>' +
  '<html lang="pt-BR">' +
  '<head>' +
  '<meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>' + escaparHTML(artigo.title) + ' | OWNews</title>' +
  '<style>' +
  'body{margin:0;background:#061c2b;color:#fff;font-family:Arial,Helvetica,sans-serif;}' +
  'header{border-bottom:1px solid #16445e;background:#08283a;}' +
  '.nav{max-width:1100px;margin:auto;padding:22px 20px;display:flex;align-items:center;justify-content:space-between;gap:20px;}' +
  '.logo{font-size:32px;font-weight:900;color:#fff;text-decoration:none;}.logo span{color:#12a8ee;}' +
  '.loja{background:#087cb9;color:#fff;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:5px;}' +
  'main{max-width:900px;margin:50px auto;padding:0 20px;}' +
  '.voltar{color:#12a8ee;text-decoration:none;font-weight:700;}' +
  '.meta{color:#8fc7e3;font-size:14px;margin-top:35px;}' +
  'h1{font-size:44px;line-height:1.08;margin:12px 0 22px;}' +
  '.resumo{font-size:21px;line-height:1.6;color:#d8e8f1;}' +
  '.imagem-materia{margin:32px 0 38px;}.imagem-materia img{width:100%;max-height:520px;object-fit:cover;border-radius:10px;display:block;}.imagem-materia figcaption{font-size:13px;color:#8ba8b8;margin-top:9px;}' +
'.conteudo-materia{font-size:19px;line-height:1.8;color:#e4edf2;max-width:780px;}.conteudo-materia p{margin:0 0 24px;}' +
'@media(max-width:700px){.conteudo-materia{font-size:17px;line-height:1.7}.imagem-materia{margin:24px 0 30px}.imagem-materia img{max-height:360px}}' +
  '.fonte{margin-top:40px;padding:18px;border:1px solid #16445e;border-radius:8px;background:#08283a;color:#9fc5d8;}' +
  '.navegacao-noticias{margin:45px 0;padding:25px 0;border-top:1px solid #16445e;border-bottom:1px solid #16445e;display:grid;grid-template-columns:1fr auto 1fr;gap:20px;align-items:center;}.nav-noticia{color:#fff;text-decoration:none;display:flex;flex-direction:column;gap:8px;padding:10px;}.nav-noticia small{color:#12a8ee;font-size:12px;font-weight:700;}.nav-noticia strong{font-size:15px;line-height:1.4;}.proxima{text-align:right;}.voltar-centro{color:#12a8ee;text-decoration:none;font-size:13px;font-weight:800;white-space:nowrap;}' +
  '.offshoreworks{margin-top:45px;padding:25px;border:1px solid #087cb9;border-radius:8px;background:#08283a;}' +
  '.offshoreworks strong{font-size:20px;}.offshoreworks a{color:#12a8ee;}' +
  'footer{margin-top:60px;border-top:1px solid #16445e;padding:30px 20px;text-align:center;color:#8ba8b8;}' +
  '@media(max-width:700px){h1{font-size:32px}.resumo{font-size:18px}.nav{padding:16px}.logo{font-size:27px}}' +
  '</style>' +
  '</head>' +
  '<body>' +
  '<header><div class="nav">' +
  '<a class="logo" href="/">OW<span>News</span></a>' +
  '<a class="loja" href="https://www.offshoreworks.com.br">LOJA OFFSHOREWORKS →</a>' +
  '</div></header>' +
  '<main>' +
  '<a class="voltar" href="/">← VOLTAR PARA O OWNEWS</a>' +
  '<div class="meta">OWNews • ' + escaparHTML(data) + '</div>' +
  '<h1>' + escaparHTML(artigo.title) + '</h1>' +
(artigo.image_url
  ? '<figure class="imagem-materia"><img src="' + escaparHTML(artigo.image_url) + '" alt="' + escaparHTML(artigo.title) + '">' +
    (artigo.image_caption ? '<figcaption>' + escaparHTML(artigo.image_caption) + '</figcaption>' : '') +
    '</figure>'
  : '') +
'<div class="conteudo-materia">' +
  escaparHTML(artigo.content || artigo.summary).replace(/\n\n/g, '</p><p>') +
'</div>' +
  '<div class="fonte">Informações apuradas a partir de fonte oficial. A referência original será mantida pelo OWNews.</div>' +
  '<div class="navegacao-noticias">' +

(noticiaAnterior
  ? '<a class="nav-noticia anterior" href="/noticia?id=' + encodeURIComponent(noticiaAnterior.id) + '">' +
    '<small>← NOTÍCIA ANTERIOR</small>' +
    '<strong>' + escaparHTML(noticiaAnterior.title) + '</strong>' +
    '</a>'
  : '<div class="nav-noticia vazio"></div>') +

'<a class="voltar-centro" href="/">VOLTAR AO OWNEWS</a>' +

(proximaNoticia
  ? '<a class="nav-noticia proxima" href="/noticia?id=' + encodeURIComponent(proximaNoticia.id) + '">' +
    '<small>PRÓXIMA NOTÍCIA →</small>' +
    '<strong>' + escaparHTML(proximaNoticia.title) + '</strong>' +
    '</a>'
  : '<div class="nav-noticia vazio"></div>') +

'</div>' +
  '<div class="offshoreworks"><strong>OffshoreWorks</strong><br><br>Equipamentos, lifestyle e identidade para quem vive o offshore.<br><br><a href="https://www.offshoreworks.com.br">Conheça a OffshoreWorks →</a></div>' +
  '</main>' +
  '<footer>OWNews • Informação para quem vive o offshore. • © 2026 OffshoreWorks</footer>' +
  '</body></html>';

return new Response(pagina, {
  headers: {
    'Content-Type': 'text/html; charset=UTF-8'
  }
});
}

    return new Response("Página não encontrada", {
      status: 404
    });
  }
};
