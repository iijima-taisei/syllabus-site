#!/usr/bin/env python3
"""基幹教育院の「授業時間割」ページから、最新の B表(1年生用)PDF を取得して data/btable.json を更新する。
使い方: python3 fetch_btable.py [--force]   (pdfplumber が必要。GitHub Actions から毎日実行)

- ページを1回読み、ファイル名(例 2026k_jikan_tableB_20261005.pdf)が btable.json に記録した取り込み元と
  同じなら何もしない(PDFは取りに行かない)。変わっていたときだけ前期・後期のPDFを取得して取り込む。
- 取り込み結果の講義数が前回より大きく減ったときは、読み取りの失敗とみなして元のデータに戻し、失敗で終わる。
- 更新したら index.html のフッターの「最終更新」日付も書き換える。
"""
import json, os, pathlib, re, subprocess, sys, tempfile, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

PAGE = "https://www.artsci.kyushu-u.ac.jp/campus_life/course.html"
ROOT = pathlib.Path(__file__).parent
BT = ROOT / "data" / "btable.json"
UA = "kyudai-syllabus-viewer (unofficial; daily B-table check)"
# 1年生用のB表だけ(2年次以上用の *_tableB_2nd_* は対象外)
NAME = re.compile(r"(\d{4})([zk])_jikan_tableB_(\d{8})\.pdf")


HOST = "www.artsci.kyushu-u.ac.jp"
MAX_BYTES = 30 * 1024 * 1024   # B表PDFは数MB。これを超えるものは取り込まない


def get(url):
    # 取得先は基幹教育院のサイト(https)に限る。リンクが外部に向いていても取りに行かない
    u = urllib.parse.urlparse(url)
    if u.scheme != "https" or u.hostname != HOST:
        sys.exit(f"想定外の取得先のため中止します: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        if urllib.parse.urlparse(r.geturl()).hostname != HOST:
            sys.exit(f"想定外の転送先のため中止します: {r.geturl()}")
        data = r.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        sys.exit(f"サイズが大きすぎるため中止します: {url}")
    return data


def latest_links(html):
    best = {}
    for href in re.findall(r'href="([^"]+\.pdf)"', html):
        m = NAME.search(href)
        if not m or "_2nd" in href:
            continue
        term = "前期" if m.group(2) == "z" else "後期"
        key = (m.group(1), m.group(3))
        if term not in best or key > best[term][0]:
            best[term] = (key, urllib.request.urljoin(PAGE, href), m.group(0))
    return {t: (url, name) for t, (_, url, name) in best.items()}


def set_output(**kw):
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            for k, v in kw.items():
                f.write(f"{k}={v}\n")


def main():
    force = "--force" in sys.argv
    links = latest_links(get(PAGE).decode("utf-8", "replace"))
    if set(links) != {"前期", "後期"}:
        sys.exit(f"ページから前期・後期のB表を見つけられませんでした: {links}")
    old = json.loads(BT.read_text(encoding="utf-8")) if BT.exists() else {}
    src = old.get("src", {})
    print("ページ上の最新:", {t: n for t, (_, n) in links.items()}, "/ 取り込み済み:", src or old.get("versions"))
    if not force and all(src.get(t) == n for t, (_, n) in links.items()):
        print("変更なし")
        set_output(changed="false")
        return

    backup = BT.read_bytes() if BT.exists() else None
    with tempfile.TemporaryDirectory() as td:
        paths = []
        for t in ("前期", "後期"):
            url, name = links[t]
            p = pathlib.Path(td) / name
            data = get(url)
            if not data.startswith(b"%PDF-"):
                sys.exit(f"PDFではないため中止します: {name}")
            p.write_bytes(data)
            print(f"取得: {name} ({p.stat().st_size // 1024} KB)")
            paths.append(str(p))
        subprocess.run([sys.executable, str(ROOT / "import_btable.py"), *paths], check=True)

    new = json.loads(BT.read_text(encoding="utf-8"))
    n_old, n_new = len(old.get("rows", {})), len(new.get("rows", {}))
    if n_old and n_new < n_old * 0.8:
        if backup is not None:
            BT.write_bytes(backup)
        sys.exit(f"講義数が {n_old} → {n_new} 件に減りました。読み取りに失敗した可能性があるので更新しません")

    today = datetime.now(timezone(timedelta(hours=9)))
    idx = ROOT / "index.html"
    html = idx.read_text(encoding="utf-8")
    html = re.sub(r"最終更新: \d{4}年\d{1,2}月\d{1,2}日", f"最終更新: {today.year}年{today.month}月{today.day}日", html, count=1)
    idx.write_text(html, encoding="utf-8")
    print(f"更新しました: {old.get('versions')} → {new.get('versions')} / 講義 {n_old} → {n_new} 件")
    set_output(changed="true", versions=json.dumps(new.get("versions"), ensure_ascii=False))


if __name__ == "__main__":
    main()
