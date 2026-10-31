// Home "Offshore Agora → Notícias" (1–3 destaques) + frescor do feed, no preview web (Playwright, fora do npm test).
// Uso: PLAYWRIGHT=<pacote playwright> U=http://127.0.0.1:8791 OUT=/tmp/x node tests/e2e/noticias-home-preview.cjs
// Casos 1–19 com feed SIMULADO (ctx.route) para serem determinísticos; o caso REAL compara com o OWNews ao vivo.
const {chromium}=require(process.env.PLAYWRIGHT); const PLUS=require('./_plus.cjs');
const U=process.env.U||'http://127.0.0.1:8791', OUT=process.env.OUT||'/tmp';
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const txt=p=>p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
const FEED=/\/api\/buddy\/feed/;
const iso=h=>new Date(Date.now()-h*3600e3).toISOString();
const dia=n=>{const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10);};
const ESCALA={ownews_minha_escala:{tipo:'14x14',dataRef:dia(-8),tipoRef:'embarquei',aeroporto:'SBJR'},owbuddy_home_prefs:{v:3,dicaVista:true}};
const art=(id,h,score,title,extra={})=>({id,title,summary:null,corpo:'Parágrafo um.\n\nParágrafo dois.',buddy_summary:'Resumo do Buddy.',why_it_matters:'Impacto.',image_url:null,image_credit:'PetroNotícias',original_url:'https://exemplo.com/'+id,published_at:iso(h),editorial_score:score,url:'https://ownews.com.br/noticia?id='+id,explica:[],...extra});
const LONGO='Petrobras assina contrato bilionário com consórcio internacional para afretamento de nova FPSO de grande porte destinada ao campo de Búzios no pré-sal da Bacia de Santos, com início previsto para 2029';
const T3=[art('n1',2,80,'Incêndio controlado em plataforma da Bacia de Campos sem feridos'),art('n2',5,100,'Petrobras contrata sonda da Foresea por US$ 900 milhões para Búzios'),art('n3',0.3,55,'Nota técnica sobre calibração de medidores em laboratório'),art('n4',30,106,'Grande descoberta anunciada ontem na Margem Equatorial pela Petrobras')];

(async()=>{const b=await chromium.launch({args:['--no-sandbox']}); const errs=[];
async function nova({W=390,esquema='dark',seed=ESCALA,feed=T3,cache=null,offline=false}={}){
  const ctx=await b.newContext({viewport:{width:W,height:844},deviceScaleFactor:2,colorScheme:esquema}); await PLUS(ctx,'trial_ativo');
  const s={...seed}; if(cache) s.owbuddy_cache_feed_v3={data:cache.data,cachedAt:cache.cachedAt};
  await ctx.addInitScript(d=>{try{if(!sessionStorage.getItem('s')){localStorage.clear();for(const[k,v]of Object.entries(d))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('s','1');}}catch(e){}},s);
  const st={pedidos:0,feed,offline};
  await ctx.route(FEED,r=>{st.pedidos++; if(st.offline) return r.abort(); r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({articles:st.feed,schema_version:2,updated_at:new Date().toISOString()})});});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); return {ctx,p,st};}
const vai=async(p,r,ms=2200)=>{await p.goto(U+r,{waitUntil:'networkidle'}).catch(()=>{}); await p.waitForTimeout(ms);};
const titulos=p=>p.$$eval('[aria-label$="Publicada há"], [aria-label*=". Publicada há "]',els=>els.map(e=>e.getAttribute('aria-label').replace(/\. Publicada há .*$/,'')));

// 1 + 5: três boas → 3, na ordem relevância × recência; a de 30 h fica fora
let {ctx,p,st}=await nova(); await vai(p,'/'); let t=await txt(p); let ts=await titulos(p);
ok(ts.length===3,'Caso 1/4: 3 destaques ('+ts.length+')');
ok(ts[0]===T3[1].title&&ts[1]===T3[0].title&&ts[2]===T3[2].title,'Caso 5: contrato 5 h > breaking 2 h > técnica 20 min: '+JSON.stringify(ts));
ok(!t.includes('Margem Equatorial'),'Recência: notícia grande de 30 h não ocupa a Home com notícias de hoje');
ok(/OFFSHORE AGORA/i.test(t)&&t.includes('Aeroportos')&&t.includes('Vagas')&&t.includes('Unidades'),'Home preservada: Offshore Agora, Vagas, Unidades, Aeroportos');
ok(/5h/.test(t)&&/2h/.test(t)&&/\d+min/.test(t),'Idade curta (5h, 2h, Nmin)');
ok(t.includes('Ver todas'),'Ver todas presente');
await p.screenshot({path:OUT+'/h-390-dark.png',fullPage:true});
// 13–15: cada linha abre a sua matéria
for(const [k,a] of [[0,T3[1]],[1,T3[0]],[2,T3[2]]]){
  await vai(p,'/',1800); await p.locator(`[aria-label^="${a.title}."]`).first().click(); await p.waitForTimeout(1500);
  ok(p.url().endsWith('/noticia/'+a.id),`Caso ${13+k}: toque na ${k+1}ª abre ${a.id} (${p.url().split('/').pop()})`);
}
// 16: Ver todas → Notícias Offshore; 20: mesma camada (Home + Notícias = 1 pedido no TTL)
const antes=st.pedidos; await vai(p,'/',1800); await p.getByLabel('Ver todas as notícias').click(); await p.waitForTimeout(1500);
ok(/\/noticias$/.test(p.url()),'Caso 16: Ver todas abre Notícias Offshore');
t=await txt(p); ok(t.includes(T3[3].title),'Notícias Offshore continua o feed completo (inclui a de 30 h)');
ok(st.pedidos===antes,'Caso 20: Home e Notícias usam o mesmo cache (nenhum pedido extra no TTL): '+(st.pedidos-antes));
await ctx.close();

