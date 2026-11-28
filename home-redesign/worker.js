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
  /* Navy metalizado premium — três camadas de CSS puro, sem imagem:
     (1) glow sutil no topo (profundidade, "azul-petróleo");
     (2) sheen diagonal quase imperceptível no canto superior direito
         (sugestão de aço escovado/metal, não brilho);
     (3) degradê diagonal muito discreto do navy-800 ao navy-950 (acabamento
         de profundidade). Tudo "fixed" pra não repetir/"costurar" ao rolar,
         e leve o bastante pra não pesar no repaint. */
  background:
    radial-gradient(1400px 800px at 50% -220px, #103a52 0%, rgba(16,58,82,0) 60%),
    radial-gradient(900px 500px at 100% 8%, rgba(255,255,255,.025) 0%, rgba(255,255,255,0) 55%),
    linear-gradient(165deg, #0a2c40 0%, var(--navy-950) 45%, #05141f 100%);
  background-attachment:fixed;
  color:var(--white);
  font-family:var(--ui);
  -webkit-font-smoothing:antialiased;
  /* casa exatamente com a altura real da tabbar (conteúdo + safe-area) —
     um valor fixo deixava vão vazio em telas sem notch e sobrepunha
     conteúdo em iPhones com safe-area-inset-bottom grande. */
  padding-bottom:calc(56px + env(safe-area-inset-bottom));

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
/* Header mobile: grid de 3 colunas (menu | logo centralizado | busca) +
   subtítulo pequeno abaixo — identidade de portal/app, não blog. No
   desktop volta a ser o flex original (linha única, sem mudança). */
.nav{
  display:grid;grid-template-columns:42px 1fr 42px;align-items:center;
  gap:8px 10px;min-height:auto;padding-block:10px;
}
.nav-subtitle{
  grid-column:1 / -1;text-align:center;font-family:var(--ui);font-size:9.5px;
  letter-spacing:.08em;text-transform:uppercase;color:var(--muted-dim);
  margin-top:-4px;padding-bottom:2px;
}
.logo{
  grid-column:2;text-align:center;font-family:var(--ui);font-size:19px;font-weight:800;
  letter-spacing:-.02em;white-space:nowrap;color:var(--white);
}
.logo span{color:var(--cyan)}
.menu-btn, .search-btn{
  display:flex;align-items:center;justify-content:center;
  border:1px solid var(--line);background:var(--navy-900);color:var(--white);
  border-radius:8px;font-size:17px;width:38px;height:36px;cursor:pointer;
}
.menu-btn{grid-column:1}
.search-btn{grid-column:3}
.search-bar{
  display:none;grid-column:1 / -1;margin-top:6px;
}
.search-bar.open{display:block}
.search-bar input{
  width:100%;font-family:var(--ui);font-size:14px;color:var(--white);
  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;
  padding:11px 14px;
}
.search-bar input:focus{outline:2px solid var(--cyan);outline-offset:1px;border-color:var(--cyan-dim)}
.search-results{
  margin-top:4px;background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;
  overflow:hidden;
}
.search-results a{
  display:block;padding:11px 14px;font-family:var(--ui);font-size:13px;color:var(--white);
  border-top:1px solid var(--line-hair);
}
.search-results a:first-child{border-top:0}
.search-results a:hover{background:var(--navy-800)}
.search-results .search-cat{font-size:10px;color:var(--cyan-dim);font-weight:700;margin-right:6px;text-transform:uppercase}
.search-vazio{padding:11px 14px;font-family:var(--ui);font-size:12.5px;color:var(--muted-dim)}
.links{
  display:none;position:absolute;left:0;right:0;top:100%;background:var(--navy-950);
  border-bottom:1px solid var(--line);padding:6px 16px 18px;flex-direction:column;gap:0;
  max-height:calc(100vh - 60px);overflow-y:auto;
}
.links.open{display:flex}
.links a{padding:13px 4px;border-bottom:1px solid var(--line-soft);font-size:13px;font-weight:700;letter-spacing:.02em}
.links a.nav-destaque{color:var(--cyan-dim)}
.links a.nav-destaque:hover{color:var(--cyan)}
.shop-btn{
  margin-top:10px;text-align:center;background:var(--navy-800);color:var(--white);
  border:1px solid var(--orange-dim);font-weight:700;font-size:12.5px;letter-spacing:.02em;
  padding:12px;border-radius:6px;
}
.shop-btn:hover{border-color:var(--orange)}

/* ---------- menu "Mais": ferramentas em desenvolvimento, sem ocupar espaço nobre ---------- */
.nav-mais{position:relative;border-bottom:1px solid var(--line-soft)}
.nav-mais-btn{
  width:100%;display:flex;align-items:center;justify-content:space-between;
  background:none;border:0;font:inherit;color:var(--white);cursor:pointer;
  font-family:var(--ui);font-size:13px;font-weight:700;letter-spacing:.02em;padding:13px 4px;
}
.nav-mais-menu{display:none;flex-direction:column;gap:0;margin:0 0 8px;padding:4px 0 2px}
.nav-mais-menu.open{display:flex}
.nav-mais-menu a, .nav-mais-menu .nav-mais-dev{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:10px 10px;font-family:var(--ui);font-size:12.5px;font-weight:600;color:var(--white);
  border-radius:6px;
}
.nav-mais-menu a:hover{background:var(--navy-900);color:var(--cyan-dim)}
.nav-mais-tag{
  font-size:9px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-dim);
  background:var(--navy-950);border-radius:99px;padding:2px 8px;white-space:nowrap;flex:none;
}
.nav-mais-disabled{opacity:.55;cursor:default}
.nav-mais-sep{height:1px;background:var(--line-hair);margin:6px 10px}
.nav-mais-label{
  display:block;padding:6px 10px 2px;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--muted-dim);font-weight:800;
}
.nav-mais-nota{padding:8px 10px 2px;font-size:11px;color:var(--muted-dim);font-family:var(--ui);margin:0}
@media(min-width:760px){
  .nav{display:flex;min-height:76px;align-items:center;gap:16px;padding-block:0}
  .nav-subtitle{display:none}
  .logo{grid-column:auto;text-align:left;font-size:30px}
  .menu-btn{display:none}
  .search-btn{display:none}
  .search-bar{display:none!important}
  .links{
    display:flex;position:static;flex-direction:row;align-items:center;gap:22px;
    background:none;border:0;padding:0;margin-left:auto;max-height:none;overflow:visible;
  }
  .links a{padding:0;border:0;font-size:13px}
  .shop-btn{margin-top:0;background:var(--navy-700);border:1px solid var(--orange-dim);color:var(--white);padding:11px 16px}
  .shop-btn:hover{border-color:var(--orange)}
  .nav-mais{border-bottom:0}
  .nav-mais-btn{width:auto;padding:0;font-size:13px}
  .nav-mais-menu{
    display:none;position:absolute;top:calc(100% + 18px);right:0;min-width:250px;
    background:var(--navy-900);border:1px solid var(--line-soft);border-radius:10px;
    box-shadow:0 16px 32px rgba(2,10,16,.45);padding:8px;z-index:40;margin:0;
  }
  .nav-mais-menu.open{display:flex}
}

/* ---------- ops strip: aeroportos (mantido como estava — sem mudanças de conceito) ---------- */
.ops{margin-block:16px}
.ops-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px;padding-inline:2px}
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
/* Cards em coluna (status+ICAO / nome / condição), nunca em linha corrida —
   é o que evita nome+status colarem quando "Farol de São Tomé" (o mais
   longo) precisa quebrar. Cada aeroporto sempre tem separação visual clara
   entre as 3 informações, em qualquer largura. */
.airport{
  scroll-snap-align:start;flex:0 0 auto;display:flex;flex-direction:column;gap:3px;
  min-width:132px;max-width:168px;
  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;
  padding:10px 12px;font:inherit;cursor:pointer;text-align:left;
}
.airport:hover, .airport:focus-visible{border-color:var(--cyan-dim)}
.airport-top{display:flex;align-items:center;gap:6px}
.airport .dot{width:8px;height:8px;border-radius:50%;flex:none}
.airport .code{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--white)}
.airport .cidade{font-size:11.5px;color:var(--muted);font-family:var(--ui);line-height:1.3;overflow-wrap:anywhere}
.airport .clima-mini{font-family:var(--ui);font-size:11px;color:var(--muted);white-space:nowrap}
.airport .clima-mini.sem-dado{color:var(--muted-dim);font-size:10px}
.dot.green{background:var(--green);box-shadow:0 0 6px var(--green)}
.dot.yellow{background:var(--yellow);box-shadow:0 0 6px var(--yellow)}
.dot.red{background:var(--red);box-shadow:0 0 6px var(--red)}
.dot.unknown{background:var(--muted-dim)}
@media(min-width:760px){
  .ops-strip{display:grid;grid-template-columns:repeat(6,1fr);overflow:visible}
  .airport{max-width:none}
}

.ops-detail{
  margin-top:8px;padding:14px 16px;border-radius:8px;
  background:var(--navy-900);border:1px solid var(--cyan-dim);
  font-family:var(--ui);
}
.ops-detail-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ops-detail-head strong{font-size:13.5px;color:var(--white)}
.ops-detail-fechar{
  background:none;border:0;color:var(--muted-dim);font-size:14px;cursor:pointer;
  padding:6px;line-height:1;min-width:28px;min-height:28px;
}
.ops-detail-fechar:hover{color:var(--white)}
.ops-detail-body{margin-top:10px;font-size:13px;color:var(--muted)}
.ops-detail-body strong{color:var(--white)}
.ops-detail-condicao{font-size:15px;color:var(--white);font-weight:600}
.ops-detail-status{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:var(--muted)}
.ops-detail-status .dot{width:7px;height:7px;border-radius:50%;flex:none}
.ops-detail-atualizacao{margin-top:6px;font-size:11px;color:var(--muted-dim)}
/* OFFVoos: referência mínima, só aparece aqui dentro do painel, depois do
   usuário interagir com o aeroporto — nunca destaque, nunca independente. */
.ops-detail-offvoos{
  margin-top:10px;padding-top:8px;border-top:1px solid var(--line-hair);
  display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;
}
.ops-detail-cta{font-size:11px;font-weight:600;color:var(--muted)}
.ops-detail-cta:hover{color:var(--cyan-dim)}
.ops-detail-offvoos-tag{font-size:9.5px;color:var(--muted-dim)}

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
  position:absolute;left:10px;top:10px;z-index:2;font-family:var(--ui);
  font-size:10.5px;letter-spacing:.03em;color:var(--muted-dim);
  background:rgba(6,28,43,.68);padding:4px 9px;border-radius:99px;
  max-width:calc(100% - 20px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.lead .illustration-note, .ops-card .illustration-note{left:20px;top:18px}
.illustration-note.compacta{
  padding:2px 5px;font-size:9px;max-width:none;white-space:nowrap;cursor:help;
}

.highlights{display:flex;flex-direction:column}
.highlight{
  display:grid;grid-template-columns:64px 1fr;gap:14px;align-items:start;
  padding-block:16px;border-top:1px solid var(--line-hair);cursor:pointer;
}
.highlight:first-child{border-top:0;padding-top:0}
.highlight .thumb{width:64px;height:64px;border-radius:4px;background-size:cover;background-position:center;background-color:var(--navy-800);flex:none;position:relative}
.highlight .thumb .illustration-note.compacta{left:3px;top:3px}
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
/* flex-wrap + sem nowrap no ed-sub: causa raiz do overflow horizontal no
   mobile — h2 + subtítulo juntos não cabem em 320-360px numa linha só, e
   nowrap forçava o subtítulo a estourar a viewport em vez de quebrar. */
.ed-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 16px;margin-bottom:22px;padding-bottom:14px;border-bottom:2px solid var(--line)}
.ed-head h2{font-family:var(--ui);font-size:22px;font-weight:800;color:var(--white);letter-spacing:-.01em}
.ed-sub{font-family:var(--ui);font-size:12px;color:var(--muted-dim)}
@media(min-width:760px){ .ed-sub{white-space:nowrap} }

/* Últimas Notícias: 1 item em destaque + lista tipográfica, sem caixas */
.latest-body{display:grid;gap:28px}
.latest-feature{display:grid;gap:14px;cursor:pointer;padding-bottom:22px;border-bottom:1px solid var(--line-hair)}
.latest-feature .thumb{width:100%;aspect-ratio:16/8;border-radius:4px;background-size:cover;background-position:center;background-color:var(--navy-900);position:relative}
.latest-feature h3{font-size:24px;line-height:1.15;font-weight:600}
.latest-feature p{font-family:var(--editorial);font-size:15.5px;line-height:1.5;color:var(--muted);max-width:68ch}
.row-list{display:flex;flex-direction:column}
.row{display:flex;gap:14px;align-items:center;padding-block:12px;border-top:1px solid var(--line-hair);cursor:pointer}
.row:first-child{border-top:0}
.row-thumb{
  width:92px;height:66px;border-radius:5px;background-size:cover;background-position:center;
  background-color:var(--navy-900);flex:none;position:relative;
}
.row-main{min-width:0}
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
.market-feature .thumb{width:100%;aspect-ratio:16/9;border-radius:4px;background-size:cover;background-position:center;background-color:var(--navy-900);position:relative}
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
/* ---------- Central Offshore: grade de atalhos, sistema de ícones SVG
   único (linear, mesma espessura, sem cor de preenchimento) — nenhum
   emoji. Comece Aqui/Offshore Agora em destaque; Salários/Vagas rebaixados
   ao final enquanto "em desenvolvimento" não competem com o que já entrega
   valor real. ---------- */
.central-grid{display:grid;grid-template-columns:1fr;gap:10px}
.central-tile{
  position:relative;display:flex;flex-direction:column;gap:8px;
  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:12px;
  padding:20px 46px 18px 20px;font-family:var(--ui);
  transition:border-color .15s ease;
}
.central-tile:hover, .central-tile:focus-visible{border-color:var(--cyan-dim)}
.central-tile .ct-icon{display:block;width:23px;height:23px;color:var(--cyan-dim)}
.central-tile .ct-icon svg{display:block;width:100%;height:100%}
.central-tile h3{font-size:14.5px;font-weight:700;color:var(--white);letter-spacing:.01em}
.central-tile p{font-size:11.5px;color:var(--muted-dim);margin:0;line-height:1.45}
.central-tile .go{
  position:absolute;top:21px;right:18px;width:14px;height:14px;color:var(--cyan-dim);
  transition:transform .15s ease,color .15s ease;
}
.central-tile .go svg{display:block;width:100%;height:100%}
.central-tile:hover .go, .central-tile:focus-visible .go{transform:translate(2px,-2px);color:var(--cyan)}
.central-tile.em-breve{opacity:.6}
.central-tile.secundario{border-style:dashed;background:var(--navy-950)}
.central-tile.secundario .ct-icon{color:var(--muted-dim)}
.central-tile.secundario:hover{border-color:var(--line)}
.tag-em-breve{
  position:absolute;top:20px;right:16px;font-size:9px;letter-spacing:.05em;text-transform:uppercase;
  color:var(--muted-dim);background:var(--navy-800);border:1px solid var(--line-soft);
  padding:3px 8px;border-radius:99px;white-space:nowrap;font-weight:700;
}
.tag-parceiro{position:absolute;top:19px;right:14px;font-size:10.5px;font-weight:700;color:var(--cyan-dim);white-space:nowrap}
.central-tile.destaque{
  background:linear-gradient(160deg,var(--navy-900) 0%,var(--navy-800) 100%);
  border-color:var(--cyan-dim);padding:24px 46px 22px 22px;
}
.central-tile.destaque .ct-icon{width:27px;height:27px;color:var(--cyan)}
.central-tile.destaque h3{font-size:17.5px}
.central-tile.destaque p{font-size:12.5px;color:var(--muted)}
@media(min-width:560px){
  .central-grid{grid-template-columns:repeat(2,1fr)}
}
@media(min-width:760px){
  .central-grid{grid-template-columns:repeat(4,1fr)}
}

/* ---------- Peça institucional OffshoreWorks: cinematográfica, navy/aço,
   sem modelo de roupa, sem aparência de e-commerce — bloco inteiro
   clicável para a loja oficial. Sem fotografia por ora (nenhum asset
   próprio/licenciado disponível no projeto); composição só com gradiente +
   textura sutil até existir uma foto editorial própria. ---------- */
.ow-institucional{
  margin-top:56px;position:relative;overflow:hidden;border-radius:14px;
  display:block;min-height:200px;text-decoration:none;
  background:
    radial-gradient(120% 140% at 12% 0%, rgba(18,168,238,.09) 0%, rgba(18,168,238,0) 45%),
    linear-gradient(155deg, #03101a 0%, #0a2436 55%, #123449 100%);
  border:1px solid var(--line-soft);
  padding:34px 26px;
}
.ow-institucional::before{
  content:"";position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,#c9a35c 0%,rgba(201,163,92,0) 60%);
  opacity:.45;
}
.ow-institucional::after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(115deg, rgba(255,255,255,.025) 0 2px, transparent 2px 26px);
  mix-blend-mode:overlay;
}
.ow-institucional-eyebrow{
  position:relative;z-index:1;display:block;font-family:var(--ui);font-size:11px;font-weight:800;
  letter-spacing:.1em;text-transform:uppercase;color:var(--cyan-dim);
}
.ow-institucional h2{
  position:relative;z-index:1;font-family:var(--ui);font-weight:800;letter-spacing:-.01em;
  font-size:clamp(26px,7vw,42px);line-height:1.08;margin:12px 0 18px;color:var(--white);
  text-wrap:balance;
}
.ow-institucional-sub{
  position:relative;z-index:1;display:inline-flex;align-items:center;gap:6px;
  font-family:var(--ui);font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--muted);
  transition:color .15s ease;
}
.ow-institucional-sub svg{width:13px;height:13px;transition:transform .15s ease}
.ow-institucional:hover .ow-institucional-sub, .ow-institucional:focus-visible .ow-institucional-sub{color:var(--cyan-dim)}
.ow-institucional:hover .ow-institucional-sub svg, .ow-institucional:focus-visible .ow-institucional-sub svg{transform:translate(2px,-2px)}
@media(min-width:760px){
  .ow-institucional{padding:52px 48px;min-height:260px}
  .ow-institucional-sub{font-size:13px}
}

/* ---------- Ecossistema: identificação curta das marcas, sem repetir a
   propaganda do bloco institucional acima — nada de cards grandes, nada de
   status "Ativo/Em breve" (a marca existe no ecossistema mesmo enquanto
   evolui). ---------- */
.eco-section{margin-top:44px;padding-top:28px;border-top:1px solid var(--line-hair)}
.eco-head{text-align:center;margin-bottom:20px}
.eco-head .eyebrow{justify-content:center;display:block;text-align:center;color:var(--muted-dim)}
.eco-row-list{display:flex;flex-direction:column;gap:16px}
.eco-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;text-decoration:none}
.eco-row-mark{font-family:var(--ui);font-size:16px;font-weight:800;color:var(--white)}
.eco-row-mark span{color:var(--cyan)}
.eco-row-tag{font-family:var(--ui);font-size:12.5px;color:var(--muted-dim);text-align:right}
a.eco-row:hover .eco-row-mark{color:var(--cyan-dim)}
@media(min-width:560px){
  .eco-row-list{flex-direction:row;gap:48px;justify-content:center}
  .eco-row{flex-direction:column;align-items:flex-start;gap:4px}
  .eco-row-tag{text-align:left}
}


/* ---------- Acessos de Alta Utilidade: substitui o Radar Offshore.
   3 atalhos fixos que levam a conteúdo real (nunca dashboard, nunca
   indicador inventado) — ocupa o mesmo espaço nobre logo após aeroportos. */
.acessos-utilidade{margin-top:16px;display:grid;grid-template-columns:1fr;gap:8px}
.au-item{
  display:block;background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;
  padding:12px 14px;
}
.au-item:hover{border-color:var(--cyan-dim)}
.au-item .au-label{font-family:var(--ui);font-size:12px;font-weight:800;color:var(--white);letter-spacing:.01em}
.au-item .au-sub{display:block;font-family:var(--ui);font-size:11px;color:var(--muted);margin-top:2px}
@media(min-width:560px){
  .acessos-utilidade{grid-template-columns:repeat(3,1fr)}
}

/* ---------- Giro de Notícias 24h: ticker contínuo ---------- */
.ticker-wrap{
  margin-top:10px;border:1px solid var(--line-soft);border-radius:8px;
  background:var(--navy-900);display:flex;align-items:stretch;overflow:hidden;
}
.ticker-head{
  flex:none;display:flex;align-items:center;font-family:var(--ui);font-size:10.5px;
  font-weight:800;letter-spacing:.08em;color:var(--navy-950);background:var(--cyan-dim);
  padding:0 10px;white-space:nowrap;
}
.ticker-viewport{flex:1;overflow:hidden;position:relative;height:36px;min-width:0}
.ticker-track{
  position:absolute;top:0;left:0;display:flex;align-items:center;height:36px;
  white-space:nowrap;animation:tickerScroll 90s linear infinite;
}
.ticker-track:hover, .ticker-track:focus-within{animation-play-state:paused}
.ticker-item{
  padding:0 18px;font-family:var(--ui);font-size:12px;color:var(--muted);
  white-space:nowrap;border-right:1px solid var(--line-hair);flex:none;
}
.ticker-item b{color:var(--cyan-dim);font-weight:700;margin-right:6px;letter-spacing:.02em}
@keyframes tickerScroll{ from{transform:translateX(0)} to{transform:translateX(-50%)} }
@media (prefers-reduced-motion: reduce){
  .ticker-track{animation:none;position:static;overflow-x:auto;max-width:100%}
  .ticker-viewport{overflow-x:auto}
}

/* ---------- newsletter ---------- */
.newsletter{margin-top:52px;padding-top:26px;border-top:1px solid var(--line-hair)}
.newsletter h3{font-family:var(--ui);font-size:13px;color:var(--muted);font-weight:700;letter-spacing:.02em;text-transform:uppercase;margin-bottom:12px}
.subscribe{display:flex;max-width:440px}
.subscribe input{min-width:0;flex:1;padding:12px;border:1px solid var(--line-soft);border-right:0;border-radius:6px 0 0 6px;background:var(--navy-900);color:var(--white);font-family:inherit}
.subscribe button{border:0;background:var(--cyan);color:var(--navy-950);font-weight:800;padding:0 16px;border-radius:0 6px 6px 0}

footer{margin-top:40px;border-top:1px solid var(--line-soft);padding:24px 0 20px;color:var(--muted-dim);font-size:12px}
.footer{display:flex;flex-direction:column;flex-wrap:wrap;gap:10px}
@media(min-width:760px){.footer{flex-direction:row;align-items:center;justify-content:space-between}}

/* ---------- Instagram: presença discreta e constante, sem propaganda ---------- */
.social-link{
  display:inline-flex;align-items:center;gap:5px;font-family:var(--ui);font-weight:600;
  font-size:12px;color:var(--muted);
}
.social-link:hover{color:var(--cyan-dim)}
.social-link svg{width:13px;height:13px;flex:none}
.social-link-secundario{color:var(--muted-dim)}
.footer-social{display:flex;gap:16px;flex-wrap:wrap}
.nav-social{display:flex;gap:16px;flex-wrap:wrap;padding:14px 4px 4px;margin-top:6px;border-top:1px solid var(--line-soft)}
@media(min-width:760px){.nav-social{display:none}}

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

/* ---------- HUB: Salários Offshore / Funções a Bordo ---------- */
.hub-main{padding-top:18px;padding-bottom:40px}
.breadcrumb{font-family:var(--ui);font-size:12px;color:var(--muted-dim);margin-bottom:18px}
.breadcrumb a{color:var(--muted);font-weight:600}
.breadcrumb a:hover{color:var(--cyan-dim)}
.bc-sep{margin:0 6px;opacity:.6}

.hub-hero{margin-bottom:36px;max-width:70ch}
.hub-hero .eyebrow{font-family:var(--ui);font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--cyan-dim);display:block;margin-bottom:10px}
.hub-hero h1{font-size:34px;line-height:1.1;font-weight:600;margin-bottom:14px}
.hub-lead{font-family:var(--editorial);font-size:17px;line-height:1.55;color:var(--muted)}
.hub-cta-secundario{display:inline-block;margin-top:14px;font-family:var(--ui);font-size:13px;font-weight:700;color:var(--cyan)}

.aviso-atualizacao{
  margin-top:18px;padding:14px 16px;border-radius:6px;
  border:1px solid var(--line-soft);background:var(--navy-900);
  font-family:var(--ui);font-size:13px;color:var(--muted);line-height:1.5;
}
.aviso-atualizacao strong{color:var(--white)}

.area-group{margin-top:40px}
.area-group h3{font-family:var(--ui);font-size:19px;font-weight:800;color:var(--white);padding-bottom:10px;border-bottom:2px solid var(--line)}
.area-desc{font-family:var(--ui);font-size:12.5px;color:var(--muted-dim);margin:8px 0 4px}

.role-list{display:flex;flex-direction:column}
.role-row{
  display:flex;align-items:center;gap:12px;padding-block:15px;
  border-top:1px solid var(--line-hair);font-family:var(--ui);
}
.role-row:first-child{border-top:0}
.role-nome{flex:1;font-size:15px;font-weight:600;color:var(--white)}
.role-row .go{color:var(--cyan)}

.campo-pill{
  display:inline-block;font-family:var(--ui);font-size:11px;font-weight:700;
  letter-spacing:.03em;color:var(--muted-dim);background:var(--navy-800);
  border:1px solid var(--line-soft);border-radius:99px;padding:4px 10px;
}
.campo-pill.neutro{color:var(--cyan-dim);border-color:var(--line)}

.campo-grid{display:flex;flex-direction:column;margin-top:8px}
.campo-row{
  display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;
  padding-block:14px;border-top:1px solid var(--line-hair);
}
.campo-row:first-child{border-top:0}
.campo-rotulo{font-family:var(--ui);font-size:13.5px;font-weight:600;color:var(--white)}

.hub-continue{
  margin-top:44px;padding-top:20px;border-top:1px solid var(--line-hair);
  display:flex;flex-wrap:wrap;gap:16px;align-items:baseline;font-family:var(--ui);
}
.hub-continue-label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-dim);width:100%}
.hub-continue a{font-size:13.5px;font-weight:700;color:var(--cyan)}

@media(min-width:760px){
  .hub-hero h1{font-size:44px}
  .campo-row{grid-template-columns:260px 1fr}
}

/* ---------- /salarios: tratamento de produto premium ---------- */
.salarios-hero{margin-bottom:40px;max-width:74ch}
.salarios-hero .eyebrow{font-family:var(--ui);font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--cyan-dim);display:block;margin-bottom:10px}
.salarios-hero h1{font-size:36px;line-height:1.08;font-weight:600;margin-bottom:14px}
.salarios-hero h1 .ano{color:var(--cyan-dim);font-size:.62em;font-family:var(--ui);font-weight:800;letter-spacing:.02em;vertical-align:middle;margin-left:4px}

.busca-grande{margin-top:28px;max-width:560px}
.busca-grande label{display:block;font-family:var(--ui);font-size:13px;font-weight:700;color:var(--muted);margin-bottom:8px}
.busca-grande input{
  width:100%;font-family:var(--editorial);font-size:19px;color:var(--white);
  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;
  padding:16px 18px;
}
.busca-grande input:focus{outline:2px solid var(--cyan);outline-offset:2px;border-color:var(--cyan-dim)}
.busca-grande input::placeholder{color:var(--muted-dim)}

.stats-row{display:flex;flex-wrap:wrap;gap:28px;margin-top:28px;padding-top:22px;border-top:1px solid var(--line-hair)}
.stat{display:flex;flex-direction:column;gap:2px;font-family:var(--ui)}
.stat strong{font-size:28px;font-weight:800;color:var(--white);line-height:1}
.stat span{font-size:12px;color:var(--muted-dim)}
.stat-texto{justify-content:center}
.stat-texto span{font-size:13px;color:var(--muted)}

.area-cards{display:grid;grid-template-columns:1fr;gap:16px;margin-top:8px}
.area-card{
  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:10px;padding:22px;
}
.area-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.area-card-head h3{font-family:var(--ui);font-size:18px;font-weight:800;color:var(--white)}
.area-count{font-family:var(--ui);font-size:11px;color:var(--muted-dim);white-space:nowrap}
.area-card .area-desc{font-family:var(--ui);font-size:12.5px;color:var(--muted-dim);margin:8px 0 14px}
.chip-list{display:flex;flex-direction:column}
.role-chip{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding-block:11px;border-top:1px solid var(--line-hair);font-family:var(--ui);
  font-size:14px;font-weight:600;color:var(--white);
}
.role-chip:first-child{border-top:0}
.role-chip:hover span:first-child{color:var(--cyan-dim)}

.busca-vazio{font-family:var(--ui);color:var(--muted-dim);text-align:center;padding:30px 0}

