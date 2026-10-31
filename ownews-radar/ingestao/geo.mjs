/**
 * Geometrias oficiais (GeoServer da ANP, WFS) → GeoJSON leve para o mapa: arredondado a ~100 m
 * e com vértices a pelo menos `minKm` de distância. Só ambiente marítimo.
 */
import { GEO } from '../fontes.mjs';
import { baixar } from './anp.mjs';
import { chaveNome, limparTexto } from '../lib/texto.mjs';

function distKm(a, b) {
  const dx = (a[0] - b[0]) * 111.32 * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  const dy = (a[1] - b[1]) * 111.32;
  return Math.sqrt(dx * dx + dy * dy);
}
export function simplificarAnel(coords, minKm) {
  const r = [];
  for (const p of coords) {
    const q = [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
    if (!r.length || q[0] !== r[r.length - 1][0] || q[1] !== r[r.length - 1][1]) r.push(q);
  }
  if (r.length < 5) return r.length >= 4 ? r : null;
  const fino = [r[0]];
  for (let i = 1; i < r.length - 1; i++) if (distKm(fino[fino.length - 1], r[i]) >= minKm) fino.push(r[i]);
  fino.push(r[r.length - 1]);
  return fino.length >= 4 ? fino : r;
}
function simplificarGeom(g, minKm) {
  if (!g) return null;
  if (g.type === 'Polygon') { const an = g.coordinates.map((a) => simplificarAnel(a, minKm)).filter(Boolean); return an.length ? { type: 'Polygon', coordinates: an } : null; }
  if (g.type === 'MultiPolygon') { const ps = g.coordinates.map((p) => p.map((a) => simplificarAnel(a, minKm)).filter(Boolean)).filter((p) => p.length); return ps.length ? { type: 'MultiPolygon', coordinates: ps } : null; }
  return null;
}

export async function baixarCamada(nome) {
  const cfg = GEO[nome];
  let url = `${GEO.pagina}?service=WFS&version=1.0.0&request=GetFeature&typeName=${encodeURIComponent(cfg.typeName)}&outputFormat=application/json&srsName=EPSG:4326`;
  if (cfg.filtroCql) url += `&CQL_FILTER=${encodeURIComponent(cfg.filtroCql)}`;
  const bruto = JSON.parse(new TextDecoder().decode(await baixar(url, { tempoMs: 180000 })));
  const feats = (bruto.features || []).map((f) => {
    const props = {};
    for (const k of cfg.props) if (f.properties && f.properties[k]) props[k] = limparTexto(f.properties[k], 80);
    const geometry = simplificarGeom(f.geometry, cfg.minKm);
    return geometry ? { type: 'Feature', properties: props, geometry } : null;
  }).filter(Boolean);
  if (feats.length < (nome === 'presal' ? 1 : 20)) throw new Error(`camada ${nome}: poucas feições (${feats.length})`);
  return { type: 'FeatureCollection', features: feats };
}

/** Liga cada polígono de campo à página do campo (por nome exato) — sem casar por aproximação. */
export function ligarCamposAoRadar(geo, campos) {
  const porNome = new Map(campos.map((c) => [chaveNome(c.nome_anp), c]));
  for (const f of geo.features) {
    const c = porNome.get(chaveNome(f.properties.NOM_CAMPO));
    f.properties = { nome: c ? c.nome : f.properties.NOM_CAMPO, bacia: f.properties.NOM_BACIA || null, slug: c ? c.slug : null };
  }
  return geo;
}
