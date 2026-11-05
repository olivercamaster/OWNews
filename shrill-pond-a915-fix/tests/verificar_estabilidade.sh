#!/usr/bin/env bash
# Verificação de estabilidade do OWNews (05/11/2026) — só leitura, sem segredo, sem gravar nada.
# Uso: bash shrill-pond-a915-fix/tests/verificar_estabilidade.sh [horas_desde]   (padrão: 24)
# Responde: o collector rodou? entraram matérias? alguma gravação falhou? o Giro tem conteúdo?
# as fontes funcionam? o cron do Radar está ativo e o snapshot é recente?
set -euo pipefail
H="${1:-24}"
K="apikey: sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt"   # chave pública do site (a mesma do navegador)
DESDE=$(date -u -d "-$H hours" +%Y-%m-%dT%H:%M:%SZ)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
curl -s https://shrill-pond-a915.olivercamaster.workers.dev/saude -A curl/8 > "$T/saude.json"
curl -s "https://awyowuhwkqfyhwgdpepp.supabase.co/rest/v1/articles?select=title,created_at,published_at,image_url&status=eq.published&buddy_source=eq.ownews&created_at=gte.$DESDE&order=created_at.desc" -H "$K" > "$T/art.json"
curl -s "https://awyowuhwkqfyhwgdpepp.supabase.co/rest/v1/articles?select=id,published_at&status=eq.published&buddy_source=eq.ownews&order=published_at.desc&limit=40" -H "$K" > "$T/lista.json"
CRON=$(crontab -l 2>/dev/null | grep -c radar-cron.sh || true)
ULTIMA_RADAR=$(grep '"ingestao_concluida"' /home/offshore/ownews-radar-state/cron.log 2>/dev/null | tail -1 || true)
python3 - "$H" "$CRON" "$ULTIMA_RADAR" "$T" <<'PY'
import json, sys, datetime
h, cron, radar_log, T = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
s, art, lista = (json.load(open(f"{T}/{n}.json")) for n in ("saude", "art", "lista"))
agora = datetime.datetime.now(datetime.timezone.utc)
ok = lambda c: "OK  " if c else "FALHA"
g = s["gate_editorial"]["janelas"]
a = s["automacao"]; ult = a.get("ultimo_sucesso")
idade = (agora - datetime.datetime.fromisoformat(ult.replace("Z", "+00:00"))).total_seconds() / 3600 if ult else 99
ie = sum((g.get(w) or {}).get("insercao_falhou") or 0 for w in ("24h",))
n48 = sum(1 for x in lista if 0 <= (agora - datetime.datetime.fromisoformat(x["published_at"])).total_seconds() / 3600 <= 48)
print(f"[{ok(idade < 1.5)}] collector: última execução há {idade:.1f} h ({ult})")
print(f"[{ok(len(art) > 0)}] matérias novas nas últimas {h} h: {len(art)} ({sum(1 for x in art if x['image_url'])} com foto)")
for x in art[:8]: print("        ", x["created_at"][:16], x["title"][:80])
print(f"[{ok(ie == 0)}] gravações recusadas pelo banco (24 h): {ie}")
print(f"[{ok(n48 > 0)}] Giro do Offshore Agora: {n48} matéria(s) elegível(is) em 48 h")
fe = g.get("24h", {}).get("ultimo_erro_fonte") or {}
print(f"[{ok(len(fe) <= 1)}] fontes com erro (24 h): {', '.join(k + ': ' + v['erro'][:60] for k, v in fe.items()) or 'nenhuma'}")
r = s.get("radar") or {}
print(f"[{ok(cron == 2 and r.get('estado') == 'healthy')}] Radar: {cron} linhas no crontab; snapshot {r.get('gerado_em')} ({r.get('idade_h')} h), produção {r.get('competencia_producao')}")
print(f"        último log do cron: {radar_log[:110]}")
se = s["saude_editorial"]
print(f"[{ok(se['status'] != 'VERMELHO')}] saúde editorial: {se['status']} — {'; '.join(se.get('motivos') or []) or 'sem alertas'}")
for k in ("mercado", "offvoos", "aeroportos_meteo"):
    v = s.get(k) or {}; e = v.get("market_status") or v.get("estado")
    print(f"[{ok(e == 'healthy')}] {k}: {e}")
t = s.get("telegram") or {}
print(f"[{ok(bool(t.get('ultimo_envio')))}] telegram: último envio {t.get('ultimo_envio')} ({t.get('ultimo_resultado')})")
PY