// 2 e 3: só 2 boas / só 1 boa (fraca não completa)
({ctx,p}=await nova({feed:[art('a',1,90,'Seadrill renova contrato do West Tellus com a Petrobras'),art('b',3,85,'Transocean recebe aditivo para sonda no pré-sal'),art('x',2,20,'Evento social reúne fornecedores em Macaé')]}));
await vai(p,'/'); ts=await titulos(p); ok(ts.length===2,'Caso 2: 2 boas → 2 ('+ts.length+')'); await ctx.close();
({ctx,p}=await nova({feed:[art('a',2,90,'Ocyan inicia operação de nova sonda'),art('x',1,30,'Curso rápido de Excel para fornecedores')]}));
await vai(p,'/'); ts=await titulos(p); ok(ts.length===1,'Caso 3: 1 boa → 1 ('+ts.length+')'); await ctx.close();

// 4: dez recentes → no máximo 3
({ctx,p}=await nova({feed:Array.from({length:10},(_,k)=>art('d'+k,k+0.5,70+k,`Empresa${k} fecha acordo${k} para projeto${k} offshore`))}));
await vai(p,'/'); ts=await titulos(p); ok(ts.length===3,'Caso 4: 10 recentes → 3'); await ctx.close();

// 6: três sobre o mesmo fato + uma alternativa → não ocupa os três slots
({ctx,p}=await nova({feed:[art('p1',1,100,'Petrobras anuncia contrato da FPSO P-90 com a Seatrium'),art('p2',2,95,'Petrobras detalha contrato da FPSO P-90 com a Seatrium'),art('p3',3,90,'Seatrium confirma contrato da FPSO P-90 com a Petrobras'),art('o1',4,70,'Foresea mobiliza sonda para campanha na Bacia de Santos')]}));
await vai(p,'/'); ts=await titulos(p); ok(ts.length===2&&ts.filter(x=>x.includes('P-90')).length===1,'Caso 6: mesma pauta ocupa 1 vaga: '+JSON.stringify(ts)); await ctx.close();

// 7 + 19 + 26: cache antigo (20 h) + API atual → Home atualiza, sem perder o scroll
const VELHO=[art('v1',20,90,'Notícia de ontem que estava em cache no aparelho')];
({ctx,p,st}=await nova({cache:{data:VELHO,cachedAt:Date.now()-6*60e3},feed:[art('f1',0.5,95,'Notícia nova de 30 minutos publicada agora no OWNews'),...VELHO]}));
st.offline=true; await vai(p,'/',2500); t=await txt(p);
ok(t.includes('Notícia de ontem'),'SWR: cache aparece na hora (rede fora)');
const ROLA=()=>[...document.querySelectorAll('div')].find(d=>d.scrollHeight>d.clientHeight+50&&/(auto|scroll)/.test(getComputedStyle(d).overflowY));
await p.evaluate(`(${ROLA})().scrollTop=400`); await p.waitForTimeout(300); const y0=await p.evaluate(`(${ROLA})().scrollTop`);
st.offline=false; await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
await p.waitForTimeout(2500); t=await txt(p);
ok(t.includes('Notícia nova de 30 minutos'),'Caso 7: voltar ao app com cache vencido → Home atualiza');
const y1=await p.evaluate(`(${ROLA})().scrollTop`);
ok(y0>0&&y1===y0,`Caso 19: atualização não reseta o scroll (${y0} → ${y1})`);
const nNova=(await titulos(p)).filter(x=>x.includes('30 minutos')).length; ok(nNova===1,'Sem duplicar após atualizar');
await ctx.close();

// 8: API offline + cache → Home funciona com os destaques guardados
({ctx,p}=await nova({offline:true,cache:{data:[art('c1',3,90,'Destaque guardado no aparelho para uso offline')],cachedAt:Date.now()-2*3600e3}}));
await vai(p,'/'); t=await txt(p); ok(t.includes('Destaque guardado')&&t.includes('Aeroportos')&&t.includes('Vagas'),'Caso 8: offline + cache → destaques e resto da Home'); await ctx.close();
// 9: primeiro uso offline → Home inteira, bloco discreto
({ctx,p}=await nova({offline:true})); await vai(p,'/'); t=await txt(p);
ok(t.includes('Disponível quando houver conexão')&&t.includes('Aeroportos')&&t.includes('Unidades'),'Caso 9: primeiro uso offline não quebra a Home'); await p.screenshot({path:OUT+'/h-offline-1uso.png'}); await ctx.close();

