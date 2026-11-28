/**
 * CSS e JS do Radar Offshore, servidos com cache longo em /radar-offshore/static/*.
 * Só variáveis do OWNews (--navy-*, --cyan, --white, --muted, --line…): o tema claro do portal
 * redefine as mesmas variáveis, então o Radar acompanha claro/escuro sem regra extra.
 */
export const CSS = `
.ro-trilha{display:flex;flex-wrap:wrap;gap:6px;font:600 12px/1.4 var(--ui);color:var(--muted-dim);margin:8px 0 4px}
.ro-trilha a{color:var(--cyan-dim);text-decoration:none}
.ro-cab{margin:6px 0 14px}
.ro-kicker{font:700 11px/1.3 var(--ui);letter-spacing:.12em;text-transform:uppercase;color:var(--cyan-dim);margin:0 0 6px}
.ro-cab h1{font:800 clamp(26px,5vw,38px)/1.12 var(--ui);color:var(--white);margin:0;overflow-wrap:anywhere}
.ro-sub{font:17px/1.5 var(--editorial);color:var(--muted);margin:8px 0 0;max-width:68ch}
.ro-selo{display:inline-block;font:600 12px/1.4 var(--ui);color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:4px 10px;margin:0 0 14px}
.ro-selo a{color:var(--cyan-dim)}
.ro-previsto{border-color:var(--yellow);color:var(--yellow)}
.ro-secoes{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;margin:0 0 8px;scrollbar-width:none}
.ro-secoes::-webkit-scrollbar{display:none}
.ro-secoes a,.ro-secoes span{flex:none;font:600 13px/1 var(--ui);padding:10px 12px;border:1px solid var(--line);border-radius:999px;color:var(--white);text-decoration:none;min-height:40px;display:inline-flex;align-items:center}
.ro-secoes span{border-color:var(--cyan);color:var(--cyan-dim)}
.ro-bloco{margin:26px 0}
.ro-bloco h2{font:800 14px/1.3 var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--white);margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.ro-cartoes{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.ro-cartao{display:flex;flex-direction:column;gap:4px;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--navy-900);color:inherit;text-decoration:none;min-width:0}
a.ro-cartao:hover{border-color:var(--cyan)}
.ro-cartao-valor{font:800 22px/1.15 var(--ui);color:var(--white);overflow-wrap:anywhere}
.ro-cartao-rotulo{font:13px/1.35 var(--ui);color:var(--muted)}
.ro-cartao-nota{font:600 12px/1.35 var(--ui);color:var(--cyan-dim)}
.ro-dados{display:grid;gap:0;margin:0}
.ro-dados div{display:grid;grid-template-columns:minmax(120px,38%) 1fr;gap:12px;padding:10px 0;border-bottom:1px solid var(--line-hair)}
.ro-dados dt{font:600 13px/1.4 var(--ui);color:var(--muted)}
.ro-dados dd{margin:0;font:15px/1.45 var(--ui);color:var(--white);overflow-wrap:anywhere}
.ro-dados a,.ro-lista a strong,.ro-noticias a,.ro-tabela a,.ro-nota a,.ro-fonte a,.ro-atalhos a strong{color:var(--cyan-dim)}
.ro-nd{color:var(--muted-dim);font-size:13px}
.ro-lista,.ro-atalhos ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.ro-item a,.ro-atalhos a{display:flex;flex-direction:column;gap:3px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--navy-900);text-decoration:none;min-height:44px}
.ro-item a:hover,.ro-atalhos a:hover{border-color:var(--cyan)}
.ro-item strong{font:700 16px/1.3 var(--ui);color:var(--white)}
.ro-item span,.ro-atalhos span{font:13px/1.4 var(--ui);color:var(--muted)}
.ro-item[hidden]{display:none}
.ro-filtros{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin:0 0 14px}
.ro-filtros label{display:flex;flex-direction:column;gap:4px;font:600 12px/1.3 var(--ui);color:var(--muted)}
.ro-filtros input,.ro-filtros select{min-height:44px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--navy-950);color:var(--white);font:15px var(--ui);width:100%;box-sizing:border-box}
.ro-busca{grid-column:1/-1}
.ro-contagem{grid-column:1/-1;margin:0;font:13px var(--ui);color:var(--muted)}
.ro-noticias{list-style:none;margin:0;padding:0}
.ro-noticias li{display:flex;flex-direction:column;gap:2px;padding:10px 0;border-bottom:1px solid var(--line-hair);font:15px/1.4 var(--ui);color:var(--white)}
.ro-noticias span{color:var(--muted);font-size:13px}
.ro-noticias time{font:12px var(--ui);color:var(--muted-dim)}
.ro-grafico{margin:18px 0;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--navy-900)}
.ro-grafico figcaption{font:600 13px/1.4 var(--ui);color:var(--muted);margin-bottom:8px}
.ro-grafico svg{width:100%;height:auto;display:block}
.ro-grafico rect{fill:var(--cyan)}
.ro-grafico text{fill:var(--muted-dim);font:9px var(--ui)}
.ro-grafico details,.ro-bloco details{margin-top:8px;font:13px var(--ui);color:var(--muted)}
.ro-grafico summary,.ro-bloco summary{cursor:pointer;min-height:32px;color:var(--cyan-dim)}
.ro-rolagem{overflow-x:auto}
.ro-tabela{width:100%;border-collapse:collapse;font:14px/1.4 var(--ui);color:var(--white)}
.ro-tabela th{text-align:left;font:600 12px var(--ui);color:var(--muted);padding:8px 6px;border-bottom:1px solid var(--line)}
.ro-tabela td{padding:8px 6px;border-bottom:1px solid var(--line-hair);vertical-align:top}
.ro-tabela td span{color:var(--muted);font-size:12px}
.ro-barras{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.ro-barras li{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;font:14px var(--ui);color:var(--white)}
.ro-barra{height:10px;border-radius:5px;background:linear-gradient(90deg,var(--cyan) var(--p),var(--line-hair) var(--p))}
.ro-analise{margin:24px 0;padding:14px 16px;border-left:3px solid var(--yellow);background:var(--navy-900);border-radius:0 10px 10px 0}
.ro-analise p{margin:4px 0;font:15px/1.5 var(--editorial);color:var(--muted)}
.ro-foto{margin:0 0 16px}
.ro-foto img{width:100%;height:auto;max-height:360px;object-fit:cover;border-radius:10px;background:var(--navy-900)}
.ro-foto figcaption{font:12px var(--ui);color:var(--muted-dim);margin-top:6px}
.ro-foto a{color:var(--cyan-dim)}
.ro-acoes{margin:14px 0}
.ro-botao{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:8px;border:1px solid var(--cyan);color:var(--cyan-dim);font:700 14px var(--ui);text-decoration:none}
.ro-nota{font:13px/1.5 var(--ui);color:var(--muted);margin:14px 0}
.ro-vazio{font:14px/1.5 var(--ui);color:var(--muted);padding:12px 0}
.ro-aviso{color:var(--yellow)}
.ro-fonte{margin:32px 0 8px;padding-top:14px;border-top:1px solid var(--line);font:13px/1.5 var(--ui);color:var(--muted)}
.ro-fonte ul{margin:6px 0;padding-left:18px}
.ro-disclaimer{color:var(--muted-dim)}
.ro-regras li{font:15px/1.55 var(--editorial);color:var(--muted);margin:6px 0}
.ro-camadas{display:flex;flex-wrap:wrap;gap:6px 14px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0 0 10px}
.ro-camadas legend{font:700 12px var(--ui);color:var(--muted);padding:0 4px}
.ro-camadas label{display:flex;align-items:center;gap:6px;min-height:40px;font:14px var(--ui);color:var(--white)}
.ro-camadas input{width:20px;height:20px;accent-color:var(--cyan)}
.ro-mapa{height:min(70vh,560px);min-height:340px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--navy-900)}
.ro-pop{font:14px/1.4 var(--ui);color:#0b2340;min-width:160px}
.ro-pop strong{display:block;font-size:15px}
.ro-pop a{display:inline-block;margin-top:6px;color:#0a66b3;font-weight:700}
@media(min-width:900px){.ro-lista{grid-template-columns:repeat(2,minmax(0,1fr))}.ro-cartoes{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}.ro-filtros{grid-template-columns:2fr 1fr 1fr 1fr}.ro-busca{grid-column:auto}.ro-mapa{height:620px}}
`;

