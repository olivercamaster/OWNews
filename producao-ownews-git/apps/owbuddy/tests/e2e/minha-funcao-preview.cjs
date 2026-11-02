// Minha Função no preview web (Playwright, fora do npm test).
// Uso: PLAYWRIGHT=<pacote playwright> U=http://127.0.0.1:8791 OUT=/tmp/x node tests/e2e/minha-funcao-preview.cjs
// Catálogo = fixture gerada do worker real do OWNews (/api/buddy/funcoes); vagas = títulos reais do Radar de Vagas.
const {chromium}=require(process.env.PLAYWRIGHT); const PLUS=require('./_plus.cjs');
const fs=require('fs'), path=require('path');
const U=process.env.U||'http://127.0.0.1:8791', OUT=process.env.OUT||'/tmp';
const CAT=fs.readFileSync(path.join(__dirname,'..','fixtures-catalogo-funcoes.json'),'utf8');
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const txt=p=>p.evaluate(()=>document.body.innerText.replace(/[-]/g,'').replace(/\s+/g,' '));
const dia=n=>{const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10);};
const ESCALA={ownews_minha_escala:{tipo:'14x14',dataRef:dia(-8),tipoRef:'embarquei',aeroporto:'SBJR'},owbuddy_home_prefs:{v:3,dicaVista:true}};
const agoraISO=new Date().toISOString();
const vaga=(id,titulo,categoria)=>({id,titulo,empresa:'Foresea',local:'Macaé',offshore_onshore:'OFFSHORE',resumo:'Vaga publicada no portal oficial.',application_url:'https://exemplo.com/'+id,verificado_em:agoraISO,categoria});
const VAGAS=[vaga('v1','Sondador Cyber | Cyber Driller','perfuracao'),vaga('v2','Técnico de Segurança do Trabalho Offshore Temporário','sms'),vaga('v3','Operadora(o) de Convés (CONTRATO POR TEMPO DETERMINADO)','conves'),
  vaga('v4','Engenheiro (a) de Processos Jr.','engenharia'),vaga('v5','Deck Pusher','conves'),vaga('v6','Estagiário(a) de QSMS','sms'),vaga('v7','Assistant Driller','perfuracao')];
const art=(id,h,title)=>({id,title,summary:null,corpo:'Parágrafo um.\n\nParágrafo dois.',buddy_summary:'Resumo.',why_it_matters:'Impacto.',image_url:null,image_credit:'Eixos',original_url:'https://exemplo.com/'+id,published_at:new Date(Date.now()-h*3600e3).toISOString(),editorial_score:80,url:'https://ownews.com.br/noticia?id='+id,explica:[]});
const FEED=[art('n1',1,'Foresea contrata Cyber Driller para nova sonda no pré-sal'),art('n2',2,'Petrobras anuncia nova FPSO para Búzios')];

(async()=>{const b=await chromium.launch({args:['--no-sandbox']}); const errs=[]; const pedidos=[];
async function nova({W=390,esquema='dark',seed=ESCALA,catalogo=true}={}){
  const ctx=await b.newContext({viewport:{width:W,height:844},deviceScaleFactor:2,colorScheme:esquema}); await PLUS(ctx,'trial_ativo');
  await ctx.addInitScript(d=>{try{if(!sessionStorage.getItem('s')){localStorage.clear();for(const[k,v]of Object.entries(d))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('s','1');}}catch(e){}},seed);
  await ctx.route(/\/api\/buddy\/funcoes/,r=>catalogo?r.fulfill({status:200,contentType:'application/json',body:CAT}):r.abort());
  await ctx.route(/\/api\/buddy\/vagas/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({vagas:VAGAS,updated_at:agoraISO})}));
  await ctx.route(/\/api\/buddy\/feed/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({articles:FEED,schema_version:2})}));
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  p.on('request',r=>{const u=r.url(); if(/ownews\.com\.br|supabase|analytics|posthog/.test(u)) pedidos.push(u+' '+(r.postData()||''));});
  return {ctx,p};}
const vai=async(p,r,ms=2200)=>{await p.goto(U+r,{waitUntil:'networkidle'}).catch(()=>{}); await p.waitForTimeout(ms);};
const ls=(p,k)=>p.evaluate(k=>localStorage.getItem(k),k);