// 10–12: sem foto entra; inglês (barrado no gate do OWNews, nunca chega ao feed); PT-BR válida entra
({ctx,p}=await nova({feed:[art('s1',1,90,'DOF fecha contrato de PLSV com a Petrobras',{image_url:null}),art('s2',2,80,'TechnipFMC entrega árvores de natal molhadas para Mero')]}));
await vai(p,'/'); ts=await titulos(p); ok(ts.includes('DOF fecha contrato de PLSV com a Petrobras'),'Caso 10: sem imagem aparece'); ok(ts.length===2,'Caso 12: PT-BR válida aparece'); await ctx.close();

// 17: duplicada na API → uma vez
({ctx,p}=await nova({feed:[T3[1],T3[1],T3[0]]})); await vai(p,'/'); ts=await titulos(p);
ok(ts.filter(x=>x===T3[1].title).length===1,'Caso 17: duplicada aparece uma vez'); await ctx.close();

// 18 + 30: títulos longos/curtos em 320–430, escuro e claro: sem rolagem lateral, chevron e idade inteiros
const MIX=[art('l1',1,100,LONGO),art('l2',3,80,'P-71 produz'),art('l3',4,75,'Subsea7 conquista contrato submarino de médio porte para campo em águas profundas no Espírito Santo')];
for(const esquema of ['dark','light']) for(const W of [320,360,375,390,412,430]){
  ({ctx,p}=await nova({W,esquema,feed:MIX})); await vai(p,'/',2000);
  const lat=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  const geo=await p.$$eval('[aria-label*=". Publicada há "]',els=>els.map(e=>{const r=e.getBoundingClientRect();const tt=e.querySelector('div[dir="auto"]');const tr=tt?tt.getBoundingClientRect():r;const svg=e.querySelector('svg')||e.lastElementChild;const sr=svg.getBoundingClientRect();return {dentro:r.right<=innerWidth+0.5&&r.left>=0,semColisao:tr.right<=sr.left+1,alt:r.height,toque:r.height>=44};}));
  ok(!lat&&geo.length===3&&geo.every(g=>g.dentro&&g.semColisao&&g.toque&&g.alt<90),`Caso 18/30: ${W}px ${esquema}: íntegro ${JSON.stringify(geo.map(g=>Math.round(g.alt)))}`);
  if([320,390,430].includes(W)) await p.screenshot({path:`${OUT}/h-${W}-${esquema}-longo.png`,fullPage:true});
  await ctx.close();
}

// Acessibilidade: foco por teclado chega nas manchetes e no Ver todas
({ctx,p}=await nova()); await vai(p,'/');
let focos=[]; for(let i=0;i<60;i++){await p.keyboard.press('Tab'); const l=await p.evaluate(()=>document.activeElement&&document.activeElement.getAttribute('aria-label')); if(l) focos.push(l);}
ok(focos.some(l=>l.startsWith(T3[1].title))&&focos.includes('Ver todas as notícias'),'Teclado alcança manchetes e Ver todas'); await ctx.close();

// REAL: feed ao vivo do OWNews — Home e Notícias Offshore batem com a fonte
{const ctx2=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,colorScheme:'dark'}); await PLUS(ctx2,'trial_ativo');
 await ctx2.addInitScript(d=>{try{if(!sessionStorage.getItem('s')){localStorage.clear();for(const[k,v]of Object.entries(d))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('s','1');}}catch(e){}},ESCALA);
 const p2=await ctx2.newPage(); p2.on('pageerror',e=>errs.push(e.message));
 const real=await (await fetch('https://ownews.com.br/api/buddy/feed')).json();
 await vai(p2,'/',3500); const tsr=await titulos(p2);
 console.log('INFO OWNews mais nova: '+real.articles[0].published_at+' · '+real.articles[0].title);
 console.log('INFO Home real: '+JSON.stringify(tsr));
 ok(tsr.length>=1&&tsr.every(x=>real.articles.some(a=>a.title===x)),'REAL: destaques da Home vêm do feed atual do OWNews');
 await p2.screenshot({path:OUT+'/real-home-390-dark.png',fullPage:true});
 await vai(p2,'/noticias',3000); const tn=await txt(p2); ok(tn.includes(real.articles[0].title),'REAL: Notícias Offshore mostra a matéria mais nova do OWNews');
 await p2.screenshot({path:OUT+'/real-noticias-390-dark.png'}); await ctx2.close();}

console.log((errs.length?'FALHA':'OK  ')+' Erros JS: '+JSON.stringify(errs.slice(0,5))); if(errs.length) falhas++;
console.log('FALHAS='+falhas); await b.close(); process.exit(falhas?1:0);})();
