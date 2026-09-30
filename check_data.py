#!/usr/bin/env python3
"""data フォルダの状態を点検する(表示されないときの原因調べ用)。 実行: python3 check_data.py"""
import json, pathlib
D = pathlib.Path(__file__).parent / "data"
print("フォルダ:", D.resolve(), "存在" if D.is_dir() else "← ありません!")
def load(p):
    try:
        return json.loads(p.read_text(encoding="utf-8")), None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"
for name in ("index.json", "btable.json", "boilerplate.json"):
    p = D / name
    if not p.exists():
        print(f"{name}: なし"); continue
    j, err = load(p)
    n = len(j) if isinstance(j, list) else len(j.get("rows", j)) if isinstance(j, dict) else "?"
    print(f"{name}: {p.stat().st_size:,}バイト", f"読み込みNG → {err}" if err else f"OK({n}件)")
det = sorted((D / "detail").glob("*.json")) if (D / "detail").is_dir() else []
print(f"detail: {len(det)}件")
bad, tmp, plan_ok, plan_empty, noplan, weird = [], 0, 0, 0, 0, []
for p in det:
    j, err = load(p)
    if err or not isinstance(j, dict):
        bad.append((p.name, err)); continue
    if "plan" not in j: noplan += 1
    elif j["plan"]:
        plan_ok += 1
        r = j["plan"].get("rows")
        if not isinstance(r, list) or not all(isinstance(x, list) for x in r): weird.append(p.name)
    else: plan_empty += 1
tmp = len(list((D / "detail").glob("*.tmp"))) if det else 0
print(f"  壊れたJSON {len(bad)}件 {bad[:3]} / 書きかけ(.tmp) {tmp}件")
print(f"  授業計画あり {plan_ok} / 表なし {plan_empty} / 未確認 {noplan} / 形式が変なもの {len(weird)} {weird[:3]}")
print("raw:", len(list((D / 'raw').glob('*.gz'))) if (D / 'raw').is_dir() else "なし")
cn = sum(1 for r in (load(D / "index.json")[0] or []) if r.get("cat"))
print(f"index.json のうち学部カテゴリあり: {cn}件 (0なら python3 scrape.py --enrich)")

# ---- 授業計画の行数の分布(表の一部しか取れていない講義を探す) ----
from collections import Counter
cnt, few = Counter(), []
for p in det:
    j, _ = load(p)
    pl = (j or {}).get("plan")
    if pl and pl.get("rows"):
        n = len(pl["rows"]); cnt[min(n, 20)] += 1
        if n <= 2: few.append((p.stem, pl))
print("授業計画の行数の分布(20は20行以上):", dict(sorted(cnt.items())))
print(f"2行以下の講義: {len(few)}件")
for code, pl in few[:4]:
    print(f"  {code} 見出し{pl.get('head')} 方式{pl.get('via')}")
    for r in pl["rows"]:
        print("    ", [f"{c[:25]!r}(改行{c.count(chr(10))}/{len(c)}字)" for c in r])
# 生HTMLから「授業計画」まわりのHTMLを書き出す(通信なし)
try:
    import gzip, scrape
    for code, _ in few[:3]:
        rp = D / "raw" / f"{code}.html.gz"
        if rp.exists():
            html = gzip.open(rp, "rt", encoding="utf-8").read()
            out = D / f"plan_sample_{code}.html"
            out.write_text(scrape._anchor_outline(html, 30000), encoding="utf-8")
            print("  書き出し:", out)
except Exception as e:
    print("生HTMLの書き出しをスキップ:", type(e).__name__, e)
