#!/usr/bin/env python3
"""週1回の更新(GitHub Actions から実行): Campusmate の講義一覧を取り直し、新しく増えた講義の詳細だけを取得する。
取得済みの詳細は取り直さない(scrape.py の既定)。一覧は約45ページ、詳細は新規分だけなのでアクセスは少ない。
使い方: python3 weekly_update.py
- 一覧の件数が前回の9割未満なら、取得の失敗とみなして元の index.json に戻して終える。
- 最後に --enrich と ふりがな(build_yomi.py)を作り直し、フッターの「最終更新」を書き換える。"""
import json, os, pathlib, re, subprocess, sys
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).parent
IDX = ROOT / "data" / "index.json"


def run(*args):
    print("$", " ".join(args), flush=True)
    subprocess.run([sys.executable, *args], cwd=ROOT, check=True)


def main():
    before = IDX.read_bytes()
    n0 = len(json.loads(before))
    run("scrape.py", "--year", "2026", "--workers", "3", "--refresh-list")
    n1 = len(json.loads(IDX.read_text(encoding="utf-8")))
    if n1 < n0 * 0.9:
        IDX.write_bytes(before)
        sys.exit(f"講義一覧が {n0} → {n1} 件に減りました。取得の失敗とみなして元に戻します")
    run("scrape.py", "--enrich")
    run("build_yomi.py")
    changed = subprocess.run(["git", "status", "--porcelain", "data"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    if changed:
        today = datetime.now(timezone(timedelta(hours=9)))
        p = ROOT / "index.html"
        s = re.sub(r"最終更新: \d{4}年\d{1,2}月\d{1,2}日", f"最終更新: {today.year}年{today.month}月{today.day}日", p.read_text(encoding="utf-8"), count=1)
        p.write_text(s, encoding="utf-8")
    print(f"講義一覧 {n0} → {n1} 件 / 変更: {'あり' if changed else 'なし'}")
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\nsummary={n0}→{n1}件\n")


if __name__ == "__main__":
    main()
