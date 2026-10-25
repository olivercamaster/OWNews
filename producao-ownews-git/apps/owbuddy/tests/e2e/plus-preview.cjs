// OWBuddy Free + OWBuddy+ no preview web (Playwright, fora do npm test). Loja SIMULADA (modo de teste).
// Uso: PLAYWRIGHT=<pacote playwright> U=http://127.0.0.1:8791 [UPROD=http://127.0.0.1:8792] OUT=/tmp/x node tests/e2e/plus-preview.cjs
// UPROD (opcional) = mesmo app exportado SEM a flag de teste: prova que não há cenário nem painel.
const {chromium}=require(process.env.PLAYWRIGHT); const PLUS=require('./_plus.cjs');
const U=process.env.U||'http://127.0.0.1:8791', UPROD=process.env.UPROD, OUT=process.env.OUT;
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const txt=p=>p.evaluate(()=>document.body.innerText.replace(/[-]/g,'').replace(/\s+/g,' '));
const ESCALA={v:2,data:{tipo:'14x14',dataRef:'2026-10-16',tipoRef:'embarquei',origem:'dispositivo',updated_at:'2026-10-20T10:00:00.000Z'},updated_at:'2026-10-20T10:00:00.000Z'};
const AGORA='2026-10-24T12:00:00.000Z';
const reg=i=>({id:'he_'+i,embarque:`20${18+i}-03-01`,desembarque:`20${18+i}-03-15`,fonte:'manual',criado_em:AGORA,updated_at:AGORA});
const DADOS={
  ownews_minha_escala:ESCALA,
  owbuddy_home_prefs:{v:3,dicaVista:true},
  ownews_checklist_mala:{items:Array.from({length:12},(_,i)=>({id:'i'+i,t:'Item secreto '+i,cat:'Roupas',ok:i<3})),ciclo:null},
  ownews_certificados:[{id:'c1',nome:'CBSP',validade:'2026-11-02'},{id:'c2',nome:'HUET',validade:'2027-05-01'}],
  ownews_minha_viagem:{tipo:'AVIAO',data:'2026-10-30',hora:'08:40',origem:'GRU',destino:'Macaé',localizador:'XYZ123'},
  owbuddy_contatos_embarque:[{id:'k1',nome:'Logística Base',tipo:'LOGISTICA',telefone:'22999990000'}],
  owbuddy_historico:{v:1,registros:[0,1,2,3,4,5].map(reg),acontecimentos:[],seq:12},
};
const CHAVES_DADOS=Object.keys(DADOS);
(async()=>{const b=await chromium.launch({args:['--no-sandbox']}); const errs=[]; const dialogos=[]; let resposta=true;
async function nova(cenario,{W=390,esquema='dark',seed=DADOS,base=U}={}){
  const ctx=await b.newContext({viewport:{width:W,height:844},deviceScaleFactor:2,colorScheme:esquema,timezoneId:'America/Sao_Paulo'});
  await ctx.addInitScript(d=>{try{if(!sessionStorage.getItem('s')){localStorage.clear();for(const[k,v]of Object.entries(d))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('s','1');}}catch(e){}},seed);
  if(cenario) await PLUS(ctx,cenario);
  const p=await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-10-24T12:00:00-03:00'));
  p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>{dialogos.push(d.message()); resposta?d.accept():d.dismiss();});
  p.base=base; return {ctx,p};
}
const vai=async(p,rota,ms=1600)=>{await p.goto(p.base+rota,{waitUntil:'networkidle'}); await p.waitForTimeout(ms);};
const clica=async(p,texto,ms=1000)=>{await p.getByText(texto,{exact:true}).last().click(); await p.waitForTimeout(ms);};
const dados=p=>p.evaluate(ks=>Object.fromEntries(ks.map(k=>[k,localStorage.getItem(k)])),CHAVES_DADOS);
const ovf=p=>p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
const rota=p=>new URL(p.url()).pathname;

// ── A. Free com período gratuito disponível ──
let {ctx,p}=await nova('free_trial');
await vai(p,'/',2500); const antes=await dados(p); let t=await txt(p);
ok(rota(p)==='/','Abrir o app NÃO abre paywall');
ok(!/Mala: \d+ de \d+|Faltam \d+ itens/.test(t),'Início Free: sem dados da mala no cálculo');
ok(!/CBSP/.test(t),'Início Free: alerta de documento (Plus) fora');
ok((t.match(/OWBuddy\+/g)||[]).length===3,'Início Free: selo discreto só nos 3 atalhos Plus ('+(t.match(/OWBuddy\+/g)||[]).length+')');
ok(/Meu Embarque\s*Mala inteligente/.test(t)&&/Minha Viagem\s*Voo, transfer e contatos/.test(t),'Atalhos Plus descrevem o recurso');
await p.screenshot({path:OUT+'/a1-home-free.png',fullPage:true});
await vai(p,'/mala'); t=await txt(p);
ok(t.includes('Mala inteligente')&&t.includes('Os 12 itens da sua mala continuam guardados.')&&t.includes('Nada foi apagado'),'Embarque bloqueado: explica e diz que os 12 itens continuam guardados');
ok(t.includes('Conhecer OWBuddy+')&&t.includes('Agora não')&&!t.includes('Item secreto'),'Bloqueio: Conhecer / Agora não; conteúdo da mala não aparece');
ok(rota(p)==='/mala','Bloqueio na própria aba (não abre checkout)');
await p.screenshot({path:OUT+'/a2-mala-bloqueada.png',fullPage:true});
await clica(p,'Agora não',1500); ok(rota(p)==='/','"Agora não" volta ao Início');
await vai(p,'/historico'); t=await txt(p);
ok(t.includes('Meu Histórico')&&t.includes('Seus 6 embarques registrados continuam guardados.'),'Histórico bloqueado: "Seus 6 embarques registrados continuam guardados."');
await vai(p,'/certs'); t=await txt(p); ok(t.includes('Documentos e vencimentos')&&t.includes('Seus 2 documentos continuam guardados.'),'Documentos bloqueado com contagem');
await vai(p,'/viagem'); t=await txt(p); ok(t.includes('Viagem e logística')&&t.includes('Sua viagem continua guardada.')&&!t.includes('XYZ123'),'Viagem bloqueada, localizador não aparece');
await vai(p,'/contato-form'); t=await txt(p); ok(t.includes('Contatos de embarque')&&t.includes('Seu contato de embarque continua guardado.'),'Contatos bloqueado');
await vai(p,'/escala'); t=await txt(p); ok(/Meu Histórico[\s\S]*OWBuddy\+/.test(t)&&/Outubro 2026/.test(t),'Escala (Free) funciona; atalho do Histórico com selo');
await vai(p,'/proximos'); t=await txt(p); ok(t.includes('Buddy Agora completo')&&!/CBSP|Mala/.test(t.replace('Mala, viagem e documentos também entram aqui.','')),'Buddy Agora básico + uma linha discreta do completo');
const depoisPortoes=await dados(p);
ok(JSON.stringify(antes)===JSON.stringify(depoisPortoes),'Nenhum dado alterado ao passar pelos bloqueios');
await vai(p,'/historico'); await clica(p,'Conhecer OWBuddy+',1800);
ok(rota(p)==='/owbuddy-plus','Conhecer OWBuddy+ abre a tela informativa (não a compra)');
ok(dialogos.length===0,'Nenhuma confirmação de compra aberta sem toque no botão');
t=await txt(p);
for(const s of ['Você está no OWBuddy Free','Com OWBuddy+ você libera','Mala inteligente','Meu Histórico','Linha do tempo offshore','Estatísticas do histórico','Contatos de embarque','Buddy Agora completo','1 mês grátis','Depois, R$ 0,00/mês',
  'Após o período gratuito de 1 mês, a assinatura passa a ser R$ 0,00/mês, salvo cancelamento.','Experimentar OWBuddy+','Renovação automática todo mês até você cancelar','O OWBuddy Free continua funcionando normalmente.',
  'nada é apagado','Restaurar compras','Gerenciar assinatura','Continuar no Free','Continua no OWBuddy Free','Não precisa de Conta OW','A assinatura é gerenciada pela loja onde foi contratada','Modo de teste: preço e período fictícios. Nada é cobrado.','Política de privacidade'])
  ok(t.toLowerCase().includes(s.toLowerCase()),'OWBuddy+ (trial elegível): "'+s+'"');  // rótulos de seção são caixa-alta
ok(!/última chance|best value|melhor valor|perderá/i.test(t),'Sem urgência/ameaça');
const estilo=await p.evaluate(()=>{const el=[...document.querySelectorAll('div')].find(d=>d.childElementCount===0&&d.textContent.startsWith('Após o período gratuito'));if(!el)return null;const s=getComputedStyle(el);return {fs:parseFloat(s.fontSize),cor:s.color};});
ok(estilo&&estilo.fs>=15,'Aviso de cobrança legível junto ao botão ('+(estilo&&estilo.fs)+'px)');
const ordem=await p.evaluate(()=>{const b=document.body.innerText;return b.indexOf('Após o período gratuito')<b.indexOf('Experimentar OWBuddy+');});
ok(ordem,'Aviso de cobrança vem ANTES do botão');
await p.screenshot({path:OUT+'/a3-plus-trial.png',fullPage:true});
// Restaurar sem compra
await clica(p,'Restaurar compras',1200); t=await txt(p); ok(t.includes('Nenhuma assinatura do OWBuddy+ foi encontrada nesta conta da loja.'),'Restaurar: nenhuma compra encontrada');
// Compra: só com toque; cancelar na confirmação não muda nada
resposta=false; await clica(p,'Experimentar OWBuddy+',1500);
ok(dialogos.some(d=>/nada é cobrado/i.test(d)),'Toque no botão abre a confirmação (da loja; aqui simulada)');
t=await txt(p); ok(t.includes('Você está no OWBuddy Free'),'Cancelar a confirmação: continua Free');
resposta=true; await p.getByText('Experimentar OWBuddy+',{exact:true}).last().dblclick(); await p.waitForTimeout(2200);
ok(dialogos.length===2,'Duplo toque: uma só confirmação de compra ('+dialogos.length+')');
t=await txt(p); ok(t.includes('OWBuddy+ ativo')&&t.includes('Gerenciar assinatura')&&!t.includes('Experimentar OWBuddy+'),'Depois de assinar: OWBuddy+ ativo, sem botão de compra');
ok(!/Próxima renovação/.test(t),'Sem data de renovação inventada (a loja não informou)');
await p.screenshot({path:OUT+'/a4-plus-ativo.png',fullPage:true});
await vai(p,'/mala'); t=await txt(p); ok(t.includes('Item secreto 0')&&!t.includes('Conhecer OWBuddy+'),'Plus: mala liberada com os MESMOS itens');
await vai(p,'/historico'); t=await txt(p); ok(/6\s*embarques/.test(t),'Plus: os 6 embarques reaparecem');
await vai(p,'/',2500); t=await txt(p); ok(!/OWBuddy\+/.test(t),'Plus: Início sem selos');
// a Mala, ao ABRIR com acesso, já normalizava a lista (ciclo/categoria) antes do OWBuddy+: compara o CONTEÚDO
const conteudo=d=>{const o={...d}; const m=JSON.parse(o.ownews_checklist_mala||'null'); o.ownews_checklist_mala=m&&m.items.map(i=>i.id+'|'+i.t+'|'+i.ok).join(','); return JSON.stringify(o);};
ok(conteudo(antes)===conteudo(await dados(p)),'Dados idênticos antes e depois de assinar (itens, viagem, documentos, contatos, histórico)');
await ctx.close();

// ── B. Free sem período gratuito (já usado / não elegível) ──
({ctx,p}=await nova('free_sem_trial'));
await vai(p,'/owbuddy-plus',2200); t=await txt(p);
ok(t.includes('R$ 0,00/mês')&&t.includes('Assinar OWBuddy+')&&t.includes('A assinatura custa R$ 0,00/mês, salvo cancelamento.'),'Não elegível: preço direto + "Assinar OWBuddy+"');
ok(!/grátis|período gratuito/i.test(t),'Não elegível: nenhuma promessa de grátis');
await p.screenshot({path:OUT+'/b-sem-trial.png',fullPage:true});
await ctx.close();

// ── C. Expirado ──
({ctx,p}=await nova('expirado'));
await vai(p,'/',2500); ok(rota(p)==='/','Expirado: app abre no Início (sem paywall)');
t=await txt(p); ok((t.match(/terminou/g)||[]).length===0,'Expirado: Início sem aviso repetido');
await vai(p,'/historico'); t=await txt(p);
ok(t.includes('Seus 6 embarques registrados continuam guardados.')&&t.includes('Seu acesso ao OWBuddy+ terminou. Assine novamente para acessar e continuar usando seu histórico.'),'Expirado: Histórico mostra dados guardados + acesso terminou');
await p.screenshot({path:OUT+'/c-expirado.png',fullPage:true});
await vai(p,'/owbuddy-plus',2200); t=await txt(p); ok(t.includes('Seu acesso ao OWBuddy+ terminou')&&t.includes('Assinando de novo, tudo volta como estava.'),'Expirado: tela OWBuddy+ explica e permite reassinar');
await ctx.close();

// ── D. Cancelado mas ainda ativo ──
({ctx,p}=await nova('plus_cancelado'));
await vai(p,'/owbuddy-plus',2200); t=await txt(p);
ok(t.includes('OWBuddy+ ativo')&&/Renovação automática desligada\. Ativo até \d\d\/\d\d\/\d{4}\./.test(t),'Cancelado: continua ativo até o fim do período');
await vai(p,'/mala'); t=await txt(p); ok(t.includes('Item secreto 0'),'Cancelado: recursos Plus continuam liberados');
await ctx.close();

// ── E. Plus sem internet ──
({ctx,p}=await nova('offline_plus'));
await vai(p,'/historico'); t=await txt(p); ok(/6\s*embarques/.test(t)&&!t.includes('Conhecer OWBuddy+'),'Offline: assinante não vira Free');
await vai(p,'/owbuddy-plus',2200); t=await txt(p); ok(t.includes('Sem conexão com a loja agora. Seu acesso continua liberado.'),'Offline: aviso honesto');
await ctx.close();

// ── F. Carregando ──
({ctx,p}=await nova('carregando'));
await vai(p,'/mala',2000); t=await txt(p); ok(!t.includes('Conhecer OWBuddy+')&&!t.includes('Item secreto'),'Carregando: nem cadeado nem conteúdo (sem piscar)');
await vai(p,'/',2500); t=await txt(p); ok(!/OWBuddy\+/.test(t),'Carregando: Início sem selos');
await vai(p,'/owbuddy-plus',2000); t=await txt(p); ok(t.includes('Verificando seu acesso…')&&!/R\$/.test(t),'Carregando: tela OWBuddy+ sem preço');
await ctx.close();

// ── G. Erro da loja ──
({ctx,p}=await nova('erro'));
await vai(p,'/owbuddy-plus',2200); t=await txt(p);
ok(t.includes('Não foi possível consultar o OWBuddy+ agora.')&&t.includes('Tentar novamente')&&t.includes('Continuar no Free'),'Erro: mensagem + Tentar novamente + Continuar no Free');
ok(!/R\$|grátis/.test(t),'Erro: nenhum preço inventado');
await p.screenshot({path:OUT+'/g-erro.png',fullPage:true});
await vai(p,'/historico'); t=await txt(p); ok(t.includes('Não foi possível confirmar o OWBuddy+ agora.')&&t.includes('Tentar novamente')&&!/terminou/.test(t),'Erro no bloqueio: não diz que acabou');
await ctx.close();

// ── H. Painel de teste troca cenário na hora ──
({ctx,p}=await nova('free_trial'));
await vai(p,'/owbuddy-plus',2200);
await clica(p,'Plus ativo',2200); t=await txt(p); ok(t.includes('OWBuddy+ ativo'),'Painel de teste: Plus ativo');
await clica(p,'Free · trial não elegível',2200); t=await txt(p); ok(t.includes('Assinar OWBuddy+')&&!t.includes('grátis'),'Painel de teste: não elegível');
await vai(p,'/owbuddy-plus?plus=expirado',2200); t=await txt(p); ok(t.includes('Seu acesso ao OWBuddy+ terminou'),'?plus=expirado (só no modo de teste)');
await ctx.close();

// ── I. Meu Buddy: linha OWBuddy+ ──
({ctx,p}=await nova('free_trial'));
await vai(p,'/buddy-config',2200); t=await txt(p); ok(t.includes('OWBuddy+')&&t.includes('Você está no Free · conhecer os recursos Plus'),'Meu Buddy: situação do OWBuddy+');
await ctx.close();

// ── J. Responsivo 320–430, escuro e claro ──
for(const esquema of ['dark','light']) for(const W of [320,360,375,390,412,430]){
  ({ctx,p}=await nova('free_trial',{W,esquema}));
  let tudo=true;
  for(const r of ['/owbuddy-plus','/historico','/mala','/']){ await vai(p,r,1500); if(await ovf(p)) { tudo=false; ok(false,`${W} ${esquema} ${r}: rolagem lateral`); } }
  if(W===320||W===430){ await vai(p,'/owbuddy-plus',1500); await p.screenshot({path:`${OUT}/j-${esquema}-${W}-plus.png`,fullPage:true}); await vai(p,'/historico',1500); await p.screenshot({path:`${OUT}/j-${esquema}-${W}-bloqueio.png`,fullPage:true}); }
  ok(tudo,`${W}px ${esquema}: OWBuddy+, bloqueio, Embarque e Início sem rolagem lateral`);
  await ctx.close();
}

// ── K. Build sem a flag (equivale à produção): sem cenário, sem painel, sem Plus por localStorage ──
if(UPROD){
  ({ctx,p}=await nova('plus',{base:UPROD}));
  await vai(p,'/owbuddy-plus?plus=plus',2200); t=await txt(p);
  ok(!t.includes('Modo de teste')&&!t.includes('Plus ativo'),'Sem flag: nenhum painel/cenário de teste');
  ok(t.includes('A assinatura do OWBuddy+ é feita no app para Android ou iPhone'),'Sem flag (web): sem loja, sem compra');
  await vai(p,'/mala'); t=await txt(p); ok(!t.includes('Item secreto')&&t.includes('Conhecer OWBuddy+'),'Sem flag: cenário "plus" no localStorage NÃO libera nada');
  await ctx.close();
}

console.log((errs.length?'FALHA':'OK  ')+' Erros JS: '+JSON.stringify(errs.slice(0,5)));
if(errs.length) falhas++;
console.log('FALHAS='+falhas); await b.close(); process.exit(falhas?1:0);
})();
