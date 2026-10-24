// OWBuddy 1.0 — jornada completa do "companheiro offshore" (Playwright, fora do npm test).
// Relógio fixo em 24/10/2026 12:00 (America/Sao_Paulo). Contexto novo e vazio (nunca toca dados reais).
// Uso: PLAYWRIGHT=<pacote playwright> U=http://127.0.0.1:8791 OUT=/tmp/x node tests/e2e/companheiro-preview.cjs
const {chromium}=require(process.env.PLAYWRIGHT);
const fs=require('fs');
const U=process.env.U||'http://127.0.0.1:8791', OUT=process.env.OUT||'/tmp';
let falhas=0; const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) falhas++;};
const txt=p=>p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
const ls=(p,k)=>p.evaluate(k=>localStorage.getItem(k),k);
const espera=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const b=await chromium.launch({args:['--no-sandbox']}); const errs=[];
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,colorScheme:'dark',timezoneId:'America/Sao_Paulo',acceptDownloads:true});
async function pagina(){const p=await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-10-24T12:00:00-03:00'));
  p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); return p;}
let p=await pagina();
const ir=async(rota,ms=1800)=>{await p.goto(U+rota,{waitUntil:'networkidle'}); await p.waitForTimeout(ms);};
// dois toques no MESMO botão antes de qualquer navegação (o caso que a trava precisa cobrir)
const duploToque=async texto=>{await p.evaluate(t=>{const el=[...document.querySelectorAll('[role=button],[tabindex]')].find(e=>e.innerText.trim()===t&&e.getBoundingClientRect().width>0);el.click();el.click();},texto);};
const tab=async nome=>{await p.getByRole('tab',{name:new RegExp(nome,'i')}).first().click().catch(async()=>{await p.getByText(nome,{exact:true}).last().click();}); await p.waitForTimeout(1200);};

// 1. Usuário novo
await ir('/',2500); let t=await txt(p);
ok(t.includes('Vamos começar pela sua escala'),'Novo usuário: Home ensina o próximo passo');

// 2. Escala 14×14, embarque 16/10 (rolagem real no seletor), confirmar
await ir('/escala-config');
await p.getByText('Escolher data').click(); await p.waitForTimeout(1200);
const box=await p.evaluate(()=>{const l=[...document.querySelectorAll('div')].filter(d=>d.clientHeight===240&&d.scrollHeight>240)[0].getBoundingClientRect();return {x:l.x+l.width/2,y:l.y+l.height/2};});
await p.mouse.move(box.x,box.y); await p.mouse.wheel(0,-8*48); await p.waitForTimeout(1200);
await p.getByText('OK',{exact:true}).click(); await p.waitForTimeout(800);
// toque duplo no Confirmar
await duploToque('Confirmar escala'); await p.waitForTimeout(2200); t=await txt(p);
ok(/Dia 9 de 14/.test(t)&&/Faltam 6 dias pra casa\./.test(t),'Escala: Dia 9 de 14 · "Faltam 6 dias pra casa."');
ok(/Escala salva/.test(t),'Feedback "Escala salva"');

// 3. Calendário + compartilhar escala (download no preview)
ok(await p.getByText('Compartilhar minha escala').isVisible(),'Botão "Compartilhar minha escala" visível na Escala');
await p.getByText('Compartilhar minha escala').click(); await p.waitForTimeout(1000); t=await txt(p);
ok(/MINHA ESCALA/.test(t)&&/OUTUBRO 2026/.test(t)&&/Seu parceiro na vida offshore\./.test(t),'Imagem: título, mês e marca discreta');
await p.getByRole('button',{name:'Próximo mês'}).click(); await p.waitForTimeout(500); t=await txt(p);
ok(/NOVEMBRO 2026/.test(t)&&/Embarcado · 14/.test(t),'Navega para novembro (14 dias embarcado)');
ok(!/Macaé|SBME|@|\(\d\d\)/.test(t.slice(t.indexOf('MINHA ESCALA'),t.indexOf('Compartilhar imagem'))),'Imagem sem dado pessoal');
await p.screenshot({path:OUT+'/c-share.png'});
const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}).catch(()=>null),p.getByText('Compartilhar imagem').click()]);
if(dl){const f=OUT+'/'+dl.suggestedFilename(); await dl.saveAs(f); const buf=fs.readFileSync(f);
  ok(dl.suggestedFilename()==='minha-escala-2026-11.png'&&buf.slice(1,4).toString()==='PNG'&&buf.length>8000,'PNG gerado: '+dl.suggestedFilename()+' '+buf.length+' bytes');
  const w=buf.readUInt32BE(16),h=buf.readUInt32BE(20); ok(w>=300&&h>=300,`PNG ${w}×${h}`);
} else ok(false,'download do PNG (fallback web)');
await p.waitForTimeout(600);
await p.getByText('Fechar',{exact:true}).click(); await p.waitForTimeout(500);
ok(!(await p.getByText('Compartilhar imagem').isVisible().catch(()=>false)),'Modal fecha e volta ao app sem perder estado');
t=await txt(p); ok(/Dia 9 de 14/.test(t),'Estado preservado após compartilhar');