@media(min-width:760px){
  .salarios-hero h1{font-size:48px}
  .area-cards{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
}

/* ---------- caminho de carreira (sequência conectada) ---------- */
.caminho-carreira-bloco{margin-top:40px}
.caminho-carreira-bloco h3{font-family:var(--ui);font-size:16px;font-weight:800;color:var(--white);margin-bottom:14px}
.caminho-sequencia{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.caminho-no{
  font-family:var(--ui);font-size:13px;font-weight:700;color:var(--muted);
  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:99px;
  padding:8px 16px;
}
.caminho-no.atual{color:var(--cyan-dim);border-color:var(--cyan-dim)}
.caminho-seta{color:var(--muted-dim);font-size:15px;padding:0 4px}

.caminho-carreira-compacto{margin-top:18px;padding-top:16px;border-top:1px solid var(--line-hair)}
.caminho-carreira-compacto h3{font-size:12.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-dim);margin-bottom:10px}
.funcao-nome-antigo{font-family:var(--ui);font-size:12.5px;color:var(--muted-dim);margin:-8px 0 12px;font-style:italic}

/* ---------- CTA de comunidade (informar salário) ---------- */
.cta-comunidade{
  margin-top:36px;padding:26px 24px;border-radius:10px;text-align:center;
  border:1px solid var(--line-soft);background:var(--navy-900);
}
.cta-comunidade h3{font-family:var(--editorial);font-size:20px;font-weight:600;color:var(--white);margin-bottom:8px}
.cta-comunidade p{font-family:var(--ui);font-size:13.5px;color:var(--muted);margin-bottom:18px}
.btn-em-breve{
  display:inline-flex;align-items:center;gap:10px;font-family:var(--ui);font-weight:700;font-size:13.5px;
  color:var(--muted);background:var(--navy-800);border:1px solid var(--line);
  border-radius:6px;padding:12px 20px;cursor:not-allowed;
}
.em-breve-tag{
  font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted-dim);
  background:var(--line-soft);border-radius:99px;padding:3px 9px;
}

/* Intrinsic sizing: long text must fit its grid/flex cell, including mobile. */
.container, .container *, .hub-main *{min-width:0}
h1,h2,h3,p,.ed-sub,.hub-lead,.breadcrumb,.campo-valor,.hub-continue a{overflow-wrap:anywhere}
.topline .container{flex-wrap:wrap}
.ops-detail-head{flex-wrap:wrap}
.ticker-track{width:max-content;gap:0}
.ticker-group{display:flex;flex:none;width:max-content;align-items:center}
.ticker-item{padding-right:24px}
[hidden]{display:none!important}
@media(min-width:760px) and (max-width:1100px){
  .nav{flex-wrap:wrap;padding-block:12px}
  .links{flex-wrap:wrap;gap:14px}
  .ops-strip{grid-template-columns:repeat(3,minmax(0,1fr))}
}

/* Shared page navigation wraps instead of forcing desktop links into mobile. */
.hub-nav{flex-wrap:wrap;padding-block:12px}
.hub-nav .logo{flex:none}
.hub-links{display:flex;flex-wrap:wrap;gap:10px 16px;width:100%;align-items:center}
.hub-links a{font-size:12px;font-weight:700;overflow-wrap:anywhere}
.hub-links .shop-btn{margin:0}
.area-card-head{flex-wrap:wrap;gap:8px}
.area-count,.role-row .campo-pill{flex-shrink:0}
@media(min-width:1100px){.hub-links{width:auto;margin-left:auto}}
</style>
</head>
<body>

<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

<div class="topline"><div class="container"><span>OWNews • Informação para quem vive o offshore.</span><span>by OffshoreWorks</span></div></div>

<header>
  <div class="container nav">
    <button class="menu-btn" aria-label="Abrir menu" aria-expanded="false" id="menuBtn">☰</button>
    <a class="logo" href="#inicio">OW<span>News</span></a>
    <button class="search-btn" aria-label="Buscar" aria-expanded="false" id="searchBtn">🔍</button>
    <p class="nav-subtitle">Informação para quem vive o offshore</p>
    <div class="search-bar" id="searchBar">
      <input type="search" id="buscaInput" placeholder="Busque notícias, funções, empresas…" autocomplete="off">
      <div class="search-results" id="buscaResultados" hidden></div>
    </div>
    <nav class="links" id="navLinks">
      <a href="#destaque">NOTÍCIAS</a>
      <a href="/agora">OFFSHORE AGORA</a>
      <a class="nav-destaque" href="/carreiras/cadastre-seu-curriculo">CADASTRE SEU CURRÍCULO</a>
      <a href="#carreiras">CARREIRAS</a>
      <div class="nav-mais" id="navMais">
        <button type="button" class="nav-mais-btn" id="maisBtn" aria-expanded="false" aria-haspopup="true" aria-controls="maisMenu">MAIS ▾</button>
        <div class="nav-mais-menu" id="maisMenu" role="menu" aria-label="Mais">
          <span class="nav-mais-label">Explorar</span>
          <a href="/funcoes" role="menuitem">Funções a Bordo</a>
          <a href="/empresas" role="menuitem">Empresas Offshore</a>
          <a href="/cursos" role="menuitem">Cursos e Escolas</a>
          <a href="/dados" role="menuitem">Offshore em Números</a>
          <div class="nav-mais-sep"></div>
          <span class="nav-mais-label">Em desenvolvimento</span>
          <a class="nav-mais-dev" href="/vagas" role="menuitem"><span>Vagas Verificadas</span><span class="nav-mais-tag">Em desenvolvimento</span></a>
          <a class="nav-mais-dev" href="/salarios" role="menuitem"><span>Salários Offshore</span><span class="nav-mais-tag">Dados em preparação</span></a>
          <span class="nav-mais-dev nav-mais-disabled"><span>Minha Escala</span><span class="nav-mais-tag">Em breve</span></span>
        </div>
      </div>
      <a class="shop-btn" href="https://www.offshoreworks.com.br" target="_blank" rel="noopener">OFFSHOREWORKS ↗</a>
      <div class="nav-social">
        <a class="social-link" href="https://www.instagram.com/ownews" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.4.4a5 5 0 0 1 2 1.3 5 5 0 0 1 1.3 2c.2.6.4 1.3.4 2.4.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.4a5 5 0 0 1-1.3 2 5 5 0 0 1-2 1.3c-.6.2-1.3.4-2.4.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.4-.4a5 5 0 0 1-2-1.3 5 5 0 0 1-1.3-2c-.2-.6-.4-1.3-.4-2.4C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.4a5 5 0 0 1 1.3-2 5 5 0 0 1 2-1.3c.6-.2 1.3-.4 2.4-.4C8.9 2 9.3 2 12 2zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.8.4-1.1.7-.3.3-.5.7-.7 1.1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.4.8.7 1.1.3.3.7.5 1.1.7.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.8-.4 1.1-.7.3-.3.5-.7.7-1.1.1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7a3 3 0 0 0-.7-1.1 3 3 0 0 0-1.1-.7c-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1zm0 3a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 12 6.8zm0 1.8a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm5.4-2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/></svg>@ownews</a>
        <a class="social-link social-link-secundario" href="https://www.instagram.com/offshoreworks" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.4.4a5 5 0 0 1 2 1.3 5 5 0 0 1 1.3 2c.2.6.4 1.3.4 2.4.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.4a5 5 0 0 1-1.3 2 5 5 0 0 1-2 1.3c-.6.2-1.3.4-2.4.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.4-.4a5 5 0 0 1-2-1.3 5 5 0 0 1-1.3-2c-.2-.6-.4-1.3-.4-2.4C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.4a5 5 0 0 1 1.3-2 5 5 0 0 1 2-1.3c.6-.2 1.3-.4 2.4-.4C8.9 2 9.3 2 12 2zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.8.4-1.1.7-.3.3-.5.7-.7 1.1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.4.8.7 1.1.3.3.7.5 1.1.7.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.8-.4 1.1-.7.3-.3.5-.7.7-1.1.1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7a3 3 0 0 0-.7-1.1 3 3 0 0 0-1.1-.7c-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1zm0 3a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 12 6.8zm0 1.8a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm5.4-2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/></svg>@offshoreworks</a>
      </div>
    </nav>
  </div>
</header>

<main class="container" id="conteudo">

  <section class="ops" id="aeroportos" aria-label="Condições nos aeroportos offshore">
    <div class="ops-head">
      <span class="live-dot"></span>
      <strong>Condições nos aeroportos offshore</strong>
    </div>
    <div class="ops-strip" id="opsStrip"></div>
    <div class="ops-detail" id="opsDetail" hidden></div>
  </section>

  <section class="acessos-utilidade" aria-label="Acessos rápidos">
    <a class="au-item" href="/comece-aqui">
      <span class="au-label">COMECE AQUI</span>
      <span class="au-sub">Como trabalhar offshore →</span>
    </a>
    <a class="au-item" href="/funcoes">
      <span class="au-label">FUNÇÕES A BORDO</span>
      <span class="au-sub">Requisitos e cursos →</span>
    </a>
    <a class="au-item" href="/carreiras/cadastre-seu-curriculo">
      <span class="au-label">CADASTRE SEU CURRÍCULO</span>
      <span class="au-sub">Principais empresas →</span>
    </a>
  </section>

  <section class="ticker-wrap" aria-label="Giro de notícias 24 horas">
    <span class="ticker-head">GIRO 24H</span>
    <div class="ticker-viewport">
      <div class="ticker-track" id="tickerTrack"></div>
    </div>
  </section>

  <section class="masthead" id="destaque" aria-label="Destaque">
    <article class="lead" id="heroCard"></article>
    <aside class="highlights" id="highlightsList"></aside>
  </section>

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
    <div class="ed-head"><h2>Central Offshore</h2><span class="ed-sub">Tudo pra quem vive ou quer entrar no offshore, num só lugar</span></div>
    <div class="central-grid">
      <a class="central-tile destaque" href="/comece-aqui">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.25"/><path d="M14.8 9.2l-2.2 5.6-5.6 2.2 2.2-5.6z"/></svg></span>
        <h3>Comece Aqui</h3>
        <p>Como trabalhar offshore, passo a passo</p>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </a>
      <a class="central-tile destaque" href="/agora">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l2.2-6.5L13 18l2.4-6H21"/></svg></span>
        <h3>Offshore Agora</h3>
        <p>O que está acontecendo no offshore brasileiro agora</p>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </a>
      <a class="central-tile" href="/carreiras/cadastre-seu-curriculo">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9.5" cy="8.5" r="3.2"/><path d="M3.5 19.5a6 6 0 0 1 12 0"/><path d="M18 8v5M15.5 10.5h5"/></svg></span>
        <h3>Cadastre seu Currículo</h3>
        <p>Canais oficiais das principais empresas do setor</p>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </a>
      <a class="central-tile" href="/funcoes">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15.5a8 8 0 0 1 16 0"/><path d="M12 7.5v-1"/><rect x="2.5" y="15.5" width="19" height="3" rx="1"/></svg></span>
        <h3>Funções a Bordo</h3>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </a>
      <a class="central-tile" href="/empresas">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="1"/><path d="M9 8h1.2M13.8 8H15M9 12h1.2M13.8 12H15M9 16h1.2M13.8 16H15"/></svg></span>
        <h3>Empresas Offshore</h3>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </a>
      <a class="central-tile" href="/cursos" id="cursos">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5.5 2.5 10 12 14.5 21.5 10z"/><path d="M6.5 12v4.5c0 1.1 2.5 2.5 5.5 2.5s5.5-1.4 5.5-2.5V12"/></svg></span>
        <h3>Cursos e Escolas</h3>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </a>
      <a class="central-tile" href="/guias">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5V8h4"/><path d="M9.5 12.5h5M9.5 16h5"/></svg></span>
        <h3>Guias OWNews</h3>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </a>
      <a class="central-tile" href="/unidades">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><path d="M12 7v13"/><path d="M6 13a6 6 0 0 0 12 0"/><path d="M4.5 13h3M16.5 13h3"/></svg></span>
        <h3>Plataformas &amp; Sondas</h3>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </a>
      <a class="central-tile" href="/dados">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M11 20V4M18 20v-7"/></svg></span>
        <h3>Offshore em Números</h3>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </a>
      <a class="central-tile secundario" href="/salarios">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6.5" width="18" height="12" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14" r="1"/></svg></span>
        <h3>Salários Offshore</h3>
        <span class="tag-em-breve">Dados em preparação</span>
      </a>
      <a class="central-tile secundario" href="/vagas">
        <span class="ct-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/></svg></span>
        <h3>Vagas Verificadas</h3>
        <span class="tag-em-breve">Em desenvolvimento</span>
      </a>
    </div>
  </section>

  <a class="ow-institucional" id="loja" href="https://www.offshoreworks.com.br" target="_blank" rel="noopener" aria-label="OffshoreWorks — Loja oficial. Feitos de sal e aço. Conheça a OffshoreWorks.">
    <span class="ow-institucional-eyebrow">OffshoreWorks</span>
    <h2>Feitos de<br>sal e aço.</h2>
    <span class="ow-institucional-sub">LOJA OFICIAL · Conheça a OffshoreWorks
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>
    </span>
  </a>

  <section class="eco-section" id="ecossistema">
    <div class="eco-head">
      <span class="eyebrow">Ecossistema</span>
    </div>
    <div class="eco-row-list">
      <a class="eco-row" href="https://www.offshoreworks.com.br" target="_blank" rel="noopener">
        <span class="eco-row-mark">Offshore<span>Works</span></span>
        <span class="eco-row-tag">Loja oficial</span>
      </a>
      <div class="eco-row">
        <span class="eco-row-mark">OW <span>Lab</span></span>
        <span class="eco-row-tag">Ideias que ganham forma.</span>
      </div>
    </div>
  </section>

  <section class="newsletter">
    <h3>Receba as principais notícias</h3>
    <div class="subscribe"><input type="email" placeholder="Seu e-mail" id="newsletterEmail"><button>Inscrever</button></div>
  </section>

</main>

<footer><div class="container footer"><span>OWNews • Informação para quem vive o offshore. • © 2026 OffshoreWorks</span><span>v3 — home em redesign editorial, ainda não publicada</span><div class="footer-social"><a class="social-link" href="https://www.instagram.com/ownews" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.4.4a5 5 0 0 1 2 1.3 5 5 0 0 1 1.3 2c.2.6.4 1.3.4 2.4.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.4a5 5 0 0 1-1.3 2 5 5 0 0 1-2 1.3c-.6.2-1.3.4-2.4.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.4-.4a5 5 0 0 1-2-1.3 5 5 0 0 1-1.3-2c-.2-.6-.4-1.3-.4-2.4C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.4a5 5 0 0 1 1.3-2 5 5 0 0 1 2-1.3c.6-.2 1.3-.4 2.4-.4C8.9 2 9.3 2 12 2zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.8.4-1.1.7-.3.3-.5.7-.7 1.1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.4.8.7 1.1.3.3.7.5 1.1.7.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.8-.4 1.1-.7.3-.3.5-.7.7-1.1.1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7a3 3 0 0 0-.7-1.1 3 3 0 0 0-1.1-.7c-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1zm0 3a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 12 6.8zm0 1.8a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm5.4-2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/></svg>@ownews</a><a class="social-link social-link-secundario" href="https://www.instagram.com/offshoreworks" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.4.4a5 5 0 0 1 2 1.3 5 5 0 0 1 1.3 2c.2.6.4 1.3.4 2.4.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.4a5 5 0 0 1-1.3 2 5 5 0 0 1-2 1.3c-.6.2-1.3.4-2.4.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.4-.4a5 5 0 0 1-2-1.3 5 5 0 0 1-1.3-2c-.2-.6-.4-1.3-.4-2.4C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.4a5 5 0 0 1 1.3-2 5 5 0 0 1 2-1.3c.6-.2 1.3-.4 2.4-.4C8.9 2 9.3 2 12 2zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.8.4-1.1.7-.3.3-.5.7-.7 1.1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.4.8.7 1.1.3.3.7.5 1.1.7.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.8-.4 1.1-.7.3-.3.5-.7.7-1.1.1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7a3 3 0 0 0-.7-1.1 3 3 0 0 0-1.1-.7c-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1zm0 3a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 12 6.8zm0 1.8a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm5.4-2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/></svg>@offshoreworks</a></div></div></footer>

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

const maisBtn = document.getElementById('maisBtn');
function fecharMais(){
  const menu = document.getElementById('maisMenu');
  if (menu) menu.classList.remove('open');
  if (maisBtn) maisBtn.setAttribute('aria-expanded', 'false');
}
if (maisBtn) maisBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('maisMenu');
  const open = menu.classList.toggle('open');
  maisBtn.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', (e) => {
  const nav = document.getElementById('navMais');
  if (nav && !nav.contains(e.target)) fecharMais();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharMais();
});
document.querySelectorAll('#maisMenu a').forEach(a => a.addEventListener('click', fecharMais));

/* Busca: índice estático leve com os destinos reais do site (mesmos nomes/
   slugs usados nas páginas hub) + notícias atualmente carregadas. Nunca
   inventa resultado — se não casar com nada, mostra "Nenhum resultado". */
const INDICE_BUSCA_DESTINOS = [
  { titulo: 'Comece Aqui — Como trabalhar offshore', categoria: 'Comece Aqui', url: '/comece-aqui' },
  { titulo: 'Cadastre seu currículo nas empresas offshore', categoria: 'Carreiras', url: '/carreiras/cadastre-seu-curriculo' },
  { titulo: 'Empresas Offshore', categoria: 'Empresas', url: '/empresas' },
  { titulo: 'Vagas Verificadas OWNews', categoria: 'Vagas', url: '/vagas' },
  { titulo: 'Salários Offshore', categoria: 'Salários', url: '/salarios' },
  { titulo: 'Funções a Bordo', categoria: 'Funções', url: '/funcoes' },
  { titulo: 'Cursos e Escolas', categoria: 'Cursos', url: '/cursos' },
  { titulo: 'Guias OWNews', categoria: 'Guias', url: '/guias' },
  { titulo: 'Offshore Agora', categoria: 'Agora', url: '/agora' },
  { titulo: 'Roustabout / Homem de Área', categoria: 'Funções', url: '/funcoes/roustabout' },
  { titulo: 'Plataformista', categoria: 'Funções', url: '/funcoes/plataformista' },
  { titulo: 'Guindasteiro', categoria: 'Funções', url: '/funcoes/guindasteiro' },
  { titulo: 'Driller', categoria: 'Funções', url: '/funcoes/driller' },
  { titulo: 'Toolpusher', categoria: 'Funções', url: '/funcoes/toolpusher' },
  { titulo: 'ROV', categoria: 'Funções', url: '/funcoes/rov' },
  { titulo: 'Técnico de Segurança do Trabalho', categoria: 'Funções', url: '/funcoes/tecnico-seguranca-trabalho' },
  { titulo: 'Mecânico', categoria: 'Funções', url: '/funcoes/mecanico' },
  { titulo: 'Eletricista', categoria: 'Funções', url: '/funcoes/eletricista' },
  { titulo: 'SBM Offshore', categoria: 'Empresas', url: '/empresas#sbm-offshore' },
  { titulo: 'MODEC', categoria: 'Empresas', url: '/empresas#modec' },
  { titulo: 'Foresea', categoria: 'Empresas', url: '/empresas#foresea' },
  { titulo: 'Ocyan', categoria: 'Empresas', url: '/empresas#ocyan' },
  { titulo: 'Transocean', categoria: 'Empresas', url: '/empresas#transocean' },
  { titulo: 'Subsea7', categoria: 'Empresas', url: '/empresas#subsea7' },
  { titulo: 'Oceaneering', categoria: 'Empresas', url: '/empresas#oceaneering' },
  { titulo: 'DOF', categoria: 'Empresas', url: '/empresas#dof' },
  { titulo: 'TechnipFMC', categoria: 'Empresas', url: '/empresas#technipfmc' },
  { titulo: 'Saipem', categoria: 'Empresas', url: '/empresas#saipem' },
  { titulo: 'SLB', categoria: 'Empresas', url: '/empresas#slb' },
  { titulo: 'Halliburton', categoria: 'Empresas', url: '/empresas#halliburton' },
  { titulo: 'Baker Hughes', categoria: 'Empresas', url: '/empresas#baker-hughes' }
];

function normalizarBusca(s){
  return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
}

function executarBusca(termo){
  const box = document.getElementById('buscaResultados');
  const q = normalizarBusca(termo).trim();
  if (!box) return;
  if (q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }

  const destinos = INDICE_BUSCA_DESTINOS.filter(d => normalizarBusca(d.titulo).includes(q));
  const noticias = ULTIMAS_NOTICIAS_RADAR.filter(n => normalizarBusca(n.title).includes(q)).slice(0, 5);

  const resultados = [
    ...destinos.slice(0, 8).map(d => ({ href: d.url, categoria: d.categoria, titulo: d.titulo })),
    ...noticias.map(n => ({ href: '/noticia?id=' + encodeURIComponent(n.id), categoria: 'Notícia', titulo: n.title }))
  ].slice(0, 10);

  if (resultados.length === 0) {
    box.innerHTML = '<div class="search-vazio">Nenhum resultado para "' + termo.replace(/</g,'&lt;') + '"</div>';
  } else {
    box.innerHTML = resultados.map(r =>
      '<a href="' + r.href + '"><span class="search-cat">' + r.categoria + '</span>' + r.titulo.replace(/</g,'&lt;') + '</a>'
    ).join('');
  }
  box.hidden = false;
}

const buscaInput = document.getElementById('buscaInput');
if (buscaInput) buscaInput.addEventListener('input', e => executarBusca(e.target.value));

document.getElementById('searchBtn').addEventListener('click', () => {
  const bar = document.getElementById('searchBar');
  const btn = document.getElementById('searchBtn');
  const open = bar.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
  if (open) { document.getElementById('navLinks').classList.remove('open'); setTimeout(() => buscaInput && buscaInput.focus(), 50); }
});

const SUPABASE_URL = 'https://awyowuhwkqfyhwgdpepp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt';
const AEROPORTOS_URL = 'https://shrill-pond-a915.olivercamaster.workers.dev/aeroportos';

/* Snapshot real (mesmos endpoints públicos que o site já consome ao vivo),
   usado como estado inicial pra não haver "flash" de placeholder — e como
   fallback caso o fetch ao vivo não seja possível neste ambiente. */
