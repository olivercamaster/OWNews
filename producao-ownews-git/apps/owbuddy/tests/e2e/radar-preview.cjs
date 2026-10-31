// Minha Unidade + Radar Offshore no preview web (Playwright, fora do npm test).
// Uso: PLAYWRIGHT=<pacote playwright> U=http://127.0.0.1:8791 OUT=/tmp/x node tests/e2e/radar-preview.cjs
// O pacote do Radar vem da API REAL (ownews.com.br/radar-offshore/api/buddy) — ou de um pacote
// simulado quando a rede é bloqueada no teste.
const {chromium}=require(process.env.PLAYWRIGHT); const PLUS=require('./_plus.cjs');
const U=process.env.U||'http://127.0.0.1:8791', OUT=process.env.OUT||'/tmp';
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const txt=p=>p.evaluate(()=>document.body.innerText.replace(/[-]/g,'').replace(/\s+/g,' '));
const dia=n=>{const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const ESCALA={ownews_minha_escala:{tipo:'14x14',dataRef:dia(-8),tipoRef:'embarquei',aeroporto:'SBJR'},owbuddy_home_prefs:{v:3,dicaVista:true}};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']}); const errs=[]; const pedidos=[];
async function nova({W=390,esquema='dark',seed=ESCALA}={}){const ctx=await b.newContext({viewport:{width:W,height:844},deviceScaleFactor:2,colorScheme:esquema}); await PLUS(ctx,'trial_ativo');
 await ctx.addInitScript(d=>{try{if(!sessionStorage.getItem('s')){localStorage.clear();for(const[k,v]of Object.entries(d))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('s','1');}}catch(e){}},seed);
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); p.on('request',r=>{if(/radar-offshore/.test(r.url()))pedidos.push(r.url());}); return {ctx,p};}
const vai=async(p,r,ms=2200)=>{await p.goto(U+r,{waitUntil:'networkidle'}).catch(()=>{}); await p.waitForTimeout(ms);};
const ls=(p,k)=>p.evaluate(k=>localStorage.getItem(k),k);

// 1. Autocomplete online: "West Ju" → West Jupiter; salvar; contexto + link OWNews
let {ctx,p}=await nova();
await vai(p,'/escala'); let t=await txt(p);
ok(/Minha Unidade\s*Onde você embarca/.test(t),'Escala: atalho "Minha Unidade" (vazio)');
const escalaAntes=await ls(p,'ownews_minha_escala');
await vai(p,'/minha-unidade',2500); t=await txt(p);
ok(t.includes('Onde você embarca?'),'Minha Unidade vazia pede a unidade');
await p.getByLabel('Unidade',{exact:true}).click(); await p.getByLabel('Unidade',{exact:true}).fill('West Ju'); await p.waitForTimeout(800);
t=await txt(p); ok(/West Jupiter\s*Navio-sonda · Seadrill/.test(t),'Sugestão do Radar: West Jupiter · Navio-sonda · Seadrill');
await p.screenshot({path:OUT+'/r1-sugestao.png'});
await p.getByText('West Jupiter',{exact:true}).last().click(); await p.waitForTimeout(500);
t=await txt(p); ok(t.includes('Radar Offshore · Navio-sonda'),'Escolhida: referência do Radar mostrada');
await p.getByText('Salvar',{exact:true}).click(); await p.waitForTimeout(2500);
t=await txt(p);
ok(t.includes('MINHA UNIDADE')&&t.includes('West Jupiter')&&t.includes('Operador da sonda: Seadrill'),'Contexto: tipo e operador da sonda');
ok(/Você está no Dia \d+ de 14/.test(t),'Embarcado: "Você está no Dia X de 14"');
ok(t.includes('Ver unidade no OWNews'),'Botão Ver unidade no OWNews');
await p.screenshot({path:OUT+'/r2-minha-unidade.png',fullPage:true});
const mu=JSON.parse(await ls(p,'owbuddy_minha_unidade'));
ok(mu&&mu.nome==='West Jupiter'&&mu.radar&&mu.radar.id==='sonda-ns-55','Guardado: nome + referência estável sonda-ns-55');
ok(await ls(p,'ownews_minha_escala')===escalaAntes,'Escala intacta (ciclo e datas não mudaram)');
ok(pedidos.every(u=>/\/radar-offshore\/api\/buddy$/.test(u)),'Privacidade: só o pacote público foi pedido (nenhuma consulta com a unidade): '+JSON.stringify([...new Set(pedidos)]));
await ctx.close();

