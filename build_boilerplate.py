#!/usr/bin/env python3
"""どの講義でも同じ文言の項目(定型文・共通の説明)を洗い出し、data/boilerplate.json に書き出す。
サイトはこのファイルを読んで、該当する項目を詳細画面で非表示にします。

実行:  python3 build_boilerplate.py            # 書き出す
       python3 build_boilerplate.py --dry-run  # 一覧を見るだけ
調整:  --min-count 30 (何講義以上で同じなら定型文とみなすか) / --min-len 12 (短い値は対象外)
手動で消したい項目名は、boilerplate.json の "labels" に追記してください(実行しても残ります)。
"""
import argparse, json, pathlib
from collections import Counter

DATA = pathlib.Path(__file__).parent / "data"

ap = argparse.ArgumentParser()
ap.add_argument("--min-count", type=int, default=30)
ap.add_argument("--min-share", type=float, default=0.03, help="全体に対する割合の下限")
ap.add_argument("--min-len", type=int, default=12)
ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args()

files = sorted((DATA / "detail").glob("*.json"))
cnt, n = Counter(), 0
for p in files:
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        continue
    n += 1
    for sec in (d.get("sections") or {}).values():
        for k, v in (sec or {}).items():
            v = str(v).strip()
            if k != "全文" and len(v) >= a.min_len:
                cnt[(k, v)] += 1

need = max(a.min_count, int(n * a.min_share))
pairs = [(k, v, c) for (k, v), c in cnt.most_common() if c >= need]
print(f"詳細 {n}件を調べました。{need}件以上で同じ文言の項目: {len(pairs)}種類")
for k, v, c in pairs[:40]:
    print(f"  {c:5d}件  {k}: {v[:50].replace(chr(10), ' ')}{'…' if len(v) > 50 else ''}")

out = DATA / "boilerplate.json"
labels = []
if out.exists():
    try:
        labels = json.loads(out.read_text(encoding="utf-8")).get("labels", [])
    except Exception:
        pass
if not a.dry_run:
    out.write_text(json.dumps({"labels": labels, "pairs": [[k, v] for k, v, _ in pairs]},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"→ {out} に保存しました(項目名で消したいものは \"labels\" に追記)")
