// OWBuddy Free + Premium no preview web (Playwright, fora do npm test). Loja SIMULADA (modo de teste).
// Uso: PLAYWRIGHT=<pacote playwright> U=http://127.0.0.1:8791 OUT=/tmp/x node tests/e2e/plus-preview.cjs
// Cobre os testes da missão de fechamento (2026-10-30): 36 Escala Free, 37 Minha Mala Free,
// 38 novo ciclo, 39 Histórico sem sequestro de dados, período de 45 dias e responsivo 320–430.
const {chromium}=require(process.env.PLAYWRIGHT);
const U=process.env.U||'http://127.0.0.1:8791', OUT=process.env.OUT||'/tmp';
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const txt=p=>p.evaluate(()=>document.body.innerText.replace(/[-]/g,'').replace(/\s+/g,' '));
const ESCALA=d=>({v:2,data:{tipo:'14x14',dataRef:d,tipoRef:'embarquei',origem:'dispositivo',updated_at:'2026-10-20T10:00:00.000Z'},updated_at:'2026-10-20T10:00:00.000Z'});
const AGORA='2026-10-24T12:00:00.000Z';
const reg=i=>({id:'he_'+i,embarque:`20${18+i}-03-01`,desembarque:`20${18+i}-03-15`,unidade:'P-'+(70+i),fonte:'manual',criado_em:AGORA,updated_at:AGORA});
const DADOS={
  ownews_minha_escala:ESCALA('2026-10-16'),
  owbuddy_home_prefs:{v:3,dicaVista:true},
  ownews_checklist_mala:{items:Array.from({length:12},(_,i)=>({id:'i'+i,t:'Item '+i,cat:'roupas',ok:i<3})),ciclo:'2026-11-13'},
  ownews_certificados:[{id:'c1',nome:'CBSP',validade:'2026-11-02'}],
  ownews_minha_viagem:{tipo:'AVIAO',data:'2026-10-25',hora:'08:40',origem:'GRU',destino:'Macaé',localizador:'XYZ123'},
  owbuddy_historico:{v:1,registros:[0,1,2,3,4,5].map(reg),acontecimentos:[],seq:12},
};
const CEN='owbuddy_plus_teste_cenario';
(async()=>{const b=await chromium.launch({args:['--no-sandbox']}); const errs=[];
async function nova({W=390,esquema='dark',seed={},cenario='novo_usuario',quando='2026-10-24T12:00:00-03:00'}={}){
  const ctx=await b.newContext({viewport:{width:W,height:844},deviceScaleFactor:2,colorScheme:esquema,timezoneId:'America/Sao_Paulo'});
  await ctx.addInitScript(([d,c,k])=>{try{if(!sessionStorage.getItem('s')){localStorage.clear();for(const[kk,v]of Object.entries(d))localStorage.setItem(kk,JSON.stringify(v));localStorage.setItem(k,JSON.stringify(c));sessionStorage.setItem('s','1');}}catch(e){}},[seed,cenario,CEN]);
  const p=await ctx.newPage(); await p.clock.setFixedTime(new Date(quando));
  p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); return {ctx,p};
}
const vai=async(p,rota,ms=1700)=>{await p.goto(U+rota,{waitUntil:'networkidle'}); await p.waitForTimeout(ms);};
const clica=async(p,texto,ms=900)=>{await p.getByText(texto,{exact:true}).last().click(); await p.waitForTimeout(ms);};
const rotulo=async(p,label,ms=700)=>{await p.getByLabel(label,{exact:true}).last().click(); await p.waitForTimeout(ms);};
const ovf=p=>p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
const rota=p=>new URL(p.url()).pathname;
const cenario=async(p,c)=>{await p.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify(v)),[CEN,c]);};
const ls=(p,k)=>p.evaluate(k=>localStorage.getItem(k),k);

