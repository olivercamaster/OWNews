// Meu Histórico (Playwright, fora do npm test). Relógio fixo em 24/10/2026 12:00 (America/Sao_Paulo).
// Uso: PLAYWRIGHT=<pacote playwright> U=http://127.0.0.1:8791 OUT=/tmp/x node tests/e2e/historico-preview.cjs
const {chromium}=require(process.env.PLAYWRIGHT);
const U=process.env.U||'http://127.0.0.1:8791', OUT=process.env.OUT;
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const txt=p=>p.evaluate(()=>document.body.innerText.replace(/[\uE000-\uF8FF]/g,'').replace(/\s+/g,' '));
const ESCALA={v:2,data:{tipo:'14x14',dataRef:'2026-10-16',tipoRef:'embarquei',origem:'dispositivo',updated_at:'2026-10-20T10:00:00.000Z'},updated_at:'2026-10-20T10:00:00.000Z'};
const VIAGEM={tipo:'AVIAO',data:'2026-10-16',hora:'08:40',num_voo:'AD4512',origem:'GRU',destino:'Macaé',localizador:'XYZ123',assento:'12A'};
const SEED={ownews_minha_escala:ESCALA,ownews_minha_viagem:VIAGEM,owbuddy_home_prefs:{v:3,dicaVista:true}};
const ANO0=2026-40; // OWDatePicker com anosAtras=40
(async()=>{const b=await chromium.launch({args:['--no-sandbox']}); const errs=[];
let respostaDialogo=true;
async function nova(W,seed,esquema='dark',relogio='2026-10-24T12:00:00-03:00',storageState){const ctx=await b.newContext({viewport:{width:W,height:844},deviceScaleFactor:2,colorScheme:esquema,timezoneId:'America/Sao_Paulo',storageState});
 if(seed) await ctx.addInitScript(d=>{try{if(!sessionStorage.getItem('s')){localStorage.clear();for(const[k,v]of Object.entries(d))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('s','1');}}catch(e){}},seed||{});
 const p=await ctx.newPage(); await p.clock.setFixedTime(new Date(relogio));
 p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>{dialogos.push(d.message()); respostaDialogo?d.accept():d.dismiss();}); return {ctx,p};}
const dialogos=[];
const vai=async(p,rota,ms=1500)=>{await p.goto(U+rota,{waitUntil:'networkidle'}); await p.waitForTimeout(ms);};
const clica=async(p,texto,ms=900)=>{await p.getByText(texto,{exact:true}).last().click(); await p.waitForTimeout(ms);};
const ovf=p=>p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
const hist=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('owbuddy_historico')||'null'));
// Coluna do seletor: posiciona a lista (virtualizada) e toca no item.
async function coluna(p,i,idx,rotulo){
  const g=await p.evaluate(i=>{const l=[...document.querySelectorAll('div')].filter(d=>d.clientHeight===240&&d.scrollHeight>240&&d.getBoundingClientRect().width>0)[i];const r=l.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,top:l.scrollTop};},i);
  await p.mouse.move(g.x,g.y); await p.mouse.wheel(0,idx*48-g.top); await p.waitForTimeout(700);
  await p.getByLabel(rotulo,{exact:true}).last().click(); await p.waitForTimeout(350);
}
const MES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
async function data(p,botao,iso){
  await p.getByLabel(botao,{exact:true}).click(); await p.waitForTimeout(900);
  const [y,m,d]=iso.split('-').map(Number);
  await coluna(p,2,y-ANO0,'ANO '+y); await coluna(p,1,m-1,'MÊS '+MES[m-1]); await coluna(p,0,d-1,'DIA '+String(d).padStart(2,'0'));
  await p.getByText('OK',{exact:true}).last().click(); await p.waitForTimeout(600);
}
async function hora(p,hhmm){
  await p.getByLabel('Horário do acontecimento',{exact:true}).click(); await p.waitForTimeout(900);
  const [h,mi]=hhmm.split(':');
  await coluna(p,0,Number(h),h+' horas'); await coluna(p,1,Number(mi),mi+' minutos');
  await p.getByText('OK',{exact:true}).last().click(); await p.waitForTimeout(600);
}
const campo=async(p,label,valor)=>{await p.getByLabel(label,{exact:true}).fill(valor); await p.waitForTimeout(150);};