const SEED_ARTICLES = [{"id": "25caaee6-4963-4a48-b61f-d0c9db2e3074", "title": "VÍDEO - Coletiva de imprensa sobre a descoberta de petróleo em águas profundas do Amapá, na margem equatorial brasileira", "summary": "Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás.", "image_url": null, "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/v%C3%ADdeo-coletiva-de-imprensa-sobre-a-descoberta-de-petr%C3%B3leo-em-%C3%A1guas-profundas-do-amap%C3%A1-na-margem-equatorial-brasileira", "published_at": "2026-09-12T18:50:20.664+00:00"}, {"id": "bfa73887-df22-4305-823c-4a286853f478", "title": "Navio-plataforma Alexandre de Gusmão atinge topo de produção no pré-sal", "summary": "Plataforma foi a quinta instalada em Mero, o terceiro maior campo da Petrobras", "image_url": "https://agencia.petrobras.com.br/documents/10623376/0/FPSO%20Alexandre%20de%20Gusm%C3%A3o_Foto7_Divulga%C3%A7%C3%A3o%20Petrobras/677273e5-92ce-fae4-e6c9-ca09e5692af3", "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/navio-plataforma-alexandre-de-gusm%C3%A3o-atinge-topo-de-produ%C3%A7%C3%A3o-no-pr%C3%A9-sal", "published_at": "2026-09-12T18:50:19.9+00:00"}, {"id": "bfd9e2c9-d7c2-42dd-9a1f-636d6d4ffbe8", "title": "Plataformas da Petrobras P-80 e P-82, que vão operar em Búzios, são batizadas em estaleiro em Singapura", "summary": "Em fase final de integração, as unidades iniciarão navegação para o Brasil nas próximas semanas. P-80 será a primeira a zarpar", "image_url": "https://agencia.petrobras.com.br/o/adaptive-media/image/45374257/Thumbnail-300x300/P80_Estaleiro_Foto1_Divulgacao_Seatrium.jpg?t=1787772215000", "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/plataformas-da-petrobras-p-80-e-p-82-que-v%C3%A3o-operar-em-b%C3%BAzios-s%C3%A3o-batizadas-em-estaleiro-em-singapura", "published_at": "2026-09-12T18:50:17.497+00:00"}, {"id": "fa55970d-2f6d-47e3-a69d-f117dec76c33", "title": "Royalties: ANP publica resolução sobre distribuição a municípios afetados por instalações de embarque e desembarque", "summary": "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/royalties-anp-publica-resolucao-sobre-distribuicao-a-municipios-afetados-por-instalacoes-de-embarque-e-desembarque", "published_at": "2026-09-12T18:50:14.927+00:00"}, {"id": "1d3a5e9a-f75b-48d5-9025-25d06e0dd3f2", "title": "Eólica offshore: publicada metodologia de seleção de áreas ofertadas no país", "summary": "Documento, disponível no site do MME, estabelece critérios para definição, conciliando o desenvolvimento do setor com os demais usos do espaço marinho e as exigências da Lei nº 15.097/2025", "image_url": null, "image_credit": "MME", "original_url": "https://www.gov.br/mme/pt-br/assuntos/noticias/eolica-offshore-publicada-metodologia-de-selecao-de-areas-ofertadas-no-pais", "published_at": "2026-09-08T13:44:17.752+00:00"}, {"id": "e683febd-2b17-488d-9d8c-155a2c3cd628", "title": "MME amplia adesão ao Pacto Nacional de Harmonização Regulatória do Mercado de Gás Natural", "summary": "Acordo de cooperação técnica firmado durante evento em Sergipe formalizou a entrada de novas agências reguladoras estaduais na iniciativa", "image_url": null, "image_credit": "MME", "original_url": "https://www.gov.br/mme/pt-br/assuntos/noticias/mme-amplia-adesao-ao-pacto-nacional-de-harmonizacao-regulatoria-do-mercado-de-gas-natural", "published_at": "2026-09-08T13:44:16.886+00:00"}, {"id": "8a0008ff-6e06-4cfe-beb5-58bf3eaac8af", "title": "Participação Especial: valores referentes à produção do segundo trimestre de 2026 foram distribuídos hoje a estados e municípios", "summary": "O montante total destinado aos municípios, estados e União, no período, foi de R$ 11,83 bilhões", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/participacao-especial-valores-referentes-a-producao-do-segundo-trimestre-de-2026-foram-distribuidos-hoje-a-estados-e-municipios", "published_at": "2026-09-08T13:28:16.783+00:00"}, {"id": "8b97c710-fbb6-4a91-acac-3b4999d1efb3", "title": "Royalties: valores referentes à produção de junho foram distribuídos hoje a estados e municípios", "summary": "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/royalties-valores-referentes-a-producao-de-junho-foram-distribuidos-hoje-a-estados-e-municipios", "published_at": "2026-09-08T13:28:16.167+00:00"}, {"id": "fea2fc47-4bee-47bd-9987-78f6ec40b4ae", "title": "Painel de previsões da fase de produção traz novos filtros para atividades de descomissionamento", "summary": "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/painel-de-previsoes-da-fase-de-producao-traz-novos-filtros-para-atividades-de-descomissionamento", "published_at": "2026-09-08T13:28:15.766+00:00"}, {"id": "2e11fcf1-727b-4469-9f27-31b08c568ffc", "title": "Petrobras inicia negociação para blocos exploratórios em Gana", "summary": "Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás.", "image_url": null, "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/petrobras-inicia-negocia%C3%A7%C3%A3o-para-blocos-explorat%C3%B3rios-em-gana", "published_at": "2026-09-08T11:48:06.862+00:00"}, {"id": "5b9dc5e8-67cd-4d0b-808e-42bc2639578a", "title": "Campo de Búzios bate recordes mensal e diário de exportação de gás natural", "summary": "Pela primeira vez, marca supera 10 milhões de m³/d em um mês", "image_url": "https://agencia.petrobras.com.br/o/adaptive-media/image/23124790/Thumbnail-300x300/P-74+%284%29.jpg?t=1724083784000", "image_credit": "Petrobras", "original_url": "https://agencia.petrobras.com.br/w/negocio/campo-de-b%C3%BAzios-bate-recordes-mensal-e-di%C3%A1rio-de-exporta%C3%A7%C3%A3o-de-g%C3%A1s-natural", "published_at": "2026-09-08T11:48:05.657+00:00"}, {"id": "a1517de9-b259-4a31-9b22-3b6b04b9199e", "title": "Gás natural: prorrogado até 14/9 o prazo da consulta pública sobre acesso de terceiros a gasodutos de escoamento e instalações de processamento", "summary": "A audiência pública sobre o tema será em 1/10", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/gas-natural-prorrogado-ate-14-9-o-prazo-da-consulta-publica-sobre-acesso-de-terceiros-a-gasodutos-de-escoamento-e-instalacoes-de-processamento", "published_at": "2026-09-08T11:20:29.148+00:00"}, {"id": "99b0b760-e786-4b3f-aa22-c5719248483c", "title": "ANP divulga dados consolidados da produção de petróleo e gás em julho de 2026", "summary": "No mês, foram produzidos 5,851milhões de barris de óleo equivalente por dia (boe/d) de petróleo e gás natural.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/anp-divulga-dados-consolidados-da-producao-de-petroleo-e-gas-em-julho-de-2026", "published_at": "2026-09-08T11:20:26.632+00:00"}, {"id": "01e00bd1-3f0e-456b-861a-39f8cf48042e", "title": "CGOB: ANP publica Informes Técnicos que permitem início da certificação de produtores e importadores de biometano", "summary": "Documentos detalham procedimentos e documentação para certificação de origem do biometano com vistas à emissão do CGOB", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/cgob-anp-publica-informes-tecnicos-que-permitem-inicio-da-certificacao-de-produtores-e-importadores-de-biometano", "published_at": "2026-09-08T11:20:26.033+00:00"}, {"id": "efb7328e-d57b-478b-8c62-478601c58ba6", "title": "Aprovada a indicação de 24 blocos na Bacia Potiguar para futuros ciclos da Oferta Permanente de Concessão (OPC)", "summary": "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/aprovada-a-indicacao-de-24-blocos-na-bacia-potiguar-para-futuros-ciclos-da-oferta-permanente-de-concessao-opc", "published_at": "2026-09-08T11:20:25.658+00:00"}, {"id": "90f0146a-c08a-4b4a-8e48-58c8dd5b7a84", "title": "ANP, em parceria com o Banco Mundial, lança campanha de medição de metano", "summary": "Ação visa promover a capacitação técnica em tecnologias de medição, detecção e quantificação de metano", "image_url": null, "image_credit": "ANP", "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/anp-em-parceria-com-o-banco-mundial-lanca-campanha-de-medicao-de-metano", "published_at": "2026-09-08T11:20:23.137+00:00"}, {"id": "91566f57-a883-467e-b0de-0d13d7ad034d", "title": "Produção brasileira de petróleo e gás alcança 5,851 milhões de boe/d em julho", "summary": "A produção brasileira de petróleo e gás natural alcançou 5,851 milhões de barris de óleo equivalente por dia em julho de 2026. Segundo a ANP, a produção de petróleo foi de 4,498 milhões de barris por dia, alta de 13,6% em relação a julho de 2025.", "image_url": null, "image_credit": null, "original_url": "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/anp-divulga-dados-consolidados-da-producao-de-petroleo-e-gas-em-julho-de-2026/", "published_at": "2026-09-08T00:43:32.229039+00:00"}];
const AEROPORTOS_ORDEM = [
  { codigo:'SBJR', nome:'Jacarepaguá' },
  { codigo:'SBMI', nome:'Maricá' },
  { codigo:'SBCB', nome:'Cabo Frio' },
  { codigo:'SBME', nome:'Macaé' },
  { codigo:'SBFS', nome:'Farol de São Tomé' },
  { codigo:'SBVT', nome:'Vitória' }
];

/* Snapshot real (mesmo endpoint /aeroportos do coletor), usado como estado
   inicial pra não haver "flash" sem clima — e como fallback se o fetch ao
   vivo não for possível neste ambiente. Nenhum campo aqui é inventado: é a
   última leitura confirmada da REDEMET no momento em que este arquivo foi
   atualizado. */
// No historic weather is presented as a current observation.
const SEED_AEROPORTOS = Object.fromEntries(AEROPORTOS_ORDEM.map(a =>
  [a.codigo, { status: null, clima: {} }]
));

let MAPA_AEROPORTOS = SEED_AEROPORTOS;
let AEROPORTO_DETALHE_ABERTO = null;

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

/* Só tratamos o METAR como "confirmado" quando a REDEMET devolveu um
   horário de observação de fato — sem isso, o parser cai no valor-padrão
   (ícone de sol / "Céu claro") mesmo sem ter lido nada, e mostrar isso
   seria inventar condição. horarioUTC é o único campo que garante que a
   leitura foi realmente feita. */
function climaConfirmado(clima){
  return !!(clima && clima.horarioUTC);
}

function renderAirports(mapa){
  MAPA_AEROPORTOS = mapa;
  const strip = document.getElementById('opsStrip');
  strip.innerHTML = AEROPORTOS_ORDEM.map(a => {
    const info = mapa[a.codigo] || {};
    const classe = info.status === 'g' ? 'green' : info.status === 'y' ? 'yellow' : info.status === 'r' ? 'red' : 'unknown';
    const clima = info.clima || {};
    let mini;
    if (climaConfirmado(clima)) {
      const temp = typeof clima.temperatura === 'number' ? \` \${clima.temperatura}°\` : '';
      mini = \`<span class="clima-mini">\${clima.icone}\${temp}</span>\`;
    } else {
      mini = \`<span class="clima-mini sem-dado" title="Sem dados meteorológicos confirmados">Sem dados</span>\`;
    }
    return \`<button type="button" class="airport" onclick="mostrarDetalheAeroporto('\${a.codigo}')" aria-label="Ver detalhes de \${a.nome}">\` +
      \`<span class="airport-top"><span class="dot \${classe}"></span><span class="code">\${a.codigo}</span></span>\` +
      \`<span class="cidade">\${a.nome}</span>\${mini}</button>\`;
  }).join('');
  if (AEROPORTO_DETALHE_ABERTO) mostrarDetalheAeroporto(AEROPORTO_DETALHE_ABERTO, true);
}

function aeroportosMapFromApi(retorno){
  const map = {};
  const lista = Array.isArray(retorno && retorno.aeroportos) ? retorno.aeroportos : [];
  lista.forEach(item => {
    const info = Array.isArray(item.dados) ? item.dados : [];
    if (info[0]) map[info[0]] = { status: info[4], clima: item.clima || {} };
  });
  return map;
}

/* Rótulo do status REDEMET já existente (g/y/r) — nunca traduzido como
   "aberto"/"fechado": é só a classificação operacional que a REDEMET já
   fornece, mantida em linguagem neutra. */
function rotuloStatus(status){
  if (status === 'g') return { texto: 'Condições normais', classe: 'green' };
  if (status === 'y') return { texto: 'Atenção', classe: 'yellow' };
  if (status === 'r') return { texto: 'Restrição operacional', classe: 'red' };
  return { texto: 'Status não confirmado', classe: 'unknown' };
}

function mostrarDetalheAeroporto(codigo, manterAberto){
  const painel = document.getElementById('opsDetail');
  if (!painel) return;
  if (!manterAberto && AEROPORTO_DETALHE_ABERTO === codigo) {
    esconderDetalheAeroporto();
    return;
  }
  const info = MAPA_AEROPORTOS[codigo] || {};
  const meta = AEROPORTOS_ORDEM.find(a => a.codigo === codigo);
  if (!meta) return;

  const clima = info.clima || {};
  const partes = [];
  if (climaConfirmado(clima)) {
    if (clima.icone) partes.push(clima.icone);
    if (clima.tempo) partes.push(escaparHTML(clima.tempo));
    if (typeof clima.temperatura === 'number') partes.push(\`\${clima.temperatura}°C\`);
  }
  const linha = partes.length ? partes.join(' · ') : 'Sem dados';
  const atualizacao = clima.horarioUTC ? \`Observação atualizada às \${escaparHTML(clima.horarioUTC)}\` : '';
  const status = rotuloStatus(info.status);

  painel.innerHTML = \`
    <div class="ops-detail-head">
      <strong>Aeroporto \${escaparHTML(meta.nome)} — \${codigo}</strong>
      <button type="button" class="ops-detail-fechar" onclick="esconderDetalheAeroporto()" aria-label="Fechar detalhes">✕</button>
    </div>
    <div class="ops-detail-body">
      <div class="ops-detail-condicao">\${linha}</div>
      <div class="ops-detail-status"><span class="dot \${status.classe}"></span>\${status.texto}</div>
      \${atualizacao ? \`<div class="ops-detail-atualizacao">\${atualizacao}</div>\` : ''}
    </div>
    <div class="ops-detail-offvoos">
      <a class="ops-detail-cta" href="https://offvoos.com.br/" target="_blank" rel="noopener noreferrer">Saiba mais no OFFVoos ↗</a>
      <span class="ops-detail-offvoos-tag">Parceiro OWNews</span>
    </div>
  \`;
  painel.hidden = false;
  AEROPORTO_DETALHE_ABERTO = codigo;
}

function esconderDetalheAeroporto(){
  const painel = document.getElementById('opsDetail');
  if (painel) painel.hidden = true;
  AEROPORTO_DETALHE_ABERTO = null;
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

/* ---------------------------------------------------------------
   Biblioteca Editorial OWNews — Nível 3 da hierarquia de imagem.
   Fotos reais, licenciadas (CC BY / CC BY-SA), curadas manualmente — ver
   biblioteca-fotografica.json (metadado completo, com URL original, autor,
   licença e data de validação). Aqui só o necessário pra exibir + creditar.
   Nunca retratam o acontecimento específico da matéria — por isso sempre
   aparecem com o selo "Imagem ilustrativa" + crédito.
------------------------------------------------------------------ */
const BIBLIOTECA_FOTOGRAFICA = [{"id": "commons-hermod-cassia", "categoria": "plataforma_fpso", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Hermod_at_Cassia_A_and_Cassia_B_platforms%2C_offshore_Trinidad.jpg?width=1600", "credito": "Foto: Chanilim714 / Wikimedia Commons (CC BY-SA 3.0)"}, {"id": "commons-northsea-platforms", "categoria": "plataforma_fpso", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/North_Sea_oil_platforms_%289246%29.jpg?width=1600", "credito": "Foto: joiseyshowaa / Wikimedia Commons (CC BY-SA 2.0)"}, {"id": "commons-silivri-platform", "categoria": "plataforma_fpso", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/SilivriOffshorePlatform.jpg?width=1600", "credito": "Foto: CeeGee / Wikimedia Commons (CC BY-SA 4.0)"}, {"id": "commons-scotland-psv", "categoria": "sonda_perfuracao", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Offshore_drilling_rigs_and_a_platform_supply_vessel_lay_idle_in_Scotland_%289287%29.jpg?width=1600", "credito": "Foto: Michael Elleray / Wikimedia Commons (CC BY 2.0)"}, {"id": "commons-caspian-drilling", "categoria": "sonda_perfuracao", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Deep_sea_oil_drilling_in_the_Caspian._%283892498628%29.jpg?width=1600", "credito": "Foto: Peretz Partensky / Wikimedia Commons (CC BY-SA 2.0)"}, {"id": "commons-oiltanker-nyharbour", "categoria": "petroleo_gas", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Oil_Tanker_in_New_York_Harbour.jpg?width=1600", "credito": "Foto: Paul Harrison / Wikimedia Commons (CC BY-SA 4.0)"}, {"id": "commons-burnaby-refinery", "categoria": "petroleo_gas", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Burnaby_Refinery.jpg?width=1600", "credito": "Foto: Robert Stupka / Wikimedia Commons (CC BY 2.0)"}, {"id": "commons-boats-oilrig", "categoria": "navio_apoio_maritimo", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Boats_and_Oil_rig.jpg?width=1600", "credito": "Foto: Alancru / Wikimedia Commons (CC BY-SA 3.0)"}, {"id": "marinha-porto-santos", "categoria": "porto_logistica", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Navio_cargueiro_atracado_no_Porto_de_Santos_-_2024_%2853639935936%29.jpg?width=1600", "credito": "Foto: Marinha do Brasil / Wikimedia Commons (CC BY-SA 2.0)"}, {"id": "commons-saipem7000", "categoria": "subsea_rov", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Saipem_7000.jpg?width=1600", "credito": "Foto: TeeGeeNo / Wikimedia Commons (CC BY-SA 3.0)"}, {"id": "commons-seven-navica", "categoria": "subsea_rov", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Seven_Navica.jpg?width=1600", "credito": "Foto: Billy McCrorie / Wikimedia Commons (CC BY-SA 2.0)"}, {"id": "commons-dcv-aegir", "categoria": "subsea_rov", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/DCV_Aegir_at_Huisman_yard.jpg?width=1600", "credito": "Foto: RCH95 / Wikimedia Commons (CC BY-SA 3.0)"}, {"id": "commons-nordsee-one", "categoria": "eolica_offshore", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Nordsee_One_Offshore_Windpark.jpg?width=1600", "credito": "Foto: Capmat007 / Wikimedia Commons (CC BY-SA 4.0)"}, {"id": "commons-kent-windfarm", "categoria": "eolica_offshore", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Windfarm_off_the_Kent_coast_%2826339012935%29.jpg?width=1600", "credito": "Foto: G B_NZ / Wikimedia Commons (CC BY-SA 2.0)"}, {"id": "commons-transmission-sunset", "categoria": "energia_industria", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Transmission_Lines_at_Sunset.jpg?width=1600", "credito": "Foto: Kevin Kiefuik / Wikimedia Commons (CC BY 4.0)"}, {"id": "commons-plenario-camara", "categoria": "regulacao_mercado", "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Plen%C3%A1rio_Ulysses_Guimar%C3%A3es.jpg?width=1600", "credito": "Foto: Boaventuravinicius / Wikimedia Commons (CC BY-SA 4.0)"}];

// correspondência SEMÂNTICA por assunto — nunca "qualquer foto offshore".
const PALAVRAS_CATEGORIA_IMAGEM = {
  plataforma_fpso: ["plataforma","navio-plataforma","fpso","p-80","p-82","p-74"],
  sonda_perfuracao: ["sonda","perfuração","perfuracao","poço","poco","toolpusher","driller"],
  subsea_rov: ["subsea","rov","árvore de natal","arvore de natal"],
  eolica_offshore: ["eólica offshore","eolica offshore","parque eólico","parque eolico"],
  navio_apoio_maritimo: ["navio","embarcação","embarcacao","apoio marítimo","apoio maritimo"],
  porto_logistica: ["porto","estaleiro","construção naval","construcao naval","terminal"],
  petroleo_gas: ["petróleo","petroleo","gás natural","gas natural","óleo e gás","oleo e gas","hidrocarbonetos","metano","biometano"],
  regulacao_mercado: ["royalties","participação especial","participacao especial","licitação","licitacao",
    "leilão","leilao","concessão","concessao","oferta permanente","resolução","resolucao","consulta pública",
    "consulta publica","bloco","bacia"],
  energia_industria: ["energia","eletricidade","gasoduto","descomissionamento"]
};
const ORDEM_CATEGORIA_IMAGEM = [
  "plataforma_fpso","sonda_perfuracao","subsea_rov","eolica_offshore",
  "navio_apoio_maritimo","porto_logistica","petroleo_gas","regulacao_mercado","energia_industria"
];

function bateComBordaDePalavra(t, palavra){
  if (palavra.length > 4) return t.includes(palavra);
  const re = new RegExp('(^|[^a-zA-Zà-ú])' + palavra + '([^a-zA-Zà-ú]|$)', 'i');
  return re.test(t);
}

function classificarImagem(n){
  const t = ((n.title || '') + ' ' + (n.summary || '')).toLowerCase();
  for (const cat of ORDEM_CATEGORIA_IMAGEM) {
    if (PALAVRAS_CATEGORIA_IMAGEM[cat].some(p => bateComBordaDePalavra(t, p))) return cat;
  }
  return null;
}

// rotação: nunca repete a última foto usada (em qualquer seção da home) e
// gira por todas as fotos da categoria antes de repetir uma delas.
const ponteiroCategoriaFoto = {};
let ultimaFotoUsadaId = null;

function proximaFotoBiblioteca(categoria){
  const pool = BIBLIOTECA_FOTOGRAFICA.filter(f => f.categoria === categoria);
  if (!pool.length) return null;
  let idx = ponteiroCategoriaFoto[categoria] || 0;
  let escolhida, tentativas = 0;
  do {
    escolhida = pool[idx % pool.length];
    idx++; tentativas++;
  } while (escolhida.id === ultimaFotoUsadaId && tentativas < pool.length + 1);
  ponteiroCategoriaFoto[categoria] = idx;
  ultimaFotoUsadaId = escolhida.id;
  return escolhida;
}

/* Imagens que não servem como capa mesmo vindo como image_url "real": ícones
   de sistema de CMS (ex.: SharePoint dos sites .gov.br), não fotografia.
   Ex. real: EPE reaproveita o mesmo ícone genérico do site em toda matéria
   (_layouts/15/images/spcommon.png) — isso cai pro fallback editorial. */
const IMAGEM_PADROES_INVALIDOS = [
  /_layouts\\/15\\/images\\//i,
  /spcommon\\.png/i
];
function imagemInvalida(url){
  return !!url && IMAGEM_PADROES_INVALIDOS.some(re => re.test(url));
}

/* Hierarquia de imagem:
   1) foto real da própria matéria (já veio pronta em noticia.image_url —
      inclui o que foi extraído via og:image/JSON-LD lá no coletor), desde
      que não seja um ícone/arte de sistema (ver imagemInvalida);
   2) Biblioteca Editorial OWNews, por correspondência semântica de assunto;
   3) ilustração vetorial OWNews — só como último fallback técnico. */
function imagemDe(noticia){
  if (noticia.image_url && !imagemInvalida(noticia.image_url)) {
    return { src: noticia.image_url, ilustracao: false, variant: '', credito: null };
  }

  const categoria = classificarImagem(noticia);
  if (categoria) {
    const foto = proximaFotoBiblioteca(categoria);
    if (foto) {
      return { src: foto.src, ilustracao: true, variant: '', credito: foto.credito };
    }
  }

  const h = hashSimples(noticia.id || noticia.title || '');
  const flip = (h % 2 === 0) ? 'scaleX(-1)' : 'none';
  const hue = (h % 5) * 6 - 12; // leve variação, não muda a paleta de marca
  return {
    src: FALLBACK_IMAGES[noticia.image_credit] || FALLBACK_IMAGES.default,
    ilustracao: true,
    variant: \`transform:\${flip};filter:hue-rotate(\${hue}deg)\`,
    credito: null
  };
}

function notaIlustrativa(img, compacta){
  if (!img.ilustracao) return '';
  const texto = img.credito ? \`Imagem ilustrativa · \${escaparHTML(img.credito)}\` : 'Ilustração editorial OWNews';
  return \`<span class="illustration-note\${compacta ? ' compacta' : ''}"\${compacta ? \` title="\${escaparHTML(texto)}"\` : ''}>\${compacta ? 'ⓘ' : texto}</span>\`;
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

function truncar(texto, max){
  const t = String(texto || '').trim();
  return t.length > max ? t.slice(0, max).trim() + '…' : t;
}

function renderHero(noticia){
  const hero = document.getElementById('heroCard');
  const img = imagemDe(noticia);
  hero.innerHTML = \`
    <div class="cover" style="\${coverStyle(img)}"></div>
    \${notaIlustrativa(img, false)}
    <div class="lead-copy">
      <span class="eyebrow">\${cartaoFonte(noticia.image_credit)} · Destaque</span>
      <h1>\${escaparHTML(noticia.title)}</h1>
      <p>\${escaparHTML(truncar(noticia.summary, 130))}</p>
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
      <div class="thumb" style="\${coverStyle(img)}">\${notaIlustrativa(img, true)}</div>
      <div>
        <span class="eyebrow">\${cartaoFonte(n.image_credit)}</span>
        <h3>\${escaparHTML(n.title)}</h3>
        <span class="byline">\${tempoRelativo(n.published_at)}</span>
      </div>
    </article>\`;
  }).join('');
}

function renderRowItem(n){
  const img = imagemDe(n); // computado uma única vez — não pode ser chamado 2x (a rotação avança a cada chamada)
  return \`
    <article class="row" onclick="\${irPara(n.id)}">
      <div class="row-thumb" style="\${coverStyle(img)}">\${notaIlustrativa(img, true)}</div>
      <div class="row-main">
        <h3>\${escaparHTML(n.title)}</h3>
        <span class="byline">\${cartaoFonte(n.image_credit)} · \${tempoRelativo(n.published_at)}</span>
      </div>
    </article>\`;
}

function renderUltimas(lista){
  const el = document.getElementById('ultimasBody');
  if (!lista.length) { el.innerHTML = ''; return; }
  const [destaque, ...resto] = lista;
  const img = imagemDe(destaque);
  el.innerHTML = \`
    <article class="latest-feature" onclick="\${irPara(destaque.id)}">
      <div class="thumb" style="\${coverStyle(img)}">\${notaIlustrativa(img, false)}</div>
      <span class="eyebrow">\${cartaoFonte(destaque.image_credit)}</span>
      <h3>\${escaparHTML(destaque.title)}</h3>
      <p>\${escaparHTML(destaque.summary)}</p>
      <span class="byline">\${tempoRelativo(destaque.published_at)}</span>
    </article>
    <div class="row-list">
      \${resto.map(renderRowItem).join('')}
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
      <div class="thumb" style="\${coverStyle(img)}">\${notaIlustrativa(img, false)}</div>
      <span class="eyebrow">\${cartaoFonte(destaque.image_credit)}</span>
      <h3>\${escaparHTML(destaque.title)}</h3>
      <p>\${escaparHTML(destaque.summary)}</p>
      <span class="byline">\${tempoRelativo(destaque.published_at)}</span>
    </article>
    <div class="row-list">
      \${resto.map(renderRowItem).join('')}
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
      \${notaIlustrativa(img, false)}
      <div class="ops-card-copy">
        <span class="eyebrow">\${cartaoFonte(n.image_credit)}</span>
        <h3>\${escaparHTML(n.title)}</h3>
        <span class="byline">\${tempoRelativo(n.published_at)}</span>
      </div>
    </article>\`;
  }).join('');
}

/* ---------------------------------------------------------------
   Radar Offshore + Giro 24h: reaproveitam a mesma lista de matérias já
   carregada (nenhuma chamada extra) — só recortam e etiquetam.

   "AGORA" só aparece quando a matéria é de fato recente (<=6h). Antes,
   essa etiqueta era aplicada ao primeiro item só por posição na lista —
   uma matéria de dias atrás podia aparecer marcada como "AGORA" no
   ticker sempre que fosse a mais recente disponível. Corrigido: a
   etiqueta agora reflete o tempo real decorrido, nunca a posição.
------------------------------------------------------------------ */
const HORAS_JANELA_AGORA = 6;

function tagRadar(n){
  const horas = (Date.now() - new Date(n.published_at).getTime()) / 3600000;
  if (Number.isFinite(horas) && horas <= HORAS_JANELA_AGORA) return 'AGORA';
  const cat = classificar(n);
  if (cat === 'operacoes') return 'OPERAÇÕES';
  if (cat === 'mercado') return 'MERCADO';
  const fonte = (n.image_credit || '').toUpperCase();
  if (fonte === 'MME' || fonte === 'EPE') return 'ENERGIA';
  return fonte || 'OWNEWS';
}

/* Radar Offshore foi removido nesta rodada de acabamento: sobrava sem
   entregar valor proporcional ao espaço (aeroportos duplicava a área
   acima, vagas/alertas não tinham dado real). O array abaixo continua
   existindo só porque a busca (executarBusca) usa a lista de notícias
   carregadas — não é mais "radar", é só o estado atual de notícias. */
let ULTIMAS_NOTICIAS_RADAR = SEED_ARTICLES;

/* Velocidade editorial confortável e proporcional ao conteúdo: ~34px/s.
   Como o conteúdo é duplicado pro loop contínuo (translateX -50%), a
   largura de UM conjunto é metade do scrollWidth total — a duração é
   calculada em cima dela, então 3 manchetes ou 12 sempre "sentem" a
   mesma velocidade de leitura, só muda quanto tempo o ciclo inteiro leva. */
const TICKER_PX_POR_SEGUNDO = 34;

function renderTicker(lista){
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  const itens = lista.slice(0, 12);
  if (!itens.length) { track.innerHTML = ''; return; }
  const html = itens.map(n => \`
    <a class="ticker-item" href="/noticia?id=\${encodeURIComponent(n.id)}"><b>\${escaparHTML(tagRadar(n))}</b>\${escaparHTML(truncar(n.title, 90))}</a>\`
  ).join('');
  track.innerHTML = '<span class="ticker-group">' + html + '</span>' +
    '<span class="ticker-group" aria-hidden="true">' + html + '</span>';
  track.querySelectorAll('[aria-hidden="true"] a').forEach(a => a.tabIndex = -1);
  atualizarVelocidadeTicker();
}

function atualizarVelocidadeTicker(){
  const track = document.getElementById('tickerTrack');
  const grupo = track && track.querySelector('.ticker-group');
  if (!grupo) return;
  const largura = grupo.getBoundingClientRect().width;
  if (largura > 0) track.style.animationDuration = (largura / TICKER_PX_POR_SEGUNDO) + 's';
}
window.addEventListener('resize', atualizarVelocidadeTicker);
if (document.fonts) document.fonts.ready.then(atualizarVelocidadeTicker);

/* ---------------------------------------------------------------
   Pontuação editorial da manchete principal — score simples, sem IA,
   determinístico (a mesma lista de notícias sempre produz o mesmo
   resultado, sem aleatoriedade e sem chamada externa).

   Antes, a manchete era só "a mais recente que tivesse imagem própria",
   o que fazia uma notícia ficar em destaque por vários dias sempre que
   nada novo chegava com foto própria — mesmo já existindo matérias mais
   recentes (só cobertas pelo fallback de imagem, que já existe e é
   editorialmente aceitável via imagemDe()).

   Componentes (pesos somados, nenhum decide sozinho):
   - RECÊNCIA: decai por faixa de horas, mas nunca cai a zero de vez —
     uma matéria antiga ainda pode vencer se for muito mais relevante.
   - AUTORIDADE DA FONTE: todas as fontes hoje já são oficiais (ANP,
     Petrobras, PPSA, EPE, MME, Marinha, IBAMA) — o peso aqui reflete o
     quão central a fonte é para operação/produção offshore, não uma
     avaliação de confiabilidade (todas já passaram nesse crivo antes de
     chegar ao banco).
   - RELEVÂNCIA / CONEXÃO COM O ECOSSISTEMA OFFSHORE: reaproveita
     classificar() (mesma função já usada nas seções Mercado/Operações) —
     "operações" pesa mais que "mercado", que pesa mais que "geral". Os
     dois critérios são tratados juntos porque o banco não tem um campo
     que os distinga; separar em duas pontuações inventaria um sinal que
     não existe nos dados.
   - IMPACTO: lista curta de palavras que sinalizam evento concreto e
     significativo (descoberta, recorde, leilão arrematado, aprovação,
     investimento etc.) — não é análise de sentimento, é correspondência
     literal, então o resultado é sempre auditável.
   - Imagem própria (não-fallback) soma um bônus pequeno — preferência
     visual, não critério excludente.
------------------------------------------------------------------ */
const AUTORIDADE_FONTE = {
  PETROBRAS: 20, ANP: 20, PPSA: 16, EPE: 12, MME: 12, MARINHA: 8, IBAMA: 8
};
const PALAVRAS_IMPACTO = [
  "descoberta","recorde","maior da história","maior de sua história",
  "aprovação","aprovada","aprovado","investimento","bilhões","bilhão",
  "leilão","arremata","contrato de longo prazo","recorde de produção",
  "topo de produção","greve","acidente","explosão","vazamento",
  "corte de produção","sanção","opep"
];

function pontuarDestaque(n, agora){
  const horas = (agora - new Date(n.published_at).getTime()) / 3600000;
  let recencia = 0;
  if (Number.isFinite(horas)) {
    if (horas <= 6) recencia = 40;
    else if (horas <= 24) recencia = 30;
    else if (horas <= 48) recencia = 20;
    else if (horas <= 96) recencia = 10;
    else if (horas <= 168) recencia = 4;
  }

  const fonte = (n.image_credit || '').toUpperCase();
  const autoridade = AUTORIDADE_FONTE[fonte] ?? 10;

  const cat = classificar(n);
  const relevanciaOffshore = cat === 'operacoes' ? 30 : cat === 'mercado' ? 20 : 8;

  const t = ((n.title || '') + ' ' + (n.summary || '')).toLowerCase();
  const impacto = PALAVRAS_IMPACTO.some(p => t.includes(p)) ? 15 : 0;

  const bonusImagemPropria = (n.image_url && !imagemInvalida(n.image_url)) ? 5 : 0;

  return recencia + autoridade + relevanciaOffshore + impacto + bonusImagemPropria;
}

/* Em empate, fica a matéria que já vinha primeiro — a lista chega
   ordenada por published_at desc, então o empate sempre resolve para a
   mais recente, nunca de forma imprevisível entre execuções. */
function escolherDestaque(lista){
  const agora = Date.now();
  let melhor = lista[0];
  let melhorScore = pontuarDestaque(lista[0], agora);
  for (let i = 1; i < lista.length; i++){
    const score = pontuarDestaque(lista[i], agora);
    if (score > melhorScore) { melhor = lista[i]; melhorScore = score; }
  }
  return melhor;
}

function renderTudo(noticias){
  if (!noticias.length) return;
  ULTIMAS_NOTICIAS_RADAR = noticias;

  const hero = escolherDestaque(noticias);
  const restantesPosHero = noticias.filter(n => n.id !== hero.id);
  const destaques = restantesPosHero.slice(0, 3);
  const usados = new Set([hero.id, ...destaques.map(n => n.id)]);
  /* Esgotamento sequencial do pool: cada seção só pode usar matérias que
     nenhuma seção anterior já usou. Antes, "Mercado" e "Operações" liam do
     mesmo pool que "Últimas" sem descontar nada — a mesma matéria podia
     aparecer em Últimas E em Mercado/Operações ao mesmo tempo. A ordem
     abaixo é a prioridade editorial (manchete > destaques > últimas >
     mercado > operações); "operações" pode aceitar conteúdo um pouco menos
     recente (não teve tanta concorrência pelas vagas), mas nunca repete o
     que uma seção anterior já mostrou. */
  const ultimas = noticias.filter(n => !usados.has(n.id)).slice(0, 6);
  ultimas.forEach(n => usados.add(n.id));

  const mercado = noticias.filter(n => !usados.has(n.id) && classificar(n) === 'mercado').slice(0, 5);
  mercado.forEach(n => usados.add(n.id));

  const operacoes = noticias.filter(n => !usados.has(n.id) && classificar(n) === 'operacoes').slice(0, 6);

  renderHero(hero);
  renderHighlights(destaques);
  renderUltimas(ultimas);
  renderMercado(mercado);
  renderOperacoes(operacoes);

  /* O ticker é um resumo/varredura, não uma "seção de conteúdo" como as
     acima — pode citar de novo algo que já apareceu, do mesmo jeito que um
     ticker de TV repete manchetes já mostradas na tela principal. */
  renderTicker(noticias);
}

/* 1) estado inicial imediato, com o snapshot real — sem tela em branco */
renderAirports(SEED_AEROPORTOS);
renderTudo(SEED_ARTICLES);

/* 2) dado ao vivo (mesmos endpoints públicos da produção), com atualização
   automática periódica — mesmas chamadas já existentes, só repetidas num
   intervalo fixo e moderado (10min), sem loops nem custo extra. */
async function carregarNoticiasAoVivo(){
  try {
    const url = SUPABASE_URL + '/rest/v1/articles?select=id,title,summary,image_url,image_credit,original_url,published_at&status=eq.published&order=published_at.desc&limit=20';
    const resposta = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    if (!resposta.ok) throw new Error('Supabase ' + resposta.status);
    const noticias = await resposta.json();
    if (noticias.length) renderTudo(noticias);
  } catch (erro) {
    console.warn('OWNews: usando snapshot local de notícias (fetch ao vivo indisponível).', erro);
  }
}

async function carregarAeroportosAoVivo(){
  try {
    const resposta = await fetch(AEROPORTOS_URL);
    if (!resposta.ok) throw new Error('REDEMET ' + resposta.status);
    const retorno = await resposta.json();
    renderAirports(aeroportosMapFromApi(retorno));
  } catch (erro) {
    renderAirports(SEED_AEROPORTOS);
    console.warn('OWNews: aeroportos sem dados confirmados (consulta indisponível).', erro);
  }
}

carregarNoticiasAoVivo();
carregarAeroportosAoVivo();

const DEZ_MINUTOS = 10 * 60 * 1000;
setInterval(carregarNoticiasAoVivo, DEZ_MINUTOS);
setInterval(carregarAeroportosAoVivo, DEZ_MINUTOS);
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

/* Mesma regra da Home (imagemInvalida no script do cliente): ícones de
   sistema de CMS (ex.: SharePoint dos sites .gov.br) não servem como
   imagem de capa. Versão server-side, usada em /noticia. */
const IMAGEM_PADROES_INVALIDOS_SERVIDOR = [
  /_layouts\/15\/images\//i,
  /spcommon\.png/i
];
function imagemValidaServidor(url) {
  return !!url && !IMAGEM_PADROES_INVALIDOS_SERVIDOR.some((re) => re.test(url));
}

/* =========================================================================
   OWNews HUB — Salários Offshore / Funções a Bordo
   Estrutura só (sem dados de salário inventados). "Em atualização" em todo
   campo que ainda não tem fonte confiável. Reaproveita o mesmo visual da
   home (tokens de cor, tipografia, header/rodapé/tabbar).
========================================================================= */

const AREAS_OFFSHORE = {
  deck: { nome: "Deck", desc: "Convés — movimentação de cargas e operações com guindastes." },
  drilling: { nome: "Drilling", desc: "Perfuração — sonda, coluna de perfuração e operação do poço." },
  subsea: { nome: "Subsea/ROV", desc: "Operações e equipamentos submarinos." },
  engine: { nome: "Engine/Manutenção", desc: "Motores, elétrica e manutenção mecânica da unidade." },
  seguranca: { nome: "Segurança", desc: "Segurança do trabalho e saúde a bordo." },
  marine: { nome: "Marine", desc: "Operações marítimas e comunicação." },
  catering: { nome: "Catering", desc: "Alimentação, hotelaria e serviços de bordo." }
};

const CAMINHO_DECK = ["roustabout", "assistente-guindasteiro", "guindasteiro", "deck-pusher"];
const CAMINHO_DRILLING = ["plataformista", "torrista-derrickman", "assistant-driller", "driller", "toolpusher", "superintendente-perfuracao"];

const FUNCOES_OFFSHORE = [
  { slug: "roustabout", nome: "Auxiliar de Plataforma", area: "deck",
    nomeAntigo: "Antigamente conhecido como Homem de Área / Roustabout.",
    resumo: "Atua nas atividades gerais de convés, organização da área, apoio às operações e movimentação de cargas.",
    caminhoCarreira: CAMINHO_DECK },
  { slug: "assistente-guindasteiro", nome: "Assistente de Guindasteiro", area: "deck",
    resumo: "Apoia o Operador de Guindaste nas operações de movimentação de cargas, preparação das áreas e atividades de convés.",
    caminhoCarreira: CAMINHO_DECK },
  { slug: "guindasteiro", nome: "Operador de Guindaste", area: "deck",
    nomeAntigo: "Também chamado de Guindasteiro.",
    resumo: "Opera os guindastes da unidade nas movimentações de cargas, seguindo o planejamento, os procedimentos e os limites operacionais.",
    caminhoCarreira: CAMINHO_DECK },
  { slug: "deck-pusher", nome: "Deck Pusher", area: "deck",
    resumo: "Supervisiona e coordena as atividades da equipe de Deck, incluindo as operações de convés e movimentação de cargas.",
    caminhoCarreira: CAMINHO_DECK },
  { slug: "plataformista", nome: "Plataformista", area: "drilling",
    resumo: "Atua diretamente no piso da sonda, apoiando as operações de perfuração e o manuseio dos equipamentos e componentes da coluna.",
    caminhoCarreira: CAMINHO_DRILLING },
  { slug: "torrista-derrickman", nome: "Torrista (Derrickman)", area: "drilling",
    resumo: "Atua nas operações relacionadas à coluna de perfuração e nos sistemas de fluido de perfuração.",
    caminhoCarreira: CAMINHO_DRILLING },
  { slug: "assistant-driller", nome: "Assistant Driller", area: "drilling",
    resumo: "Auxilia o Driller na condução das operações e no acompanhamento dos equipamentos e parâmetros da perfuração.",
    caminhoCarreira: CAMINHO_DRILLING },
  { slug: "driller", nome: "Driller", area: "drilling",
    resumo: "Opera e controla os principais equipamentos de perfuração e conduz a operação conforme o programa do poço.",
    caminhoCarreira: CAMINHO_DRILLING },
  { slug: "toolpusher", nome: "Toolpusher", area: "drilling",
    resumo: "Supervisiona a equipe e as atividades de perfuração, acompanhando a execução operacional e o cumprimento do planejamento.",
    caminhoCarreira: CAMINHO_DRILLING },
  { slug: "superintendente-perfuracao", nome: "Superintendente de Perfuração", area: "drilling",
    resumo: "Responsável pela gestão e supervisão geral das operações de perfuração da unidade.",
    caminhoCarreira: CAMINHO_DRILLING },
  { slug: "rov", nome: "ROV", area: "subsea",
    resumo: "Opera veículos subaquáticos remotamente operados (ROVs) para inspeção, manutenção e apoio a operações submarinas." },
  { slug: "subsea", nome: "Subsea", area: "subsea",
    resumo: "Atua em operações e equipamentos submarinos — árvores de natal molhadas, dutos, conexões e sistemas de produção subsea." },
  { slug: "tecnico-seguranca-trabalho", nome: "Técnico de Segurança do Trabalho", area: "seguranca",
    resumo: "Acompanha e fiscaliza o cumprimento das normas de segurança (NRs) a bordo, prevenção de acidentes e resposta a emergências." },
  { slug: "mecanico", nome: "Mecânico", area: "engine",
    resumo: "Realiza manutenção preventiva e corretiva de motores, bombas e equipamentos mecânicos da unidade." },
  { slug: "eletricista", nome: "Eletricista", area: "engine",
    resumo: "Realiza manutenção e reparo de sistemas elétricos, geradores e painéis de energia a bordo." },
  { slug: "radio-operador", nome: "Rádio Operador", area: "marine",
    resumo: "Responsável pelas comunicações da unidade — rádio, telefonia e sistemas de telecomunicação marítima." },
  { slug: "enfermeiro-offshore", nome: "Enfermeiro Offshore", area: "seguranca",
    resumo: "Presta atendimento de saúde e primeiros socorros a bordo, atua na prevenção e nas emergências médicas da tripulação." },
  { slug: "catering", nome: "Catering", area: "catering",
    resumo: "Responsável pela alimentação, hotelaria e serviços de bordo, incluindo cozinha, camaradagem e limpeza dos ambientes internos." }
];

function funcaoPorSlug(slug) {
  return FUNCOES_OFFSHORE.find((f) => f.slug === slug) || null;
}

/* =========================================================================
   DADOS_SALARIO — dados reais pesquisados (setembro/2026), só para as
   funções onde há apuração concluída. Regra: nunca misturar salário-base
   CLT/CAGED (ocupação genérica, muitas vezes sem recorte offshore) com
   remuneração offshore total (base + adicionais). Cada valor carrega sua
   própria fonte. Campo ausente = renderSalarioDetalhe cai em "Em atualização".
========================================================================= */
const ADICIONAIS_PADRAO = "Periculosidade: quando a atividade se enquadra como perigosa pela NR-16 (CLT art. 193) — o que costuma ser o caso em operações offshore de óleo e gás —, a lei prevê adicional de 30% sobre o salário-base. A aplicação depende do laudo técnico (PGR/LTCAT) e do enquadramento contratual de cada função e empresa; nem todo contrato garante o percentual cheio. Confinamento/embarque: adicional previsto em ACT/CCT das empresas do setor, mas o percentual exato não foi confirmado diretamente nesta apuração (não tivemos acesso à cláusula na íntegra) — consulte o acordo coletivo da sua empresa.";

const DADOS_SALARIO = {
  guindasteiro: {
    salarioBase: {
      valor: "R$ 3.488,76 em média (piso salarial médio R$ 3.504,54 · teto salarial R$ 4.455,55)",
      contexto: "CBO 7822-10 — Operador de Guindaste (Fixo), jornada de referência 43h/semana. É salário-base CLT (CAGED), não é remuneração offshore.",
      fonte: "salario.com.br — CBO 782110, amostra de 4.839 profissionais (admissões e desligamentos, CAGED 08/2025–07/2026), consultado em 13/09/2026"
    },
    faixaOffshore: {
      valor: null,
      contexto: "As estimativas de mercado localizadas (petrosolgas.com.br, 2023; Monitor do Mercado, 2026) divergem entre si na definição dos níveis júnior/pleno/sênior e nenhuma cita fonte primária — não atendem ao padrão de confiabilidade do OWNews.",
      fonte: null
    },
    adicionais: ADICIONAIS_PADRAO,
    escala: "14x14 (14 dias embarcado por 14 de folga), turnos de até 12h — regime amplamente citado no setor, sem fonte oficial única confirmada por esta apuração.",
    oQueFaz: "Opera guindastes de bordo (fixos, tipo pedestal) para movimentar cargas entre o convés, embarcações de apoio e outras estruturas, seguindo procedimentos de içamento e sinalização.",
    requisitos: "Formação técnica em áreas como mecânica, eletrônica ou automação industrial, mais experiência prévia em operação de equipamentos de içamento.",
    cursos: "Curso de operador de guindaste (NR-11), CBSP (Curso Básico de Segurança de Plataforma) e HUET (escape de helicóptero submerso) — pré-requisitos padrão para embarcar.",
    experiencia: "Empresas costumam exigir experiência prévia com equipamentos de içamento antes de aceitar candidatos para o regime offshore.",
    carreira: "Fontes de mercado descrevem progressão interna dentro da própria função — de operador júnior a sênior — mas sem uma fonte primária que documente essa trajetória; tratamos como referência informal, não como fato apurado.",
    mercado: "Publicações do setor relatam grande volume de vagas para esta função, mas não encontramos estatística oficial que confirme isso especificamente para o regime offshore.",
    metodologia: "Salário-base: CAGED via salario.com.br (CBO 782110), consultado diretamente em 13/09/2026. Faixa offshore removida nesta versão por falta de fonte primária e por divergência entre as estimativas de mercado encontradas. Percentual de confinamento/embarque removido por não termos confirmado a cláusula diretamente no ACT/CCT.",
    fontes: [
      { nome: "salario.com.br — CBO 782110 (Operador de Guindaste Fixo)", url: "https://www.salario.com.br/profissao/operador-de-guindaste-fixo-cbo-782110/" }
    ]
  },

  plataformista: {
    salarioBase: {
      valor: "R$ 2.171,98 em média (piso salarial médio R$ 2.119,94 · teto salarial R$ 3.008,34)",
      contexto: "CBO 7113-25 — Plataformista (Petróleo), jornada de referência 39h/semana. É salário-base CLT (CAGED), não é remuneração offshore.",
      fonte: "salario.com.br — CBO 711325, amostra de 2.090 profissionais (CAGED 08/2025–07/2026), consultado em 13/09/2026"
    },
    faixaOffshore: {
      valor: null,
      contexto: "A única referência de mercado localizada citava um valor isolado de entrada, sem faixa consolidada por nível de experiência nem fonte primária — não é suficiente para publicar.",
      fonte: null
    },
    adicionais: ADICIONAIS_PADRAO,
    escala: "14x14 (14 dias embarcado por 14 de folga) — regime amplamente citado no setor, sem fonte oficial única confirmada por esta apuração.",
    oQueFaz: "Função de entrada na equipe de convés/sonda: apoio a operações de carga e descarga, transporte de materiais e serviços gerais, com exposição a esforço físico e trabalho em altura.",
    requisitos: "Ensino médio completo; não exige curso superior.",
    cursos: "CBSP (Segurança de Plataforma), HUET (escape de helicóptero), NR-33 (espaço confinado) e NR-35 (trabalho em altura).",
    experiencia: "Função tipicamente de entrada — poucas empresas exigem experiência offshore prévia, mas dão preferência a quem já tem os cursos obrigatórios em dia.",
    carreira: "Descrita informalmente pelo mercado como porta de entrada para a carreira offshore, com possibilidade de especialização em funções de convés e sonda ao longo do tempo — sem uma progressão única e documentada por fonte primária.",
    mercado: "Publicações do setor (Indeed) descrevem alta rotatividade e grande volume de vagas de entrada; não é uma estatística com metodologia divulgada.",
    metodologia: "Salário-base: CAGED via salario.com.br (CBO 711325), consultado diretamente em 13/09/2026. Faixa offshore mantida como 'Em atualização' — dado insuficiente para consolidar, conforme regra de não inventar valores.",
    fontes: [
      { nome: "salario.com.br — CBO 711325 (Plataformista, Petróleo)", url: "https://www.salario.com.br/profissao/plataformista-petroleo-cbo-711325/" }
    ]
  },

  "tecnico-seguranca-trabalho": {
    salarioBase: {
      valor: "R$ 3.948,44 em média (piso salarial médio R$ 3.507,90 · teto salarial R$ 6.353,13)",
      contexto: "CBO 3516-05 — Técnico em Segurança do Trabalho, jornada de referência 43h/semana. É salário-base CLT (CAGED), não é remuneração offshore.",
      fonte: "salario.com.br — CBO 351605, amostra de 146.982 profissionais (CAGED 08/2025–07/2026), consultado em 13/09/2026"
    },
    faixaOffshore: {
      valor: null,
      contexto: "A única estimativa de mercado localizada (Monitor do Mercado, 2026) não cita fonte primária e não foi confirmada por uma segunda fonte independente — não é suficiente para publicar.",
      fonte: null
    },
    adicionais: ADICIONAIS_PADRAO,
    escala: "14x14 ou 28x28, conforme empresa e contrato — regimes citados no setor, sem fonte oficial única confirmada por esta apuração.",
    oQueFaz: "Acompanha e fiscaliza o cumprimento das Normas Regulamentadoras a bordo, participa de auditorias, treinamentos e resposta a emergências.",
    requisitos: "Curso técnico em Segurança do Trabalho com registro profissional.",
    cursos: "CBSP, HUET, e normas complementares como NR-37 (plataformas), NR-33 (espaço confinado) e NR-35 (trabalho em altura).",
    experiencia: "Experiência em auditorias e resposta a emergências costuma valorizar a remuneração, segundo relatos do setor — sem estatística que quantifique esse efeito.",
    carreira: "Não encontramos uma sequência de cargos formalmente documentada para esta função dentro do nosso próprio mapeamento — tratada como 'Em atualização'.",
    mercado: "Fontes do setor descrevem demanda estável ligada à conformidade regulatória das operações offshore, sem estatística oficial que sustente números específicos.",
    metodologia: "Salário-base: CAGED via salario.com.br (CBO 351605), consultado diretamente em 13/09/2026. Faixa offshore removida nesta versão: única fonte encontrada, sem sustentação primária e sem confirmação independente.",
    fontes: [
      { nome: "salario.com.br — CBO 351605 (Técnico em Segurança no Trabalho)", url: "https://www.salario.com.br/profissao/tecnico-em-seguranca-no-trabalho-cbo-351605/" }
    ]
  },

  rov: {
    salarioBase: {
      valor: "R$ 5.217,49 em média (piso salarial médio R$ 3.531,06 · teto salarial R$ 8.337,13)",
      contexto: "CBO 7813-05 — Piloto/Operador de ROV (ocupação própria, não é equivalência forçada com outro CBO), jornada de referência 41h/semana. É salário-base CLT (CAGED), não é remuneração offshore.",
      fonte: "salario.com.br — CBO 781305, amostra de 1.126 profissionais (646 admissões + 480 desligamentos, CAGED 08/2025–07/2026), consultado em 13/09/2026"
    },
    faixaOffshore: {
      valor: null,
      contexto: "As estimativas de mercado localizadas não citam fonte primária; uma delas ficou indisponível (404) numa nova verificação — não atendem ao padrão de confiabilidade do OWNews.",
      fonte: null
    },
    adicionais: ADICIONAIS_PADRAO,
    escala: "14x14 na maioria das empresas, com relatos de folgas de até 21 dias — regime citado no setor, sem fonte oficial única confirmada por esta apuração.",
    oQueFaz: "Pilota veículos subaquáticos remotamente operados (ROVs) para inspeção, manutenção e apoio a operações submarinas de produção.",
    requisitos: "Curso técnico em Eletrônica, Mecânica, Elétrica ou Mecatrônica, com registro no CREA.",
    cursos: "CBSP, HUET, especialização/curso específico em operação de ROV; inglês técnico é diferencial.",
    experiencia: "Relatos do setor associam progressão de trainee a piloto pleno e depois supervisor a tempo de operação autônoma e gestão de equipe — sem fonte primária que documente prazos.",
    carreira: "Sequência trainee → piloto pleno → supervisor de ROV é citada por publicações do setor, dentro da própria função — sem cargos formalmente cadastrados em nosso mapeamento de Funções a Bordo.",
    mercado: null,
    metodologia: "Salário-base: CAGED via salario.com.br (CBO 781305), consultado diretamente em 13/09/2026. Faixa offshore removida por falta de fonte primária. Removemos também uma afirmação anterior de alta no volume de contratações: uma nova verificação direta da mesma fonte mostrou o oposto (retração), então o dado foi retirado por segurança.",
    fontes: [
      { nome: "salario.com.br — CBO 781305 (Piloto de ROV)", url: "https://www.salario.com.br/profissao/piloto-de-rov-cbo-781305/" }
    ]
  },

  driller: {
    salarioBase: {
      valor: "R$ 4.018,78 em média (piso R$ 2.862,77 · teto R$ 5.297,37)",
      contexto: "CBO 7113-15 — Sondador (Poços de Petróleo e Gás). 'Driller' é o termo em inglês usado pela indústria para o Sondador — não é uma equivalência forçada, é a tradução operacional consolidada no setor. Jornada de referência 41h/semana. É salário-base CLT (CAGED, inclui operação terrestre), não é remuneração offshore.",
      fonte: "salario.com.br — CBO 711315, amostra de 1.164 profissionais (CAGED 08/2025–07/2026), consultado em 13/09/2026"
    },
    faixaOffshore: {
      valor: null,
      contexto: "As duas estimativas de mercado localizadas (Monitor do Mercado e Monitor Econômico) trazem números idênticos sem metodologia nomeada em nenhuma das duas — mais consistente com conteúdo replicado do que com confirmação independente, por isso não usamos.",
      fonte: null
    },
    adicionais: ADICIONAIS_PADRAO,
    escala: "14x14, turnos de 12h — regime amplamente citado no setor, sem fonte oficial única confirmada por esta apuração.",
    oQueFaz: "Opera o sistema de perfuração a partir do painel de controle da sonda, comandando descida/subida da coluna e o processo de perfuração do poço.",
    requisitos: "Curso técnico em Mecânica, Petróleo e Gás ou Eletrotécnica.",
    cursos: "CBSP, HUET, certificação Well Control em nível Sondador e IWCF (International Well Control Forum); inglês fluente para operar sistemas internacionais (ex. NOV, Aker Solutions).",
    experiencia: "Relatos do setor associam a progressão de Assistente de Sondador para Sondador e depois Sondador Sênior a tempo de operação e responsabilidade sobre turno e segurança do poço.",
    carreira: "Sequência Assistente de Sondador → Sondador → Sondador Sênior é citada por publicações do setor — corresponde à hierarquia de sonda amplamente documentada internacionalmente (Torrista/Assistant Driller/Driller/Toolpusher), embora não tenhamos fonte primária nacional que quantifique cada degrau.",
    mercado: "Fontes do setor relatam demanda aquecida ligada à expansão do pré-sal e de novos campos na Margem Equatorial, sem estatística oficial que confirme isso especificamente para esta função.",
    metodologia: "Salário-base: CAGED via salario.com.br (CBO 711315), consultado diretamente em 13/09/2026. Faixa offshore removida: as duas fontes de mercado encontradas convergem número por número sem metodologia nomeada, o que sugere conteúdo replicado, não confirmação independente.",
    fontes: [
      { nome: "salario.com.br — CBO 711315 (Sondador, Poços de Petróleo e Gás)", url: "https://www.salario.com.br/profissao/sondador-pocos-de-petroleo-e-gas-cbo-711315/" }
    ]
  }
};

function campoDado(dado) {
  if (!dado) return pillAtualizacao("Dados offshore em atualização");
  if (!dado.valor) {
    return (
      pillAtualizacao("Dados offshore em atualização") +
      (dado.contexto ? '<div class="dado-contexto">' + escaparHTML(dado.contexto) + '</div>' : '')
    );
  }
  return (
    '<div class="dado-valor">' + escaparHTML(dado.valor) + '</div>' +
    (dado.contexto ? '<div class="dado-contexto">' + escaparHTML(dado.contexto) + '</div>' : '') +
    (dado.fonte ? '<div class="dado-fonte">Fonte: ' + escaparHTML(dado.fonte) + '</div>' : '')
  );
}

function campoTexto(texto) {
  if (!texto) return pillAtualizacao("Em atualização");
  return '<div class="dado-contexto sem-margem">' + escaparHTML(texto) + '</div>';
}

function pillAtualizacao(texto) {
  return '<span class="campo-pill">' + escaparHTML(texto || "Em atualização") + '</span>';
}

function campoEstrutura(rotulo, conteudoHtml) {
  return (
    '<div class="campo-row">' +
    '<span class="campo-rotulo">' + escaparHTML(rotulo) + '</span>' +
    '<span class="campo-valor">' + conteudoHtml + '</span>' +
    '</div>'
  );
}

/* ---------- chrome compartilhado (header/topline/rodapé/tabbar) ---------- */
function paginaChrome(tituloAba, descricaoMeta, conteudoHtml, caminhoCanonico) {
  return (
    '<!doctype html><html lang="pt-BR"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<meta name="theme-color" content="#061c2b">' +
    '<meta name="description" content="' + escaparHTML(descricaoMeta) + '">' +
    (caminhoCanonico ? '<link rel="canonical" href="https://ownews.com.br' + caminhoCanonico + '">' : '') +
    '<link rel="manifest" href="/manifest.webmanifest">' +
    '<title>' + escaparHTML(tituloAba) + ' | OWNews (preview)</title>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=Archivo:wght@500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap">' +
    '<style>\n/* ---------------------------------------------------------------\n   OWNews — HOME v3 (redesign editorial, preview local — não publicado\n   em produção). Identidade preservada: navy escuro + branco + azul/ciano.\n   Laranja reservado exclusivamente para elementos ligados à OffshoreWorks.\n\n   Vozes tipográficas:\n   - Source Serif 4 = voz editorial (todo título de matéria, de manchete a\n     linha de lista) — é o que dá o ar de jornal premium.\n   - Archivo = voz de interface (nav, botões, rótulos de seção, metadados).\n   - IBM Plex Mono = reservada só pra dado técnico (códigos ICAO na barra\n     de aeroportos) — de propósito, não usamos mono em mais nada, pra\n     tirar o ar de "dashboard".\n------------------------------------------------------------------ */\n:root{\n  --navy-950:#061c2b;\n  --navy-900:#08283a;\n  --navy-800:#0a2c40;\n  --navy-700:#0e3450;\n  --line:#16445e;\n  --line-soft:#123c53;\n  --line-hair:#153a50;\n  --cyan:#12a8ee;\n  --cyan-dim:#5fc4ee;\n  --white:#f7fafc;\n  --muted:#9eb5c5;\n  --muted-dim:#6f8b9c;\n  --orange:#ff7a00;   /* somente OffshoreWorks */\n  --orange-dim:#7a3f10;\n  --green:#42d879;\n  --yellow:#ffd44d;\n  --red:#ff4b4b;\n\n  --editorial: \'Source Serif 4\', Georgia, \'Times New Roman\', serif;\n  --ui: \'Archivo\', system-ui, -apple-system, \'Segoe UI\', sans-serif;\n  --mono: \'IBM Plex Mono\', \'SF Mono\', ui-monospace, monospace;\n\n  color-scheme: dark;\n}\n\n*{box-sizing:border-box}\nhtml{scroll-behavior:smooth}\nbody{\n  margin:0;\n  /* degradê quase imperceptível — leve glow no topo que se dissolve no\n     navy-950 chapado; fixed pra não repetir/"costurar" ao rolar a página. */\n  background:\n    radial-gradient(1400px 800px at 50% -220px, #0d3349 0%, rgba(13,51,73,0) 60%),\n    var(--navy-950);\n  background-attachment:fixed;\n  color:var(--white);\n  font-family:var(--ui);\n  -webkit-font-smoothing:antialiased;\n  /* casa exatamente com a altura real da tabbar (conteúdo + safe-area) —\n     um valor fixo deixava vão vazio em telas sem notch e sobrepunha\n     conteúdo em iPhones com safe-area-inset-bottom grande. */\n  padding-bottom:calc(56px + env(safe-area-inset-bottom));\n\n}\n@media(min-width:760px){ body{ padding-bottom:0; } }\n\na{text-decoration:none;color:inherit}\nimg{max-width:100%;display:block}\nh1,h2,h3{text-wrap:balance;margin:0;font-family:var(--editorial)}\nbutton{font-family:inherit}\n:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}\n\n.container{width:min(1180px,100% - 32px);margin-inline:auto}\n\n.skip-link{\n  position:absolute;left:12px;top:-48px;background:var(--cyan);color:var(--navy-950);\n  font-weight:700;padding:10px 14px;border-radius:6px;z-index:100;transition:top .15s;\n}\n.skip-link:focus{top:12px}\n\n/* ---------- topo institucional ---------- */\n.topline{border-bottom:1px solid var(--line-soft);font-family:var(--ui);font-size:11.5px;letter-spacing:.02em;color:var(--muted-dim)}\n.topline .container{display:flex;justify-content:space-between;gap:12px;padding-block:8px}\n\n/* ---------- header ---------- */\nheader{\n  background:rgba(6,28,43,.92);backdrop-filter:blur(10px);\n  border-bottom:1px solid var(--line);position:sticky;top:0;z-index:30;\n}\n.nav{min-height:60px;display:flex;align-items:center;gap:16px}\n.logo{font-family:var(--ui);font-size:24px;font-weight:800;letter-spacing:-.03em;white-space:nowrap;color:var(--white)}\n.logo span{color:var(--cyan)}\n.menu-btn{\n  display:flex;align-items:center;justify-content:center;margin-left:auto;\n  border:1px solid var(--line);background:var(--navy-900);color:var(--white);\n  border-radius:8px;font-size:20px;width:42px;height:38px;\n}\n.links{\n  display:none;position:absolute;left:0;right:0;top:60px;background:var(--navy-950);\n  border-bottom:1px solid var(--line);padding:6px 16px 18px;flex-direction:column;gap:0;\n}\n.links.open{display:flex}\n.links a{padding:13px 4px;border-bottom:1px solid var(--line-soft);font-size:13px;font-weight:700;letter-spacing:.02em}\n.shop-btn{\n  margin-top:10px;text-align:center;background:var(--navy-800);color:var(--white);\n  border:1px solid var(--orange-dim);font-weight:700;font-size:12.5px;letter-spacing:.02em;\n  padding:12px;border-radius:6px;\n}\n.shop-btn:hover{border-color:var(--orange)}\n@media(min-width:760px){\n  .nav{min-height:76px}\n  .logo{font-size:30px}\n  .menu-btn{display:none}\n  .links{\n    display:flex;position:static;flex-direction:row;align-items:center;gap:22px;\n    background:none;border:0;padding:0;margin-left:auto;\n  }\n  .links a{padding:0;border:0;font-size:13px}\n  .shop-btn{margin-top:0;background:var(--navy-700);border:1px solid var(--orange-dim);color:var(--white);padding:11px 16px}\n  .shop-btn:hover{border-color:var(--orange)}\n}\n\n/* ---------- ops strip: aeroportos (mantido como estava — sem mudanças de conceito) ---------- */\n.ops{margin-block:16px}\n.ops-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px;padding-inline:2px}\n.ops-head .live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);flex:none}\n.ops-head strong{\n  font-family:var(--ui);font-size:11px;letter-spacing:.08em;color:var(--muted);\n  text-transform:uppercase;font-weight:700;\n}\n.ops-strip{\n  display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;\n  padding-bottom:2px;-webkit-overflow-scrolling:touch;\n}\n.ops-strip::-webkit-scrollbar{display:none}\n.airport{\n  scroll-snap-align:start;flex:0 0 auto;display:flex;align-items:center;gap:8px;\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;\n  padding:9px 12px;white-space:nowrap;\n}\n.airport .dot{width:8px;height:8px;border-radius:50%;flex:none}\n.airport .code{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--white)}\n.airport .cidade{font-size:11px;color:var(--muted);font-family:var(--ui)}\n.dot.green{background:var(--green);box-shadow:0 0 6px var(--green)}\n.dot.yellow{background:var(--yellow);box-shadow:0 0 6px var(--yellow)}\n.dot.red{background:var(--red);box-shadow:0 0 6px var(--red)}\n.dot.unknown{background:var(--muted-dim)}\n@media(min-width:760px){\n  .ops-strip{display:grid;grid-template-columns:repeat(6,1fr);overflow:visible}\n  .airport{justify-content:center}\n}\n\n/* ---------- MASTHEAD: manchete dominante + 3 destaques ---------- */\n.masthead{display:grid;gap:22px;margin-top:8px}\n.lead{\n  position:relative;border-radius:4px;overflow:hidden;min-height:400px;\n  background:var(--navy-900);cursor:pointer;\n}\n.lead .cover{position:absolute;inset:0;background-size:cover;background-position:center center}\n.lead .cover::after{\n  content:"";position:absolute;inset:0;\n  background:linear-gradient(180deg,rgba(4,12,18,0) 32%,rgba(3,10,15,.94) 100%);\n}\n.lead-copy{position:relative;z-index:2;padding:26px 22px 24px;display:flex;flex-direction:column;justify-content:flex-end;min-height:400px}\n.eyebrow{\n  font-family:var(--ui);font-size:11.5px;font-weight:700;letter-spacing:.08em;\n  text-transform:uppercase;color:var(--cyan-dim);margin-bottom:12px;\n}\n.lead h1{font-size:30px;line-height:1.08;font-weight:600;letter-spacing:-.01em;margin-bottom:12px;color:var(--white)}\n.lead p{font-family:var(--editorial);font-size:17px;line-height:1.5;color:#dbe8ef;max-width:60ch;margin-bottom:12px}\n.byline{font-family:var(--ui);font-size:12px;color:var(--muted)}\n.illustration-note{\n  position:absolute;left:10px;top:10px;z-index:2;font-family:var(--ui);\n  font-size:10.5px;letter-spacing:.03em;color:var(--muted-dim);\n  background:rgba(6,28,43,.68);padding:4px 9px;border-radius:99px;\n  max-width:calc(100% - 20px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\n}\n.lead .illustration-note, .ops-card .illustration-note{left:20px;top:18px}\n.illustration-note.compacta{\n  padding:2px 5px;font-size:9px;max-width:none;white-space:nowrap;cursor:help;\n}\n\n.highlights{display:flex;flex-direction:column}\n.highlight{\n  display:grid;grid-template-columns:64px 1fr;gap:14px;align-items:start;\n  padding-block:16px;border-top:1px solid var(--line-hair);cursor:pointer;\n}\n.highlight:first-child{border-top:0;padding-top:0}\n.highlight .thumb{width:64px;height:64px;border-radius:4px;background-size:cover;background-position:center;background-color:var(--navy-800);flex:none;position:relative}\n.highlight .thumb .illustration-note.compacta{left:3px;top:3px}\n.highlight .eyebrow{margin-bottom:6px;font-size:10.5px}\n.highlight h3{font-size:16px;line-height:1.3;font-weight:600;color:var(--white)}\n.highlight .byline{margin-top:6px;display:block}\n\n@media(min-width:760px){\n  .masthead{grid-template-columns:1.7fr 1fr}\n  .lead{min-height:520px}\n  .lead-copy{min-height:520px;padding:40px}\n  .lead h1{font-size:42px}\n  .lead p{font-size:18px}\n}\n\n/* ---------- seções editoriais ---------- */\n.ed-section{margin-top:52px}\n/* flex-wrap + sem nowrap no ed-sub: causa raiz do overflow horizontal no\n   mobile — h2 + subtítulo juntos não cabem em 320-360px numa linha só, e\n   nowrap forçava o subtítulo a estourar a viewport em vez de quebrar. */\n.ed-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 16px;margin-bottom:22px;padding-bottom:14px;border-bottom:2px solid var(--line)}\n.ed-head h2{font-family:var(--ui);font-size:22px;font-weight:800;color:var(--white);letter-spacing:-.01em}\n.ed-sub{font-family:var(--ui);font-size:12px;color:var(--muted-dim)}\n@media(min-width:760px){ .ed-sub{white-space:nowrap} }\n\n/* Últimas Notícias: 1 item em destaque + lista tipográfica, sem caixas */\n.latest-body{display:grid;gap:28px}\n.latest-feature{display:grid;gap:14px;cursor:pointer;padding-bottom:22px;border-bottom:1px solid var(--line-hair)}\n.latest-feature .thumb{width:100%;aspect-ratio:16/8;border-radius:4px;background-size:cover;background-position:center;background-color:var(--navy-900);position:relative}\n.latest-feature h3{font-size:24px;line-height:1.15;font-weight:600}\n.latest-feature p{font-family:var(--editorial);font-size:15.5px;line-height:1.5;color:var(--muted);max-width:68ch}\n.row-list{display:flex;flex-direction:column}\n.row{display:flex;gap:14px;align-items:center;padding-block:12px;border-top:1px solid var(--line-hair);cursor:pointer}\n.row:first-child{border-top:0}\n.row-thumb{\n  width:92px;height:66px;border-radius:5px;background-size:cover;background-position:center;\n  background-color:var(--navy-900);flex:none;position:relative;\n}\n.row-main{min-width:0}\n.row-main h3{font-size:16.5px;line-height:1.35;font-weight:600}\n.row-main .byline{margin-top:5px}\n\n@media(min-width:760px){\n  .latest-body{grid-template-columns:1.3fr 1fr;align-items:start}\n  .latest-feature{border-bottom:0;padding-bottom:0}\n  .latest-feature h3{font-size:27px}\n}\n\n/* Mercado & Energia: assimétrico, item maior + lista compacta ao lado */\n.market-body{display:grid;gap:26px}\n.market-feature{display:grid;gap:12px;cursor:pointer}\n.market-feature .thumb{width:100%;aspect-ratio:16/9;border-radius:4px;background-size:cover;background-position:center;background-color:var(--navy-900);position:relative}\n.market-feature h3{font-size:22px;line-height:1.18;font-weight:600}\n.market-feature p{font-family:var(--editorial);font-size:15px;line-height:1.5;color:var(--muted)}\n@media(min-width:760px){\n  .market-body{grid-template-columns:1fr 1fr;gap:40px}\n  .market-feature h3{font-size:25px}\n}\n\n/* Operações Offshore: trilho horizontal cinematográfico */\n.ops-rail{display:flex;gap:16px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}\n.ops-rail::-webkit-scrollbar{display:none}\n.ops-card{\n  scroll-snap-align:start;flex:0 0 auto;width:280px;border-radius:6px;overflow:hidden;\n  position:relative;min-height:340px;cursor:pointer;background:var(--navy-900);\n}\n.ops-card .cover{position:absolute;inset:0;background-size:cover;background-position:center}\n.ops-card .cover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,12,18,0) 40%,rgba(3,10,15,.92) 100%)}\n.ops-card-copy{position:relative;z-index:2;padding:18px;display:flex;flex-direction:column;justify-content:flex-end;min-height:340px}\n.ops-card h3{font-size:18px;line-height:1.25;font-weight:600;color:var(--white)}\n@media(min-width:760px){ .ops-card{width:320px;min-height:380px} .ops-card-copy{min-height:380px} }\n\n/* Carreiras: lista limpa, sem grade de caixas */\n/* ---------- parceiro OFFVoos (discreto, dentro da barra de aeroportos) ---------- */\n.ops-partner{\n  display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;\n  margin-top:10px;padding-top:10px;border-top:1px solid var(--line-hair);\n  font-family:var(--ui);\n}\n.ops-partner-link{font-size:12.5px;font-weight:700;color:var(--cyan-dim)}\n.ops-partner-link:hover{color:var(--cyan)}\n.ops-partner-sig{font-size:10.5px;color:var(--muted-dim)}\n\n/* ---------- newsletter ---------- */\n.newsletter{margin-top:52px;padding-top:26px;border-top:1px solid var(--line-hair)}\n.newsletter h3{font-family:var(--ui);font-size:13px;color:var(--muted);font-weight:700;letter-spacing:.02em;text-transform:uppercase;margin-bottom:12px}\n.subscribe{display:flex;max-width:440px}\n.subscribe input{min-width:0;flex:1;padding:12px;border:1px solid var(--line-soft);border-right:0;border-radius:6px 0 0 6px;background:var(--navy-900);color:var(--white);font-family:inherit}\n.subscribe button{border:0;background:var(--cyan);color:var(--navy-950);font-weight:800;padding:0 16px;border-radius:0 6px 6px 0}\n\nfooter{margin-top:40px;border-top:1px solid var(--line-soft);padding:24px 0 20px;color:var(--muted-dim);font-size:12px}\n.footer{display:flex;flex-direction:column;flex-wrap:wrap;gap:10px}\n@media(min-width:760px){.footer{flex-direction:row;align-items:center;justify-content:space-between}}\n\n/* ---------- Instagram: presença discreta e constante, sem propaganda ---------- */\n.social-link{\n  display:inline-flex;align-items:center;gap:5px;font-family:var(--ui);font-weight:600;\n  font-size:12px;color:var(--muted);\n}\n.social-link:hover{color:var(--cyan-dim)}\n.social-link svg{width:13px;height:13px;flex:none}\n.social-link-secundario{color:var(--muted-dim)}\n.footer-social{display:flex;gap:16px;flex-wrap:wrap}\n.nav-social{display:flex;gap:16px;flex-wrap:wrap;padding:14px 4px 4px;margin-top:6px;border-top:1px solid var(--line-soft)}\n@media(min-width:760px){.nav-social{display:none}}\n\n/* ---------- tab bar fixa (mobile / futuro app) ---------- */\n.tabbar{\n  position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;\n  background:rgba(8,28,40,.96);backdrop-filter:blur(10px);border-top:1px solid var(--line);\n  padding-bottom:env(safe-area-inset-bottom);\n}\n.tabbar a{\n  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px 8px;\n  font-size:10px;font-weight:700;color:var(--muted-dim);font-family:var(--ui);\n}\n.tabbar a .ti{font-size:18px}\n.tabbar a.active{color:var(--cyan)}\n@media(min-width:760px){.tabbar{display:none}}\n\n/* ---------- HUB: Salários Offshore / Funções a Bordo ---------- */\n.hub-main{padding-top:18px;padding-bottom:40px}\n.breadcrumb{font-family:var(--ui);font-size:12px;color:var(--muted-dim);margin-bottom:18px}\n.breadcrumb a{color:var(--muted);font-weight:600}\n.breadcrumb a:hover{color:var(--cyan-dim)}\n.bc-sep{margin:0 6px;opacity:.6}\n\n.hub-hero{margin-bottom:36px;max-width:70ch}\n.hub-hero .eyebrow{font-family:var(--ui);font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--cyan-dim);display:block;margin-bottom:10px}\n.hub-hero h1{font-size:34px;line-height:1.1;font-weight:600;margin-bottom:14px}\n.hub-lead{font-family:var(--editorial);font-size:17px;line-height:1.55;color:var(--muted)}\n.hub-cta-secundario{display:inline-block;margin-top:14px;font-family:var(--ui);font-size:13px;font-weight:700;color:var(--cyan)}\n\n.aviso-atualizacao{\n  margin-top:18px;padding:14px 16px;border-radius:6px;\n  border:1px solid var(--line-soft);background:var(--navy-900);\n  font-family:var(--ui);font-size:13px;color:var(--muted);line-height:1.5;\n}\n.aviso-atualizacao strong{color:var(--white)}\n\n.area-group{margin-top:40px}\n.area-group h3{font-family:var(--ui);font-size:19px;font-weight:800;color:var(--white);padding-bottom:10px;border-bottom:2px solid var(--line)}\n.area-desc{font-family:var(--ui);font-size:12.5px;color:var(--muted-dim);margin:8px 0 4px}\n\n.role-list{display:flex;flex-direction:column}\n.role-row{\n  display:flex;align-items:center;gap:12px;padding-block:15px;\n  border-top:1px solid var(--line-hair);font-family:var(--ui);\n}\n.role-row:first-child{border-top:0}\n.role-nome{flex:1;font-size:15px;font-weight:600;color:var(--white)}\n.role-row .go{color:var(--cyan)}\n\n.campo-pill{\n  display:inline-block;font-family:var(--ui);font-size:11px;font-weight:700;\n  letter-spacing:.03em;color:var(--muted-dim);background:var(--navy-800);\n  border:1px solid var(--line-soft);border-radius:99px;padding:4px 10px;\n}\n.campo-pill.neutro{color:var(--cyan-dim);border-color:var(--line)}\n\n.campo-grid{display:flex;flex-direction:column;margin-top:8px}\n.campo-row{\n  display:flex;flex-direction:column;gap:8px;\n  padding-block:14px;border-top:1px solid var(--line-hair);\n}\n.campo-row:first-child{border-top:0}\n.campo-rotulo{font-family:var(--ui);font-size:13.5px;font-weight:600;color:var(--white)}\n.campo-valor{min-width:0}\n.dado-valor{font-family:var(--editorial);font-size:16px;line-height:1.4;color:var(--white)}\n.dado-contexto{font-family:var(--ui);font-size:12.5px;line-height:1.5;color:var(--muted);margin-top:4px}\n.dado-contexto.sem-margem{margin-top:0;color:var(--muted)}\n.dado-fonte{font-family:var(--ui);font-size:11.5px;color:var(--muted-dim);margin-top:4px}\n.lista-fontes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}\n.lista-fontes a{font-family:var(--ui);font-size:12.5px;font-weight:600;color:var(--cyan-dim)}\n.lista-fontes a:hover{color:var(--cyan)}\n.aviso-metodologia{margin-bottom:28px}\n\n.hub-continue{\n  margin-top:44px;padding-top:20px;border-top:1px solid var(--line-hair);\n  display:flex;flex-wrap:wrap;gap:16px;align-items:baseline;font-family:var(--ui);\n}\n.hub-continue-label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-dim);width:100%}\n.hub-continue a{font-size:13.5px;font-weight:700;color:var(--cyan)}\n\n@media(min-width:760px){\n  .hub-hero h1{font-size:44px}\n  .campo-row{display:grid;grid-template-columns:260px 1fr;gap:12px;align-items:start}\n}\n\n/* ---------- /salarios: tratamento de produto premium ---------- */\n.salarios-hero{margin-bottom:40px;max-width:74ch}\n.salarios-hero .eyebrow{font-family:var(--ui);font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--cyan-dim);display:block;margin-bottom:10px}\n.salarios-hero h1{font-size:36px;line-height:1.08;font-weight:600;margin-bottom:14px}\n.salarios-hero h1 .ano{color:var(--cyan-dim);font-size:.62em;font-family:var(--ui);font-weight:800;letter-spacing:.02em;vertical-align:middle;margin-left:4px}\n\n.busca-grande{margin-top:28px;max-width:560px}\n.busca-grande label{display:block;font-family:var(--ui);font-size:13px;font-weight:700;color:var(--muted);margin-bottom:8px}\n.busca-grande input{\n  width:100%;font-family:var(--editorial);font-size:19px;color:var(--white);\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;\n  padding:16px 18px;\n}\n.busca-grande input:focus{outline:2px solid var(--cyan);outline-offset:2px;border-color:var(--cyan-dim)}\n.busca-grande input::placeholder{color:var(--muted-dim)}\n\n.stats-row{display:flex;flex-wrap:wrap;gap:28px;margin-top:28px;padding-top:22px;border-top:1px solid var(--line-hair)}\n.stat{display:flex;flex-direction:column;gap:2px;font-family:var(--ui)}\n.stat strong{font-size:28px;font-weight:800;color:var(--white);line-height:1}\n.stat span{font-size:12px;color:var(--muted-dim)}\n.stat-texto{justify-content:center}\n.stat-texto span{font-size:13px;color:var(--muted)}\n\n.area-cards{display:grid;grid-template-columns:1fr;gap:16px;margin-top:8px}\n.area-card{\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:10px;padding:22px;\n}\n.area-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}\n.area-card-head h3{font-family:var(--ui);font-size:18px;font-weight:800;color:var(--white)}\n.area-count{font-family:var(--ui);font-size:11px;color:var(--muted-dim);white-space:nowrap}\n.area-card .area-desc{font-family:var(--ui);font-size:12.5px;color:var(--muted-dim);margin:8px 0 14px}\n.chip-list{display:flex;flex-direction:column}\n.role-chip{\n  display:flex;align-items:center;justify-content:space-between;gap:10px;\n  padding-block:11px;border-top:1px solid var(--line-hair);font-family:var(--ui);\n  font-size:14px;font-weight:600;color:var(--white);\n}\n.role-chip:first-child{border-top:0}\n.role-chip:hover span:first-child{color:var(--cyan-dim)}\n\n.busca-vazio{font-family:var(--ui);color:var(--muted-dim);text-align:center;padding:30px 0}\n\n@media(min-width:760px){\n  .salarios-hero h1{font-size:48px}\n  .area-cards{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}\n}\n\n/* ---------- caminho de carreira (sequência conectada) ---------- */\n.caminho-carreira-bloco{margin-top:40px}\n.caminho-carreira-bloco h3{font-family:var(--ui);font-size:16px;font-weight:800;color:var(--white);margin-bottom:14px}\n.caminho-sequencia{display:flex;flex-wrap:wrap;align-items:center;gap:4px}\n.caminho-no{\n  font-family:var(--ui);font-size:13px;font-weight:700;color:var(--muted);\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:99px;\n  padding:8px 16px;\n}\n.caminho-no.atual{color:var(--cyan-dim);border-color:var(--cyan-dim)}\n.caminho-seta{color:var(--muted-dim);font-size:15px;padding:0 4px}\n\n/* ---------- CTA de comunidade (informar salário) ---------- */\n.cta-comunidade{\n  margin-top:36px;padding:26px 24px;border-radius:10px;text-align:center;\n  border:1px solid var(--line-soft);background:var(--navy-900);\n}\n.cta-comunidade h3{font-family:var(--editorial);font-size:20px;font-weight:600;color:var(--white);margin-bottom:8px}\n.cta-comunidade p{font-family:var(--ui);font-size:13.5px;color:var(--muted);margin-bottom:18px}\n.btn-em-breve{\n  display:inline-flex;align-items:center;gap:10px;font-family:var(--ui);font-weight:700;font-size:13.5px;\n  color:var(--muted);background:var(--navy-800);border:1px solid var(--line);\n  border-radius:6px;padding:12px 20px;cursor:not-allowed;\n}\n.em-breve-tag{\n  font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted-dim);\n  background:var(--line-soft);border-radius:99px;padding:3px 9px;\n}\n\n/* ---------- Vagas Verificadas OWNews: card-exemplo e lista de empresas ---------- */\n.chip-list-flex{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}\n.vaga-exemplo{\n  position:relative;margin-top:16px;padding:22px;border-radius:10px;\n  border:2px dashed var(--line-soft);background:var(--navy-900);opacity:.9;\n}\n.vaga-exemplo-tag{\n  display:inline-block;margin-bottom:12px;font-family:var(--ui);font-size:10px;font-weight:800;\n  letter-spacing:.05em;text-transform:uppercase;color:var(--yellow);\n  background:rgba(255,212,77,.12);border:1px solid var(--yellow);border-radius:99px;padding:3px 10px;\n}\n.vaga-selo{font-family:var(--ui);font-size:11px;font-weight:800;color:var(--green);margin-bottom:10px}\n.vaga-exemplo h4{font-family:var(--editorial);font-size:19px;font-weight:600;color:var(--white);margin-bottom:4px}\n.vaga-empresa{font-family:var(--ui);font-size:13px;color:var(--muted);margin-bottom:4px}\n.vaga-meta{font-family:var(--ui);font-size:11.5px;color:var(--muted-dim);margin-bottom:14px}\n\n/* ---------- Offshore Agora: widgets ao vivo dentro do hub ---------- */\n.agora-secao{margin-top:32px}\n.agora-secao h3{\n  font-family:var(--ui);font-size:13px;font-weight:800;color:var(--muted);\n  text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;\n}\n.agora-ops-strip{\n  display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;\n  padding-bottom:4px;-webkit-overflow-scrolling:touch;\n}\n.agora-ops-strip::-webkit-scrollbar{display:none}\n.agora-airport{\n  scroll-snap-align:start;flex:0 0 auto;display:flex;flex-direction:column;gap:3px;\n  min-width:132px;max-width:168px;\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;\n  padding:10px 12px;font-family:var(--ui);font-size:12px;color:var(--white);\n}\n.agora-airport-top{display:flex;align-items:center;gap:6px}\n.agora-airport .agora-dot{width:8px;height:8px;border-radius:50%;flex:none}\n.agora-airport .agora-dot.green{background:var(--green);box-shadow:0 0 6px var(--green)}\n.agora-airport .agora-dot.yellow{background:var(--yellow);box-shadow:0 0 6px var(--yellow)}\n.agora-airport .agora-dot.red{background:var(--red);box-shadow:0 0 6px var(--red)}\n.agora-airport .agora-dot.unknown{background:var(--muted-dim)}\n.agora-airport .agora-code{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--white)}\n.agora-airport .agora-cidade{font-size:11.5px;color:var(--muted);line-height:1.3;overflow-wrap:anywhere}\n.agora-airport .agora-clima{font-size:11px;color:var(--muted)}\n.agora-airport .agora-clima.sem-dado{color:var(--muted-dim);font-size:10px}\n.agora-noticias{display:flex;flex-direction:column}\n.agora-noticia-item{padding-block:12px;border-top:1px solid var(--line-hair);font-family:var(--ui)}\n.agora-noticia-item:first-child{border-top:0}\n.agora-noticia-item a{font-size:14px;font-weight:600;color:var(--white)}\n.agora-noticia-item a:hover{color:var(--cyan-dim)}\n.agora-noticia-meta{font-size:11.5px;color:var(--muted-dim);display:block;margin-top:3px}\n.agora-carregando{font-family:var(--ui);font-size:13px;color:var(--muted-dim);padding:10px 0}\n\n/* ---------- Dados Oficiais vs Pesquisa Salarial OWNews: rótulos de seção ---------- */\n.secao-label{\n  font-family:var(--ui);font-size:13px;font-weight:800;color:var(--cyan-dim);\n  text-transform:uppercase;letter-spacing:.06em;margin-top:36px;margin-bottom:4px;\n}\n.campo-grid + .secao-label{margin-top:44px}\n\n/* ---------- Pesquisa Salarial OWNews: formulário mobile-first ---------- */\n.pesquisa-hero{margin-bottom:8px}\n.pesquisa-cta-bloco{\n  margin:22px 0 36px;padding:26px 22px;border-radius:10px;text-align:center;\n  background:linear-gradient(135deg,var(--navy-900) 0%,var(--navy-800) 100%);\n  border:1px solid var(--cyan-dim);\n}\n.pesquisa-cta-bloco h2{font-family:var(--ui);font-size:20px;font-weight:800;color:var(--white);margin-bottom:8px;line-height:1.3}\n.pesquisa-cta-bloco p{font-family:var(--editorial);font-size:14.5px;color:var(--muted);max-width:52ch;margin:0 auto 18px}\n.form-pesquisa{display:flex;flex-direction:column;gap:20px;margin-top:24px}\n.campo-form{display:flex;flex-direction:column;gap:6px}\n.campo-form label{font-family:var(--ui);font-size:13px;font-weight:700;color:var(--white)}\n.campo-form .ajuda{font-family:var(--ui);font-size:11.5px;color:var(--muted-dim)}\n.campo-form select, .campo-form input[type="text"], .campo-form textarea{\n  width:100%;font-family:var(--ui);font-size:15px;color:var(--white);\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:8px;\n  padding:12px 14px;appearance:none;\n}\n.campo-form select:focus, .campo-form input:focus, .campo-form textarea:focus{\n  outline:2px solid var(--cyan);outline-offset:1px;border-color:var(--cyan-dim);\n}\n.campo-form textarea{resize:vertical;min-height:80px;font-family:inherit}\n.checks-grid{display:flex;flex-wrap:wrap;gap:10px}\n.check-item{\n  display:flex;align-items:center;gap:7px;font-family:var(--ui);font-size:13px;color:var(--muted);\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:99px;padding:8px 14px;\n  cursor:pointer;\n}\n.check-item input{margin:0}\n.check-item:has(input:checked){color:var(--white);border-color:var(--cyan-dim)}\n.btn-enviar-pesquisa{\n  font-family:var(--ui);font-weight:800;font-size:15px;color:var(--navy-950);\n  background:var(--cyan);border:0;border-radius:8px;padding:15px 20px;cursor:pointer;\n  margin-top:6px;\n}\n.btn-enviar-pesquisa:hover{background:var(--cyan-dim)}\n.btn-enviar-pesquisa:disabled{opacity:.6;cursor:not-allowed}\n.pesquisa-status{\n  font-family:var(--ui);font-size:13.5px;padding:12px 14px;border-radius:8px;margin-top:6px;display:none;\n}\n.pesquisa-status.ok{display:block;background:rgba(66,216,121,.1);border:1px solid var(--green);color:var(--white)}\n.pesquisa-status.erro{display:block;background:rgba(255,75,75,.1);border:1px solid var(--red);color:var(--white)}\n.metodologia-bloco{margin-top:48px;padding-top:24px;border-top:1px solid var(--line-hair)}\n.metodologia-bloco h2{font-family:var(--ui);font-size:18px;font-weight:800;color:var(--white);margin-bottom:14px}\n.metodologia-bloco h3{font-family:var(--ui);font-size:14px;font-weight:700;color:var(--white);margin:18px 0 6px}\n.metodologia-bloco p, .metodologia-bloco li{font-family:var(--ui);font-size:13.5px;color:var(--muted);line-height:1.6}\n.metodologia-bloco ul{margin:0;padding-left:20px}\n@media(min-width:760px){\n  .form-pesquisa{display:grid;grid-template-columns:1fr 1fr;gap:20px 24px}\n  .campo-form.largura-total{grid-column:1 / -1}\n}\n\n\n/* Intrinsic sizing: long text must fit its grid/flex cell, including mobile. */\n.container, .container *, .hub-main *{min-width:0}\nh1,h2,h3,p,.ed-sub,.hub-lead,.breadcrumb,.campo-valor,.hub-continue a{overflow-wrap:anywhere}\n.topline .container{flex-wrap:wrap}\n.ops-detail-head{flex-wrap:wrap}\n.ticker-track{width:max-content;gap:0}\n.ticker-group{display:flex;flex:none;width:max-content;align-items:center}\n.ticker-item{padding-right:24px}\n[hidden]{display:none!important}\n@media(max-width:759px){\n  .airport{max-width:calc(100vw - 32px);white-space:normal;flex-wrap:wrap}\n  .airport .cidade{overflow-wrap:anywhere}\n}\n@media(min-width:760px) and (max-width:1100px){\n  .nav{flex-wrap:wrap;padding-block:12px}\n  .links{flex-wrap:wrap;gap:14px}\n  .ops-strip{grid-template-columns:repeat(3,minmax(0,1fr))}\n}\n\n/* Shared page navigation wraps instead of forcing desktop links into mobile. */\n.hub-nav{flex-wrap:wrap;padding-block:12px}\n.hub-nav .logo{flex:none}\n.hub-links{display:flex;flex-wrap:wrap;gap:10px 16px;width:100%;align-items:center}\n.hub-links a{font-size:12px;font-weight:700;overflow-wrap:anywhere}\n.hub-links .shop-btn{margin:0}\n.area-card-head{flex-wrap:wrap;gap:8px}\n.area-count,.role-row .campo-pill{flex-shrink:0}\n@media(min-width:1100px){.hub-links{width:auto;margin-left:auto}}\n\n/* ---------- Cadastre seu Currículo: filtros e cards de empresa ---------- */\n.filtro-segmento-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}\n.filtro-btn{\n  font-family:var(--ui);font-size:12.5px;font-weight:700;color:var(--muted);\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:99px;\n  padding:8px 14px;cursor:pointer;\n}\n.filtro-btn:hover{border-color:var(--cyan-dim);color:var(--white)}\n.filtro-btn.ativo{color:var(--navy-950);background:var(--cyan-dim);border-color:var(--cyan-dim)}\n.empresas-grid{display:flex;flex-direction:column;gap:14px}\n.empresa-card{\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:10px;\n  padding:18px 20px;\n}\n.empresa-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}\n.empresa-head h3{font-family:var(--ui);font-size:16px;font-weight:800;color:var(--white)}\n.empresa-segmento-tag{\n  font-family:var(--ui);font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;\n  color:var(--cyan-dim);background:var(--navy-800);border:1px solid var(--line);border-radius:99px;padding:3px 10px;\n}\n.empresa-portal, .empresa-ats{font-family:var(--ui);font-size:13px;color:var(--muted);margin:4px 0}\n.empresa-verificado{font-family:var(--ui);font-size:11px;color:var(--muted-dim);margin:8px 0 12px}\n.empresa-cta{display:inline-block;font-family:var(--ui);font-weight:700;font-size:13px;color:var(--cyan-dim)}\n.empresa-cta:hover{color:var(--cyan)}\n.empresa-pendente{display:block;font-family:var(--ui);font-size:12px;color:var(--muted-dim);font-style:italic}\n@media(min-width:760px){\n  .empresas-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}\n}\n.compartilhar-bloco{margin-top:36px;padding-top:18px;border-top:1px solid var(--line-hair);display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-family:var(--ui)}\n.compartilhar-label{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted-dim)}\n.compartilhar-link{font-size:12.5px;font-weight:700;color:var(--cyan-dim);background:none;border:1px solid var(--line-soft);border-radius:99px;padding:6px 14px;cursor:pointer;font-family:inherit}\n.compartilhar-link:hover{color:var(--cyan);border-color:var(--cyan-dim)}\n\n/* Comece Aqui / Cursos / Guias — páginas novas desta rodada */\n.jornada-lista{display:flex;flex-direction:column;gap:0;margin-top:8px}\n.jornada-passo{display:flex;gap:14px;padding:18px 0;border-bottom:1px solid var(--line-hair)}\n.jornada-passo:last-child{border-bottom:0}\n.jornada-num{flex:none;width:30px;height:30px;border-radius:50%;background:var(--navy-800);border:1px solid var(--cyan-dim);color:var(--cyan);font-family:var(--ui);font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}\n.jornada-corpo h3{font-family:var(--ui);font-size:15px;font-weight:800;color:var(--white);margin:0 0 6px}\n.jornada-corpo p{font-family:var(--editorial);font-size:13.5px;line-height:1.5;color:#c9d6dc;margin:0 0 10px}\n.jornada-cta{font-family:var(--ui);font-size:12.5px;font-weight:700;color:var(--cyan-dim)}\n.jornada-cta:hover{color:var(--cyan)}\n.cursos-grid{display:grid;gap:12px;margin-top:8px}\n.curso-card{border:1px solid var(--line);border-radius:8px;background:var(--navy-900);padding:16px}\n.curso-card h3{font-family:var(--ui);font-size:14.5px;font-weight:800;color:var(--white);margin:0 0 8px}\n.curso-card p{font-family:var(--editorial);font-size:13px;line-height:1.5;color:#c9d6dc;margin:0 0 6px}\n.curso-aviso{font-size:11.5px!important;color:var(--muted-dim)!important}\n.guias-grid{display:grid;gap:12px;margin-top:8px}\n.guia-card{display:block;border:1px solid var(--line);border-radius:8px;background:var(--navy-900);padding:16px;position:relative}\n.guia-card h3{font-family:var(--ui);font-size:14.5px;font-weight:800;color:var(--white);margin:0 0 6px}\n.guia-card p{font-family:var(--editorial);font-size:13px;line-height:1.5;color:#c9d6dc;margin:0}\n.guia-card .go{position:absolute;top:16px;right:16px;color:var(--cyan-dim);font-weight:800}\n.guia-em-preparacao{opacity:.55;display:flex;align-items:center;justify-content:space-between}\n.guia-em-preparacao h3{margin:0}\n/* menu "Mais" no header compartilhado (hub pages) — mesmo padrão do menu\n   principal da Home: Explorar + Em desenvolvimento, sem ocupar espaço nobre. */\n.nav-mais{position:relative}\n.nav-mais-btn{\n  background:none;border:0;font:inherit;color:var(--white);cursor:pointer;\n  font-family:var(--ui);font-size:12px;font-weight:700;letter-spacing:.02em;\n  display:flex;align-items:center;gap:2px;padding:0;\n}\n.nav-mais-menu{display:none;flex-direction:column;gap:0;margin:0;padding:8px}\n.nav-mais-menu.open{\n  display:flex;position:absolute;top:calc(100% + 14px);right:0;min-width:240px;\n  background:var(--navy-900);border:1px solid var(--line-soft);border-radius:10px;\n  box-shadow:0 16px 32px rgba(2,10,16,.45);z-index:40;\n}\n.nav-mais-menu a, .nav-mais-menu .nav-mais-dev{\n  display:flex;align-items:center;justify-content:space-between;gap:8px;\n  padding:10px 10px;font-family:var(--ui);font-size:12.5px;font-weight:600;color:var(--white);\n  border-radius:6px;\n}\n.nav-mais-menu a:hover{background:var(--navy-800);color:var(--cyan-dim)}\n.nav-mais-tag{\n  font-size:9px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-dim);\n  background:var(--navy-950);border-radius:99px;padding:2px 8px;white-space:nowrap;flex:none;\n}\n.nav-mais-disabled{opacity:.55;cursor:default}\n.nav-mais-sep{height:1px;background:var(--line-hair);margin:6px 10px}\n.nav-mais-label{\n  display:block;padding:8px 10px 2px;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;\n  color:var(--muted-dim);font-weight:800;\n}\n.nav-mais-label:first-child{padding-top:2px}\n.links a.nav-destaque{color:var(--cyan-dim)}\n.links a.nav-destaque:hover{color:var(--cyan)}\n</style>' +
    '</head><body>' +
    '<div class="topline"><div class="container"><span>OWNews • Informação para quem vive o offshore.</span><span>by OffshoreWorks</span></div></div>' +
    '<header><div class="container nav hub-nav">' +
    '<a class="logo" href="/">OW<span>News</span></a>' +
    '<nav class="hub-links" aria-label="Navegação principal">' +
    '<a href="/#destaque">NOTÍCIAS</a>' +
    '<a href="/agora">OFFSHORE AGORA</a>' +
    '<a class="nav-destaque" href="/carreiras/cadastre-seu-curriculo">CADASTRE SEU CURRÍCULO</a>' +
    '<a href="/#carreiras">CARREIRAS</a>' +
    '<div class="nav-mais" id="navMaisHub">' +
    '<button type="button" class="nav-mais-btn" id="maisBtnHub" aria-expanded="false" aria-haspopup="true" aria-controls="maisMenuHub">MAIS ▾</button>' +
    '<div class="nav-mais-menu" id="maisMenuHub" role="menu" aria-label="Mais">' +
    '<span class="nav-mais-label">Explorar</span>' +
    '<a href="/funcoes" role="menuitem">Funções a Bordo</a>' +
    '<a href="/empresas" role="menuitem">Empresas Offshore</a>' +
    '<a href="/cursos" role="menuitem">Cursos e Escolas</a>' +
    '<a href="/dados" role="menuitem">Offshore em Números</a>' +
    '<div class="nav-mais-sep"></div>' +
    '<span class="nav-mais-label">Em desenvolvimento</span>' +
    '<a class="nav-mais-dev" href="/vagas" role="menuitem"><span>Vagas Verificadas</span><span class="nav-mais-tag">Em desenvolvimento</span></a>' +
    '<a class="nav-mais-dev" href="/salarios" role="menuitem"><span>Salários Offshore</span><span class="nav-mais-tag">Dados em preparação</span></a>' +
    '<span class="nav-mais-dev nav-mais-disabled"><span>Minha Escala</span><span class="nav-mais-tag">Em breve</span></span>' +
    '</div></div>' +
    '<a class="shop-btn" href="https://www.offshoreworks.com.br" target="_blank" rel="noopener">OFFSHOREWORKS ↗</a>' +
    '</nav></div></header>' +
    '<main class="container hub-main">' + conteudoHtml +
    '<div class="compartilhar-bloco">' +
    '<span class="compartilhar-label">Compartilhar</span>' +
    '<a class="compartilhar-link" id="shareWhatsApp" href="https://wa.me/" target="_blank" rel="noopener">WhatsApp</a>' +
    '<button type="button" class="compartilhar-link" id="shareNativo" hidden>Compartilhar</button>' +
    '</div>' +
    '</main>' +
    '<script>(function(){' +
    'var url=window.location.href;var titulo=document.title;' +
    'var wa=document.getElementById("shareWhatsApp");' +
    'if(wa)wa.href="https://wa.me/?text="+encodeURIComponent(titulo+" - "+url);' +
    'var nativo=document.getElementById("shareNativo");' +
    'if(nativo&&navigator.share){nativo.hidden=false;nativo.addEventListener("click",function(){navigator.share({title:titulo,url:url}).catch(function(){});});}' +
    'var maisBtnHub=document.getElementById("maisBtnHub");' +
    'function fecharMaisHub(){var menu=document.getElementById("maisMenuHub");if(menu)menu.classList.remove("open");if(maisBtnHub)maisBtnHub.setAttribute("aria-expanded","false");}' +
    'if(maisBtnHub){maisBtnHub.addEventListener("click",function(e){e.stopPropagation();var menu=document.getElementById("maisMenuHub");var open=menu.classList.toggle("open");maisBtnHub.setAttribute("aria-expanded",String(open));});' +
    'document.addEventListener("click",function(e){var nav=document.getElementById("navMaisHub");if(nav&&!nav.contains(e.target))fecharMaisHub();});' +
    'document.addEventListener("keydown",function(e){if(e.key==="Escape")fecharMaisHub();});' +
    'Array.prototype.slice.call(document.querySelectorAll("#maisMenuHub a")).forEach(function(a){a.addEventListener("click",fecharMaisHub);});}' +
    '})();</script>' +
    '<footer><div class="container footer"><span>OWNews • Informação para quem vive o offshore. • © 2026 OffshoreWorks</span><span>v3 — hub em estruturação, preview</span><div class="footer-social"><a class="social-link" href="https://www.instagram.com/ownews" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.4.4a5 5 0 0 1 2 1.3 5 5 0 0 1 1.3 2c.2.6.4 1.3.4 2.4.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.4a5 5 0 0 1-1.3 2 5 5 0 0 1-2 1.3c-.6.2-1.3.4-2.4.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.4-.4a5 5 0 0 1-2-1.3 5 5 0 0 1-1.3-2c-.2-.6-.4-1.3-.4-2.4C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.4a5 5 0 0 1 1.3-2 5 5 0 0 1 2-1.3c.6-.2 1.3-.4 2.4-.4C8.9 2 9.3 2 12 2zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.8.4-1.1.7-.3.3-.5.7-.7 1.1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.4.8.7 1.1.3.3.7.5 1.1.7.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.8-.4 1.1-.7.3-.3.5-.7.7-1.1.1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7a3 3 0 0 0-.7-1.1 3 3 0 0 0-1.1-.7c-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1zm0 3a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 12 6.8zm0 1.8a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm5.4-2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/></svg>@ownews</a><a class="social-link social-link-secundario" href="https://www.instagram.com/offshoreworks" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.4.4a5 5 0 0 1 2 1.3 5 5 0 0 1 1.3 2c.2.6.4 1.3.4 2.4.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.4a5 5 0 0 1-1.3 2 5 5 0 0 1-2 1.3c-.6.2-1.3.4-2.4.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.4-.4a5 5 0 0 1-2-1.3 5 5 0 0 1-1.3-2c-.2-.6-.4-1.3-.4-2.4C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.4a5 5 0 0 1 1.3-2 5 5 0 0 1 2-1.3c.6-.2 1.3-.4 2.4-.4C8.9 2 9.3 2 12 2zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.8.4-1.1.7-.3.3-.5.7-.7 1.1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.4.8.7 1.1.3.3.7.5 1.1.7.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.8-.4 1.1-.7.3-.3.5-.7.7-1.1.1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7a3 3 0 0 0-.7-1.1 3 3 0 0 0-1.1-.7c-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1zm0 3a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 12 6.8zm0 1.8a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm5.4-2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/></svg>@offshoreworks</a></div></div></footer>' +
    '<nav class="tabbar" aria-label="Navegação principal">' +
    '<a href="/"><span class="ti">🏠</span>Home</a>' +
    '<a href="/#destaque"><span class="ti">📰</span>Notícias</a>' +
    '<a href="/#carreiras"><span class="ti">💼</span>Carreiras</a>' +
    '<a href="https://www.offshoreworks.com.br" target="_blank" rel="noopener"><span class="ti">🛒</span>Loja</a>' +
    '</nav>' +
    '</body></html>'
  );
}

function breadcrumb(itens) {
  return (
    '<nav class="breadcrumb" aria-label="Caminho">' +
    itens.map((it, i) => {
      if (i === itens.length - 1) return '<span aria-current="page">' + escaparHTML(it.nome) + '</span>';
      return '<a href="' + it.href + '">' + escaparHTML(it.nome) + '</a><span class="bc-sep">/</span>';
    }).join('') +
    '</nav>'
  );
}

/* ---------- /salarios ---------- */
function renderSalariosIndex() {
  const porArea = {};
  FUNCOES_OFFSHORE.forEach((f) => {
    if (!porArea[f.area]) porArea[f.area] = [];
    porArea[f.area].push(f);
  });

  const totalFuncoes = FUNCOES_OFFSHORE.length;
  const totalAreas = Object.keys(AREAS_OFFSHORE).length;

  const cards = Object.keys(AREAS_OFFSHORE).map((areaKey) => {
    const lista = porArea[areaKey] || [];
    if (!lista.length) return '';
    const area = AREAS_OFFSHORE[areaKey];
    return (
      '<article class="area-card" data-area="' + areaKey + '">' +
      '<div class="area-card-head">' +
      '<h3>' + escaparHTML(area.nome) + '</h3>' +
      '<span class="area-count">' + lista.length + (lista.length === 1 ? ' função' : ' funções') + '</span>' +
      '</div>' +
      '<p class="area-desc">' + escaparHTML(area.desc) + '</p>' +
      '<div class="chip-list">' +
      lista.map((f) =>
        '<a class="role-chip" href="/salarios/' + f.slug + '" data-nome="' + escaparHTML(f.nome.toLowerCase()) + '">' +
        '<span>' + escaparHTML(f.nome) + '</span>' +
        (DADOS_SALARIO[f.slug]
          ? '<span class="campo-pill neutro">Dados 2026</span>'
          : pillAtualizacao("Em atualização")) +
        '</a>'
      ).join('') +
      '</div></article>'
    );
  }).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Salários Offshore" }]) +
    '<div class="salarios-hero">' +
    '<span class="eyebrow">Referência OWNews</span>' +
    '<h1>Salários Offshore <span class="ano">2026</span></h1>' +
    '<p class="hub-lead">Quanto ganha quem trabalha embarcado? Consulte salários, adicionais, escalas, requisitos e caminhos de carreira.</p>' +
    '</div>' +

    '<div class="pesquisa-cta-bloco">' +
    '<h2>TRABALHA OFFSHORE? CONTRIBUA COM A PESQUISA SALARIAL OWNEWS</h2>' +
    '<p>Leva menos de 1 minuto. As respostas são anônimas e ajudam a construir um retrato mais real da remuneração offshore no Brasil.</p>' +
    '<a class="hub-cta-secundario" href="/pesquisa-salarial">Contribuir com a pesquisa →</a>' +
    '</div>' +

    '<div class="salarios-hero">' +
    '<div class="busca-grande">' +
    '<label for="buscaFuncao">Qual função você procura?</label>' +
    '<input type="search" id="buscaFuncao" placeholder="Ex.: Driller, ROV, Guindasteiro, Catering..." autocomplete="off">' +
    '</div>' +

    '<div class="stats-row">' +
    '<div class="stat"><strong>' + totalFuncoes + '</strong><span>funções mapeadas</span></div>' +
    '<div class="stat"><strong>' + totalAreas + '</strong><span>áreas profissionais</span></div>' +
    '<div class="stat stat-texto"><span>🔄 Dados atualizados periodicamente</span></div>' +
    '</div>' +
    '</div>' +

    '<div class="area-cards" id="areaCards">' + cards + '</div>' +
    '<p class="busca-vazio" id="buscaVazio" hidden>Nenhuma função encontrada — tente outro termo.</p>' +

    '<script>' +
    '(function(){' +
    'var input=document.getElementById("buscaFuncao");' +
    'var cards=Array.prototype.slice.call(document.querySelectorAll(".area-card"));' +
    'var vazio=document.getElementById("buscaVazio");' +
    'if(!input)return;' +
    'input.addEventListener("input",function(){' +
    'var termo=input.value.trim().toLowerCase();' +
    'var algumCardVisivel=false;' +
    'cards.forEach(function(card){' +
    'var chips=Array.prototype.slice.call(card.querySelectorAll(".role-chip"));' +
    'var algumChipVisivel=false;' +
    'chips.forEach(function(chip){' +
    'var nome=chip.getAttribute("data-nome")||"";' +
    'var bate=!termo||nome.indexOf(termo)!==-1;' +
    'chip.hidden=!bate;' +
    'if(bate)algumChipVisivel=true;' +
    '});' +
    'card.hidden=!algumChipVisivel;' +
    'if(algumChipVisivel)algumCardVisivel=true;' +
    '});' +
    'vazio.hidden=algumCardVisivel;' +
    '});' +
    '})();' +
    '</script>';

  return paginaChrome(
    "Salários Offshore 2026",
    "Salários, adicionais, escalas e requisitos por função offshore — 17 funções, 7 áreas profissionais.",
    conteudo
  );
}

/* ---------- Caminho de carreira: sequência visual de cargos conectados.
   Só renderiza algo quando HÁ uma progressão definida no nosso próprio
   cadastro (campo caminhoCarreira em FUNCOES_OFFSHORE). Enquanto isso não
   for definido para uma função, mostra "Em atualização" — nunca inventa
   uma progressão. ---------- */
function renderCaminhoCarreira(f) {
  const seq = f.caminhoCarreira || [];
  if (seq.length < 2) {
    return pillAtualizacao("Em atualização — progressão ainda não definida pela redação");
  }
  return (
    '<div class="caminho-sequencia">' +
    seq.map((slugPasso, i) => {
      const rf = funcaoPorSlug(slugPasso);
      const nome = rf ? rf.nome : slugPasso;
      const classeAtual = slugPasso === f.slug ? ' atual' : '';
      const no = '<a class="caminho-no' + classeAtual + '" href="/salarios/' + slugPasso + '">' + escaparHTML(nome) + '</a>';
      return i === 0 ? no : '<span class="caminho-seta">→</span>' + no;
    }).join('') +
    '</div>'
  );
}

/* ---------- Pesquisa Salarial OWNews: agregados ----------
   Vazio de propósito — ainda não existem respostas (a tabela no Supabase
   ainda nem foi criada). Quando houver, o agregado real (mediana, faixa,
   n, etc.) entra aqui por função, calculado a partir de pesquisa_salarial_
   respostas via função SECURITY DEFINER que só libera estatística com
   amostra mínima. Nunca inventar valor aqui. */
const PESQUISA_SALARIAL_MINIMO = 10;
const PESQUISA_SALARIAL_AGREGADOS = {};

/* ---------- /salarios/:slug ---------- */
function renderSalarioDetalhe(slug) {
  const f = funcaoPorSlug(slug);
  if (!f) return null;
  const area = AREAS_OFFSHORE[f.area];
  const d = DADOS_SALARIO[slug] || null;
  const temDados = !!d;
  const ultimaAtualizacao = temDados ? "Setembro de 2026" : null;

  const fontesHtml = temDados && d.fontes && d.fontes.length
    ? '<ul class="lista-fontes">' + d.fontes.map((s) =>
        '<li><a href="' + escaparHTML(s.url) + '" target="_blank" rel="noopener">' + escaparHTML(s.nome) + '</a></li>'
      ).join('') + '</ul>'
    : pillAtualizacao("Em atualização");

  const pesquisa = PESQUISA_SALARIAL_AGREGADOS[slug] || null;
  const amostraSuficiente = !!(pesquisa && pesquisa.n >= PESQUISA_SALARIAL_MINIMO);

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Salários Offshore", href: "/salarios" }, { nome: f.nome }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">' + escaparHTML(area.nome) + '</span>' +
    '<h1>Quanto ganha um ' + escaparHTML(f.nome) + ' Offshore em 2026?</h1>' +
    '<p class="hub-lead">' + escaparHTML(f.resumo) + '</p>' +
    '<a class="hub-cta-secundario" href="/funcoes/' + f.slug + '">Ver função a bordo →</a>' +
    '</div>' +

    (temDados ? '<div class="aviso-atualizacao aviso-metodologia">' +
      '<strong>Referência de salário-base CLT.</strong> A remuneração total offshore pode variar conforme empresa, contrato, escala, função, experiência e adicionais. ' +
      'Nunca somamos salário-base com estimativa de mercado nem inventamos valor onde a fonte não detalhou.' +
      '</div>' : '') +

    '<h2 class="secao-label">Dados Oficiais</h2>' +
    '<div class="campo-grid">' +
    campoEstrutura("Salário-base (CLT/CAGED)", temDados ? campoDado(d.salarioBase) : pillAtualizacao()) +
    campoEstrutura("Faixa / remuneração offshore", temDados ? campoDado(d.faixaOffshore) : pillAtualizacao("Dados offshore em atualização")) +
    campoEstrutura("Adicionais (periculosidade, embarque etc.)", temDados ? campoTexto(d.adicionais) : pillAtualizacao()) +
    campoEstrutura("Escala de trabalho", temDados ? campoTexto(d.escala) : pillAtualizacao()) +
    campoEstrutura("O que faz", temDados ? campoTexto(d.oQueFaz) : pillAtualizacao()) +
    campoEstrutura("Requisitos", temDados ? campoTexto(d.requisitos) : pillAtualizacao()) +
    campoEstrutura("Cursos / certificações", temDados ? campoTexto(d.cursos) : pillAtualizacao()) +
    campoEstrutura("Experiência necessária", temDados ? campoTexto(d.experiencia) : pillAtualizacao()) +
    campoEstrutura("Carreira", temDados ? campoTexto(d.carreira) : pillAtualizacao()) +
    campoEstrutura("Situação de mercado", temDados ? campoTexto(d.mercado) : pillAtualizacao()) +
    campoEstrutura("Metodologia", temDados ? campoTexto(d.metodologia) : pillAtualizacao()) +
    campoEstrutura("Fontes", fontesHtml) +
    campoEstrutura("Última atualização", ultimaAtualizacao
      ? '<span class="campo-pill neutro">' + escaparHTML(ultimaAtualizacao) + '</span>'
      : '<span class="campo-pill neutro">Estrutura criada — sem dado de salário ainda</span>') +
    '</div>' +

    '<h2 class="secao-label">Pesquisa Salarial OWNews</h2>' +
    '<div class="aviso-atualizacao">' +
    'Dados declarados anonimamente por quem trabalha offshore — não é CAGED, não é garantia de salário, e só vira estatística pública com pelo menos ' + PESQUISA_SALARIAL_MINIMO + ' respostas válidas para esta função. ' +
    'Usamos <strong>mediana</strong> (não média) pra reduzir o efeito de valores extremos. ' +
    '<a href="/pesquisa-salarial#metodologia">Ver metodologia completa →</a>' +
    '</div>' +
    '<div class="campo-grid">' +
    campoEstrutura("Mediana — salário-base declarado", amostraSuficiente ? campoTexto(pesquisa.medianaBase) : pillAtualizacao("Menos de " + PESQUISA_SALARIAL_MINIMO + " respostas — em atualização")) +
    campoEstrutura("Mediana — remuneração total declarada", amostraSuficiente ? campoTexto(pesquisa.medianaTotal) : pillAtualizacao("Menos de " + PESQUISA_SALARIAL_MINIMO + " respostas — em atualização")) +
    campoEstrutura("Faixa observada", amostraSuficiente ? campoTexto(pesquisa.faixaObservada) : pillAtualizacao("Menos de " + PESQUISA_SALARIAL_MINIMO + " respostas — em atualização")) +
    campoEstrutura("Número de respostas", '<span class="campo-pill neutro">' + (pesquisa ? pesquisa.n : 0) + '</span>') +
    campoEstrutura("Experiência predominante", amostraSuficiente ? campoTexto(pesquisa.experienciaPredominante) : pillAtualizacao()) +
    campoEstrutura("Tipo de unidade mais comum", amostraSuficiente ? campoTexto(pesquisa.tipoUnidadeComum) : pillAtualizacao()) +
    campoEstrutura("Última atualização", amostraSuficiente ? campoTexto(pesquisa.ultimaAtualizacao) : pillAtualizacao("Aguardando primeiras respostas")) +
    '</div>' +

    '<div class="caminho-carreira-bloco">' +
    '<h3>Caminho de carreira</h3>' +
    renderCaminhoCarreira(f) +
    '</div>' +

    '<div class="cta-comunidade">' +
    '<span class="campo-pill neutro">Contribua agora</span>' +
    '<h3>Trabalha offshore? Contribua com a Pesquisa Salarial OWNews</h3>' +
    '<p>Leva menos de 1 minuto. As respostas são anônimas e ajudam a construir um retrato mais real da remuneração offshore no Brasil.</p>' +
    '<a class="hub-cta-secundario" href="/pesquisa-salarial?funcao=' + f.slug + '">Contribuir com a pesquisa →</a>' +
    '</div>' +

    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/salarios">← Todos os salários</a>' +
    '<a href="/funcoes/' + f.slug + '">Função a bordo: ' + escaparHTML(f.nome) + ' →</a>' +
    '<a href="/#carreiras">Ver seção Carreiras</a>' +
    '</div>';

  return paginaChrome(
    "Quanto ganha um " + f.nome + " Offshore em 2026? — Salário Offshore",
    temDados
      ? "Salário-base CLT/CAGED (fonte oficial CAGED), adicionais, escala, requisitos e fontes de " + f.nome + " — atualizado em setembro de 2026. Faixa offshore em atualização."
      : "Salário, faixa de remuneração e requisitos de " + f.nome + " no offshore — em atualização.",
    conteudo
  );
}

/* ---------- /funcoes ---------- */
function renderFuncoesIndex() {
  const porArea = {};
  FUNCOES_OFFSHORE.forEach((f) => {
    if (!porArea[f.area]) porArea[f.area] = [];
    porArea[f.area].push(f);
  });

  const grupos = Object.keys(AREAS_OFFSHORE).map((areaKey) => {
    const lista = porArea[areaKey] || [];
    if (!lista.length) return '';
    const caminho = lista[0] && lista[0].caminhoCarreira;
    const progressao = caminho && caminho.length > 1
      ? '<div class="caminho-carreira-bloco caminho-carreira-compacto">' +
        '<h3>Progressão nesta área</h3>' +
        '<div class="caminho-sequencia">' +
        caminho.map((slugPasso, i) => {
          const rf = funcaoPorSlug(slugPasso);
          const nomePasso = rf ? rf.nome : slugPasso;
          const no = '<a class="caminho-no" href="/funcoes/' + slugPasso + '">' + escaparHTML(nomePasso) + '</a>';
          return i === 0 ? no : '<span class="caminho-seta">→</span>' + no;
        }).join('') +
        '</div></div>'
      : '';
    return (
      '<div class="area-group">' +
      '<h3>' + escaparHTML(AREAS_OFFSHORE[areaKey].nome) + '</h3>' +
      '<p class="area-desc">' + escaparHTML(AREAS_OFFSHORE[areaKey].desc) + '</p>' +
      '<div class="role-list">' +
      lista.map((f) =>
        '<a class="role-row" href="/funcoes/' + f.slug + '">' +
        '<span class="role-nome">' + escaparHTML(f.nome) + '</span>' +
        '<span class="go">→</span>' +
        '</a>'
      ).join('') +
      '</div>' +
      progressao +
      '</div>'
    );
  }).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Funções a Bordo" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Referência OWNews</span>' +
    '<h1>Funções a Bordo</h1>' +
    '<p class="hub-lead">O que cada profissional faz em uma plataforma ou embarcação offshore, organizado por área — Deck, Drilling, Subsea/ROV, Engine/Manutenção, Segurança, Marine e Catering.</p>' +
    '</div>' +
    grupos;

  return paginaChrome(
    "Funções a Bordo",
    "Funções e áreas de trabalho a bordo de plataformas e embarcações offshore.",
    conteudo,
    "/funcoes"
  );
}

/* ---------- /funcoes/:slug ---------- */
function renderFuncaoDetalhe(slug) {
  const f = funcaoPorSlug(slug);
  if (!f) return null;
  const area = AREAS_OFFSHORE[f.area];

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Funções a Bordo", href: "/funcoes" }, { nome: f.nome }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">' + escaparHTML(area.nome) + '</span>' +
    '<h1>' + escaparHTML(f.nome) + '</h1>' +
    (f.nomeAntigo ? '<p class="funcao-nome-antigo">' + escaparHTML(f.nomeAntigo) + '</p>' : '') +
    '<p class="hub-lead">' + escaparHTML(f.resumo) + '</p>' +
    '<a class="hub-cta-secundario" href="/salarios/' + f.slug + '">Ver salário desta função →</a>' +
    '</div>' +
    '<div class="campo-grid">' +
    campoEstrutura("Rotina a bordo", pillAtualizacao()) +
    campoEstrutura("Requisitos de entrada", pillAtualizacao()) +
    campoEstrutura("Cursos e certificações", pillAtualizacao()) +
    campoEstrutura("Equipamentos de proteção específicos", pillAtualizacao()) +
    '</div>' +
    (f.caminhoCarreira && f.caminhoCarreira.length > 1
      ? '<div class="caminho-carreira-bloco">' +
        '<h3>Progressão nesta área</h3>' +
        '<div class="caminho-sequencia">' +
        f.caminhoCarreira.map((slugPasso, i) => {
          const rf = funcaoPorSlug(slugPasso);
          const nomePasso = rf ? rf.nome : slugPasso;
          const classeAtual = slugPasso === f.slug ? ' atual' : '';
          const no = '<a class="caminho-no' + classeAtual + '" href="/funcoes/' + slugPasso + '">' + escaparHTML(nomePasso) + '</a>';
          return i === 0 ? no : '<span class="caminho-seta">→</span>' + no;
        }).join('') +
        '</div></div>'
      : '') +
    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/funcoes">← Todas as funções</a>' +
    '<a href="/salarios/' + f.slug + '">Salário de ' + escaparHTML(f.nome) + ' →</a>' +
    '<a href="/#carreiras">Ver seção Carreiras</a>' +
    '</div>';

  return paginaChrome(
    f.nome + " — Funções a Bordo",
    "O que faz um(a) " + f.nome + " a bordo de uma unidade offshore.",
    conteudo,
    "/funcoes/" + f.slug
  );
}

/* ---------- /vagas ---------- */
/* Empresas offshore relevantes no Brasil, em avaliação técnica para uma
   futura fonte de vagas verificadas — estar nesta lista não significa que
   já temos vagas delas, só que estamos checando se dá pra verificar com
   segurança (API/feed oficial, sem scraping agressivo). */
const EMPRESAS_EM_AVALIACAO = [
  "SBM Offshore", "MODEC", "Foresea", "Constellation", "Ocyan", "Transocean",
  "Subsea7", "Oceaneering", "DOF", "TechnipFMC", "Saipem", "SLB",
  "Halliburton", "Baker Hughes"
];

function renderVagasIndex(){
  const listaEmpresas = EMPRESAS_EM_AVALIACAO.map((nome) =>
    '<span class="campo-pill">' + escaparHTML(nome) + '</span>'
  ).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Vagas Verificadas OWNews" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Referência OWNews</span>' +
    '<h1>Vagas Verificadas OWNews</h1>' +
    '<p class="hub-lead">Não somos um agregador de vagas copiadas da internet. Uma vaga só recebe o selo <strong>✓ VAGA VERIFICADA OWNEWS</strong> quando é encontrada diretamente no portal oficial de carreiras ou no ATS oficial usado pela empresa.</p>' +
    '<div class="aviso-atualizacao">' +
    '<strong>Em construção — nenhuma vaga real publicada ainda.</strong> Estamos auditando as fontes oficiais das principais empresas offshore do Brasil antes de automatizar qualquer coleta. Nenhuma vaga fictícia entra aqui enquanto isso.' +
    '</div>' +
    '</div>' +

    '<div class="area-group">' +
    '<h3>Como funciona a verificação</h3>' +
    '<div class="campo-grid">' +
    campoEstrutura("Conta como fonte oficial", campoTexto("Portal de carreiras da própria empresa, ou o ATS (sistema de candidaturas) que ela usa oficialmente.")) +
    campoEstrutura("Não conta como verificação", campoTexto("Posts de Instagram, grupos de WhatsApp, reposts de terceiros ou agregadores sem vínculo direto com a empresa.")) +
    campoEstrutura("Ao clicar em uma vaga", campoTexto("Você abre primeiro uma página do OWNews com os dados confirmados — cargo, empresa, local, offshore/onshore quando confirmado, data da verificação — e só depois segue para \"Candidatar-se no site oficial ↗\".")) +
    campoEstrutura("OWNews não recebe currículo", campoTexto("O OWNews nunca atua como recrutador nem intermediário — a candidatura sempre acontece no site oficial da empresa.")) +
    campoEstrutura("Quando uma vaga sai do ar", campoTexto("O card passa a mostrar \"Vaga encerrada ou não disponível na fonte oficial.\"")) +
    '</div>' +
    '</div>' +

    '<div class="area-group">' +
    '<h3>Formato do card (exemplo ilustrativo)</h3>' +
    '<p class="area-desc">Nenhuma vaga real ainda — este card mostra só o formato que toda vaga verificada vai seguir.</p>' +
    '<div class="vaga-exemplo">' +
    '<span class="vaga-exemplo-tag">MODELO — não é uma vaga real</span>' +
    '<div class="vaga-selo">✓ VAGA VERIFICADA OWNEWS</div>' +
    '<h4>Cargo (exemplo)</h4>' +
    '<p class="vaga-empresa">Empresa (exemplo) · Local (exemplo)</p>' +
    '<p class="vaga-meta">Offshore/Onshore quando confirmado · Verificada em 00/00/0000</p>' +
    '<span class="hub-cta-secundario">Candidatar-se no site oficial ↗</span>' +
    '</div>' +
    '</div>' +

    '<div class="area-group">' +
    '<h3>Empresas em avaliação para verificação futura</h3>' +
    '<p class="area-desc">Estamos checando se cada uma tem portal oficial ou ATS com acesso técnico seguro (sem scraping agressivo). Estar na lista não significa que já temos vagas publicadas.</p>' +
    '<div class="chip-list-flex">' + listaEmpresas + '</div>' +
    '</div>' +

    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Enquanto isso, explore</span>' +
    '<a href="/funcoes">Funções a Bordo →</a>' +
    '<a href="/salarios">Salários Offshore →</a>' +
    '<a href="/agora">Offshore Agora →</a>' +
    '</div>';

  return paginaChrome(
    "Vagas Verificadas OWNews",
    "Vagas offshore verificadas diretamente na fonte oficial da empresa — sem agregação de posts ou reposts de terceiros. Em construção.",
    conteudo
  );
}

/* ---------- /agora (Offshore Agora) ----------
   Painel ao vivo: reúne só dados reais que o OWNews já tem (aeroportos,
   Radar Offshore, últimas notícias) numa página só. Busca os mesmos dois
   endpoints já usados na Home (Supabase + REDEMET via coletor) — nenhuma
   chamada nova, nenhum dado inventado. Script próprio, sem template
   literals, pra não precisar de nenhum escape especial dentro do bundle. */
function renderAgora(){
  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Offshore Agora" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Ao vivo</span>' +
    '<h1>Offshore Agora</h1>' +
    '<p class="hub-lead">O que está acontecendo no offshore brasileiro agora.</p>' +
    '</div>' +

    '<div class="agora-secao">' +
    '<h3>🌦 Aeroportos Offshore</h3>' +
    '<div class="agora-ops-strip" id="agoraAeroportos"><p class="agora-carregando">Carregando condições…</p></div>' +
    '</div>' +

    '<div class="agora-secao">' +
    '<h3>Últimas Notícias</h3>' +
    '<div class="agora-noticias" id="agoraNoticias"><p class="agora-carregando">Carregando notícias…</p></div>' +
    '</div>' +

    '<div class="agora-secao">' +
    '<h3>Acesso rápido</h3>' +
    '<div class="chip-list-flex">' +
    '<a class="campo-pill neutro" href="/vagas">💼 Vagas Verificadas</a>' +
    '<a class="campo-pill neutro" href="/funcoes">👷 Funções a Bordo</a>' +
    '<a class="campo-pill neutro" href="/salarios">💰 Salários Offshore</a>' +
    '<a class="campo-pill neutro" href="/unidades">⚓ Plataformas &amp; Sondas</a>' +
    '<a class="campo-pill neutro" href="/dados">📊 Offshore em Números</a>' +
    '</div>' +
    '</div>' +

    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/#destaque">Ver todas as notícias →</a>' +
    '<a href="/#carreiras">Central Offshore →</a>' +
    '</div>' +

    '<script>' +
    '(function(){' +
    'function fmtRel(iso){try{var d=Math.round((Date.now()-new Date(iso).getTime())/60000);var r=new Intl.RelativeTimeFormat("pt-BR",{numeric:"auto"});if(Math.abs(d)<60)return r.format(-d,"minute");var h=Math.round(d/60);if(Math.abs(h)<24)return r.format(-h,"hour");return r.format(-Math.round(h/24),"day");}catch(e){return "";}}' +
    'function esc(t){return String(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}' +
    'function climaOk(c){return !!(c&&c.horarioUTC);}' +
    'var AEROPORTOS_ORDEM=[{codigo:"SBJR",nome:"Jacarepaguá"},{codigo:"SBMI",nome:"Maricá"},{codigo:"SBCB",nome:"Cabo Frio"},{codigo:"SBME",nome:"Macaé"},{codigo:"SBFS",nome:"Farol de São Tomé"},{codigo:"SBVT",nome:"Vitória"}];' +
    'var MAPA_AEROPORTOS={};' +
    'var NOTICIAS=[];' +
    'var PALAVRAS_OPERACOES=["plataforma","navio-plataforma","fpso","sonda","poço","poco","perfuração","perfuracao","descomissionamento","pré-sal","pre-sal","margem equatorial","búzios","buzios","campo","águas profundas","aguas profundas","uep","mero","tupi"];' +
    'var PALAVRAS_MERCADO=["royalties","participação especial","participacao especial","licitação","licitacao","leilão","leilao","concessão","concessao","oferta permanente","bloco","bacia","gás natural","gas natural","eólica offshore","eolica offshore","exportação","exportacao","hidrocarbonetos","gasoduto","mercado"];' +
    'function classificarAgora(n){var t=((n.title||"")+" "+(n.summary||"")).toLowerCase();for(var i=0;i<PALAVRAS_OPERACOES.length;i++){if(t.indexOf(PALAVRAS_OPERACOES[i])!==-1)return "operacoes";}for(var j=0;j<PALAVRAS_MERCADO.length;j++){if(t.indexOf(PALAVRAS_MERCADO[j])!==-1)return "mercado";}return "geral";}' +
    'function renderAeroportosAgora(){var el=document.getElementById("agoraAeroportos");if(!el)return;el.innerHTML=AEROPORTOS_ORDEM.map(function(a){var info=MAPA_AEROPORTOS[a.codigo]||{};var classe=info.status==="g"?"green":info.status==="y"?"yellow":info.status==="r"?"red":"unknown";var clima=info.clima||{};var mini;if(climaOk(clima)){var temp=typeof clima.temperatura==="number"?(" "+clima.temperatura+"°"):"";mini="<span class=\\"agora-clima\\">"+(clima.icone||"")+temp+"</span>";}else{mini="<span class=\\"agora-clima sem-dado\\">Sem dados</span>";}return "<div class=\\"agora-airport\\"><span class=\\"agora-airport-top\\"><span class=\\"agora-dot "+classe+"\\"></span><span class=\\"agora-code\\">"+a.codigo+"</span></span><span class=\\"agora-cidade\\">"+esc(a.nome)+"</span>"+mini+"</div>";}).join("");}' +
    
    'function renderNoticiasAgora(){var el=document.getElementById("agoraNoticias");if(!el)return;if(!NOTICIAS.length){el.innerHTML="<p class=\\"agora-carregando\\">Sem notícias no momento.</p>";return;}el.innerHTML=NOTICIAS.slice(0,8).map(function(n){var fonte=(n.image_credit||"OWNews").toUpperCase();return "<div class=\\"agora-noticia-item\\"><a href=\\"/noticia?id="+encodeURIComponent(n.id)+"\\">"+esc(n.title)+"</a><span class=\\"agora-noticia-meta\\">"+esc(fonte)+" · "+fmtRel(n.published_at)+"</span></div>";}).join("");}' +
    'function carregarNoticiasAgora(){var url="https://awyowuhwkqfyhwgdpepp.supabase.co/rest/v1/articles?select=id,title,summary,image_url,image_credit,original_url,published_at&status=eq.published&order=published_at.desc&limit=20";fetch(url,{headers:{apikey:"sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt"}}).then(function(r){if(!r.ok)throw new Error("Supabase "+r.status);return r.json();}).then(function(lista){if(lista.length){NOTICIAS=lista;renderNoticiasAgora();}}).catch(function(e){console.warn("OWNews Agora: notícias indisponíveis no momento.",e);});}' +
    'function carregarAeroportosAgora(){fetch("https://shrill-pond-a915.olivercamaster.workers.dev/aeroportos").then(function(r){if(!r.ok)throw new Error("REDEMET "+r.status);return r.json();}).then(function(retorno){var map={};var lista=Array.isArray(retorno&&retorno.aeroportos)?retorno.aeroportos:[];lista.forEach(function(item){var info=Array.isArray(item.dados)?item.dados:[];if(info[0])map[info[0]]={status:info[4],clima:item.clima||{}};});MAPA_AEROPORTOS=map;renderAeroportosAgora();}).catch(function(e){MAPA_AEROPORTOS={};renderAeroportosAgora();console.warn("OWNews Agora: aeroportos indisponíveis no momento.",e);});}' +
    'renderAeroportosAgora();' +
    'carregarNoticiasAgora();' +
    'carregarAeroportosAgora();' +
    'setInterval(carregarNoticiasAgora,10*60*1000);' +
    'setInterval(carregarAeroportosAgora,10*60*1000);' +
    '})();' +
    '</script>';

  return paginaChrome(
    "Offshore Agora",
    "O que está acontecendo no offshore brasileiro agora — aeroportos, radar do setor e últimas notícias, tudo com dados reais do OWNews.",
    conteudo
  );
}

/* ---------- /pesquisa-salarial ----------
   Prévia da pesquisa: coleta em preparação. Não faz requisições de envio.
   Ativação depende de revisão do backend e autorização separada.
   O schema SQL é somente uma proposta, nunca executada pelo frontend. */
function renderPesquisaSalarial() {
  const opcoesFuncao = FUNCOES_OFFSHORE.map((f) =>
    '<option value="' + f.slug + '">' + escaparHTML(f.nome) + '</option>'
  ).join('') + '<option value="outro">Outra função (especificar)</option>';

  const opcoesArea = Object.keys(AREAS_OFFSHORE).map((k) =>
    '<option value="' + k + '">' + escaparHTML(AREAS_OFFSHORE[k].nome) + '</option>'
  ).join('');

  const adicionaisPares = [
    ["periculosidade", "Periculosidade"], ["confinamento", "Confinamento"],
    ["embarque", "Embarque"], ["produtividade-plr", "Produtividade / PLR"],
    ["hora-extra", "Hora extra"], ["nenhum", "Nenhum"]
  ];
  const checksAdicionais = adicionaisPares.map((par) =>
    '<label class="check-item"><input type="checkbox" name="adicionais" value="' + par[0] + '"> ' + par[1] + '</label>'
  ).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Salários Offshore", href: "/salarios" }, { nome: "Pesquisa Salarial" }]) +
    '<div class="hub-hero pesquisa-hero">' +
    '<span class="eyebrow">Pesquisa colaborativa</span>' +
    '<h1>Pesquisa Salarial OWNews</h1>' +
    '<p class="hub-lead">Estamos construindo a maior base de dados salariais do offshore brasileiro — com respostas reais, anônimas, de quem vive isso todo dia.</p>' +
    '</div>' +

    '<div class="pesquisa-cta-bloco">' +
    '<h2>TRABALHA OFFSHORE? CONTRIBUA COM A PESQUISA SALARIAL OWNEWS</h2>' +
    '<p>Leva menos de 1 minuto. As respostas são anônimas e ajudam a construir um retrato mais real da remuneração offshore no Brasil.</p>' +
    '</div>' +

    '<p class="hub-lead"><strong>Coleta em preparação.</strong> Este é um preview do questionário. O envio está desabilitado; nenhuma resposta é coletada nesta etapa.</p>' +
    '<form class="form-pesquisa" id="formPesquisaSalarial">' +

    '<div class="campo-form">' +
    '<label for="pFuncao">Função / cargo</label>' +
    '<select id="pFuncao" name="funcao_slug" required><option value="">Selecione...</option>' + opcoesFuncao + '</select>' +
    '</div>' +

    '<div class="campo-form" id="grupoFuncaoOutro" hidden>' +
    '<label for="pFuncaoOutro">Qual função?</label>' +
    '<input type="text" id="pFuncaoOutro" name="funcao_outro" maxlength="80">' +
    '</div>' +

    '<div class="campo-form">' +
    '<label for="pArea">Área / departamento (opcional)</label>' +
    '<select id="pArea" name="area"><option value="">Prefiro não informar</option>' + opcoesArea + '</select>' +
    '</div>' +

    '<div class="campo-form">' +
    '<label for="pExperiencia">Tempo de experiência offshore</label>' +
    '<select id="pExperiencia" name="experiencia_faixa" required>' +
    '<option value="">Selecione...</option>' +
    '<option value="menos-1-ano">Menos de 1 ano</option>' +
    '<option value="1-3-anos">1 a 3 anos</option>' +
    '<option value="3-5-anos">3 a 5 anos</option>' +
    '<option value="5-10-anos">5 a 10 anos</option>' +
    '<option value="mais-10-anos">Mais de 10 anos</option>' +
    '</select>' +
    '</div>' +

    '<div class="campo-form">' +
    '<label for="pTipoUnidade">Tipo de unidade</label>' +
    '<select id="pTipoUnidade" name="tipo_unidade" required>' +
    '<option value="">Selecione...</option>' +
    '<option value="fpso">FPSO</option>' +
    '<option value="sonda">Sonda</option>' +
    '<option value="plataforma">Plataforma fixa</option>' +
    '<option value="embarcacao">Embarcação de apoio</option>' +
    '<option value="apoio-maritimo">Apoio marítimo (outros)</option>' +
    '<option value="rov">Operação ROV</option>' +
    '<option value="outro">Outro</option>' +
    '</select>' +
    '</div>' +

    '<div class="campo-form">' +
    '<label for="pEscala">Escala de trabalho</label>' +
    '<select id="pEscala" name="escala">' +
    '<option value="">Selecione...</option>' +
    '<option value="14x14">14x14</option>' +
    '<option value="14x21">14x21</option>' +
    '<option value="21x21">21x21</option>' +
    '<option value="28x28">28x28</option>' +
    '<option value="outro">Outra</option>' +
    '</select>' +
    '</div>' +

    '<div class="campo-form">' +
    '<label for="pEmpresa">Empresa (opcional)</label>' +
    '<input type="text" id="pEmpresa" name="empresa" maxlength="80" placeholder="Deixe em branco se preferir">' +
    '<span class="ajuda">Nunca é exibida individualmente. Se sua função + empresa + local forem muito raros, considere deixar em branco.</span>' +
    '</div>' +

    '<div class="campo-form">' +
    '<label for="pVinculo">Vínculo</label>' +
    '<select id="pVinculo" name="vinculo" required>' +
    '<option value="">Selecione...</option>' +
    '<option value="clt">CLT</option>' +
    '<option value="pj">PJ</option>' +
    '<option value="temporario">Temporário</option>' +
    '<option value="outro">Outro</option>' +
    '</select>' +
    '</div>' +

    '<div class="campo-form">' +
    '<label for="pSalarioBase">Salário-base mensal (sem adicionais)</label>' +
    '<select id="pSalarioBase" name="salario_base_faixa" required>' +
    '<option value="">Selecione uma faixa...</option>' +
    '<option value="ate-3000">Até R$ 3.000</option>' +
    '<option value="3000-5000">R$ 3.000 a R$ 5.000</option>' +
    '<option value="5000-8000">R$ 5.000 a R$ 8.000</option>' +
    '<option value="8000-12000">R$ 8.000 a R$ 12.000</option>' +
    '<option value="12000-18000">R$ 12.000 a R$ 18.000</option>' +
    '<option value="18000-25000">R$ 18.000 a R$ 25.000</option>' +
    '<option value="acima-25000">Acima de R$ 25.000</option>' +
    '</select>' +
    '<span class="ajuda">Valor fixo no contracheque, antes de qualquer adicional.</span>' +
    '</div>' +

    '<div class="campo-form">' +
    '<label for="pRemuneracaoTotal">Remuneração mensal total aproximada (com adicionais)</label>' +
    '<select id="pRemuneracaoTotal" name="remuneracao_total_faixa" required>' +
    '<option value="">Selecione uma faixa...</option>' +
    '<option value="ate-5000">Até R$ 5.000</option>' +
    '<option value="5000-8000">R$ 5.000 a R$ 8.000</option>' +
    '<option value="8000-12000">R$ 8.000 a R$ 12.000</option>' +
    '<option value="12000-18000">R$ 12.000 a R$ 18.000</option>' +
    '<option value="18000-25000">R$ 18.000 a R$ 25.000</option>' +
    '<option value="25000-35000">R$ 25.000 a R$ 35.000</option>' +
    '<option value="35000-50000">R$ 35.000 a R$ 50.000</option>' +
    '<option value="acima-50000">Acima de R$ 50.000</option>' +
    '</select>' +
    '<span class="ajuda">Incluindo periculosidade, confinamento, embarque, PLR etc. — o que cai na conta no fim do mês.</span>' +
    '</div>' +

    '<div class="campo-form largura-total">' +
    '<label>Adicionais recebidos</label>' +
    '<div class="checks-grid">' + checksAdicionais + '</div>' +
    '</div>' +

    '<div class="campo-form">' +
    '<label for="pEstado">Estado / base operacional (opcional)</label>' +
    '<select id="pEstado" name="estado">' +
    '<option value="">Prefiro não informar</option>' +
    '<option value="RJ">Rio de Janeiro</option>' +
    '<option value="ES">Espírito Santo</option>' +
    '<option value="SP">São Paulo</option>' +
    '<option value="BA">Bahia</option>' +
    '<option value="SE">Sergipe</option>' +
    '<option value="AL">Alagoas</option>' +
    '<option value="RN">Rio Grande do Norte</option>' +
    '<option value="outro">Outro</option>' +
    '</select>' +
    '</div>' +

    '<div class="campo-form largura-total">' +
    '<label for="pObservacao">Observação (opcional)</label>' +
    '<textarea id="pObservacao" name="observacao" maxlength="500" placeholder="Algo mais que ajude a entender sua resposta — sem se identificar."></textarea>' +
    '</div>' +

    '<div class="campo-form largura-total">' +
    '<p id="pesquisaPreparacao" role="status">A coleta está em preparação. O envio está desabilitado e nenhuma resposta será transmitida ou armazenada nesta etapa.</p>' +
    '<button class="btn-enviar-pesquisa" type="submit" id="btnEnviarPesquisa" disabled aria-describedby="pesquisaPreparacao">Coleta em preparação</button>' +
    '<div class="pesquisa-status" id="pesquisaStatus"></div>' +
    '</div>' +

    '</form>' +

    '<div class="metodologia-bloco" id="metodologia">' +
    '<h2>Metodologia da Pesquisa Salarial OWNews</h2>' +
    '<p>Estas informações são declaradas anonimamente por participantes voluntários e <strong>não representam garantia salarial</strong> nem substituem dados oficiais (CAGED). São dois retratos diferentes, mostrados separadamente, nunca somados.</p>' +
    '<h3>Anonimato</h3>' +
    '<p>Não coletamos nome, CPF, matrícula, telefone, e-mail ou qualquer identificador pessoal. Empresa é opcional e nunca é exibida junto com uma resposta individual.</p>' +
    '<h3>O que nunca acontece</h3>' +
    '<ul>' +
    '<li>Respostas individuais nunca aparecem publicamente — só estatística agregada.</li>' +
    '<li>Nenhuma média/faixa é publicada para uma função com menos de ' + PESQUISA_SALARIAL_MINIMO + ' respostas válidas.</li>' +
    '<li>Salário-base CAGED e remuneração offshore declarada nunca são somados ou confundidos.</li>' +
    '</ul>' +
    '<h3>Por que mediana, não média</h3>' +
    '<p>A mediana é menos sensível a valores extremos (um salário muito alto ou muito baixo isolado) do que a média — por isso é o indicador principal desta pesquisa.</p>' +
    '<h3>Limitações que assumimos publicamente</h3>' +
    '<ul>' +
    '<li>Não há como garantir que cada resposta venha de uma pessoa diferente — a coleta terá controles antiabuso e revisão antes de qualquer ativação, mas isso reduz o risco, não o elimina.</li>' +
    '<li>Faixas (não valores exatos) viram estatística por decisão editorial — evita falsa precisão, mas significa que a mediana é uma aproximação por faixa, nunca um número exato.</li>' +
    '<li>Respostas passarão por validação antes de entrar na amostra; só contam como "resposta válida" as que passarem por essa checagem.</li>' +
    '</ul>' +
    '<h3>Quando uma função entra no ar</h3>' +
    '<p>Após a ativação da coleta e a validação da metodologia, funções com pelo menos ' + PESQUISA_SALARIAL_MINIMO + ' respostas válidas poderão mostrar mediana, faixa observada, número de respostas, experiência predominante, tipo de unidade mais comum e data da última atualização.</p>' +
    '</div>' +

    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/salarios">← Salários Offshore</a>' +
    '<a href="/funcoes">Funções a Bordo →</a>' +
    '</div>' +

    '<script>' +
    '(function(){' +
    'var params=new URLSearchParams(window.location.search);' +
    'var funcaoPreSelecionada=params.get("funcao");' +
    'var selFuncao=document.getElementById("pFuncao");' +
    'if(funcaoPreSelecionada&&selFuncao){for(var i=0;i<selFuncao.options.length;i++){if(selFuncao.options[i].value===funcaoPreSelecionada){selFuncao.value=funcaoPreSelecionada;break;}}}' +
    'function atualizarFuncaoOutro(){var grupo=document.getElementById("grupoFuncaoOutro");if(!grupo||!selFuncao)return;grupo.hidden=(selFuncao.value!=="outro");}' +
    'if(selFuncao){selFuncao.addEventListener("change",atualizarFuncaoOutro);atualizarFuncaoOutro();}' +
    'var form=document.getElementById("formPesquisaSalarial");' +
    'var status=document.getElementById("pesquisaStatus");' +
    'var btn=document.getElementById("btnEnviarPesquisa");' +
    'if(form){form.addEventListener("submit",function(ev){' +
    'ev.preventDefault();' +
    'status.className="pesquisa-status";status.style.display="block";' +
    'status.textContent="Coleta em preparação. Nenhuma resposta foi enviada.";' +
    '});}' +
    '})();' +
    '</script>';

  return paginaChrome(
    "Pesquisa Salarial OWNews",
    "Contribua com a Pesquisa Salarial OWNews — respostas anônimas sobre salário e remuneração offshore no Brasil. Leva menos de 1 minuto.",
    conteudo
  );
}

/* ---------- /carreiras/cadastre-seu-curriculo ----------
   Canais OFICIAIS de recrutamento de empresas offshore relevantes no
   Brasil. Regra: só entra aqui domínio oficial da empresa ou ATS
   comprovadamente usado por ela (nunca agregador como destino final).
   "temCadastro" só é true quando encontramos evidência direta de banco de
   talentos/cadastro espontâneo (não um "pode haver vaga"); na dúvida,
   fica false e o botão vira "Ver vagas oficiais" — nunca o contrário.
   Pesquisado via busca web em 14/09/2026; nenhum scraping, nenhuma
   autenticação contornada. */
const EMPRESAS_CARREIRAS = [
  { nome: "SBM Offshore", segmento: "fpso", portalNome: "careers.sbmoffshore.com", portalUrl: "https://careers.sbmoffshore.com", ats: "Não identificado com segurança nesta pesquisa", temCadastro: true },
  { nome: "MODEC", segmento: "fpso", portalNome: "modec-br.gupy.io", portalUrl: "https://modec-br.gupy.io", ats: "Gupy", temCadastro: true },
  { nome: "Foresea", segmento: "perfuracao", portalNome: "foresea.gupy.io", portalUrl: "https://foresea.gupy.io", ats: "Gupy", temCadastro: true },
  { nome: "Constellation Oil Services", segmento: "perfuracao", portalNome: null, portalUrl: null, ats: "Não confirmado", temCadastro: false, pendente: true },
  { nome: "Ocyan", segmento: "servicos", portalNome: "ocyan.gupy.io", portalUrl: "https://ocyan.gupy.io", ats: "Gupy", temCadastro: true },
  { nome: "Transocean", segmento: "perfuracao", portalNome: "deepwater.wd1.myworkdayjobs.com", portalUrl: "https://deepwater.wd1.myworkdayjobs.com/GlobalExternalCareerSite", ats: "Workday", temCadastro: false },
  { nome: "Subsea7", segmento: "subsea", portalNome: "subsea7.gupy.io (Brasil) / careers.subsea7.com (global)", portalUrl: "https://subsea7.gupy.io", ats: "Gupy (Brasil) e ATS próprio (global)", temCadastro: true },
  { nome: "Oceaneering", segmento: "subsea", portalNome: "trabalheconosco.vagas.com.br/oceaneering", portalUrl: "https://trabalheconosco.vagas.com.br/oceaneering", ats: "Vagas.com (canal oficial da empresa nesse portal)", temCadastro: false },
  { nome: "DOF", segmento: "maritimo", portalNome: "dof.com/vacancies", portalUrl: "https://www.dof.com/vacancies", ats: "Workable", temCadastro: true },
  { nome: "TechnipFMC", segmento: "subsea", portalNome: "careers.technipfmc.com", portalUrl: "https://careers.technipfmc.com", ats: "ATS próprio", temCadastro: true },
  { nome: "Saipem", segmento: "perfuracao", portalNome: "saipem.com/en/people/careers", portalUrl: "https://www.saipem.com/en/people/careers", ats: "Ncoreplat", temCadastro: true },
  { nome: "SLB", segmento: "servicos", portalNome: "careers.slb.com", portalUrl: "https://careers.slb.com", ats: "Eightfold", temCadastro: true },
  { nome: "Halliburton", segmento: "servicos", portalNome: "careers.halliburton.com", portalUrl: "https://careers.halliburton.com", ats: "Não identificado com segurança nesta pesquisa", temCadastro: true },
  { nome: "Baker Hughes", segmento: "servicos", portalNome: "careers.bakerhughes.com/br/pt/home", portalUrl: "https://careers.bakerhughes.com/br/pt/home", ats: "Workday", temCadastro: true }
];

const SEGMENTOS_CARREIRAS = {
  perfuracao: "Perfuração", fpso: "FPSO", subsea: "Subsea/ROV",
  servicos: "Serviços", maritimo: "Marítimo", oleogas: "Óleo & Gás"
};

function renderCadastreCurriculo() {
  const segmentosPresentes = Array.from(new Set(EMPRESAS_CARREIRAS.map((e) => e.segmento)));
  const filtros = segmentosPresentes.map((s) =>
    '<button type="button" class="filtro-btn" data-segmento="' + s + '">' + escaparHTML(SEGMENTOS_CARREIRAS[s] || s) + '</button>'
  ).join('');

  const cards = EMPRESAS_CARREIRAS.map((e) => {
    const tag = '<span class="empresa-segmento-tag">' + escaparHTML(SEGMENTOS_CARREIRAS[e.segmento] || e.segmento) + '</span>';
    const cta = e.pendente
      ? '<span class="empresa-pendente">Levantamento em andamento — portal oficial ainda não confirmado com segurança</span>'
      : '<a class="empresa-cta" href="' + escaparHTML(e.portalUrl) + '" target="_blank" rel="noopener noreferrer">' +
        (e.temCadastro ? 'Cadastrar currículo →' : 'Ver vagas oficiais →') + '</a>';
    return (
      '<article class="empresa-card" data-segmento="' + e.segmento + '">' +
      '<div class="empresa-head"><h3>' + escaparHTML(e.nome) + '</h3>' + tag + '</div>' +
      (e.portalNome ? '<p class="empresa-portal">Portal: ' + escaparHTML(e.portalNome) + '</p>' : '') +
      '<p class="empresa-ats">ATS: ' + escaparHTML(e.ats) + '</p>' +
      '<p class="empresa-verificado">Última verificação: 14/09/2026</p>' +
      cta +
      '</article>'
    );
  }).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Central Offshore", href: "/#carreiras" }, { nome: "Cadastre seu Currículo" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Carreiras Offshore</span>' +
    '<h1>Cadastre seu currículo nas principais empresas offshore</h1>' +
    '<p class="hub-lead">Encontre os canais oficiais de carreira das empresas que atuam em perfuração, FPSO, subsea, marítimo, serviços e óleo e gás.</p>' +
    '</div>' +
    '<p class="hub-lead" style="margin-bottom:28px">Reunimos aqui, empresa por empresa, o portal oficial de carreiras e o sistema de candidatura (ATS) que cada uma realmente usa — para você ir direto na fonte, sem depender de agregador ou repost. Quando a empresa mantém banco de talentos ou cadastro espontâneo, o botão leva direto pra lá; quando só encontramos busca de vagas abertas, dizemos isso claramente.</p>' +
    '<p class="hub-lead" style="margin-bottom:28px">Se você quer saber onde enviar currículo offshore, como trabalhar embarcado ou como conseguir uma vaga em plataforma numa empresa de petróleo e gás, comece por aqui — e acompanhe as oportunidades offshore verificadas pelo OWNews.</p>' +

    '<div class="aviso-atualizacao">' +
    'O OWNews não participa dos processos seletivos e não recebe currículos. Os links direcionam aos canais oficiais de recrutamento das empresas. Nenhum logotipo é usado aqui para não sugerir parceria, representação ou endosso por parte dessas empresas.' +
    '</div>' +

    '<div class="filtro-segmento-row">' + filtros + '</div>' +
    '<div class="empresas-grid" id="empresasGrid">' + cards + '</div>' +

    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/funcoes">Funções a Bordo →</a>' +
    '<a href="/vagas">Vagas Verificadas →</a>' +
    '<a href="/salarios">Salários Offshore →</a>' +
    '<a href="/agora">Offshore Agora →</a>' +
    '</div>' +

    '<script>' +
    '(function(){' +
    'var botoes=Array.prototype.slice.call(document.querySelectorAll(".filtro-btn"));' +
    'var cards=Array.prototype.slice.call(document.querySelectorAll(".empresa-card"));' +
    'var ativo=null;' +
    'botoes.forEach(function(b){b.addEventListener("click",function(){' +
    'var seg=b.getAttribute("data-segmento");' +
    'if(ativo===seg){ativo=null;}else{ativo=seg;}' +
    'botoes.forEach(function(x){x.classList.toggle("ativo",x.getAttribute("data-segmento")===ativo);});' +
    'cards.forEach(function(c){c.hidden=!!(ativo&&c.getAttribute("data-segmento")!==ativo);});' +
    '});});' +
    '})();' +
    '</script>';

  return paginaChrome(
    "Onde cadastrar currículo para trabalhar offshore",
    "Canais oficiais de carreira das principais empresas offshore no Brasil — perfuração, FPSO, subsea, marítimo e serviços. Cadastre seu currículo direto na fonte oficial, sem agregadores.",
    conteudo,
    "/carreiras/cadastre-seu-curriculo"
  );
}

const SEGMENTO_AREAS_RELACIONADAS = {
  perfuracao: ["drilling"], fpso: ["deck", "engine"], subsea: ["subsea"],
  servicos: ["seguranca", "engine"], maritimo: ["marine"], oleogas: ["deck"]
};

/* ---------- /empresas (Empresas Offshore) ----------
   Referência do setor, não uma central de candidatura — o CTA de
   recrutamento fica concentrado em /carreiras/cadastre-seu-curriculo pra
   não duplicar (e desatualizar em dois lugares) o mesmo link externo. */
function renderEmpresasOffshore() {
  const cards = EMPRESAS_CARREIRAS.map((e) => {
    const areasRel = (SEGMENTO_AREAS_RELACIONADAS[e.segmento] || [])
      .map((a) => (AREAS_OFFSHORE[a] ? AREAS_OFFSHORE[a].nome : a));
    const slug = e.nome.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return (
      '<article class="empresa-card" id="' + slug + '" data-segmento="' + e.segmento + '">' +
      '<div class="empresa-head"><h3>' + escaparHTML(e.nome) + '</h3>' +
      '<span class="empresa-segmento-tag">' + escaparHTML(SEGMENTOS_CARREIRAS[e.segmento] || e.segmento) + '</span></div>' +
      (e.portalNome ? '<p class="empresa-portal">Portal de carreiras: ' + escaparHTML(e.portalNome) + '</p>' : '') +
      (areasRel.length ? '<p class="empresa-ats">Funções relacionadas no OWNews: ' + escaparHTML(areasRel.join(', ')) + '</p>' : '') +
      '<p class="empresa-verificado">Última verificação: 14/09/2026</p>' +
      '</article>'
    );
  }).join('');

  const segmentosPresentes = Array.from(new Set(EMPRESAS_CARREIRAS.map((e) => e.segmento)));
  const filtros = segmentosPresentes.map((s) =>
    '<button type="button" class="filtro-btn" data-segmento="' + s + '">' + escaparHTML(SEGMENTOS_CARREIRAS[s] || s) + '</button>'
  ).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Empresas Offshore" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Referência OWNews</span>' +
    '<h1>Empresas Offshore</h1>' +
    '<p class="hub-lead">Quem atua no setor offshore brasileiro — segmento, área de atuação e portal de carreiras oficial de cada empresa. Não é uma parceria comercial: é referência editorial, mantida com verificação própria.</p>' +
    '</div>' +
    '<div class="filtro-segmento-row">' + filtros + '</div>' +
    '<div class="empresas-grid" id="empresasGrid">' + cards + '</div>' +
    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/carreiras/cadastre-seu-curriculo">Cadastre seu currículo →</a>' +
    '<a href="/funcoes">Funções a Bordo →</a>' +
    '<a href="/vagas">Vagas Verificadas →</a>' +
    '</div>' +
    '<script>' +
    '(function(){' +
    'var botoes=Array.prototype.slice.call(document.querySelectorAll(".filtro-btn"));' +
    'var cards=Array.prototype.slice.call(document.querySelectorAll(".empresa-card"));' +
    'var ativo=null;' +
    'botoes.forEach(function(b){b.addEventListener("click",function(){' +
    'var seg=b.getAttribute("data-segmento");' +
    'if(ativo===seg){ativo=null;}else{ativo=seg;}' +
    'botoes.forEach(function(x){x.classList.toggle("ativo",x.getAttribute("data-segmento")===ativo);});' +
    'cards.forEach(function(c){c.hidden=!!(ativo&&c.getAttribute("data-segmento")!==ativo);});' +
    '});});' +
    '})();' +
    '</script>';

  return paginaChrome(
    "Empresas Offshore — quem atua no setor",
    "Referência das principais empresas offshore no Brasil: segmento, área de atuação e portal de carreiras oficial de cada uma.",
    conteudo,
    "/empresas"
  );
}

/* ---------- /comece-aqui (Como trabalhar offshore) ----------
   Jornada de entrada — organiza links que já existem, não cria conteúdo
   novo de risco (nada de prazo, preço ou obrigatoriedade inventada). */
function renderComeceAqui() {
  const passos = [
    { n: "1", titulo: "Entenda como funciona", texto: "O trabalho offshore acontece embarcado, em plataformas, FPSOs ou sondas, seguindo um regime de escala (o mais comum é 14 dias embarcado por 14 de folga, com variações conforme empresa e função). O acesso costuma ser por helicóptero a partir de bases como Macaé, Cabo Frio ou Vitória.", href: "/agora", cta: "Ver o que está acontecendo agora →" },
    { n: "2", titulo: "Conheça as funções", texto: "Cada área a bordo (Deck, Drilling, Subsea, Segurança, Engine, Marine, Catering) tem funções de entrada e de carreira diferentes, com requisitos próprios.", href: "/funcoes", cta: "Ver Funções a Bordo →" },
    { n: "3", titulo: "Veja cursos e requisitos", texto: "Antes de embarcar, o setor costuma exigir cursos de segurança e sobrevivência específicos, além dos treinamentos de cada função. Confirme sempre a exigência exata com a empresa contratante.", href: "/cursos", cta: "Ver Cursos e Escolas →" },
    { n: "4", titulo: "Conheça as empresas", texto: "Empresas de perfuração, FPSO, subsea, marítimo e serviços atuam com processos seletivos próprios — cada uma com seu portal e sistema de candidatura oficial.", href: "/empresas", cta: "Ver Empresas Offshore →" },
    { n: "5", titulo: "Cadastre seu currículo", texto: "Envie seu currículo direto pelos canais oficiais de recrutamento — o OWNews não participa dos processos seletivos nem recebe currículos.", href: "/carreiras/cadastre-seu-curriculo", cta: "Cadastre seu currículo →" },
    { n: "6", titulo: "Veja vagas verificadas", texto: "Acompanhe oportunidades reais e verificadas pelo OWNews antes de embarcar na sua jornada de candidatura.", href: "/vagas", cta: "Ver Vagas Verificadas →" }
  ];

  const lista = passos.map((p) =>
    '<div class="jornada-passo">' +
    '<div class="jornada-num">' + p.n + '</div>' +
    '<div class="jornada-corpo">' +
    '<h3>' + escaparHTML(p.titulo) + '</h3>' +
    '<p>' + escaparHTML(p.texto) + '</p>' +
    '<a class="jornada-cta" href="' + p.href + '">' + escaparHTML(p.cta) + '</a>' +
    '</div></div>'
  ).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Comece Aqui" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Comece Aqui</span>' +
    '<h1>Como trabalhar offshore</h1>' +
    '<p class="hub-lead">Um caminho, passo a passo, pra quem quer entender o setor e se candidatar de verdade — sem prometer atalho nem vaga garantida.</p>' +
    '</div>' +
    '<div class="jornada-lista">' + lista + '</div>' +
    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/guias">Guias OWNews →</a>' +
    '<a href="/salarios">Salários Offshore →</a>' +
    '</div>';

  return paginaChrome(
    "Comece Aqui — Como trabalhar offshore",
    "O caminho completo para começar no setor offshore: como funciona, funções, cursos, empresas, cadastro de currículo e vagas verificadas.",
    conteudo,
    "/comece-aqui"
  );
}

/* ---------- /cursos (Cursos e Escolas) ----------
   Só termos de treinamento amplamente conhecidos e citados no setor
   (NR-33, NR-35, HUET/BOSIET) — sem preço, sem lista de escola e sem
   afirmar obrigatoriedade fechada, já que isso varia por empresa/função e
   não temos fonte primária própria para cravar. */
const CURSOS_REFERENCIA = [
  { nome: "NR-33 — Segurança em Espaços Confinados", contexto: "Norma regulamentadora citada com frequência para funções que envolvem entrada em espaços confinados a bordo." },
  { nome: "NR-35 — Trabalho em Altura", contexto: "Norma regulamentadora citada com frequência para funções com atividades em altura (torre, deck, estruturas)." },
  { nome: "HUET / BOSIET — Treinamento de sobrevivência e escape subaquático", contexto: "Treinamento de segurança e sobrevivência normalmente associado ao transporte por helicóptero até unidades offshore." }
];

function renderCursosEscolas() {
  const cards = CURSOS_REFERENCIA.map((c) =>
    '<article class="curso-card">' +
    '<h3>' + escaparHTML(c.nome) + '</h3>' +
    '<p>' + escaparHTML(c.contexto) + '</p>' +
    '<p class="curso-aviso">Exigência, validade e escola variam por empresa e função — confirme sempre no processo seletivo.</p>' +
    '</article>'
  ).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Cursos e Escolas" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Referência OWNews</span>' +
    '<h1>Cursos e Escolas</h1>' +
    '<p class="hub-lead">Treinamentos comumente associados ao trabalho offshore no Brasil. Não afirmamos obrigatoriedade fechada nem preço — cada empresa define seus próprios requisitos.</p>' +
    '</div>' +
    '<div class="cursos-grid">' + cards + '</div>' +
    campoEstrutura("Escolas e faixa de preço", pillAtualizacao("Em atualização — só com fontes confiáveis e verificáveis")) +
    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/funcoes">Funções a Bordo →</a>' +
    '<a href="/comece-aqui">Comece Aqui →</a>' +
    '</div>';

  return paginaChrome(
    "Cursos para trabalhar offshore",
    "Treinamentos e certificações comumente associados ao trabalho offshore no Brasil — NR-33, NR-35, HUET/BOSIET.",
    conteudo,
    "/cursos"
  );
}

/* ---------- /guias (Guias OWNews) ----------
   Só um guia completo publicado agora (autorreferente, sem risco de fonte
   externa) — o restante fica listado como "Em preparação", sem link morto
   e sem conteúdo técnico/legal sem fonte suficiente. */
const GUIAS_EM_PREPARACAO = [
  "Primeiro embarque: o que preciso?",
  "Checklist de documentos para trabalhar offshore",
  "O que levar para o primeiro embarque",
  "Como funciona a escala offshore",
  "Principais erros de quem procura a primeira oportunidade"
];

function renderGuias() {
  const preparacao = GUIAS_EM_PREPARACAO.map((titulo) =>
    '<div class="guia-card guia-em-preparacao">' +
    '<h3>' + escaparHTML(titulo) + '</h3>' +
    '<span class="tag-em-breve">Em preparação</span>' +
    '</div>'
  ).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Guias OWNews" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Guias OWNews</span>' +
    '<h1>Guias e Checklists</h1>' +
    '<p class="hub-lead">Conteúdo prático pra quem vive o offshore. Publicamos só o que temos fonte suficiente pra sustentar — o resto aparece aqui como "em preparação", sem conteúdo técnico ou legal sem base.</p>' +
    '</div>' +
    '<div class="guias-grid">' +
    '<a class="guia-card" href="/carreiras/cadastre-seu-curriculo">' +
    '<h3>Como cadastrar currículo nas empresas offshore</h3>' +
    '<p>O passo a passo pra encontrar o canal oficial certo em cada empresa do setor.</p>' +
    '<span class="go">→</span>' +
    '</a>' +
    preparacao +
    '</div>' +
    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/comece-aqui">Comece Aqui →</a>' +
    '<a href="/empresas">Empresas Offshore →</a>' +
    '</div>';

  return paginaChrome(
    "Guias OWNews",
    "Guias e checklists práticos para quem vive ou quer entrar no offshore.",
    conteudo,
    "/guias"
  );
}

/* ---------- /unidades (Plataformas & Sondas) ----------
   Referências reais, citadas em matérias já publicadas pelo OWNews — não é
   um cadastro completo do setor, só o que já cobrimos editorialmente. */
const UNIDADES_REFERENCIA = [
  { nome: "FPSO Alexandre de Gusmão", tipo: "Navio-plataforma (FPSO)", campo: "Mero, pré-sal da Bacia de Santos" },
  { nome: "P-80 e P-82", tipo: "Plataformas", campo: "Búzios, Bacia de Santos" },
  { nome: "P-74", tipo: "Plataforma", campo: "Búzios, Bacia de Santos" }
];

function renderUnidades(){
  const lista = UNIDADES_REFERENCIA.map((u) =>
    '<div class="area-group" style="margin-top:18px">' +
    '<a class="role-row" href="/#operacoes">' +
    '<span class="role-nome">' + escaparHTML(u.nome) + '</span>' +
    '<span class="campo-pill">' + escaparHTML(u.tipo) + '</span>' +
    '</a>' +
    '<p class="area-desc">' + escaparHTML(u.campo) + '</p>' +
    '</div>'
  ).join('');

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Plataformas & Sondas" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Referência OWNews</span>' +
    '<h1>Plataformas &amp; Sondas</h1>' +
    '<p class="hub-lead">Unidades já mencionadas nas notícias do OWNews. Ainda não é um cadastro completo do setor — cresce conforme cobrimos mais matérias.</p>' +
    '</div>' +
    lista +
    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/#operacoes">Ver Operações Offshore →</a>' +
    '<a href="/funcoes">Funções a Bordo →</a>' +
    '</div>';

  return paginaChrome(
    "Plataformas & Sondas",
    "Plataformas, FPSOs e sondas já mencionados nas notícias do OWNews.",
    conteudo
  );
}

/* ---------- /dados (Offshore em Números) ----------
   Só números reais e verificáveis sobre a própria cobertura do OWNews —
   nunca estatística de mercado inventada. */
function renderDados(){
  const totalFuncoes = FUNCOES_OFFSHORE.length;
  const totalAreas = Object.keys(AREAS_OFFSHORE).length;

  const conteudo =
    breadcrumb([{ nome: "Home", href: "/" }, { nome: "Offshore em Números" }]) +
    '<div class="hub-hero">' +
    '<span class="eyebrow">Referência OWNews</span>' +
    '<h1>Offshore em Números</h1>' +
    '<p class="hub-lead">Números reais sobre a cobertura do OWNews — não é estatística de mercado, é sobre o que já mapeamos.</p>' +
    '</div>' +
    '<div class="campo-grid">' +
    campoEstrutura("Funções mapeadas em Salários/Funções", '<span class="campo-pill neutro">' + totalFuncoes + '</span>') +
    campoEstrutura("Áreas profissionais cobertas", '<span class="campo-pill neutro">' + totalAreas + '</span>') +
    campoEstrutura("Aeroportos offshore monitorados ao vivo", '<span class="campo-pill neutro">6</span>') +
    campoEstrutura("Fontes oficiais ativas no coletor", '<span class="campo-pill neutro">ANP, Petrobras, MME</span>') +
    campoEstrutura("Fotos da Biblioteca Editorial OWNews", '<span class="campo-pill neutro">16, licenciadas</span>') +
    campoEstrutura("Dados de mercado (salários, vagas)", pillAtualizacao("Em atualização — só com fontes confiáveis")) +
    '</div>' +
    '<div class="hub-continue">' +
    '<span class="hub-continue-label">Continue no OWNews</span>' +
    '<a href="/salarios">Salários Offshore →</a>' +
    '<a href="/funcoes">Funções a Bordo →</a>' +
    '</div>';

  return paginaChrome(
    "Offshore em Números",
    "Números reais sobre a cobertura do OWNews.",
    conteudo
  );
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

    if (url.pathname === "/salarios") {
      return new Response(renderSalariosIndex(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname.startsWith("/salarios/")) {
      const slug = url.pathname.split("/")[2];
      const pagina = renderSalarioDetalhe(slug);
      if (!pagina) return new Response("Função não encontrada", { status: 404 });
      return new Response(pagina, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
    }

    if (url.pathname === "/funcoes") {
      return new Response(renderFuncoesIndex(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname.startsWith("/funcoes/")) {
      const slug = url.pathname.split("/")[2];
      const pagina = renderFuncaoDetalhe(slug);
      if (!pagina) return new Response("Função não encontrada", { status: 404 });
      return new Response(pagina, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
    }

    if (url.pathname === "/vagas") {
      return new Response(renderVagasIndex(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/agora") {
      return new Response(renderAgora(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/pesquisa-salarial") {
      return new Response(renderPesquisaSalarial(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/carreiras/cadastre-seu-curriculo") {
      return new Response(renderCadastreCurriculo(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/empresas") {
      return new Response(renderEmpresasOffshore(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/comece-aqui") {
      return new Response(renderComeceAqui(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/cursos") {
      return new Response(renderCursosEscolas(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/guias") {
      return new Response(renderGuias(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/unidades") {
      return new Response(renderUnidades(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/dados") {
      return new Response(renderDados(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
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

      let relacionadasHtml = '';
      try {
        const urlRelacionadas =
          supabaseUrl +
          '/rest/v1/articles?select=id,title&status=eq.published&id=neq.' +
          encodeURIComponent(id) +
          '&order=published_at.desc&limit=3';
        const respRelacionadas = await fetch(urlRelacionadas, { headers: { apikey: supabaseKey } });
        const relacionadas = respRelacionadas.ok ? await respRelacionadas.json() : [];
        if (relacionadas.length) {
          relacionadasHtml =
            '<span class="hub-continue-label" style="margin-top:0">Leia também</span>' +
            relacionadas.map((r) =>
              '<a href="/noticia?id=' + encodeURIComponent(r.id) + '">' + escaparHTML(r.title) + ' →</a>'
            ).join('');
        }
      } catch {
        relacionadasHtml = '';
      }

      const conteudoNoticia =
        breadcrumb([{ nome: "Home", href: "/" }, { nome: "Notícia" }]) +
        '<style>' +
        '.noticia-corpo{font-family:var(--editorial);font-size:18px;line-height:1.7;color:var(--white);max-width:720px;margin-top:24px}' +
        '.noticia-corpo p{margin:0 0 18px}' +
        '.noticia-imagem{max-width:100%;border-radius:8px;margin-top:20px}' +
        '.noticia-fonte-link{display:inline-block;margin-top:22px;font-family:var(--ui);font-size:13px;font-weight:700;color:var(--cyan-dim)}' +
        '.noticia-fonte-link:hover{color:var(--cyan)}' +
        '</style>' +
        '<div class="hub-hero">' +
        '<span class="eyebrow">' + escaparHTML((artigo.image_credit || 'OWNews').toUpperCase()) + ' · ' + escaparHTML(data) + '</span>' +
        '<h1>' + escaparHTML(artigo.title) + '</h1>' +
        '</div>' +
        (imagemValidaServidor(artigo.image_url) ? '<img class="noticia-imagem" src="' + escaparHTML(artigo.image_url) + '" alt="">' : '') +
        '<div class="noticia-corpo"><p>' + escaparHTML(artigo.content || artigo.summary).replace(/\n\n/g, '</p><p>') + '</p></div>' +
        (artigo.original_url ? '<a class="noticia-fonte-link" href="' + escaparHTML(artigo.original_url) + '" target="_blank" rel="noopener">Ler na fonte original ↗</a>' : '') +
        '<div class="hub-continue">' +
        relacionadasHtml +
        '<span class="hub-continue-label" style="margin-top:14px">Continue no OWNews</span>' +
        '<a href="/salarios">Salários Offshore →</a>' +
        '<a href="/funcoes">Funções a Bordo →</a>' +
        '<a href="/vagas">Vagas Verificadas →</a>' +
        '<a href="/agora">Offshore Agora →</a>' +
        '</div>';

      return new Response(
        paginaChrome(artigo.title, (artigo.summary || artigo.title || '').slice(0, 160), conteudoNoticia),
        { headers: { "Content-Type": "text/html; charset=UTF-8" } }
      );
    }

    return new Response("Página não encontrada (preview OWNews)", { status: 404 });
  }
};