// ── 36. Minha Escala: instalação limpa, sem login, Free para sempre ──
let {ctx,p}=await nova();
await vai(p,'/',2500); let t=await txt(p);
ok(rota(p)==='/'&&t.includes('Vamos começar pela sua escala'),'Instalação limpa: abre no Início, sem login e sem paywall');
ok(!/Premium/.test(t),'Instalação limpa: nenhum Premium no Início');
await vai(p,'/buddy-config'); t=await txt(p);
ok(t.includes('Configure sua escala e experimente 45 dias sem cobrança'),'Meu Buddy: período ainda não começou (sem escala)');
ok((await ls(p,'owbuddy_premium_trial'))===null,'Sem escala: nenhum registro de período');
await vai(p,'/escala-config',1500); await clica(p,'Escolher data',1000); await clica(p,'OK',700); await clica(p,'Confirmar escala',2200);
t=await txt(p); ok(rota(p)==='/escala'&&/Dia 1 de 14/.test(t),'Escala criada pela interface (Dia 1 de 14)');
ok((await ls(p,'owbuddy_premium_trial'))!==null,'Período de 45 dias começou ao configurar a escala');
await vai(p,'/buddy-config'); t=await txt(p); ok(t.includes('Premium ativo · 45 dias restantes'),'Meu Buddy: "Premium ativo · 45 dias restantes"');
await vai(p,'/escala'); t=await txt(p); ok(/Dia 1 de 14/.test(t),'Fechar e abrir: escala continua');
await cenario(p,'trial_terminou'); await vai(p,'/escala'); t=await txt(p);
ok(/Dia 1 de 14/.test(t)&&!/Premium/.test(t),'Premium expirado: escala integral, sem selo');
await vai(p,'/escala-config',1500); t=await txt(p); ok(/Salvar|Confirmar/.test(t),'Premium expirado: editar escala disponível');
await ctx.setOffline(true); await p.goto(U+'/escala').catch(()=>{}); await p.waitForTimeout(400);
await ctx.setOffline(false); await vai(p,'/escala'); await ctx.setOffline(true);
await p.evaluate(()=>{history.pushState({},'','/mala'); dispatchEvent(new PopStateEvent('popstate'));}); await p.waitForTimeout(400);
await p.getByRole('tab',{name:/Escala/}).first().click().catch(()=>{}); await p.waitForTimeout(1200); t=await txt(p);
ok(/Dia 1 de 14/.test(t),'Offline: escala funciona');
await ctx.setOffline(false); await ctx.close();

// ── 37. Minha Mala: sem login, editável, persistente ──
({ctx,p}=await nova({seed:{ownews_minha_escala:ESCALA('2026-10-24'),owbuddy_home_prefs:{v:3,dicaVista:true}},cenario:'trial_terminou'}));
await vai(p,'/mala',2200); t=await txt(p);
ok(t.includes('Vai lembrando. Eu guardo pra você.')&&!/Conhecer Premium|OWBuddy\+/.test(t),'Minha Mala abre sem conta e sem portão (Premium expirado)');
const tabs=await p.evaluate(()=>[...document.querySelectorAll('[role="tab"]')].map(e=>e.innerText.replace(/\s+/g,' ').trim()));
ok(tabs.some(x=>/(^|[^\p{L}])Minha Mala$/u.test(x)),'Aba se chama "Minha Mala": '+JSON.stringify(tabs));
await p.getByPlaceholder('Ex.: carregador, chinelo, remédio').fill('Café');
await rotulo(p,'Aumentar quantidade',300);
await p.getByRole('checkbox',{name:'Usar em todos os embarques'}).last().click(); await p.waitForTimeout(300);
await rotulo(p,'Adicionar item',1000);
await p.getByPlaceholder('Ex.: carregador, chinelo, remédio').fill('Carregador do notebook');
await p.getByRole('checkbox',{name:'Usar em todos os embarques'}).last().click(); await p.waitForTimeout(300);
await rotulo(p,'Adicionar item',1000);
t=await txt(p); ok(/Café × 2 só neste embarque/.test(t),'Café × 2 (só neste embarque)');
ok(t.includes('Carregador do notebook')&&!/Carregador do notebook só neste/.test(t),'Carregador do notebook (todos os embarques)');
await rotulo(p,'Editar ou excluir Café',800);
await p.getByLabel('Nome do item').fill('Café especial');
await rotulo(p,'Aumentar quantidade',300);
await p.screenshot({path:OUT+'/m1-editar-item.png'});
await clica(p,'Salvar',1000);
await rotulo(p,'Editar ou excluir Fone de ouvido',800); await clica(p,'Ocultar da minha lista',1000);
t=await txt(p); ok(/Café especial × 3/.test(t)&&!t.includes('Fone de ouvido'),'Editado para Café especial × 3; Fone de ouvido excluído da lista');
await rotulo(p,'Editar ou excluir Café especial',800); t=await txt(p);
ok(t.includes('Subir')&&t.includes('Descer')&&t.includes('Quantidade'),'Painel do item: quantidade e ordem à vista');
await rotulo(p,'Subir item',600); await clica(p,'Cancelar',600);
const ordem=await p.evaluate(()=>JSON.parse(localStorage.getItem('ownews_checklist_mala')).items.filter(i=>i.cat==='personalizados').map(i=>i.t));
ok(ordem.indexOf('Café especial')<ordem.indexOf('Carregador do notebook'),'Reorganizar: Café especial subiu '+JSON.stringify(ordem));
await rotulo(p,'Carregador do notebook',600);
await vai(p,'/mala',2000); t=await txt(p);
ok(/Café especial × 3/.test(t)&&t.includes('Carregador do notebook')&&!t.includes('Fone de ouvido'),'Fechar e abrir: tudo permanece');
const marcado=await p.evaluate(()=>JSON.parse(localStorage.getItem('ownews_checklist_mala')).items.find(i=>i.t==='Carregador do notebook').ok);
ok(marcado===true,'Marcação persiste');
ok(!(await ovf(p)),'Mala 390: sem rolagem lateral');
await p.screenshot({path:OUT+'/m2-mala.png',fullPage:true});
await ctx.setOffline(true); await p.getByRole('tab',{name:/Escala/}).first().click(); await p.waitForTimeout(900);
await p.getByRole('tab',{name:/Minha Mala/}).first().click(); await p.waitForTimeout(1200);
await rotulo(p,'Item 0',400).catch(()=>{}); t=await txt(p);
ok(/Café especial × 3/.test(t),'Offline: Minha Mala funciona');
await ctx.setOffline(false);