// 4. Mala: adicionar (toque duplo), "só neste embarque", editar, marcar
await ir('/mala');
await p.getByLabel('Nome do novo item').fill('Adaptador de tomada');
await p.evaluate(()=>{const el=document.querySelector('[aria-label="Adicionar item"]');el.click();el.click();}); await p.waitForTimeout(900);
let mala=JSON.parse(await ls(p,'ownews_checklist_mala'));
ok(mala.items.filter(i=>i.t==='Adaptador de tomada').length===1,'Toque duplo em Adicionar → 1 item só');
ok(mala.ciclo==='2026-11-13','Mala pertence ao próximo embarque (13/11)');
await p.getByLabel('Nome do novo item').fill('Bolo da vó');
await p.getByRole('checkbox',{name:'Usar em todos os embarques'}).click();
await p.getByRole('button',{name:'Adicionar item'}).click(); await p.waitForTimeout(800);
mala=JSON.parse(await ls(p,'ownews_checklist_mala'));
ok(mala.items.find(i=>i.t==='Bolo da vó')?.rec===false,'"Só neste embarque" gravado (rec:false)');
t=await txt(p); ok(/só neste embarque/.test(t),'Item mostra "só neste embarque"');
await p.getByRole('button',{name:'Editar ou excluir Adaptador de tomada'}).click(); await p.waitForTimeout(500);
await p.getByLabel('Nome do item').fill('Adaptador universal');
await p.getByText('Salvar',{exact:true}).click(); await p.waitForTimeout(700);
mala=JSON.parse(await ls(p,'ownews_checklist_mala'));
ok(mala.items.some(i=>i.t==='Adaptador universal')&&!mala.items.some(i=>i.t==='Adaptador de tomada'),'Editar item pelo ⋯');
await p.getByRole('checkbox',{name:'Adaptador universal'}).click(); await p.waitForTimeout(500);
mala=JSON.parse(await ls(p,'ownews_checklist_mala'));
ok(mala.items.find(i=>i.t==='Adaptador universal').ok===true,'Marcar item');
t=await txt(p); ok(/\d+ de \d+ itens prontos/.test(t),'Progresso "N de M itens prontos"');
await p.screenshot({path:OUT+'/c-mala.png',fullPage:true});

// 5. Documento: adicionar (Passaporte, ANO 2028), editar aviso
await tab('Certificados'); await ir('/certs');
t=await txt(p); ok(/Nenhum documento ainda/.test(t),'Documentos vazio ensina a próxima ação');
await p.getByText('+ Adicionar documento').click(); await p.waitForTimeout(600);
await p.getByRole('radio',{name:'Passaporte'}).click();
ok((await p.getByLabel('Nome',{exact:true}).inputValue())==='Passaporte','Nome automático "Passaporte"');
await p.getByText('Escolher data').first().click(); await p.waitForTimeout(1000);
await p.getByRole('button',{name:'ANO 2028'}).click(); await p.waitForTimeout(600);
await p.getByText('OK',{exact:true}).click(); await p.waitForTimeout(600);
await p.getByRole('radio',{name:'60 dias'}).click();
await duploToque('Salvar'); await p.waitForTimeout(1200);
let certs=JSON.parse(await ls(p,'ownews_certificados'));
ok(certs.length===1&&certs[0].tipo==='PASSAPORTE'&&certs[0].validade==='2028-10-24'&&certs[0].aviso_dias===60,'Documento salvo 1× (toque duplo): '+JSON.stringify(certs.map(c=>[c.tipo,c.validade,c.aviso_dias])));
t=await txt(p); ok(/Passaporte/.test(t)&&/Válido/.test(t)&&/aviso 60 dias antes/.test(t),'Card: Passaporte · Válido · aviso 60 dias');
await p.getByRole('button',{name:/Passaporte\. Válido\. Toque para editar/}).click(); await p.waitForTimeout(600);
ok(/Editar documento/.test(await txt(p)),'Tocar no card abre a edição');
await p.getByRole('radio',{name:'30 dias'}).click();
await p.getByRole('button',{name:'Salvar',exact:true}).click(); await p.waitForTimeout(900);
certs=JSON.parse(await ls(p,'ownews_certificados'));
ok(certs[0].aviso_dias===30&&/Documento atualizado/.test(await txt(p)),'Editar documento + feedback');

