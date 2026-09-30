#!/usr/bin/env python3
"""授業計画が途中までしか取れない講義の原因調べ(通信なし。data/raw の保存済みHTMLを使う)
実行:  python3 plan_dump.py 微分積分        # 講義名の一部 か 講義コード
出力:  画面に診断、data/plan_sample_<コード>.html に「授業計画」まわりの生HTMLを保存"""
import gzip, json, pathlib, re, sys
import scrape
D = pathlib.Path(__file__).parent / "data"
key = sys.argv[1] if len(sys.argv) > 1 else "微分積分"
rows = json.loads((D / "index.json").read_text(encoding="utf-8"))
hit = [r for r in rows if key == r["c"] or key in r["n"]]
hit = [r for r in hit if (D / "raw" / f"{r['c']}.html.gz").exists()]
print(f"「{key}」に合う講義(生HTMLあり): {len(hit)}件。先頭3件を調べます。parsers={scrape._parsers()}")
for r in hit[:3]:
    c = r["c"]
    html = gzip.open(D / "raw" / f"{c}.html.gz", "rt", encoding="utf-8").read()
    try:
        stored = json.loads((D / "detail" / f"{c}.json").read_text(encoding="utf-8")).get("plan") or {}
    except Exception:
        stored = {}
    print(f"\n== {c} {r['n']} / {r.get('t','')}")
    print(f"  保存済みの授業計画: {len(stored.get('rows', []))}行 (方式 {stored.get('via')}/{stored.get('parser')})")
    for pr in scrape._parsers():
        p = scrape._extract_plan(html, pr)
        print(f"  {pr:12s} → {len(p['rows']) if p else 0}行" + (f" 方式{p['via']}" if p else ""))
    f = scrape._plan_flat(html)
    print(f"  {'flat':12s} → {len(f['rows']) if f else 0}行 (タグの欠落に強い方式)")
    best = scrape.extract_plan(html)
    print(f"  採用される結果: {len(best['rows']) if best else 0}行 ({best['parser'] if best else '-'})")
    m = next((m for m in re.finditer("授業計画", html) if "line_y_label" in html[m.end():m.end() + 300]), None)
    if not m:
        print("  ⚠ 「授業計画」の見出し行が生HTMLにありません")
        continue
    seg = html[m.start() - 300:m.start() + 40000]
    nxt = re.search(r'syllabus_title', seg[400:])
    region = seg[: 400 + nxt.start()] if nxt else seg
    print(f"  生HTML: 授業計画〜次の見出し {len(region):,}文字 / <tr {len(re.findall('<tr', region))}個 / <table {len(re.findall('<table', region))}個 / </table> {len(re.findall('</table', region))}個 / </tr> {len(re.findall('</tr', region))}個")
    out = D / f"plan_sample_{c}.html"
    out.write_text(re.sub(r"[ \t]*\n\s*", "\n", seg), encoding="utf-8")
    print(f"  → {out} に保存しました")