// ── 1. Entrada pela Escala e estado vazio ──
let {ctx,p}=await nova(390,SEED);
await vai(p,'/',2500); let t=await txt(p);
ok(!/Registrar este embarque|Registrar embarque de hoje|Meu Histórico/.test(t),'Home (Dia 9) sem aviso do Histórico — só quando há ação útil');
await vai(p,'/escala'); t=await txt(p);
ok(/Meu Histórico\s*O que realmente aconteceu em cada embarque/.test(t),'Escala → atalho "Meu Histórico" (sem sexta aba)');
await p.getByLabel('Meu Histórico',{exact:true}).click(); await p.waitForTimeout(1500);
ok(new URL(p.url()).pathname==='/historico','Abre /historico');
t=await txt(p);
ok(t.includes('Seus embarques registrados vão aparecer aqui.')&&t.includes('Quer começar pelo seu embarque atual?')&&t.includes('Revisar ciclo atual')&&t.includes('Registrar primeiro embarque'),'Estado vazio com ciclo atual');
await p.screenshot({path:OUT+'/1-vazio.png',fullPage:true});
ok((await hist(p))===null,'Nada gravado só por abrir (escala NÃO popula o histórico)');

// ── 2. Embarque antigo (West Tellus, Guindasteiro, 01/03/2018 → 15/03/2018) ──
await clica(p,'Registrar primeiro embarque',1200);
await data(p,'Data real do embarque','2018-03-01');
await data(p,'Data real do desembarque','2018-03-15');
t=await txt(p); ok(t.includes('01/03/2018')&&t.includes('15/03/2018')&&t.includes('14 dias embarcado'),'Form: 01/03/2018 → 15/03/2018 = 14 dias embarcado');
await campo(p,'Unidade / local (opcional)','West Tellus');
await clica(p,'Adicionar detalhes (função, empresa, observação)',500);
await campo(p,'Função neste embarque (opcional)','Guindasteiro');
await p.screenshot({path:OUT+'/2-form-antigo.png',fullPage:true});
// duplo toque em Registrar
await p.getByText('Registrar',{exact:true}).last().dblclick(); await p.waitForTimeout(1500);
let h=await hist(p);
ok(h&&h.registros.length===1,'Duplo toque em Registrar: 1 registro (sem duplicata)');
ok(h.registros[0].unidade==='West Tellus'&&h.registros[0].funcao==='Guindasteiro'&&!h.registros[0].empresa,'Salvo sem empresa/voo/hotel/obs');
t=await txt(p); ok(t.includes('Registrar outro')&&t.includes('Ver registro')&&/WEST TELLUS|West Tellus/.test(t),'Pós-salvar: Ver registro / Registrar outro');
await clica(p,'Ver registro',1500);
t=await txt(p);
ok(/01\/03\/2018/.test(t)&&/15\/03\/2018/.test(t)&&/14\s*dias embarcado/.test(t),'Registro: datas e 14 dias');
ok(/LINHA DO TEMPO|Linha do tempo/i.test(t)&&/01\/03\s*Embarque/.test(t)&&/15\/03\s*Desembarque/.test(t),'Linha do tempo com Embarque e Desembarque automáticos'+(/01\/03\s*Embarque/.test(t)?'':' :: '+t.slice(t.search(/LINHA DO TEMPO/i),t.search(/LINHA DO TEMPO/i)+200)));
const regAntigo=h.registros[0].id;

// ── 3. Editar o embarque ──
await clica(p,'Editar embarque',1200);
await clica(p,'Adicionar detalhes (função, empresa, observação)',400).catch(()=>{});
await campo(p,'Observação (opcional)','Troca de unidade.');
await clica(p,'Salvar alterações',1500);
t=await txt(p); ok(t.includes('Troca de unidade.'),'Editar embarque: observação salva e visível');