// 6. Viagem (hoje, avião, SDU 08:40) + contato
await ir('/viagem'); t=await txt(p);
ok(/Nenhuma viagem cadastrada/.test(t)&&/Contatos do embarque/i.test(t),'Viagem vazia + Contatos do embarque');
await p.getByText('+ Adicionar viagem').click(); await p.waitForTimeout(600);
await p.getByText('Salvar viagem').click(); await p.waitForTimeout(400);
ok(/Escolha a data da viagem\./.test(await txt(p)),'Erro humano inline (sem Alert morto na web)');
await p.getByText('Selecionar').first().click(); await p.waitForTimeout(900);
await p.getByText('OK',{exact:true}).click(); await p.waitForTimeout(500);
await p.getByPlaceholder('GRU').fill('SDU'); await p.getByPlaceholder('LA1234').fill('G31234');
await duploToque('Salvar viagem'); await p.waitForTimeout(1000); t=await txt(p);
ok(/Viagem salva/.test(t)&&/Abrir no mapa · Aeroporto Santos Dumont \(SDU\)/.test(t),'Viagem salva + "Abrir no mapa" (Santos Dumont)');
await p.getByText('Editar',{exact:true}).click(); await p.waitForTimeout(600);
await p.getByPlaceholder('MEA').fill('MEA'); await p.getByText('Salvar viagem').click(); await p.waitForTimeout(900);
ok(/Viagem atualizada/.test(await txt(p))&&JSON.parse(await ls(p,'ownews_minha_viagem')).destino==='MEA','Editar viagem');
await p.getByText('Adicionar contato').first().click(); await p.waitForTimeout(1000);
await p.getByLabel('Nome do contato').fill('Logística Macaé');
await p.getByLabel('Telefone').fill('22999991234');
await duploToque('Salvar contato'); await p.waitForTimeout(1500);
let cts=JSON.parse(await ls(p,'owbuddy_contatos_embarque')||'[]');
ok(cts.length===1&&cts[0].tipo==='LOGISTICA','Contato salvo 1× (toque duplo)');
t=await txt(p); ok(/Logística Macaé/.test(t)&&/\(22\) 99999-1234/.test(t),'Contato aparece com telefone formatado');
const wa=await p.getByRole('button',{name:'WhatsApp de Logística Macaé'}).count(), call=await p.getByRole('button',{name:'Ligar para Logística Macaé'}).count();
ok(wa===1&&call===1,'Ações Ligar e WhatsApp visíveis');
await p.getByRole('button',{name:/Logística Macaé, Logística\. Toque para editar/}).click(); await p.waitForTimeout(900);
await p.getByLabel('Nome do contato').fill('Logística Base Macaé'); await p.getByText('Salvar contato').click(); await p.waitForTimeout(1200);
cts=JSON.parse(await ls(p,'owbuddy_contatos_embarque'));
ok(cts[0].nome==='Logística Base Macaé','Editar contato');
await p.screenshot({path:OUT+'/c-viagem.png',fullPage:true});