// ── 38. Novo ciclo: recorrente fica, "só este embarque" não volta ──
await p.clock.setFixedTime(new Date('2026-11-12T12:00:00-03:00'));
await vai(p,'/mala',2200); t=await txt(p);
ok(t.includes('Carregador do notebook')&&!t.includes('Café especial'),'Novo ciclo: Carregador do notebook continua; Café especial (só este) não volta');
const cicloNovo=await p.evaluate(()=>JSON.parse(localStorage.getItem('ownews_checklist_mala')));
ok(cicloNovo.items.every(i=>!i.ok)&&!cicloNovo.items.some(i=>i.id==='fone'),'Novo ciclo: tudo desmarcado; item excluído continua fora');
await ctx.close();

// ── 39. Histórico: registros do período continuam depois que ele termina ──
({ctx,p}=await nova({seed:DADOS,cenario:'trial_ativo'}));
await vai(p,'/historico',2000); t=await txt(p);
ok(/Desde 2018/i.test(t)&&/6\s*embarques/.test(t)&&/dias embarcado/.test(t),'Período ativo: resumo de carreira (Premium) visível');
await vai(p,'/buddy-config'); t=await txt(p); ok(t.includes('Premium ativo · 32 dias restantes'),'Meu Buddy: "Premium ativo · 32 dias restantes"');
await cenario(p,'trial_terminou'); await vai(p,'/historico',2000); t=await txt(p);
const linhas=await p.evaluate(()=>[...document.querySelectorAll('[role="button"]')].filter(e=>/^P-7\d/.test(e.innerText.trim())).length);
ok(linhas===6,'Período terminou: os 6 registros continuam na lista ('+linhas+')');
ok(!/Desde 2018/i.test(t)&&t.includes('Histórico de carreira')&&t.includes('Registrar embarque'),'Resumo de carreira vira cartão Premium; registrar continua');
ok(!/embarques? · [\d.]+ dias embarcado/.test(t),'Totais por ano (dias/unidades) só com Premium; contagem de embarques continua');
await clica(p,'Histórico de carreira',900); t=await txt(p);
ok(t.includes('Conhecer Premium')&&t.includes('Agora não'),'Toque no recurso Premium: explica com [Conhecer Premium] [Agora não]');
await p.screenshot({path:OUT+'/h1-cartao-premium.png'});
await clica(p,'Agora não',700); ok(rota(p)==='/historico','"Agora não" fecha e fica no Histórico');
await p.getByText('P-75',{exact:true}).first().click(); await p.waitForTimeout(1500); t=await txt(p);
ok(t.includes('Editar embarque')&&t.includes('Excluir registro'),'Registro do período: ver, editar e excluir continuam Free');
await vai(p,'/historico-form',1500); t=await txt(p); ok(!/Conhecer Premium/.test(t),'Registrar embarque: Free');
await ctx.close();