// ── 4. Adicionar voo, hotel e acontecimento personalizado; excluir um ──
await clica(p,'Registrar acontecimento',1200);
await clica(p,'Voo',300);
await data(p,'Data do acontecimento','2018-03-01');
await hora(p,'08:40');
await campo(p,'Origem (opcional)','GRU'); await campo(p,'Destino (opcional)','MEA'); await campo(p,'Número do voo (opcional)','AD1');
t=await txt(p); ok(t.includes('08:40'),'Horário 08:40 escolhido');
await clica(p,'Registrar',1500);
await clica(p,'Registrar acontecimento',1200);
await clica(p,'Hotel',300);
await data(p,'Data do acontecimento','2018-02-28');
await campo(p,'Hotel / local (opcional)','Hotel perto da base');
await clica(p,'Registrar',1500);
await clica(p,'Registrar acontecimento',1200);
await clica(p,'Outro',300);
await data(p,'Data do acontecimento','2018-03-01');
await hora(p,'07:20');
await campo(p,'Título ou descrição curta (opcional)','Troca de aeroporto');
await clica(p,'Registrar',1500);
t=await txt(p);
const ordem=['28/02','Hotel','01/03','07:20','Troca de aeroporto','01/03','08:40','Voo GRU → MEA','01/03','Embarque','15/03','Desembarque'];
let pos=-1, emOrdem=true; for(const s of ordem){const i=t.indexOf(s,pos+1); if(i<0){emOrdem=false;break;} pos=i;}
ok(emOrdem,'Linha do tempo em ordem: hotel (antes) → 07:20 → 08:40 voo → embarque → desembarque');
await p.screenshot({path:OUT+'/3-linha-do-tempo.png',fullPage:true});
// excluir o "Troca de aeroporto"
await p.getByLabel(/Troca de aeroporto\. Tocar para editar/).click(); await p.waitForTimeout(1200);
await clica(p,'Excluir acontecimento',1500);
ok(dialogos.some(d=>d.startsWith('Excluir este acontecimento?')),'Exclusão de acontecimento pede confirmação');
t=await txt(p); ok(!t.includes('Troca de aeroporto')&&t.includes('Voo GRU → MEA'),'Acontecimento excluído; os outros ficam');

// ── 5. Voltar, fechar e reabrir o app: persistência ──
await p.goBack(); await p.waitForTimeout(1200);
t=await txt(p); ok(/Voo GRU → MEA/.test(t)||new URL(p.url()).pathname.startsWith('/historico'),'Voltar funciona');
const salvo=await hist(p);
const estado=await ctx.storageState(); await ctx.close();
({ctx,p}=await nova(390,null,'dark','2026-10-24T12:00:00-03:00',estado));
await vai(p,'/historico');
ok(JSON.stringify(await hist(p))===JSON.stringify(salvo),'Fechar e reabrir: histórico idêntico no aparelho');
t=await txt(p);
ok(/2018/.test(t)&&/WEST TELLUS|West Tellus/i.test(t)&&/01 MAR → 15 MAR/.test(t)&&/14\s*dias/.test(t),'Lista por ano: 2018 · WEST TELLUS · 01 MAR → 15 MAR · 14 dias');
ok(/Desde 2018/i.test(t)&&/1\s*embarque/.test(t)&&/14\s*dias embarcado/.test(t),'Resumo geral só com o que existe (Desde 2018 · 1 embarque · 14 dias)');
await p.screenshot({path:OUT+'/3b-reaberto.png',fullPage:true});

// ── 6. Ciclo atual sugerido → revisão → registro (com viagem do Buddy) ──
t=await txt(p); ok(/Registrar este embarque\?|REGISTRAR ESTE EMBARQUE\?/i.test(t)&&/16 OUT → 30 OUT/.test(t),'Histórico sugere o ciclo atual (16 OUT → 30 OUT)');
await clica(p,'Revisar ciclo atual',1500);
t=await txt(p);
ok(/O Buddy já sabe/i.test(t)&&/Embarque previsto · 16\/10/.test(t)&&/Desembarque previsto · 30\/10/.test(t)&&/Viagem · Avião · GRU → Macaé · 16\/10 08:40/.test(t),'Revisão pré-preenchida: datas previstas + viagem');
ok(t.includes('16/10/2026')&&t.includes('Ainda embarcado'),'Embarque 16/10 sugerido; desembarque em aberto (em andamento)');
await campo(p,'Unidade / local (opcional)','West Jupiter');
await p.screenshot({path:OUT+'/4-revisao-ciclo.png',fullPage:true});
await clica(p,'Registrar',1500);
h=await hist(p); const atual=h.registros.find(r=>r.unidade==='West Jupiter');
ok(atual&&atual.desembarque===null&&atual.previsto.desembarque==='2026-10-30'&&atual.fonte==='escala','Registro em andamento, previsto guardado como previsto');
ok(h.acontecimentos.filter(a=>a.registroId===atual.id&&a.importadoDe).length===1&&!JSON.stringify(h).includes('XYZ123')&&!JSON.stringify(h).includes('12A'),'Viagem importada uma vez, sem localizador/assento');
await clica(p,'Ver registro',1500); t=await txt(p);
ok(/Em andamento/i.test(t)&&/Dia\s*9\s*registrado/.test(t)&&/prev\. 30\/10/.test(t),'Em andamento · Dia 9 registrado · desembarque previsto 30/10');
ok(/16\/10\s*08:40\s*Voo GRU → Macaé/.test(t),'Voo da Minha Viagem na linha do tempo');
await p.screenshot({path:OUT+'/5-em-andamento.png',fullPage:true});
// import de novo não aparece (dedupe)
ok(!t.includes('Adicionar ao histórico'),'Viagem já importada: sem botão duplicado');
const escalaAntes=await p.evaluate(()=>localStorage.getItem('ownews_minha_escala'));
await ctx.close();

