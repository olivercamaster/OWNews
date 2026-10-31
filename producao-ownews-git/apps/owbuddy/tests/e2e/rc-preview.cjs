// Suíte RC do preview web (Playwright). Não roda no `npm test`.
// Uso: PLAYWRIGHT=<caminho do pacote playwright> U=http://127.0.0.1:8791 OUT=/tmp/rc node tests/e2e/rc-preview.cjs
// Datas RELATIVAS a hoje (a versão anterior fixava 19/10/2026 e envelheceu).
const {chromium}=require(process.env.PLAYWRIGHT||'playwright'); const PLUS=require('./_plus.cjs');
const U=process.env.U||'http://127.0.0.1:8791', OUT=process.env.OUT;
const txt=async p=>(await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ')));
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const esc=(d)=>({ownews_minha_escala:{tipo:'14x14',dataRef:d,tipoRef:'embarquei',aeroporto:'SBJR'}});
// ISO local (a escala é por dia de calendário) e dd/mm/aaaa
const dia=n=>{const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const br=iso=>iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4);
const HOJE=dia(0);
(async()=>{const b=await chromium.launch({args:['--no-sandbox']}); const errs=[];
async function nova(W,seed,bloquear){ const ctx=await b.newContext({viewport:{width:W,height:844},deviceScaleFactor:2,colorScheme:'dark'}); await PLUS(ctx);
  // try: na página de erro do modo offline o storage é negado (erro do seed, não do app)
  await ctx.addInitScript(d=>{ try{ if(!sessionStorage.getItem('s')){localStorage.clear(); for(const [k,v] of Object.entries(d)) localStorage.setItem(k,JSON.stringify(v)); sessionStorage.setItem('s','1');}}catch(e){} },seed||{});
  if(bloquear) await ctx.route(bloquear,r=>r.abort());
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); return {ctx,p}; }
// HOME
let {ctx,p}=await nova(390,esc(HOJE));
await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(2500); let t=await txt(p);
ok(t.includes('Hoje é dia de embarque')&&t.includes('Dia 1 de 14')&&t.includes('Faltam 14 dias pra casa.')&&t.includes('Desembarque '+br(dia(14))),'Home embarcado hoje: Dia 1 de 14 · Faltam 14 dias pra casa · '+br(dia(14)));
const heroLocal=async pg=>pg.evaluate(()=>{const h=[...document.querySelectorAll('[role="button"]')].find(e=>/^EMBARCADO|^PRÉ-EMBARQUE|^DE FOLGA/i.test(e.innerText.trim())); return h?h.innerText:'';});
let hero=await heroLocal(p); ok(hero&&!/SBJR|Jacarepagu/i.test(hero),'Card embarcado (Dia 1) sem aeroporto/base');
ok(/Minha Mala Mala: 0 de 11/.test(t)&&!/\b11 Minha Mala/.test(t),'Minha Mala sem badge redundante');
ok(/Vagas \d+ vagas verificadas/.test(t),'Vagas com dado real e fresco → contador');
const man=t.replace(/[\uE000-\uF8FF]/g,'').replace(/\s+/g,' ').match(/Notícias (.{10,900}?) Ver todas Aeroportos/); ok(man&&!man[1].includes('O que importa'),'Notícias com destaques recentes (1–3): '+(man?man[1].slice(0,60):''));
ok(/\bFerramentas\b/.test(t)&&/\bLoja\b/.test(t),'Ferramentas + Loja secundários');
const tabs=await p.evaluate(()=>[...document.querySelectorAll('[role="tab"],a[href]')].map(e=>e.innerText.replace(/[\uE000-\uF8FF\s]/g,'').trim()).filter(Boolean));
ok(tabs.slice(-5).join('|')==='Início|Escala|MinhaMala|Viagem|Certificados','Bottom nav: '+JSON.stringify(tabs.slice(-6)));
await p.screenshot({path:OUT+'/rc-home-390.png'}); await ctx.close();
for(const [nome,d,esperado] of [['sem',null,'Vamos começar pela sua escala'],['pre',dia(2),'Embarque em 2 dias'],['folga',dia(9),'Mais 9 dias em casa.']]){
 ({ctx,p}=await nova(390,d?esc(d):{})); await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(2000);
 ok((await txt(p)).includes(esperado),`Home ${nome}: "${esperado}"`);
 if(nome!=='sem') ok(/SBJR · Jacarepagu/.test(await heroLocal(p)),`Card ${nome}: aeroporto continua (logística)`);
 await ctx.close(); }
// embarcado no meio do bloco: Dia 5 de 14, sem local
({ctx,p}=await nova(390,esc(dia(-4)))); await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(2000);
hero=await heroLocal(p); ok(/Dia 5 de 14/.test(hero)&&/Faltam 10 dias pra casa/.test(hero)&&!/SBJR|Jacarepagu/i.test(hero),'Card embarcado Dia 5 sem aeroporto/base');
await p.screenshot({path:OUT+'/rc-home-embarcado-dia5.png'}); await ctx.close();
// vagas/notícias indisponíveis (endpoint falha, sem cache)
({ctx,p}=await nova(390,esc(HOJE),/api\/buddy\/(vagas|feed)/)); await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(3000); t=await txt(p);
ok(/Vagas Vagas verificadas/.test(t),'Vagas sem dado → só "Vagas verificadas" (sem número)');
ok(t.includes('Notícias Disponível quando houver conexão'),'Notícia indisponível sem cache (sem rede) → aviso discreto');
await ctx.close();
// cache velho de vagas (sem updated_at, cache de 3 dias) offline
({ctx,p}=await nova(390,{...esc(HOJE),owbuddy_cache_vagas:{data:[{id:'a',titulo:'X',empresa:'Y'}],cachedAt:Date.now()-72*3600e3}},/api\/buddy\/vagas/));
await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(2500);
ok(/Vagas Vagas verificadas/.test(await txt(p)),'Cache antigo de vagas não vira contador'); await ctx.close();
// NAV + back
({ctx,p}=await nova(390,esc(HOJE))); await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(2000);
for(const [tab,url] of [['Escala','/escala'],['Minha Mala','/mala'],['Viagem','/viagem'],['Certificados','/certs'],['Início','/']]){
 await p.getByRole('tab',{name:new RegExp(tab)}).first().click().catch(async()=>{await p.getByText(tab,{exact:true}).last().click();}); await p.waitForTimeout(1200);
 ok(new URL(p.url()).pathname===url,`Tab ${tab} → ${url}`); }
await p.getByText('Escala',{exact:true}).last().click(); await p.waitForTimeout(1200);
await p.getByText('Cruzar',{exact:true}).click(); await p.waitForTimeout(1200);
ok(new URL(p.url()).pathname==='/escala-cruzar','Deep: Escala → Cruzar');
await p.goBack(); await p.waitForTimeout(1200); ok(new URL(p.url()).pathname==='/escala','Back volta para Escala');
await p.goto(U+'/loja',{waitUntil:'networkidle'}); await p.waitForTimeout(1500); ok((await txt(p)).includes('Offshore Works'),'/loja continua acessível');
// CRUZAR CRUD
await p.goto(U+'/escala-secundaria-form',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
ok(!/🤜|🤛/.test(await txt(p)),'Form Cruzar sem emoji 🤜🤛');
await p.getByPlaceholder('Ex: Ana').fill('Ana'); await p.getByText('Irmão/ã',{exact:true}).click(); await p.getByText('14 × 21',{exact:true}).click();
await p.getByText(/Selecionar|Escolher data/).first().click(); await p.waitForTimeout(500); await p.getByText('OK',{exact:true}).click(); await p.waitForTimeout(300);
await p.screenshot({path:OUT+'/rc-cruzar-form.png',fullPage:true});
await p.getByText(/^Salvar/).last().click(); await p.waitForTimeout(1500);
let cz=JSON.parse(await p.evaluate(()=>localStorage.getItem('ownews_cruzar_v2'))); 
ok(cz.length===1&&cz[0].icon==='irmaos'&&cz[0].tipo==='14x21'&&cz[0].relacao==='Irmão/ã','Criar: relação, ícone vetorial (irmaos), ciclo 14×21');
await p.screenshot({path:OUT+'/rc-cruzar.png'});
await p.getByLabel('Editar escala de Ana').first().click(); await p.waitForTimeout(1500);
await p.getByPlaceholder('Ex: Ana').fill('Ana Paula'); await p.getByText('Personalizada',{exact:true}).click(); await p.waitForTimeout(300);
await p.getByPlaceholder('Ex: 21').fill('10'); await p.getByPlaceholder(/Ex: 2[18]|Ex: 1[04]/).last().fill('5').catch(()=>{});
await p.getByText(/^Salvar/).last().click(); await p.waitForTimeout(1500);
cz=JSON.parse(await p.evaluate(()=>localStorage.getItem('ownews_cruzar_v2')));
ok(cz.length===1&&cz[0].nome==='Ana Paula','Editar persiste ('+cz[0].nome+' '+cz[0].tipo+' '+cz[0].diasEmbarcado+'x'+cz[0].diasFolga+')');
await ctx.setOffline(true); await p.reload().catch(()=>{}); await ctx.setOffline(false);
await p.goto(U+'/escala-cruzar',{waitUntil:'networkidle'}); await p.waitForTimeout(1500); ok((await txt(p)).includes('Ana Paula'),'Persistência após reabrir');
await p.getByLabel('Excluir escala de Ana Paula').click(); await p.waitForTimeout(800);
ok(JSON.parse(await p.evaluate(()=>localStorage.getItem('ownews_cruzar_v2'))).length===0,'Excluir (com confirmação)');
// legado emoji
await p.evaluate(()=>localStorage.setItem('ownews_cruzar_v2',JSON.stringify([{id:'old',nome:'Legado',relacao:'Irmão/ã',icon:'🤜🤛',tipo:'14x14',dataRef:'2026-10-01',tipoRef:'embarquei'}])));
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1500); t=await txt(p);
ok(t.includes('Legado')&&!/🤜|🤛/.test(t),'Escala antiga com emoji 🤜🤛 renderiza ícone vetorial');
await ctx.close();
// TAB BAR em larguras
for(const W of [320,360,375,390,412,430]){ ({ctx,p}=await nova(W,esc(HOJE))); await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(1800);
 const r=await p.evaluate(()=>{const ls=[...document.querySelectorAll('[role="tab"] div, a[href] div')].filter(e=>/^(Início|Escala|Minha Mala|Viagem|Certificados)$/.test(e.innerText.trim())&&e.children.length===0);
   return ls.map(e=>({t:e.innerText.trim(),cut:e.scrollWidth>e.clientWidth+1}));});
 const cortados=r.filter(x=>x.cut).map(x=>x.t); ok(r.length>=5&&cortados.length===0,`${W}px: rótulos da barra inteiros ${cortados.length?'(cortados: '+cortados+')':''}`);
 if(W===320) await p.screenshot({path:OUT+'/rc-home-320.png'}); await ctx.close(); }
console.log('FALHAS:',falhas,'ERROS JS:',JSON.stringify(errs)); await b.close(); process.exit(falhas||errs.length?1:0);})();