// Usuário existente/novo sem função: convite na Home; "Agora não" pausa
let {ctx,p}=await nova(); await vai(p,'/'); let t=await txt(p);
ok(/DEIXE O BUDDY MAIS SEU/i.test(t)&&t.includes('Adicionar minha função'),'Home: convite aparece para quem não informou função');
await p.screenshot({path:OUT+'/f1-home-convite-390-dark.png'});
await p.getByText('Agora não',{exact:true}).click(); await p.waitForTimeout(600); await vai(p,'/'); t=await txt(p);
ok(!t.includes('Adicionar minha função'),'"Agora não": convite não volta na próxima abertura');
ok(!!(await ls(p,'owbuddy_minha_funcao_convite')),'pausa guardada no aparelho');
await ctx.close();

// Pular: app segue normal, nada gravado
({ctx,p}=await nova()); await vai(p,'/minha-funcao'); t=await txt(p);
ok(t.includes('Qual é a sua função no offshore?')&&t.includes('Isso ajuda o Buddy a priorizar vagas'),'Tela: pergunta + aviso do porquê');
ok(t.includes('Ainda não trabalho offshore')&&t.includes('Pular'),'Opções: ainda não trabalho / pular');
await p.screenshot({path:OUT+'/f2-form-390-dark.png',fullPage:true});
await p.getByText('Pular',{exact:true}).click(); await p.waitForTimeout(800);
ok(await ls(p,'owbuddy_minha_funcao')===null,'Pular não grava nada');
await vai(p,'/vagas'); t=await txt(p); ok(t.includes('Deck Pusher')&&t.includes('Informe sua função'),'Vagas sem função: lista completa + convite discreto');
await ctx.close();

// Deck Pusher: autocomplete, salvar, alertas OFF por padrão, persistência, Vagas, Home
({ctx,p}=await nova()); await vai(p,'/minha-funcao');
await p.getByLabel('Buscar função').fill('deck'); await p.waitForTimeout(500);
await p.screenshot({path:OUT+'/f3-autocomplete-390-dark.png'});
await p.getByLabel(/^Deck Pusher, Deck/).click(); await p.waitForTimeout(300);
t=await txt(p); ok(t.includes('Deck Pusher · Deck'),'Autocomplete: "deck" → Deck Pusher (área preenchida)');
await p.getByText('Salvar',{exact:true}).click(); await p.waitForTimeout(800);
let mf=JSON.parse(await ls(p,'owbuddy_minha_funcao'));
ok(mf&&mf.funcao.slug==='deck-pusher'&&mf.area==='deck'&&mf.alertas===false,'Salvo local: deck-pusher, área deck, alertas desligados (consentimento separado)');
t=await txt(p); ok(t.includes('MINHA FUNÇÃO')&&t.includes('Ver carreira: Deck Pusher')&&t.includes('Função relacionada'),'Minha Função: carreira + funções relacionadas do OWNews');
await p.screenshot({path:OUT+'/f4-minha-funcao-390-dark.png',fullPage:true});
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1500); t=await txt(p);
ok(t.includes('MINHA FUNÇÃO')&&t.includes('Deck Pusher'),'Fecha/reabre: continua salvo');
await vai(p,'/vagas'); t=await txt(p);
ok(t.includes('Para minha função')&&t.includes('Todas as vagas'),'Vagas: abas Para minha função / Todas');
ok(/Deck Pusher Sua função/.test(t),'Vaga exata com motivo "Sua função"');
ok(t.includes('TAMBÉM NA SUA ÁREA')&&t.includes('Sua área: Deck'),'Vaga só da área em seção separada');
ok(!t.includes('Engenheiro (a) de Processos'),'Vaga incompatível não aparece em "Para minha função"');
await p.screenshot({path:OUT+'/f5-vagas-funcao-390-dark.png',fullPage:true});
await p.getByText('Todas as vagas',{exact:true}).click(); await p.waitForTimeout(500); t=await txt(p);
ok(t.includes('Engenheiro (a) de Processos')&&t.includes('Sondador Cyber'),'Todas: mercado inteiro continua visível');
await vai(p,'/',3000); t=await txt(p); ok(/1 relacionada à sua função/.test(t),'Home: linha de Vagas diz quantas combinam (sem avisos: sem "novas")');
ok(!t.includes('Adicionar minha função'),'Com função: sem convite');
await p.screenshot({path:OUT+'/f6-home-funcao-390-dark.png'});
await ctx.close();