// ── 7. Desembarque previsto chegou (30/10): Home pergunta; real foi 31/10 ──
({ctx,p}=await nova(390,{...SEED,owbuddy_historico:h},'dark','2026-10-30T09:00:00-03:00'));
await vai(p,'/',2500); t=await txt(p);
ok(/Desembarque previsto para hoje/i.test(t)&&t.includes('Quer registrar seu desembarque?')&&t.includes('Registrar hoje')&&t.includes('Alterar data')&&t.includes('Agora não'),'Home 30/10: aviso discreto com Registrar hoje / Alterar data / Agora não');
await p.screenshot({path:OUT+'/6-home-finalizar.png',fullPage:true});
await clica(p,'Agora não',1200); t=await txt(p);
ok(!/Desembarque previsto para hoje/i.test(t),'"Agora não" some (anti-spam: só amanhã)');
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(2000); t=await txt(p);
ok(!/Desembarque previsto para hoje/i.test(t),'Reabrir no mesmo dia: não insiste');
const h7=await hist(p);
await ctx.close();
({ctx,p}=await nova(390,{...SEED,owbuddy_historico:h7,owbuddy_historico_avisos:{dispensadas:[],adiadoAte:{}}},'dark','2026-10-31T10:00:00-03:00'));
await vai(p,'/',2500); t=await txt(p);
ok(/Finalizar último embarque/i.test(t)&&/Desembarque previsto: 30\/10/.test(t)&&t.includes('Confirmar 30/10')&&t.includes('Escolher outra data'),'31/10: "Finalizar último embarque · Confirmar 30/10 / Escolher outra data"');
await vai(p,'/proximos'); t=await txt(p);
ok(/Desembarque previsto: 30\/10/.test(t)&&/Registrar desembarque no Meu Histórico/.test(t),'Buddy Agora (Próximos dias): ação contextual');
await vai(p,'/');
await clica(p,'Escolher outra data',1500);
t=await txt(p); ok(/Registrar desembarque/.test(t),'Form de finalização');
await p.getByText('Cancelar',{exact:true}).last().click().catch(()=>{}); await p.waitForTimeout(500);
await data(p,'Data real do desembarque','2026-10-31');
t=await txt(p);
ok(/15 dias embarcado/.test(t)&&/1 dia depois do previsto/.test(t),'31/10: 15 dias e sugestão de dobra (1 dia depois do previsto)');
await clica(p,'Registrar como dobra',300);
await clica(p,'Salvar alterações',1800);
h=await hist(p); const fin=h.registros.find(r=>r.unidade==='West Jupiter');
ok(fin.desembarque==='2026-10-31'&&fin.previsto.desembarque==='2026-10-30','Desembarque real 31/10; previsto 30/10 preservado');
ok(h.acontecimentos.filter(a=>a.registroId===fin.id&&a.tipo==='DOBRA').length===1,'Dobra registrada uma vez (escolha explícita)');
ok((await p.evaluate(()=>localStorage.getItem('ownews_minha_escala')))===escalaAntes,'ESCALA NÃO MUDOU (armazenamento idêntico)');
await vai(p,'/escala'); t=await txt(p);
ok(/embarquei em 16\/10\/2026/.test(t),'Escala continua 14×14 com embarque 16/10');
await vai(p,'/historico'); t=await txt(p);
ok(/WEST JUPITER|West Jupiter/i.test(t)&&/16 OUT → 31 OUT/.test(t)&&/15\s*dias/.test(t),'Lista: WEST JUPITER 16 OUT → 31 OUT · 15 dias');
ok(/2026\s*1 embarque · 15 dias embarcado · 1 unidade/.test(t),'Resumo anual 2026: 1 embarque · 15 dias · 1 unidade');
ok(/Desde 2018/i.test(t)&&/2\s*embarques/.test(t)&&/29\s*dias embarcado/.test(t)&&/2\s*unidades/.test(t),'Resumo geral: Desde 2018 · 2 embarques · 29 dias · 2 unidades');
await p.screenshot({path:OUT+'/7-lista.png',fullPage:true});