/** Filtro das listas (sem dependência): busca + selects por data-atributos já no HTML. */
export const JS_FILTROS = `(function(){
var lista=document.querySelector('[data-lista]');if(!lista)return;
var itens=[].slice.call(lista.querySelectorAll('.ro-item'));
var campos=[].slice.call(document.querySelectorAll('[data-filtro]'));
var contagem=document.querySelector('.ro-contagem');
function norm(s){return(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();}
function aplicar(){var f={};campos.forEach(function(c){f[c.getAttribute('data-filtro')]=c.value;});
var q=norm(f.busca).trim(),n=0;
itens.forEach(function(it){var ok=(!q||norm(it.getAttribute('data-busca')).indexOf(q)>=0)&&(!f.tipo||it.getAttribute('data-tipo')===f.tipo)&&(!f.op||it.getAttribute('data-op')===f.op)&&(!f.bacia||it.getAttribute('data-bacia')===f.bacia);it.hidden=!ok;if(ok)n++;});
if(contagem)contagem.textContent=n+(n===1?' resultado':' resultados');}
campos.forEach(function(c){c.addEventListener('input',aplicar);c.addEventListener('change',aplicar);});aplicar();})();`;

/** Mapa: MapLibre (mesma versão e tiles do portal). Camadas carregadas sob demanda; sem GPS. */
export const JS_MAPA = `(function(){
var el=document.getElementById('ro-mapa');if(!el)return;
function iniciar(){if(!window.maplibregl){setTimeout(iniciar,150);return;}
el.innerHTML='';
var mapa=new maplibregl.Map({container:el,style:'https://tiles.openfreemap.org/styles/liberty',center:[-41.5,-22.5],zoom:4.6,attributionControl:{compact:true},cooperativeGestures:true});
mapa.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
var carregadas={};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function popup(lngLat,html){new maplibregl.Popup({closeButton:true,maxWidth:'260px'}).setLngLat(lngLat).setHTML('<div class="ro-pop">'+html+'</div>').addTo(mapa);}
var cfg={
unidades:{url:'/radar-offshore/api/geo/unidades',add:function(d){mapa.addSource('unidades',{type:'geojson',data:d,cluster:true,clusterRadius:36,clusterMaxZoom:7});
mapa.addLayer({id:'unidades-cluster',type:'circle',source:'unidades',filter:['has','point_count'],paint:{'circle-color':'#12a8ee','circle-opacity':.85,'circle-radius':['step',['get','point_count'],14,10,18,30,22],'circle-stroke-color':'#fff','circle-stroke-width':1.5}});
mapa.addLayer({id:'unidades-n',type:'symbol',source:'unidades',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':12,'text-font':['Noto Sans Regular']},paint:{'text-color':'#fff'}});
mapa.addLayer({id:'unidades',type:'circle',source:'unidades',filter:['!',['has','point_count']],paint:{'circle-color':'#12a8ee','circle-radius':6,'circle-stroke-color':'#fff','circle-stroke-width':1.5}});
if(!location.hash){var b=new maplibregl.LngLatBounds();d.features.forEach(function(f){b.extend(f.geometry.coordinates);});if(!b.isEmpty())mapa.fitBounds(b,{padding:40,maxZoom:7,duration:0});}
mapa.on('click','unidades',function(e){var p=e.features[0].properties;popup(e.lngLat,'<strong>'+esc(p.nome)+'</strong>'+esc(p.tipo||'')+(p.operador?'<br>Operador: '+esc(p.operador):'')+'<br><a href="/radar-offshore/unidades/'+encodeURIComponent(p.slug)+'">Ver unidade</a>');});
mapa.on('click','unidades-cluster',function(e){var f=e.features[0];mapa.getSource('unidades').getClusterExpansionZoom(f.properties.cluster_id).then(function(z){mapa.easeTo({center:f.geometry.coordinates,zoom:z});});});
},camadas:['unidades','unidades-cluster','unidades-n']},
campos:{url:'/radar-offshore/api/geo/campos',add:function(d){mapa.addSource('campos',{type:'geojson',data:d});
mapa.addLayer({id:'campos',type:'fill',source:'campos',paint:{'fill-color':'#42d879','fill-opacity':.22,'fill-outline-color':'#1a7f45'}},mapa.getLayer('unidades-cluster')?'unidades-cluster':undefined);
mapa.on('click','campos',function(e){var p=e.features[0].properties;popup(e.lngLat,'<strong>Campo '+esc(p.nome)+'</strong>'+(p.bacia?'Bacia de '+esc(p.bacia):'')+(p.slug?'<br><a href="/radar-offshore/campos/'+encodeURIComponent(p.slug)+'">Ver campo</a>':''));});
},camadas:['campos']},
blocos:{url:'/radar-offshore/api/geo/blocos',add:function(d){mapa.addSource('blocos',{type:'geojson',data:d});
mapa.addLayer({id:'blocos',type:'line',source:'blocos',paint:{'line-color':'#ffd44d','line-width':1}});
mapa.addLayer({id:'blocos-area',type:'fill',source:'blocos',paint:{'fill-color':'#ffd44d','fill-opacity':.06}});
mapa.on('click','blocos-area',function(e){var p=e.features[0].properties;popup(e.lngLat,'<strong>Bloco '+esc(p.NOM_BLOCO||'')+'</strong>'+(p.OPERADOR_C?'Operador: '+esc(p.OPERADOR_C):''));});
},camadas:['blocos','blocos-area']},
presal:{url:'/radar-offshore/api/geo/presal',add:function(d){mapa.addSource('presal',{type:'geojson',data:d});
mapa.addLayer({id:'presal',type:'line',source:'presal',paint:{'line-color':'#ff7a00','line-width':2,'line-dasharray':[3,2]}});},camadas:['presal']}};
function ligar(nome,on){var c=cfg[nome];
if(on&&!carregadas[nome]){carregadas[nome]='carregando';fetch(c.url).then(function(r){return r.json();}).then(function(d){c.add(d);carregadas[nome]=true;focar();}).catch(function(){carregadas[nome]=false;});return;}
if(carregadas[nome]===true)c.camadas.forEach(function(id){if(mapa.getLayer(id))mapa.setLayoutProperty(id,'visibility',on?'visible':'none');});}
function focar(){var h=location.hash.slice(1).split('=');if(h.length!==2)return;var src=h[0]==='unidade'?'unidades':h[0]==='campo'?'campos':null;if(!src||!mapa.getSource(src))return;
var d=mapa.getSource(src)._data;var f=(d.features||[]).find(function(x){return x.properties.slug===h[1];});if(!f)return;
if(f.geometry.type==='Point')mapa.flyTo({center:f.geometry.coordinates,zoom:9});else{var b=new maplibregl.LngLatBounds();(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).forEach(function(p){p[0].forEach(function(c){b.extend(c);});});mapa.fitBounds(b,{padding:40,maxZoom:10});}}
mapa.on('load',function(){document.querySelectorAll('[data-camada]').forEach(function(cb){if(cb.checked)ligar(cb.getAttribute('data-camada'),true);cb.addEventListener('change',function(){ligar(cb.getAttribute('data-camada'),cb.checked);});});
if(/^#campo=/.test(location.hash)){var cb=document.querySelector('[data-camada="campos"]');if(cb&&!cb.checked){cb.checked=true;ligar('campos',true);}}});}
iniciar();})();`;
