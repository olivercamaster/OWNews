// Aparência Automático/Escuro/Claro no preview web (Playwright). Não roda no `npm test`.
// Uso: PLAYWRIGHT=<caminho do pacote playwright> U=http://127.0.0.1:8791 node tests/e2e/aparencia-preview.cjs
const {chromium}=require(process.env.PLAYWRIGHT||'playwright'); const PLUS=require('./_plus.cjs');
const U=process.env.U||'http://127.0.0.1:8791', OUT=process.env.OUT;
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const hoje=new Date(); const iso=d=>new Date(hoje.getTime()+d*864e5).toISOString().slice(0,10);
const DADOS={ownews_minha_escala:{tipo:'14x14',dataRef:iso(-3),tipoRef:'embarquei',aeroporto:'SBJR'},
 ownews_cruzar_v2:[{id:'sec_1',nome:'João',relacao:'Cunhado/a',icon:'coracao',tipo:'14x14',dataRef:iso(4),tipoRef:'embarquei'}],
 ownews_certificados:[{id:'c1',nome:'CBSP',validade:iso(200)}], ownews_checklist_mala:{items:[{id:'x',label:'Botina',ok:true,cat:'roupas'}]},
 ownews_minha_viagem:{tipo:'AVIAO',data:iso(9),hora:'07:30'}, owbuddy_pagamento_v1:{regra:'dia_fixo',dia:5}, owbuddy_home_prefs:{v:1,ordem:['escala']},
 ownews_buddy_prefs:{tom:'resenha',trat:'parceira',apelido:'Duda'}, owbuddy_city_pref:{nome:'Macaé'}};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']}); const errs=[];
 const tema=p=>p.evaluate(()=>document.documentElement.dataset.tema);
 const fundo=p=>p.evaluate(()=>{const el=[...document.querySelectorAll('div')].find(d=>{const r=d.getBoundingClientRect();return r.width>300&&r.height>500&&getComputedStyle(d).backgroundColor!=='rgba(0, 0, 0, 0)';}); return el?getComputedStyle(el).backgroundColor:'?';});
 const claroBg=c=>{const m=c.match(/\d+/g); return m&&+m[0]>200;};
 for(const sis of ['dark','light']){
  const ctx=await b.newContext({viewport:{width:390,height:844},colorScheme:sis}); await PLUS(ctx); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
  ok(await tema(p)===(sis==='dark'?'escuro':'claro'),`Usuário novo + sistema ${sis} → ${await tema(p)} (padrão Automático)`);
  ok(await p.evaluate(()=>localStorage.getItem('owbuddy_aparencia'))===null,'Nada é gravado até o usuário escolher'); await ctx.close(); }
 const ctx=await b.newContext({viewport:{width:390,height:844},colorScheme:'dark'}); await PLUS(ctx);
 await ctx.addInitScript(d=>{ if(!sessionStorage.getItem('s')){localStorage.clear(); for(const [k,v] of Object.entries(d)) localStorage.setItem(k,JSON.stringify(v)); sessionStorage.setItem('s','1');}},DADOS);
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 const antes=await (async()=>{await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(1200); return p.evaluate(k=>Object.fromEntries(k.map(x=>[x,localStorage.getItem(x)])),Object.keys(DADOS));})();
 await p.goto(U+'/buddy-config',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
 ok((await p.innerText('body')).includes('Aparência'),'Meu Buddy → Aparência visível');
 const url0=p.url();
 await p.getByTestId('aparencia-claro').click(); await p.waitForTimeout(400);
 ok(await tema(p)==='claro'&&claroBg(await fundo(p)),'Claro aplica NA HORA (sem Salvar, sem recarregar): '+await fundo(p));
 ok(p.url()===url0,'Continua na mesma tela');
 ok(await p.evaluate(()=>localStorage.getItem('owbuddy_aparencia'))==='"claro"','Escolha gravada');
 if(OUT) await p.screenshot({path:OUT+'/fluxo-claro.png'});
 await p.emulateMedia({colorScheme:'dark'}); await p.waitForTimeout(400); ok(await tema(p)==='claro','Forçado Claro + sistema escuro → continua claro');
 await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1200); ok(await tema(p)==='claro','Claro persiste depois de fechar/reabrir');
 await p.getByTestId('aparencia-escuro').click(); await p.waitForTimeout(400);
 ok(await tema(p)==='escuro'&&!claroBg(await fundo(p)),'Escuro aplica na hora');
 await p.emulateMedia({colorScheme:'light'}); await p.waitForTimeout(400); ok(await tema(p)==='escuro','Forçado Escuro + sistema claro → continua escuro');
 await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1200); ok(await tema(p)==='escuro','Escuro persiste depois de reabrir');
 await p.getByTestId('aparencia-auto').click(); await p.waitForTimeout(400);
 ok(await tema(p)==='claro','Automático com sistema claro → claro na hora');
 await p.emulateMedia({colorScheme:'dark'}); await p.waitForTimeout(500); ok(await tema(p)==='escuro'&&!claroBg(await fundo(p)),'Automático: sistema muda para escuro → app acompanha sem reiniciar');
 await p.emulateMedia({colorScheme:'light'}); await p.waitForTimeout(500); ok(await tema(p)==='claro'&&claroBg(await fundo(p)),'Automático: sistema volta para claro → app acompanha');
 const radio=await p.getByTestId('aparencia-auto').getAttribute('aria-checked'); ok(radio==='true','Rádio marca Automático (acessível)');
 // navegação depois da troca: telas já montadas também mudam
 await p.goto(U+'/escala',{waitUntil:'networkidle'}); await p.waitForTimeout(1200); ok(claroBg(await fundo(p)),'Escala no claro');
 const depois=await p.evaluate(k=>Object.fromEntries(k.map(x=>[x,localStorage.getItem(x)])),Object.keys(DADOS));
 const mudou=Object.keys(DADOS).filter(k=>antes[k]!==depois[k]&&k!=='ownews_checklist_mala');
 ok(mudou.length===0,'Nenhum dado do usuário mudou com as trocas de tema'+(mudou.length?' ('+mudou+')':''));
 ok(JSON.parse(depois.ownews_buddy_prefs).apelido==='Duda'&&JSON.parse(depois.ownews_cruzar_v2)[0].nome==='João','Apelido e Cruzar preservados');
 await ctx.close();
 // LARGURAS
 for(const t of ['escuro','claro']) for(const W of [320,360,375,390,412,430]){
  const c=await b.newContext({viewport:{width:W,height:800},colorScheme:t==='claro'?'light':'dark'}); await PLUS(c);
  await c.addInitScript(d=>{ if(!sessionStorage.getItem('s')){localStorage.clear(); for(const [k,v] of Object.entries(d)) localStorage.setItem(k,JSON.stringify(v)); sessionStorage.setItem('s','1');}},{...DADOS,owbuddy_aparencia:t});
  const q=await c.newPage(); q.on('pageerror',e=>errs.push(e.message)); const ruins=[];
  for(const r of ['/','/escala','/escala-cruzar','/buddy-config','/mala','/viagem','/certs']){ await q.goto(U+r,{waitUntil:'networkidle'}); await q.waitForTimeout(900);
    const o=await q.evaluate(()=>{const over=document.documentElement.scrollWidth>window.innerWidth+1;
      const cortes=[...document.querySelectorAll('div')].filter(e=>e.children.length===0&&/^(Início|Escala|Embarque|Viagem|Certificados)$/.test(e.innerText.trim())&&e.scrollWidth>e.clientWidth+1).map(e=>e.innerText);
      return {over,cortes};});
    if(o.over||o.cortes.length) ruins.push(r+(o.over?' overflow':'')+(o.cortes.length?' nav:'+o.cortes:'')); }
  ok(ruins.length===0,`${t} ${W}px: sem overflow e nav inteira ${ruins.join(' ')}`); await c.close(); }
 console.log('FALHAS:',falhas,'ERROS JS:',JSON.stringify(errs)); await b.close(); process.exit(falhas?1:0);})();
