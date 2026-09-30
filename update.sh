#!/bin/bash
# 更新作業を1本にまとめたスクリプト。
#   ./update.sh            取得済みデータの整備(enrich → 点検 → フッター日付 → コミット確認)。通信なし
#   ./update.sh --fetch    先に scrape.py で新規分を取得する(通信あり。全件だと1〜2時間)
#   ./update.sh --push     コミット後に git push まで行う(確認あり)
# 取得は workers=6・既定の delay/backoff のまま。取得済みは再取得しない。
set -euo pipefail
cd "$(dirname "$0")"
FETCH=0; PUSH=0
for a in "$@"; do case "$a" in --fetch) FETCH=1;; --push) PUSH=1;; *) echo "不明な引数: $a"; exit 2;; esac; done
ask() { read -r -p "$1 [y/N] " r; [[ "$r" == y || "$r" == Y ]]; }

if [ "$FETCH" = 1 ]; then
  echo "== 1. 取得 =="
  ask "ku-portal から取得します(未取得分のみ。長時間かかることがあります)。続けますか?" || { echo "中止"; exit 1; }
  caffeinate -i python3 scrape.py --year 2026 --workers 6 --priority data/btable.json
fi

echo "== 2. 詳細JSONから index.json を更新(--enrich) =="
python3 scrape.py --enrich

echo "== 3. データ点検 =="
python3 check_data.py
python3 - <<'PY'
import json, glob, sys
bad = []
for f in ["data/index.json", "data/btable.json", "data/mdreq.json"] + glob.glob("data/detail/*.json"):
    try: json.load(open(f))
    except Exception: bad.append(f)
idx = json.load(open("data/index.json"))
ncat = sum(1 for r in idx if r.get("cat"))
if bad or ncat == 0:
    print(f"点検NG: 壊れたJSON {len(bad)}件 {bad[:5]} / 学部カテゴリあり {ncat}件"); sys.exit(1)
print(f"点検OK: 学部カテゴリあり {ncat}/{len(idx)}件")
PY

echo "== 4. フッターの最終更新日 =="
TODAY=$(date +"%Y年%-m月%-d日")
sed -i '' -E "s/最終更新: [0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日/最終更新: ${TODAY}/" index.html
grep -o "最終更新: [^<]*" index.html

echo "== 5. コミット =="
git add index.html data/index.json data/btable.json data/mdreq.json data/skipped.json data/detail
if git diff --cached --quiet; then echo "変更なし。終了"; exit 0; fi
git diff --cached --stat | tail -3
ask "この内容でコミットしますか?" || { echo "コミットせず終了(ステージ済み)"; exit 0; }
git commit -q -m "データ更新 $(date +%Y-%m-%d)"
git log --oneline | head -1

if [ "$PUSH" = 1 ]; then
  ask "git push origin main を実行しますか?" && git push origin main
else
  echo "push は未実行です。公開するには: git push origin main"
fi