// Driller: notícia marcada; geral continua; alertas ON → "novas"; trocar; remover
({ctx,p}=await nova({seed:{...ESCALA,owbuddy_minha_funcao:{v:1,situacao:'trabalho',area:'drilling',funcao:{slug:'driller',nome:'Driller'},texto_livre:null,alertas:true,definida_em:agoraISO}}}));
await vai(p,'/noticias',2500); t=await txt(p);
ok(/Cyber Driller.{0,120}Relacionado à sua função/.test(t),'Notícia que nomeia a função ganha o sinal');
ok(t.includes('Petrobras anuncia nova FPSO para Búzios'),'Notícia geral continua no feed');
await vai(p,'/',3000); t=await txt(p); ok(/novas? para sua função/.test(t),'Avisos ligados: Home avisa vaga nova da função');
await vai(p,'/vagas'); t=await txt(p); ok(/Sondador Cyber.{0,80}Sua função/.test(t)&&/Assistant Driller.{0,60}Função relacionada/.test(t),'Driller: Cyber Driller exata, Assistant Driller relacionada');
await vai(p,'/',3000); t=await txt(p); ok(!/novas? para sua função/.test(t)&&/relacionadas? à sua função/.test(t),'Depois de ver Vagas: "novas" some');
await vai(p,'/minha-funcao'); await p.getByText('Alterar',{exact:true}).click(); await p.waitForTimeout(400);
await p.getByLabel('Trocar função').click(); await p.getByLabel('Buscar função').fill('tecnico de seg'); await p.waitForTimeout(400);
await p.getByLabel(/^Técnico de Segurança do Trabalho,/).click(); await p.getByText('Salvar',{exact:true}).click(); await p.waitForTimeout(800);
mf=JSON.parse(await ls(p,'owbuddy_minha_funcao')); ok(mf.funcao.slug==='tecnico-seguranca-trabalho'&&mf.area==='seguranca','Trocou para Técnico de Segurança');
await vai(p,'/vagas'); t=await txt(p); ok(/Técnico de Segurança do Trabalho Offshore Temporário.{0,40}Sua função/.test(t)&&!/Sondador Cyber.{0,80}Sua função/.test(t),'Recomendações seguem a nova função');
await p.screenshot({path:OUT+'/f7-vagas-tst-390-dark.png',fullPage:true});
await vai(p,'/minha-funcao'); await p.getByText('Remover',{exact:true}).click(); await p.waitForTimeout(900);
ok(await ls(p,'owbuddy_minha_funcao')===null,'Remover apaga a função');
await ctx.close();

// Quero embarcar + área de interesse; não é tratado como quem exerce
({ctx,p}=await nova()); await vai(p,'/minha-funcao');
await p.getByText('Ainda não trabalho offshore',{exact:true}).click(); await p.waitForTimeout(300);
t=await txt(p); ok(t.includes('Quero embarcar. Se quiser, diga em qual área')&&t.includes('ÁREA DE INTERESSE (OPCIONAL)'),'Quero embarcar: área/função de interesse opcionais');
await p.getByText('Segurança',{exact:true}).click(); await p.getByText('Salvar',{exact:true}).click(); await p.waitForTimeout(800);
mf=JSON.parse(await ls(p,'owbuddy_minha_funcao')); ok(mf.situacao==='quero_embarcar'&&mf.area==='seguranca'&&!mf.funcao,'Salvo como quero embarcar · Segurança');
t=await txt(p); ok(t.includes('Quero embarcar · Segurança')&&t.includes('PARA COMEÇAR')&&t.includes('Comece aqui'),'Conteúdo para começar (guias reais)');
await p.screenshot({path:OUT+'/f8-quero-embarcar-390-dark.png',fullPage:true});
await vai(p,'/vagas'); t=await txt(p);
ok(t.includes('Para começar')&&/Estagiário\(a\) de QSMS.{0,40}Para começar em Segurança/.test(t),'Vagas: estágio da área como "para começar"');
ok(!/Técnico de Segurança do Trabalho Offshore Temporário.{0,40}(Sua função|Para começar)/.test(t),'Vaga de quem já é técnico não vira "para começar"');
await ctx.close();