// ── Avisos do período (só no Início, uma vez cada) ──
({ctx,p}=await nova({seed:DADOS,cenario:'trial_perto'}));
await vai(p,'/',2500); t=await txt(p);
ok(t.includes('Seu período Premium termina em 2 dias')&&t.includes('Entendi'),'Perto do fim: aviso discreto no Início');
await p.screenshot({path:OUT+'/t1-perto.png',fullPage:true});
await clica(p,'Entendi',1000); t=await txt(p); ok(!t.includes('termina em 2 dias'),'Aviso some depois de "Entendi"');
await vai(p,'/mala',1500); t=await txt(p); ok(!/termina em|dias restantes/.test(t),'Sem contagem em outras telas');
await cenario(p,'trial_terminou'); await vai(p,'/',2500); t=await txt(p);
ok(t.includes('Seu período Premium terminou')&&t.includes('Sua Escala, Minha Mala e seus dados continuam disponíveis normalmente.')&&t.includes('Continuar no Free')&&t.includes('Conhecer Premium'),'Fim: explicação + [Conhecer Premium] [Continuar no Free]');
await p.screenshot({path:OUT+'/t2-fim.png',fullPage:true});
ok(/Minha Mala\s*Mala: 3 de 12/.test(t),'Free: atalho da Minha Mala com a contagem real');
await clica(p,'Continuar no Free',1000); t=await txt(p); ok(!t.includes('Seu período Premium terminou'),'"Continuar no Free" fecha o aviso');
await vai(p,'/proximos',1800); t=await txt(p);
ok(t.includes('Buddy cuida do seu ciclo')&&!/Viagem amanhã|CBSP/.test(t),'Free: Buddy Agora sem cruzamento + cartão Premium');
await cenario(p,'trial_ativo'); await vai(p,'/proximos',1800); t=await txt(p);
ok(!t.includes('Buddy cuida do seu ciclo')&&/CBSP|viagem|Viagem/.test(t),'Premium: Buddy Agora cruza viagem/documentos');
await vai(p,'/owbuddy-plus',2000); t=await txt(p);
for(const s of ['Premium ativo · 32 dias restantes','sem cobrança','O Premium acrescenta','Do OWBuddy Free, para sempre','Minha Mala completa, editável e offline','Modo de teste: preço e período fictícios. Nada é cobrado.']) ok(t.toLowerCase().includes(s.toLowerCase()),'Tela Premium: "'+s+'"');
ok(!/OWBuddy\+|última chance|melhor valor|perderá/i.test(t),'Tela Premium: sem nome antigo e sem urgência');
await p.screenshot({path:OUT+'/p1-premium.png',fullPage:true});
await ctx.close();

// ── Responsivo 320–430, escuro e claro ──
for(const esquema of ['dark','light']) for(const W of [320,360,375,390,412,430]){
  ({ctx,p}=await nova({W,esquema,seed:DADOS,cenario:'trial_terminou'}));
  let tudo=true;
  for(const r of ['/','/mala','/historico','/owbuddy-plus','/proximos','/buddy-config']){ await vai(p,r,1300); if(await ovf(p)){tudo=false; ok(false,`${W} ${esquema} ${r}: rolagem lateral`);} }
  await vai(p,'/mala',1300); await rotulo(p,'Editar ou excluir Item 3',700);
  const alvos=await p.evaluate(()=>['Diminuir quantidade','Aumentar quantidade','Subir item','Descer item'].map(l=>{const e=[...document.querySelectorAll(`[aria-label="${l}"]`)].pop(); if(!e) return null; const r=e.getBoundingClientRect(); return Math.min(r.width,r.height);}));
  if(alvos.some(a=>a===null||a<44)){tudo=false; ok(false,`${W} ${esquema}: alvos de toque do painel da mala ${JSON.stringify(alvos)}`);}
  if(await ovf(p)){tudo=false; ok(false,`${W} ${esquema}: painel do item com rolagem lateral`);}
  const corte=await p.evaluate(()=>[...document.querySelectorAll('[role="tab"] div')].filter(e=>e.children.length===0&&/^Minha Mala$/.test(e.innerText.trim())).map(e=>e.scrollWidth>e.clientWidth+1));
  if(corte.length!==1||corte[0]){tudo=false; ok(false,`${W} ${esquema}: rótulo "Minha Mala" cortado ${JSON.stringify(corte)}`);}
  if(W===320||W===430){ await p.screenshot({path:`${OUT}/r-${esquema}-${W}-mala-editar.png`}); await vai(p,'/',1500); await p.screenshot({path:`${OUT}/r-${esquema}-${W}-home.png`,fullPage:true}); }
  ok(tudo,`${W}px ${esquema}: Início, Mala (+painel), Histórico, Premium, Próximos e Meu Buddy sem rolagem lateral; toques ≥ 44 px; "Minha Mala" inteiro`);
  await ctx.close();
}

console.log((errs.length?'FALHA':'OK  ')+' Erros JS: '+JSON.stringify(errs.slice(0,5)));
if(errs.length) falhas++;
console.log('FALHAS='+falhas); await b.close(); process.exit(falhas?1:0);
})();
