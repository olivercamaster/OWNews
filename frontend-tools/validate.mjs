import fs from 'node:fs/promises';
import http from 'node:http';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(process.env.OWNEWS_TEST_PACKAGE || '/tmp/ownews-frontend-tests/package.json');
const {chromium} = require('playwright');
let fontAssets={};try{fontAssets=JSON.parse(await fs.readFile('/tmp/ownews-frontend-tests/font-assets.json','utf8'));}catch{}
const source = await fs.readFile(new URL('../producao-ownews-git/worker.js',import.meta.url),'utf8');
const preview = await fs.readFile(new URL('../home-redesign/worker.js',import.meta.url),'utf8');
const load = async s => (await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'))).default;
const app = await load(source), testPreview=await load(preview);
// Only known preview labels may differ; compare every rendered route otherwise.
const normalizePreview = html => html
 .replaceAll(' (PREVIEW)', '').replaceAll(' (preview)', '')
 .replaceAll('preview OWNews', 'OWNews')
 .replaceAll('<span>v3 — home em redesign editorial, ainda não publicada</span>', '')
 .replaceAll('<span>v3 — hub em estruturação, preview</span>', '')
 .replaceAll('redesign editorial, preview local — não publicado\n   em produção). Identidade preservada: navy escuro + branco + azul/ciano.', 'versão editorial aprovada). Identidade preservada:\n   navy escuro + branco + azul/ciano.');
// Fixtures are local test data only. Never access external services during tests.
const article={id:'test-article', title:'Notícia de teste local sobre operações offshore', summary:'Resumo para validar o layout.',content:'Texto de teste local.\n\nSegundo parágrafo.',published_at:'2026-09-13T11:00:00Z',image_url:null,original_url:'https://example.org',image_credit:'Teste'};
globalThis.fetch=async()=>new Response(JSON.stringify([article]),{headers:{'Content-Type':'application/json'}});
const server=http.createServer(async(req,res)=>{try{const r=await app.fetch(new Request('http://localhost'+req.url));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const failures=[],errors=[],results=[];
page.on('pageerror',e=>errors.push(String(e)));
let weather='missing',posts=0;
await page.route('**/*',route=>{
 const req=route.request(),url=req.url();
 if(req.method()==='POST')posts++;
 if(url.startsWith(origin))return route.continue();
 if(fontAssets[url])return route.fulfill({body:Buffer.from(fontAssets[url].body,'base64'),contentType:fontAssets[url].contentType});
 if(url.includes('/aeroportos')&&weather==='failure')return route.abort();
 if(url.includes('/aeroportos'))return route.fulfill({json:{aeroportos:weather==='missing'?[]:[{dados:['SBMI','','','','g'],clima:{icone:'☀️',tempo:'Céu claro'}},{dados:['SBJR','','','','g'],clima:{horarioUTC:'11:00 UTC',temperatura:21,icone:'🌧️',tempo:'Chuva'}}]}});
 if(url.includes('/rest/v1/articles'))return route.fulfill({json:Array.from({length:12},(_,i)=>({...article,id:'test-'+i,title:article.title+' '+i}))});
 return route.abort();
});
const routes=new Set(['/','/salarios','/funcoes','/pesquisa-salarial?funcao=driller','/agora','/vagas','/unidades','/dados','/noticia?id=test-article','/carreiras/cadastre-seu-curriculo','/empresas','/comece-aqui','/cursos','/guias']);
// Discover all real role/detail routes rather than guess slugs.
for(const path of ['/salarios','/funcoes']){
 const html=await(await app.fetch(new Request(origin+path))).text();
 for(const m of html.matchAll(/href="(\/(?:salarios|funcoes|cursos)\/[^"#?]+)"/g))routes.add(m[1]);
}
for(const path of routes){
 const r=await app.fetch(new Request(origin+path)); const html=await r.text();
 if(r.status!==200)failures.push({path,status:r.status});
 for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))try{new vm.Script(m[1]);}catch(e){failures.push({path,syntax:String(e)});}
 const pre=await testPreview.fetch(new Request(origin+path));
 if(pre.status!==r.status)failures.push({path,previewStatus:pre.status});
 if(normalizePreview(await pre.text())!==html)failures.push({path,previewContentDifference:true});
}
for(const width of [320,360,375,390,412,430,768,1024,1440]){
 await page.setViewportSize({width,height:900});
 for(const path of routes){
  await page.goto(origin+path);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(75);
  const size=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,culprits:[...document.querySelectorAll('body *')].filter(e=>{const b=e.getBoundingClientRect();return b.right>innerWidth+1&&!e.closest('.ticker-viewport,.ops-strip,.ops-rail,.radar-strip,.agora-ops-strip,.agora-radar-list');}).slice(0,8).map(e=>e.className)}));
  results.push({width,path,overflow:Math.max(size.doc,size.body)-width});
  if(size.doc>width||size.body>width)failures.push({path,...size});
  if(await page.evaluate(()=>[document.documentElement,document.body].some(e=>['hidden','clip'].includes(getComputedStyle(e).overflowX))))failures.push({path,width,maskedOverflow:true});
  if(path==='/'&&width<=430){
   await page.locator('.menu-btn').click();
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))failures.push({width,menuOverflow:true});
   for(const handle of ['ownews','offshoreworks']){const links=page.locator('a[href="https://www.instagram.com/'+handle+'"]');if(await links.count()<2||await links.first().getAttribute('target')!=='_blank')failures.push({handle,social:true});}
   await page.locator('.menu-btn').click();
   const ticker=await page.evaluate(()=>{const t=document.querySelector('.ticker-track'),g=t.querySelector('.ticker-group');return g.getBoundingClientRect().width/parseFloat(t.style.animationDuration);});
   if(Math.abs(ticker-34)>.1)failures.push({width,ticker});
   await page.locator('.airport').nth(1).click();
   if(!(await page.locator('#opsDetail').innerText()).includes('Sem dados'))failures.push({width,weather:await page.locator("#opsDetail").innerText()});
   if(width===390){await page.screenshot({path:'/tmp/ownews-frontend-tests/home-390.png',fullPage:true});await page.screenshot({path:'/tmp/ownews-frontend-tests/home-390-viewport.png'});}
  }
 }
}
weather='partial';await page.goto(origin+'/');await page.waitForTimeout(50);
if(!(await page.locator('.airport').nth(1).innerText()).includes('Sem dados'))failures.push({unconfirmedWeather:await page.locator(".airport").nth(1).innerText()});
if(!(await page.locator('.airport').first().innerText()).includes('21°'))failures.push({confirmedWeather:await page.locator(".airport").first().innerText()});
weather='failure';await page.evaluate(()=>carregarAeroportosAoVivo());
if(!(await page.locator('.airport').first().innerText()).includes('Sem dados'))failures.push({staleWeather:true});
await page.goto(origin+'/agora');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
if(!(await page.locator('#agoraAeroportos').innerText()).includes('Sem dados'))failures.push({agoraWeather:true});
await page.goto(origin+'/');await page.evaluate(()=>document.fonts.ready);
for(const count of [1,3,12]){
 const px=await page.evaluate(count=>{renderTicker(Array.from({length:count},(_,i)=>({id:i,title:'Uma manchete longa para testar a velocidade proporcional do Giro 24H em diferentes cenários '+i})));const t=document.querySelector('.ticker-track');return t.querySelector('.ticker-group').getBoundingClientRect().width/parseFloat(t.style.animationDuration);},count);
 if(Math.abs(px-34)>.1)failures.push({count,px});
}
await page.emulateMedia({reducedMotion:'reduce'});
if(await page.locator('.ticker-track').evaluate(e=>getComputedStyle(e).animationName)!=='none')failures.push({reducedMotion:true});
await page.emulateMedia({reducedMotion:'no-preference'});
for(const width of [320,360,375,390,412,430]){
 await page.setViewportSize({width,height:900});
 await page.evaluate(()=>renderTudo(Array.from({length:12},(_,i)=>({id:i,title:'TítuloMuitoLongoSemEspaços'.repeat(12),summary:'Resumo '.repeat(60),image_url:null,published_at:'2026-09-13T11:00:00Z'}))));
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))failures.push({width,longText:true});
}
await page.goto(origin+'/pesquisa-salarial?funcao=driller');
if(!await page.locator('#btnEnviarPesquisa').isDisabled())failures.push({submitEnabled:true});
await page.locator('#formPesquisaSalarial').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
if(posts!==0)failures.push({posts});
if(!(await page.locator('#pesquisaStatus').innerText()).includes('Nenhuma resposta foi enviada'))failures.push({preparation:await page.locator("#pesquisaStatus").innerText()});
for(const [path,code] of [['/inexistente',404],['/noticia',404],['/salarios/inexistente',404],['/manifest.webmanifest',200]]){const r=await app.fetch(new Request(origin+path));if(r.status!==code)failures.push({path,status:r.status});}
await browser.close();server.close();
const report={fontAssets:Object.keys(fontAssets).length,routes:routes.size,measurements:results.length,maxOverflow:Math.max(...results.map(r=>r.overflow)),posts,errors,failures,results};
await fs.writeFile('/tmp/ownews-frontend-tests/results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined,failures:failures.slice(0,12),failureCount:failures.length},null,2));
process.exitCode=failures.length||errors.length?1:0;