// 2. Sem internet e sem pacote: texto livre salva normalmente
({ctx,p}=await nova());
await ctx.route(/radar-offshore/,r=>r.abort()); await vai(p,'/minha-unidade',2500);
await p.getByLabel('Unidade',{exact:true}).fill('Navio Sem Catálogo 9'); await p.waitForTimeout(600);
t=await txt(p); ok(!t.includes('Sugestões'),'Offline: sem sugestões, campo livre');
await p.getByText('Salvar',{exact:true}).click(); await p.waitForTimeout(1500); t=await txt(p);
ok(t.includes('Navio Sem Catálogo 9')&&t.includes('não está ligada ao Radar Offshore'),'Offline: unidade desconhecida salva');
await ctx.close();

// 3. Meu Histórico: autocomplete no formulário + sugestão (não automática) para registro antigo
const reg={id:'he_1',embarque:dia(-40),desembarque:dia(-26),unidade:'West Jupiter',fonte:'manual',criado_em:'2026-09-01T00:00:00Z',updated_at:'2026-09-01T00:00:00Z'};
({ctx,p}=await nova({seed:{...ESCALA,owbuddy_historico:{v:1,registros:[reg],acontecimentos:[],seq:1}}}));
await vai(p,'/historico-registro?id=he_1',3000); t=await txt(p);
ok(/está no Radar Offshore como West Jupiter \(Navio-sonda\)\. Associar este registro\?/.test(t),'Registro antigo: só SUGERE associação');
ok(JSON.parse(await ls(p,'owbuddy_historico')).registros[0].unidade_ref===undefined,'Nada mudou sem o toque');
await p.getByText('Associar',{exact:true}).click(); await p.waitForTimeout(1200);
const r1=JSON.parse(await ls(p,'owbuddy_historico')).registros[0];
ok(r1.unidade==='West Jupiter'&&r1.unidade_ref&&r1.unidade_ref.id==='sonda-ns-55','Associado: texto preservado + referência');
t=await txt(p); ok(t.includes('Navio-sonda · Ver unidade no OWNews'),'Registro: Ver unidade no OWNews');
await vai(p,'/historico-form',2000);
await p.getByLabel('Unidade / local (opcional)',{exact:true}).fill('almirante bar'); await p.waitForTimeout(700); t=await txt(p);
ok(/FPSO Almirante Barroso\s*FPSO · Petrobras/.test(t),'Formulário do histórico: autocomplete do Radar');
await ctx.close();

// 4. Início: card "Sua unidade" só com notícia nova (unidade com notícias no Radar)
({ctx,p}=await nova());
await vai(p,'/minha-unidade',2500);
const comNoticia=await p.evaluate(async()=>{const d=await (await fetch('https://ownews.com.br/radar-offshore/api/buddy')).json();const id=Object.keys(d.noticias_unidades)[0];return d.unidades.find(u=>u.id===id);});
await p.evaluate(u=>localStorage.setItem('owbuddy_minha_unidade',JSON.stringify({v:1,nome:u.nome,radar:{id:u.id,slug:u.slug},definida_em:'2026-10-31T00:00:00Z'})),comNoticia);
await vai(p,'/',3500); t=await txt(p);
ok(t.includes('SUA UNIDADE')&&t.includes(comNoticia.nome),'Início: card "Sua unidade" ('+comNoticia.nome+')');
await p.screenshot({path:OUT+'/r3-home-card.png'});
await vai(p,'/minha-unidade',3000); t=await txt(p);
ok(t.toLowerCase().includes(('Notícias sobre '+comNoticia.nome).toLowerCase()),'Minha Unidade: notícias sobre a unidade');
await vai(p,'/',3500); t=await txt(p); ok(!t.includes('SUA UNIDADE'),'Depois de ver: card some (sem notícia nova)');
await ctx.close();

// 5. Responsivo 320–430, escuro e claro
for(const esquema of ['dark','light']) for(const W of [320,360,375,390,412,430]){
  ({ctx,p}=await nova({W,esquema,seed:{...ESCALA,owbuddy_minha_unidade:{v:1,nome:'FPSO Almirante Barroso',radar:{id:'plat-FPBAR',slug:'fpso-almirante-barroso'},definida_em:'x'}}}));
  let tudo=true; for(const r of ['/minha-unidade','/escala']){await vai(p,r,1800); if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)){tudo=false;ok(false,`${W} ${esquema} ${r}: rolagem lateral`);}}
  if(W===320){await vai(p,'/minha-unidade',2000); await p.screenshot({path:`${OUT}/r4-${esquema}-320.png`,fullPage:true});}
  ok(tudo,`${W}px ${esquema}: Minha Unidade e Escala sem rolagem lateral`); await ctx.close();
}
console.log((errs.length?'FALHA':'OK  ')+' Erros JS: '+JSON.stringify(errs.slice(0,5))); if(errs.length) falhas++;
console.log('FALHAS='+falhas); await b.close(); process.exit(falhas?1:0);})();