// ── 8. Duplicidade e sobreposição (aviso; "Revisar" não salva) ──
await clica(p,'Registrar embarque',1200);
await data(p,'Data real do embarque','2026-10-16'); await data(p,'Data real do desembarque','2026-10-31');
await campo(p,'Unidade / local (opcional)','West Jupiter');
respostaDialogo=false; dialogos.length=0;
await clica(p,'Registrar',1500);
ok(dialogos.some(d=>d.startsWith('Esse embarque já parece estar no histórico.')),'Duplicidade detectada antes de salvar');
ok((await hist(p)).registros.length===2,'"Revisar" não salva');
await data(p,'Data real do embarque','2026-10-20'); await data(p,'Data real do desembarque','2026-10-28');
dialogos.length=0; await clica(p,'Registrar',1500);
ok(dialogos.some(d=>d.startsWith('Esse período se sobrepõe a outro registro.')),'Sobreposição avisada');
respostaDialogo=true; dialogos.length=0; await clica(p,'Registrar',1500);
ok((await hist(p)).registros.length===3,'"Salvar mesmo assim" salva (não bloqueia)');
// Data futura
await clica(p,'Registrar outro',1000);
await data(p,'Data real do embarque','2026-11-13');
dialogos.length=0; await clica(p,'Registrar',1500);
ok(dialogos.some(d=>d.startsWith('Essa data ainda não chegou.')),'Data futura: "Essa data ainda não chegou."');
h=await hist(p); ok(h.registros.some(r=>r.embarque==='2026-11-13'&&r.planejado===true),'Salvo como Planejado');
await vai(p,'/historico'); t=await txt(p); ok(/Planejado/.test(t),'Lista mostra "Planejado"');

// ── 9. Excluir registro ──
await p.getByLabel(/^West Tellus, 01 MAR → 15 MAR/).click(); await p.waitForTimeout(1500);
dialogos.length=0; await clica(p,'Excluir registro',1800);
ok(dialogos.some(d=>d.startsWith('Excluir este registro do histórico?')&&d.includes('Isso não altera sua escala atual.')),'Excluir registro: confirmação com "não altera sua escala"');
h=await hist(p); ok(!h.registros.some(r=>r.unidade==='West Tellus')&&!h.acontecimentos.some(a=>a.registroId===regAntigo),'Registro e acontecimentos excluídos');
ok((await p.evaluate(()=>localStorage.getItem('ownews_minha_escala')))===escalaAntes,'Escala intacta após excluir');

// ── 10. Apagar dados do aparelho inclui o Histórico (Sair não) ──
const chaves=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('owbuddy_historico')));
ok(chaves.includes('owbuddy_historico'),'Chave owbuddy_historico (prefixo coberto por "Apagar dados")');
await vai(p,'/buddy-config'); t=await txt(p);
ok(/Meu Histórico e preferências saem deste aparelho|Apagar dados deste aparelho/.test(t),'Meu Buddy: Apagar dados deste aparelho');
dialogos.length=0; await p.getByText('Apagar dados deste aparelho',{exact:true}).click(); await p.waitForTimeout(1800);
ok(dialogos.some(d=>d.includes('Meu Histórico')),'Confirmação cita o Meu Histórico');
ok((await hist(p))===null,'Histórico apagado junto (após confirmar)');
await ctx.close();

// ── 11. Responsividade 320–430 · escuro e claro ──
const cheio={...SEED,owbuddy_historico:h7};
for (const esquema of ['dark','light']) for (const W of [320,360,375,390,412,430]) {
  ({ctx,p}=await nova(W,cheio,esquema,'2026-10-31T10:00:00-03:00'));
  for (const rota of ['/historico',`/historico-registro?id=${encodeURIComponent(h7.registros.find(r=>r.unidade==='West Jupiter').id)}`,'/historico-form','/historico-acontecimento?registro='+encodeURIComponent(h7.registros[0].id)]) {
    await vai(p,rota,1200);
    const o=await ovf(p); if(o) ok(false,`${esquema} ${W}px ${rota}: rolagem lateral`);
    if (rota==='/historico'||rota.startsWith('/historico-registro')) await p.screenshot({path:`${OUT}/r-${esquema}-${W}-${rota.split('?')[0].slice(1)}.png`,fullPage:true});
  }
  ok(true,`${esquema} ${W}px: 4 telas sem rolagem lateral`);
  await ctx.close();
}
ok(errs.length===0,'Erros JS: '+JSON.stringify(errs.slice(0,5)));
console.log('FALHAS='+falhas);
await b.close(); process.exit(falhas?1:0);
})().catch(e=>{console.error(e); process.exit(2);});