// 7. Home contextual (viagem HOJE → "onde preciso estar" no topo)
await ir('/',2500); t=await txt(p);
ok(/Sua viagem é hoje/.test(t)&&/Voo\s*G31234/.test(t)&&/Aeroporto\s*Aeroporto Santos Dumont \(SDU\)/.test(t),'Home: "Sua viagem é hoje" com voo e aeroporto');
ok(/Abrir no mapa/.test(t)&&/Contatos/.test(t),'Home: Abrir no mapa + Contatos');
ok(/Você está embarcado/.test(t)&&/Faltam 6 dias pra casa\./.test(t),'Home: Dia 9 + "Faltam 6 dias pra casa."');
const idxOnde=t.indexOf('Sua viagem é hoje'), idxHero=t.indexOf('Você está embarcado');
ok(idxOnde>=0&&idxOnde<idxHero,'Viagem de HOJE vem antes do card da escala');
await p.screenshot({path:OUT+'/c-home.png',fullPage:true});

// 8. Fecha e abre: tudo permanece
await p.close(); p=await pagina(); await ir('/',2500); t=await txt(p);
ok(/Dia 9 de 14/.test(t)&&/Sua viagem é hoje/.test(t),'Reabrir: escala e viagem permanecem');
ok(JSON.parse(await ls(p,'ownews_checklist_mala')).items.find(i=>i.t==='Adaptador universal').ok===true,'Reabrir: marcação da mala permanece (sem reset)');

// 9. Offline: core continua
await ctx.setOffline(true); await p.waitForTimeout(800);
await tab('Escala'); t=await txt(p); ok(/Dia 9 de 14/.test(t),'Offline: Escala funciona');
await tab('Embarque'); t=await txt(p); ok(/Adaptador universal/.test(t),'Offline: Mala funciona');
await tab('Certificados'); t=await txt(p); ok(/Passaporte/.test(t),'Offline: Documentos funcionam');
await tab('Viagem'); t=await txt(p); ok(/Logística Base Macaé/.test(t),'Offline: Viagem e contatos funcionam');
await tab('Início'); t=await txt(p); ok(/Offline/.test(t)&&/Dia 9 de 14/.test(t),'Offline: Home com aviso discreto e escala');
await ctx.setOffline(false); await p.waitForTimeout(800);

// 10. Excluir item e contato de teste
await ir('/mala');
await p.getByRole('button',{name:'Editar ou excluir Bolo da vó'}).click(); await p.waitForTimeout(500);
await p.getByText('Excluir item').first().click(); await p.waitForTimeout(400);
ok(/Excluir “Bolo da vó”\?/.test(await txt(p)),'Excluir pede confirmação');
await p.getByText('Excluir item').last().click(); await p.waitForTimeout(700);
ok(!JSON.parse(await ls(p,'ownews_checklist_mala')).items.some(i=>i.t==='Bolo da vó'),'Item excluído');
await ir('/viagem');
await p.getByRole('button',{name:/Logística Base Macaé, Logística\. Toque para editar/}).click(); await p.waitForTimeout(900);
await p.getByText('Excluir contato').click(); await p.waitForTimeout(1300);
ok(JSON.parse(await ls(p,'owbuddy_contatos_embarque')).length===0,'Contato excluído (confirmação aceita)');
t=await txt(p); ok(/Nenhum contato ainda/.test(t),'Contatos vazio ensina a próxima ação');

// 11. Falhas de rede: 500, JSON inválido, vazio → sem crash
for (const [nome,resp] of [['500',{status:500,body:'erro'}],['json',{status:200,body:'{oops',contentType:'application/json'}],['vazio',{status:200,body:'',contentType:'application/json'}]]) {
  await p.route('**/api/**',r=>r.fulfill(resp));
  for (const rota of ['/vagas','/unidades','/noticias']) {
    await ir(rota,1800); t=await txt(p);
    ok(!/undefined|NaN|\bnull\b|invalid_input|VALIDATION_ERROR/.test(t),`Rede ${nome} em ${rota}: sem texto técnico`);
  }
  await p.unroute('**/api/**');
}
await ir('/',2000); t=await txt(p); ok(/Dia 9 de 14/.test(t),'Home intacta após falhas de rede');

ok(errs.length===0,'Sem erro JS: '+JSON.stringify(errs.slice(0,3)));
console.log('FALHAS='+falhas);
await b.close(); process.exit(falhas?1:0);
})().catch(e=>{console.error(e); process.exit(2);});