// Função não encontrada (texto livre) e catálogo offline
({ctx,p}=await nova()); await vai(p,'/minha-funcao');
await p.getByText('Engine/Máquinas',{exact:true}).click(); await p.getByLabel('Buscar função').fill('Operador de Sala de Controle');
await p.getByText('Não encontrei minha função',{exact:true}).click(); await p.waitForTimeout(300);
await p.getByText('Salvar',{exact:true}).click(); await p.waitForTimeout(800);
mf=JSON.parse(await ls(p,'owbuddy_minha_funcao')); ok(mf.texto_livre==='Operador de Sala de Controle'&&!mf.funcao&&mf.area==='engine','Texto livre guardado à parte (não vira função do catálogo)');
await ctx.close();
({ctx,p}=await nova({catalogo:false})); await vai(p,'/minha-funcao'); t=await txt(p);
ok(t.includes('Sem conexão para carregar a lista de funções')&&t.includes('Pular'),'Primeiro uso offline: escrever à mão ou configurar depois');
await vai(p,'/',2500); t=await txt(p); ok(t.includes('Aeroportos')&&t.includes('Vagas'),'Home não quebra sem catálogo');
await ctx.close();

// Apagar dados do aparelho remove a função; Minha Unidade e Escala intactas
({ctx,p}=await nova({seed:{...ESCALA,owbuddy_minha_unidade:{v:1,nome:'West Jupiter',radar:null,definida_em:'x'},owbuddy_minha_funcao:{v:1,situacao:'trabalho',area:'deck',funcao:{slug:'deck-pusher',nome:'Deck Pusher'},texto_livre:null,alertas:false,definida_em:agoraISO}}}));
await vai(p,'/escala',2500); t=await txt(p); ok(t.includes('Minha Unidade West Jupiter')&&t.includes('Minha Função Deck Pusher'),'Escala: atalhos de Minha Unidade e Minha Função lado a lado');
const escalaAntes=await ls(p,'ownews_minha_escala');
await vai(p,'/minha-funcao'); await p.getByText('Alterar',{exact:true}).click(); await p.getByText('Cancelar',{exact:true}).click();
ok(await ls(p,'ownews_minha_escala')===escalaAntes,'Escala intacta');
await p.evaluate(()=>{for(const k of Object.keys(localStorage)) if(k.startsWith('owbuddy_')||k.startsWith('ownews_')) localStorage.removeItem(k);});
ok(await ls(p,'owbuddy_minha_funcao')===null,'Apagar dados do aparelho (prefixo owbuddy_) remove a função');
await ctx.close();

// Privacidade: nenhum pedido carrega a função
ok(!pedidos.some(u=>/deck-pusher|driller|tecnico-seguranca|Deck Pusher|minha_funcao/i.test(decodeURIComponent(u))&&!/\/api\/buddy\/(funcoes|vagas|feed)$/.test(u.split(' ')[0])),'Nenhum pedido de rede leva a função da pessoa ('+pedidos.length+' pedidos)');

// Responsivo 320–430, escuro e claro: formulário, autocomplete, vagas
for(const esquema of ['dark','light']) for(const W of [320,360,375,390,412,430]){
  ({ctx,p}=await nova({W,esquema,seed:{...ESCALA,owbuddy_minha_funcao:{v:1,situacao:'trabalho',area:'deck',funcao:{slug:'deck-pusher',nome:'Deck Pusher'},texto_livre:null,alertas:true,definida_em:agoraISO}}}));
  let bom=true; for(const r of ['/minha-funcao','/vagas','/']){await vai(p,r,1700); if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)){bom=false;ok(false,`${W} ${esquema} ${r}: rolagem lateral`);}}
  await vai(p,'/minha-funcao',1500); await p.getByText('Alterar',{exact:true}).click(); await p.getByLabel('Trocar função').click(); await p.getByLabel('Buscar função').fill('sup'); await p.waitForTimeout(400);
  if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)){bom=false;ok(false,`${W} ${esquema} autocomplete: rolagem lateral`);}
  if([320,430].includes(W)||(W===390&&esquema==='light')) await p.screenshot({path:`${OUT}/f9-form-${W}-${esquema}.png`,fullPage:true});
  if(W===390&&esquema==='light'){await vai(p,'/vagas',1500); await p.screenshot({path:`${OUT}/f9-vagas-390-light.png`,fullPage:true});}
  ok(bom,`${W}px ${esquema}: Minha Função, Vagas, Home e autocomplete sem rolagem lateral`); await ctx.close();
}
console.log((errs.length?'FALHA':'OK  ')+' Erros JS: '+JSON.stringify(errs.slice(0,5))); if(errs.length) falhas++;
console.log('FALHAS='+falhas); await b.close(); process.exit(falhas?1:0);})();
