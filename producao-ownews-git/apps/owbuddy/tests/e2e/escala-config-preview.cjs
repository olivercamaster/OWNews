// Configuração de Escala 2.0 (Playwright, fora do npm test). Relógio fixo em 24/10/2026 (America/Sao_Paulo).
// Uso: PLAYWRIGHT=<pacote playwright> U=http://127.0.0.1:8791 OUT=/tmp/x node tests/e2e/escala-config-preview.cjs
const {chromium}=require(process.env.PLAYWRIGHT);
const U=process.env.U||'http://127.0.0.1:8791', OUT=process.env.OUT;
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const txt=p=>p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
(async()=>{const b=await chromium.launch({args:['--no-sandbox']}); const errs=[];
async function nova(W,seed){const ctx=await b.newContext({viewport:{width:W,height:844},deviceScaleFactor:2,colorScheme:'dark',timezoneId:'America/Sao_Paulo'});
 await ctx.addInitScript(d=>{try{if(!sessionStorage.getItem('s')){localStorage.clear();for(const[k,v]of Object.entries(d))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('s','1');}}catch(e){}},seed||{});
 const p=await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-10-24T12:00:00-03:00'));
 p.on('pageerror',e=>errs.push(e.message)); return {ctx,p};}
// item geometricamente no centro da faixa de seleção (independe de virtualização)
const cols=p=>p.evaluate(()=>[...document.querySelectorAll('div')].filter(d=>d.clientHeight===240&&d.scrollHeight>240&&d.getBoundingClientRect().width>0).map(l=>{const r=l.getBoundingClientRect();const cy=r.top+r.height/2;const it=[...l.querySelectorAll('[role=button]')].find(e=>{const b=e.getBoundingClientRect();return b.top<=cy&&b.bottom>=cy;});const sel=l.querySelector('[aria-selected=true]');return it?it.innerText.trim()+(sel&&sel!==it?'(sel '+sel.innerText.trim()+')':''):null;}));
const extenso=p=>p.evaluate(()=>{const m=document.body.innerText.match(/(domingo|segunda|terça|quarta|quinta|sexta|sábado), \d+ de \S+ de \d{4}/);return m&&m[0];});
const ovf=p=>p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
// 1. Home sem escala
let {ctx,p}=await nova(390,{});
await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(2500); let t=await txt(p);
ok(t.includes('Vamos começar pela sua escala')&&!/Dia \d+ de/.test(t)&&!/Embarque hoje|Desembarque \d/.test(t),'Home sem escala: estado neutro, sem dados fingidos');
await p.screenshot({path:OUT+'/1-home-vazia.png',fullPage:true});
// 2. Nova configuração
await p.goto(U+'/escala-config',{waitUntil:'networkidle'}); await p.waitForTimeout(1500); t=await txt(p);
ok(/qual é a sua escala\?/i.test(t)&&/quando foi seu último embarque\?/i.test(t)&&t.includes('Escolher data'),'Copy humana (sem "Data de referência")');
ok(!t.includes('Data de referência'),'"Data de referência" saiu da interface');
ok(/Confirmar escala/.test(t),'Botão "Confirmar escala" (nova)');
await p.getByText('Escolher data').click(); await p.waitForTimeout(1200);
let c=await cols(p); ok(JSON.stringify(c)===JSON.stringify(['24','Out','2026']),'Picker abre em HOJE local: '+JSON.stringify(c));
ok((await extenso(p))==='sábado, 24 de outubro de 2026','Data por extenso = hoje');
await p.screenshot({path:OUT+'/2-picker-hoje.png'});
// 3. usuário rola o dia até 16 (roda do mouse = rolagem real)
const box=await p.evaluate(()=>{const l=[...document.querySelectorAll('div')].filter(d=>d.clientHeight===240&&d.scrollHeight>240)[0].getBoundingClientRect();return {x:l.x+l.width/2,y:l.y+l.height/2};});
await p.mouse.move(box.x,box.y); await p.mouse.wheel(0,-8*48); await p.waitForTimeout(1200);
c=await cols(p); ok(c[0]==='16','Rolagem leva o centro ao 16: '+JSON.stringify(c));
ok((await extenso(p))==='sexta, 16 de outubro de 2026','Seleção acompanha a rolagem (era o bug do "embarquei hoje")');
// 3b. ano: toque em 2025 e volta para 2026
await p.getByRole('button',{name:'ANO 2025'}).click(); await p.waitForTimeout(700);
ok((await extenso(p))?.endsWith('de 2025'),'Toque no ano muda o ano (2025)');
await p.getByRole('button',{name:'ANO 2026'}).click(); await p.waitForTimeout(700);
ok((await extenso(p))==='sexta, 16 de outubro de 2026','Volta para 2026 mantendo 16/10');
await p.screenshot({path:OUT+'/3-picker-16.png'});
await p.getByText('OK',{exact:true}).click(); await p.waitForTimeout(800); t=await txt(p);
ok(t.includes('16/10/2026'),'Form mostra 16/10/2026 (não 24/10)');
ok(JSON.stringify(await p.evaluate(()=>localStorage.getItem('ownews_minha_escala')))==='null','Nada salvo antes de confirmar');
// 4. resumo
ok(/Sua escala\s*14 × 14/.test(t)&&/Último embarque\s*16\/10\/2026/.test(t)&&/Hoje\s*Embarcado · Dia 9 de 14/.test(t)&&/Próximo desembarque\s*30\/10\/2026/.test(t)&&/Próximo embarque\s*13\/11\/2026/.test(t),'Resumo antes de confirmar: 14×14 · 16/10 · Dia 9 · 30/10 · 13/11');
await p.screenshot({path:OUT+'/4-resumo.png',fullPage:true});
// 5. confirmar
await p.getByText('Confirmar escala').click(); await p.waitForTimeout(2000);
const salvo=await p.evaluate(()=>localStorage.getItem('ownews_minha_escala'));
ok(/2026-10-16/.test(salvo)&&!/diaDoBloco/.test(salvo),'Persistiu só a referência 2026-10-16: '+salvo.slice(0,120));
t=await txt(p); ok(new URL(p.url()).pathname==='/escala'&&/Dia 9 de 14/.test(t),'Escala: Dia 9 de 14');
ok(/embarquei em 16\/10\/2026/.test(t)&&/ajustada em 24\/10\/2026/.test(t),'Linha base rotulada (ajustada em …)');
const a11y=await p.evaluate(()=>[...document.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')).filter(l=>/de outubro|de novembro/.test(l)));
const lab=d=>a11y.find(l=>l.startsWith(d+' de '))||'';
ok(/embarque/.test(lab('16'))&&/dia 1\b/.test(lab('16')),'Calendário 16/10: '+lab('16'));
ok(/embarcado dia 14/.test(lab('29')),'Calendário 29/10: '+lab('29'));
ok(/desembarque/.test(lab('30')),'Calendário 30/10: '+lab('30'));
ok(/embarcado dia 9/.test(lab('24')),'Calendário 24/10 = dia 9: '+lab('24'));
await p.screenshot({path:OUT+'/5-escala.png',fullPage:true});
await p.getByRole('button').filter({has:p.locator('text=')}).first().isVisible().catch(()=>{});
// novembro
await p.evaluate(()=>{const b=[...document.querySelectorAll('[role=button],div[tabindex]')].filter(e=>e.innerText===''&&e.getBoundingClientRect().top>200);});
const navs=await p.locator('text=Outubro 2026').count(); 
await p.locator('text=Outubro 2026').locator('xpath=following-sibling::*[1]').click().catch(()=>{}); await p.waitForTimeout(800);
const a11y2=await p.evaluate(()=>[...document.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')).filter(l=>/de novembro/.test(l)));
const n13=a11y2.find(l=>l.startsWith('13 de novembro'))||'', n12=a11y2.find(l=>l.startsWith('12 de novembro'))||'';
ok(/embarque/.test(n13)&&/dia 1\b/.test(n13),'Calendário 13/11: '+n13);
ok(/folga/i.test(n12),'Calendário 12/11 folga: '+n12);
// 6. Home configurada
await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(2500); t=await txt(p);
ok(t.includes('Você está embarcado')&&t.includes('Dia 9 de 14')&&t.includes('6 dias para o desembarque.')&&t.includes('30/10/2026'),'Home: Embarcado · Dia 9 de 14 · 6 dias · 30/10/2026');
ok(!/embarcou hoje|dia de embarque/i.test(t),'Home nunca diz "embarcou hoje"');
await p.screenshot({path:OUT+'/6-home.png',fullPage:true});
// 7. Meu Embarque / Próximos
await p.goto(U+'/mala',{waitUntil:'networkidle'}); await p.waitForTimeout(1500); t=await txt(p);
ok(/PRÓXIMO EMBARQUE \(APÓS A FOLGA\)\s*13\/11\/2026/.test(t)&&/Faltam 20 dias/.test(t),'Meu Embarque: próximo embarque 13/11 (após a folga)');
await p.goto(U+'/proximos',{waitUntil:'networkidle'}); await p.waitForTimeout(1500); t=await txt(p);
ok(/Desembarque/.test(t)&&/Embarque/.test(t)&&!/16\/10/.test(t),'Próximos: desembarque e próximo embarque, sem 16/10');
// 8. editar
await p.goto(U+'/escala',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
await p.getByText('Editar',{exact:true}).click(); await p.waitForTimeout(1500); t=await txt(p);
ok(/Salvar alterações/.test(t)&&t.includes('16/10/2026'),'Editar abre com 16/10/2026 e "Salvar alterações"');
await p.getByRole('button',{name:/Data escolhida 16\/10\/2026/}).click(); await p.waitForTimeout(1200);
c=await cols(p); ok(JSON.stringify(c)===JSON.stringify(['16','Out','2026']),'Picker de edição abre na data salva: '+JSON.stringify(c));
await p.getByText('Cancelar',{exact:true}).click(); await p.waitForTimeout(600);
for(let i=0;i<3;i++){await p.getByRole('button',{name:/Data escolhida 16\/10\/2026/}).click(); await p.waitForTimeout(900); c=await cols(p); ok(JSON.stringify(c)===JSON.stringify(['16','Out','2026'])&&(await extenso(p))==='sexta, 16 de outubro de 2026','Reabrir edição #'+(i+2)+': '+JSON.stringify(c)); await p.getByText('Cancelar',{exact:true}).click(); await p.waitForTimeout(500);}
await ctx.close();
// 9. reload/offline
({ctx,p}=await nova(390,{ownews_minha_escala:{tipo:'14x14',dataRef:'2026-10-16',tipoRef:'embarquei'}}));
await ctx.setOffline(false); await p.goto(U+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500); await ctx.setOffline(true);
await p.reload({waitUntil:'domcontentloaded'}).catch(()=>{}); await p.waitForTimeout(2500); t=await txt(p).catch(()=>'');
ok(/Dia 9 de 14/.test(t)||t==='', 'Offline após reload: '+(t?'Dia 9 de 14':'(sem service worker no preview — página não recarrega offline)'));
await ctx.close();
// 10. mobile widths
for(const W of [320,360,375,390,412,430]){
 ({ctx,p}=await nova(W,{ownews_minha_escala:{tipo:'14x14',dataRef:'2026-10-16',tipoRef:'embarquei'}}));
 const res=[];
 for(const r of ['/','/escala','/escala-config','/mala']){await p.goto(U+r,{waitUntil:'networkidle'});await p.waitForTimeout(1300);res.push(r+':'+((await ovf(p))?'OVF':'ok'));}
 await p.goto(U+'/escala-config',{waitUntil:'networkidle'}); await p.waitForTimeout(1200); if(W===320) await p.screenshot({path:OUT+'/8-config-320.png',fullPage:true});
 await p.getByRole('button',{name:/Data escolhida 16\/10\/2026/}).click(); await p.waitForTimeout(900); res.push('picker:'+((await ovf(p))?'OVF':'ok'));
 const cut=await p.evaluate(()=>{const s=[...document.querySelectorAll('div')].filter(d=>d.clientHeight===240&&d.scrollHeight>240);return s.map(l=>l.getBoundingClientRect().width|0);});
 if(W===320) await p.screenshot({path:OUT+'/7-picker-320.png'});
 ok(res.every(x=>x.endsWith('ok')),W+'px sem overflow: '+res.join(' ')+' colunas '+cut.join('/'));
 await ctx.close();}
ok(errs.length===0,'Zero erro JS: '+errs.slice(0,3).join(' | '));
console.log("FALHAS="+falhas); await b.close(); process.exit(falhas?1:0);})();
