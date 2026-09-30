#!/usr/bin/env python3
"""九大シラバス取得スクリプト (並列・再開対応版)

準備:  pip3 install requests beautifulsoup4 lxml
実行:  caffeinate -i python3 scrape.py --year 2026 --workers 6

- data/index.json があれば講義一覧の再取得はしません(--refresh-list で取り直し)
- data/detail/<講義コード>.json が既にあれば再取得しません
- Ctrl+C で止めても、取得済みの分は残ります。もう一度実行すれば続きから再開します
"""
import argparse, gzip, json, math, os, pathlib, random, re, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = os.environ.get("SYLLABUS_BASE", "https://ku-portal.kyushu-u.ac.jp/campusweb/")
SEARCH = BASE + "slbsskgr.do?clearAccessData=true&contenam=slbsskgr&kjnmnNo=7"
DETAIL = (BASE + "slbssbdr.do?value(risyunen)={y}&value(semekikn)={s}"
          "&value(kougicd)={c}&value(crclumcd)={cr}")
UA = {"User-Agent": "kyudai-syllabus-viewer (personal study use)"}
OUT = pathlib.Path(__file__).parent / "data"
DETAIL_DIR = OUT / "detail"
UNP = OUT / "unparsed"
RAW = OUT / "raw"          # 授業計画の取得時に保存する生HTML(gzip)。通信せず読み直すために残す


def clean(t):
    return t.replace("\xa0", " ").strip()


def decode_html(r):
    """文字コードを自動判定して文字列にする(学部によって指定が違っても読めるように)"""
    b = r.content
    cands = []
    ct = r.headers.get("Content-Type", "")
    m = re.search(r"charset=([\w-]+)", ct, re.I)
    if m:
        cands.append(m.group(1))
    m = re.search(rb"charset=[\"']?([\w-]+)", b[:4096], re.I)
    if m:
        cands.append(m.group(1).decode("ascii", "ignore"))
    cands += ["utf-8", "cp932", "euc-jp"]
    for enc in cands:
        enc = enc.lower()
        if enc in ("iso-8859-1", "latin-1", "latin1"):
            continue                       # 指定なしのときの既定値なので信用しない
        if enc in ("shift_jis", "shift-jis", "sjis", "x-sjis"):
            enc = "cp932"
        try:
            return b.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return b.decode("utf-8", errors="replace")


# シラバスのページかどうかを判断するための言葉(どれか2つ以上あれば本文とみなす)
SYLLABUS_WORDS = ("授業科目名", "科目名称", "科目名", "授業科目", "講義名", "担当教員", "担当者", "単位数",
                  "授業の目的", "授業の概要", "講義概要", "到達目標", "授業計画", "成績評価", "教科書", "参考書",
                  "履修条件", "キーワード", "オフィスアワー", "シラバス", "Course Title", "Instructor", "Credits")
ERROR_WORDS = ("エラー", "セッション", "タイムアウト", "ログインしてください", "アクセス権", "存在しません",
               "該当するデータ", "Not Found", "Forbidden", "Bad Request")
NAME_KEYS = ("科目名称", "授業科目名", "科目名", "授業科目", "講義名", "Course Title")


def syllabus_hits(text):
    return sum(1 for k in SYLLABUS_WORDS if k in text)


# ---------------------------------------------------------------- 解析
def parse_list(html):
    soup = BeautifulSoup(html, "lxml")
    rows = []
    for tr in soup.select("tr.column_odd, tr.column_even"):
        tds = tr.find_all("td", recursive=False)
        a = tds[2].find("a") if len(tds) >= 5 else None
        if not a or not a.get("href"):
            continue
        q = dict(re.findall(r"value\((\w+)\)=([^&]*)", a["href"]))
        if not all(k in q for k in ("kougicd", "risyunen", "semekikn", "crclumcd")):
            continue
        rows.append({"c": q["kougicd"], "y": q["risyunen"], "s": q["semekikn"], "cr": q["crclumcd"],
                     "n": a.get_text(strip=True),
                     "when": [x.strip() for x in tds[3].get_text("\n").split("\n") if x.strip()],
                     "t": clean(tds[4].get_text(" ", strip=True))})
    m = re.search(r"/\s*([\d,]+)件中", soup.get_text(" ", strip=True))
    return rows, int(m.group(1).replace(",", "")) if m else len(rows)


def parse_detail_standard(html, row):
    soup = BeautifulSoup(html, "lxml")
    for r in soup.select("#rubric_tablehidden_i"):
        r.decompose()
    sections, cur = {}, "概要"
    for tr in soup.select("td#main tr"):
        tds = tr.find_all("td", recursive=False)
        title = tr.find("td", class_="syllabus_title")
        if title and len(tds) == 1:
            t = title.get_text(" ", strip=True)
            if not t.startswith("※"):
                cur = t
            continue
        if len(tds) == 3 and "line_y_label" in (tds[1].get("class") or []):
            val = clean(tds[2].get_text("\n", strip=True))
            sections.setdefault(cur, {})[tds[0].get_text(" ", strip=True)] = val
    return {"code": row["c"],
            "url": DETAIL.format(y=row["y"], s=row["s"], c=row["c"], cr=row["cr"]),
            "sections": sections}


def parse_detail_generic(html, row):
    """レイアウトが違うページ用: 表の「項目名 | 内容」の行をそのまま拾う"""
    soup = BeautifulSoup(html, "lxml")
    for r in soup.select("#rubric_tablehidden_i"):
        r.decompose()
    main = soup.select_one("td#main") or soup.body or soup
    fields, done = {}, set()
    for tr in main.find_all("tr"):
        if any(id(p) in done for p in tr.find_parents("tr")):
            continue                       # 入れ子の表の中の行は外側の行に含めて扱う
        cells = tr.find_all("td", recursive=False) or tr.find_all("th", recursive=False)
        cells = [c for c in cells if "line_y_label" not in (c.get("class") or [])]
        if len(cells) < 2:
            continue
        label = cells[0]
        if label.find("table"):
            continue
        key = re.sub(r"\s+", " ", label.get_text(" ", strip=True))
        if not key or len(key) > 40:
            continue
        val = clean("\n".join(c.get_text("\n", strip=True) for c in cells[1:]))
        if key in fields:
            n = 2
            while f"{key}({n})" in fields:
                n += 1
            key = f"{key}({n})"
        fields[key] = val
        done.add(id(tr))
    return {"code": row["c"],
            "url": DETAIL.format(y=row["y"], s=row["s"], c=row["c"], cr=row["cr"]),
            "sections": {"概要": fields} if fields else {}}


def parse_detail_text(html, row):
    """最後の手段: 表の構造が読めなくても、シラバスの本文テキストをそのまま保存する"""
    soup = BeautifulSoup(html, "lxml")
    for r in soup.select("#rubric_tablehidden_i, script, style, noscript"):
        r.decompose()
    main = soup.select_one("td#main") or soup.body or soup
    lines = [re.sub(r"[ \t\u3000]+", " ", clean(x)) for x in main.get_text("\n", strip=True).split("\n")]
    lines = [x for x in lines if x]
    text = "\n".join(lines)
    hits = syllabus_hits(text)
    # シラバスの言葉が2つ以上ある → 本文。1つ以下でも、長くてエラー表示でなければ本文とみなす
    is_body = (hits >= 2 and len(text) >= 80) or \
              (hits >= 1 and len(text) >= 400 and not any(k in text for k in ERROR_WORDS))
    if not is_body:
        return {"code": row["c"], "url": "", "sections": {}}
    name = row.get("n", "")
    for i, x in enumerate(lines[:-1]):
        if x in NAME_KEYS and lines[i + 1]:
            name = lines[i + 1]
            break
    return {"code": row["c"],
            "url": DETAIL.format(y=row["y"], s=row["s"], c=row["c"], cr=row["cr"]),
            "sections": {"概要": {"授業科目名": name or row["c"], "全文": text}}}


def parse_detail(html, row):
    d = parse_detail_standard(html, row)
    if not detail_ok(d):
        g = parse_detail_generic(html, row)
        if detail_ok(g):
            d = g
        else:
            t = parse_detail_text(html, row)
            if detail_ok(t):
                d = t
    if detail_ok(d):
        d["plan"] = extract_plan(html) or {}      # 授業計画(回ごとの表)。無ければ空
    return d


# ---------------------------------------------------------------- 授業計画(回ごとの表)
PLAN_HEAD = re.compile(r"^(回|第?\d*回?|No\.?|Week|Lesson|授業回|項目|テーマ|内容|授業内容|授業計画|Topic|Contents?)$", re.I)


def _table_rows(table):
    """1つの表の行を [[セル,...],...] にする(入れ子の表の行は含めない)"""
    rows = []
    for tr in table.find_all("tr"):
        if tr.find_parent("table") is not table:
            continue
        cells = tr.find_all(["th", "td"], recursive=False)
        vals = [re.sub(r"[ \t\u3000]+", " ", clean(c.get_text("\n", strip=True))) for c in cells]
        if any(vals):
            rows.append(vals)
    return rows


def _plan_anchor(main):
    for el in main.find_all(["td", "th", "div", "span", "b", "strong", "p"]):
        if el.find("table"):
            continue
        t = re.sub(r"\s+", "", el.get_text("", strip=True))
        if t.startswith("授業計画") and len(t) <= 12:
            return el
    return None


def _is_label_row(tr):
    if tr.find("td", class_="syllabus_title"):
        return True
    tds = tr.find_all("td", recursive=False)
    return len(tds) == 3 and "line_y_label" in (tds[1].get("class") or [])


def _pack(rows, via):
    if len(rows) < 2:
        return None
    head = []
    first = rows[0]
    is_head = (not first[0].strip() and not any(re.fullmatch(r"\d+", c.strip()) for c in first)) or \
              any(re.search(r"テーマ|内容|学修|Topic|Content", c, re.I) or PLAN_HEAD.match(re.sub(r"\s+", "", c)) and c.strip() for c in first)
    if is_head and not all(re.fullmatch(r"\d+", c) for c in first if c):
        head, rows = first, rows[1:]
    rows = [r for r in rows if any(r)]
    return {"head": head, "rows": rows, "via": via} if rows else None


def _outermost(tables):
    """入れ子になっていない(他の候補の中に入っていない)表だけを返す"""
    ids = {id(t) for t in tables}
    return [t for t in tables if not any(id(p) in ids for p in t.find_parents("table"))]


def _parsers():
    ps = ["lxml", "html.parser"]
    try:
        import html5lib  # noqa: F401  (ブラウザと同じ解釈。入っていれば使う)
        ps.append("html5lib")
    except ImportError:
        pass
    return ps


def extract_plan(html):
    """授業計画の回ごとの表を {head, rows, via, parser} で返す。見つからなければ None。
    壊れたHTMLはパーサーによって解釈が変わるので、複数のパーサーで試して行数が最も多い結果を採用する"""
    best = None
    for pr in _parsers():
        try:
            p = _extract_plan(html, pr)
        except Exception:
            continue
        if p and (best is None or len(p["rows"]) > len(best["rows"])):
            best = dict(p, parser=pr)
    try:
        f = _plan_flat(html)      # <tr>の欠落などでパーサーが行を見失うときの保険
    except Exception:
        f = None
    if f and (best is None or len(f["rows"]) > len(best["rows"])):
        best = dict(f, parser="flat")
    return best


def _plan_flat(html):
    """<tr>の対応が壊れたHTML用: 表の <td> を出てくる順に全部拾い、見出しの列数ごとに区切って行にする。
    第1列が 1,2,3… と連番になっているときだけ採用する(ずれの検出)"""
    m = next((m for m in re.finditer("授業計画", html) if "line_y_label" in html[m.end():m.end() + 300]), None)
    if not m:
        return None
    t0 = html.find("<table", m.end())
    if t0 < 0:
        return None
    ends = [e for e in (html.find("syllabus_title", t0), html.find("line_y_label", t0)) if e > 0]
    reg = html[t0:min(ends)] if ends else html[t0:]
    cells = []
    for cm in re.finditer(r"<td\b([^>]*)>(.*?)(?=<td\b|</tr|</table|\Z)", reg, re.S | re.I):
        attrs, inner = cm.groups()
        if "line_x" in attrs or re.search(r"colspan\s*=\s*[\"']?\d", attrs, re.I):
            continue
        inner = re.sub(r"</td\s*>", "", inner, flags=re.I)
        txt = BeautifulSoup(inner, "html.parser").get_text("\n", strip=True)
        cells.append(re.sub(r"[ \t\u3000]+", " ", clean(txt)))
    n = next((i for i, c in enumerate(cells) if c == "1"), -1)
    if not 2 <= n <= 8:
        return None
    body = cells[n:]
    rows = []
    for i in range(0, len(body), n):
        r = body[i:i + n]
        r += [""] * (n - len(r))
        if r[0] != str(len(rows) + 1):       # 連番が途切れたらそこまで
            break
        rows.append(r)
    return {"head": cells[:n], "rows": rows, "via": "F"} if len(rows) >= 2 else None


def _extract_plan(html, parser="lxml"):
    soup = BeautifulSoup(html, parser)
    for r in soup.select("#rubric_tablehidden_i, script, style, noscript"):
        r.decompose()
    main = soup.select_one("td#main") or soup.body or soup
    anchor = _plan_anchor(main)
    if anchor is not None:
        tr = anchor.find_parent("tr")
        if tr is not None:
            # A: 「授業計画」の行の中に入れ子になっている表
            rows = []
            for t in _outermost(tr.find_all("table")):
                rows += _table_rows(t)
            p = _pack(rows, "A")
            if p:
                return p
            # B: 「授業計画」の行より後ろ、次の見出し行までの行(表、または表のように並んだ行)
            tabs, loose = [], []
            for sib in tr.find_next_siblings("tr"):
                if _is_label_row(sib):
                    break
                ts = _outermost(sib.find_all("table"))
                if ts:
                    tabs += ts
                else:
                    cells = sib.find_all(["th", "td"], recursive=False)
                    vals = [re.sub(r"[ \t\u3000]+", " ", clean(c.get_text("\n", strip=True))) for c in cells]
                    if len(vals) >= 2 and any(vals):
                        loose.append(vals)
            rows = []
            for t in tabs:
                rows += _table_rows(t)
            p = _pack(rows, "B") or _pack(loose, "B")
            if p:
                return p
    # C: 「回 / 内容」のような見出しを持つ、いちばん内側の表を探す
    best = None
    for t in main.find_all("table"):
        if t.find("table"):
            continue
        rows = _table_rows(t)
        if len(rows) >= 3 and any(PLAN_HEAD.match(re.sub(r"\s+", "", c)) for c in rows[0]):
            if best is None or len(rows) > len(best):
                best = rows
    return _pack(best, "C") if best else None


def _anchor_outline(html, limit=6000):
    """調査用: 「授業計画」まわりのHTMLを切り出す"""
    soup = BeautifulSoup(html, "lxml")
    main = soup.select_one("td#main") or soup.body or soup
    a = _plan_anchor(main)
    if a is None:
        return "(「授業計画」の文字が見つかりませんでした)"
    tr = a.find_parent("tr")
    parts = [str(tr if tr is not None else a)]
    if tr is not None:
        for sib in tr.find_next_siblings("tr")[:3]:
            parts.append(str(sib))
    return "\n<!-- ---- 次の行 ---- -->\n".join(parts)[:limit]


def save_raw(code, html):
    RAW.mkdir(parents=True, exist_ok=True)
    with gzip.open(RAW / f"{code}.html.gz", "wt", encoding="utf-8") as f:
        f.write(html)


def fetch_html(row, delay, retries, pace, local, backoff):
    """詳細ページのHTMLだけを取る(再試行つき)。404など4xxは None"""
    sess = getattr(local, "sess", None)
    if sess is None:
        sess = local.sess = requests.Session()
    url = DETAIL.format(y=row["y"], s=row["s"], c=row["c"], cr=row["cr"])
    err = None
    for attempt in range(1, retries + 1):
        pace.wait()
        time.sleep(delay * random.uniform(0.7, 1.3))
        try:
            r = sess.get(url, headers=UA, timeout=90)
            if 400 <= r.status_code < 500 and r.status_code not in (408, 429):
                return None
            r.raise_for_status()
            return decode_html(r)
        except Exception as e:
            err = e
            local.sess = sess = requests.Session()
            wait = min(backoff * attempt, backoff * 6)
            pace.cool(wait)
            print(f"  ⚠ {row['c']} 通信失敗({attempt}/{retries}): {type(e).__name__} → 全体で{wait}秒休みます")
    raise err


def apply_plan(row, html):
    """HTMLから授業計画を取り出し、詳細JSONに書き足す。詳細JSONが無ければ全体を読んで作る。戻り値: (詳細JSON or None, 計画 or None)"""
    d = read_detail(row["c"])
    if d is None:
        d = parse_detail(html, row)
        if not detail_ok(d):
            return None, None
        write_detail(row["c"], d)
        return d, d.get("plan") or None
    p = extract_plan(html)
    d["plan"] = p or {}
    write_detail(row["c"], d)
    return d, p


def run_plan(rows, a):
    """B表にある講義だけ、詳細ページを取り直して授業計画を保存する"""
    try:
        codes = list(json.loads(pathlib.Path(a.plan).read_text(encoding="utf-8")).get("rows", {}))
    except Exception as e:
        print(f"--plan のファイルを読めませんでした: {e}")
        return
    by = {r["c"]: r for r in rows}
    targets = [by[c] for c in codes if c in by]
    print(f"B表 {len(codes)}件のうち、講義一覧にあるもの {len(targets)}件")
    todo = []
    for r in targets:
        d = read_detail(r["c"])
        if d is not None and "plan" in d and not a.force:
            continue
        todo.append(r)
    print(f"授業計画が未確認: {len(todo)}件 → {a.workers}並列で取得します(取得済み {len(targets) - len(todo)}件はスキップ)")
    if not todo:
        return
    pace, local = Pace(), threading.local()
    found = empty = gone = bad = fail = 0
    empty_codes = []

    def job(r):
        html = fetch_html(r, a.delay, a.retries, pace, local, a.backoff)
        if html is None:
            return r, "gone", None
        save_raw(r["c"], html)
        d, p = apply_plan(r, html)
        if d is None:
            return r, "bad", None
        return r, ("found" if p else "empty"), p

    t0 = time.time()
    ex = ThreadPoolExecutor(max_workers=a.workers)
    try:
        futs = [ex.submit(job, r) for r in todo]
        for i, f in enumerate(as_completed(futs), 1):
            try:
                r, st, _ = f.result()
            except Exception as e:
                fail += 1
                print(f"  ❌ あきらめました: {type(e).__name__}")
                continue
            if st == "found":
                found += 1
            elif st == "empty":
                empty += 1
                empty_codes.append(r["c"])
            elif st == "gone":
                gone += 1
            else:
                bad += 1
            if i % 50 == 0:
                rate = i / (time.time() - t0)
                print(f"  {i}/{len(todo)} (計画あり{found} 計画なし{empty} 通信失敗{fail}) 残り約{(len(todo) - i) / rate / 60:.0f}分")
    except KeyboardInterrupt:
        print("\n中断します。取得済みの分は保存されています…")
        ex.shutdown(wait=False, cancel_futures=True)
    finally:
        ex.shutdown(wait=True, cancel_futures=True)
    print("\n==== 終了 ====")
    print(f"授業計画あり {found}件 / 計画の表なし {empty}件 / ページなし {gone}件 / 読み取れず {bad}件 / 通信失敗 {fail}件")
    if empty_codes:
        print(f"  表が見つからなかった例: {empty_codes[:8]}  (HTMLは data/raw/<コード>.html.gz。python3 scrape.py --probe <コード> で調べられます)")
    if fail:
        print("もう一度同じコマンドを実行すると、未確認分だけ続きから取得します。")


def enrich_all(rows):
    """保存済みの詳細JSONから、講義一覧(index.json)に学部カテゴリ・区分・単位などを書き込む"""
    n = 0
    for row in rows:
        d = read_detail(row["c"])
        if d:
            enrich(row, d)
            n += 1
    save_index(rows)
    withcat = sum(1 for r in rows if r.get("cat"))
    print(f"index.json を更新しました: 詳細あり {n}件 / 学部カテゴリあり {withcat}件 / 全 {len(rows)}件")


def run_probe(rows, code, a):
    """1件だけ取得して、授業計画がどう見つかったかを表示する(構造調べ用)"""
    row = next((r for r in rows if r["c"] == code), None)
    if not row:
        print(f"{code} は index.json にありません")
        return
    html = fetch_html(row, 0, a.retries, Pace(), threading.local(), a.backoff)
    if html is None:
        print("ページを取得できませんでした(4xx)")
        return
    save_raw(code, html)
    outline = OUT / f"plan_probe_{code}.html"
    outline.write_text(_anchor_outline(html, 20000), encoding="utf-8")
    p = extract_plan(html)
    print(f"{code} {row['n']}")
    if not p:
        print("  → 授業計画の表を見つけられませんでした。")
        print(f"  {outline} の中身(「授業計画」まわりのHTML)を貼ってもらえれば、それに合わせて直します。")
        return
    print(f"  → 見つかりました(方式 {p['via']}) 見出し {p['head']} / {len(p['rows'])}行")
    for r in p["rows"][:4]:
        print("   ", [c[:30] for c in r])
    print(f"  参考: {outline} に「授業計画」まわりのHTMLを保存しました")


def reparse_plan(rows):
    """ネットに繋がずに、data/raw/ の保存済みHTMLから授業計画だけ読み直す"""
    by = {r["c"]: r for r in rows}
    found = empty = 0
    for p in sorted(RAW.glob("*.html.gz")):
        code = p.name[:-8]
        row = by.get(code)
        if not row:
            continue
        with gzip.open(p, "rt", encoding="utf-8") as f:
            html = f.read()
        d, pl = apply_plan(row, html)
        if d is None:
            continue
        found, empty = (found + 1, empty) if pl else (found, empty + 1)
    print(f"読み直し結果: 計画あり {found}件 / 計画の表なし {empty}件")



def detail_ok(d):
    """詳細JSONが正常か(エラーページを保存してしまっていないか)"""
    s = d.get("sections") if isinstance(d, dict) else None
    if not s:
        return False
    return any(isinstance(v, dict) and ("全文" in v or any(k in v for k in NAME_KEYS)) for v in s.values())


ART_COURSES = [("28", "環境設計"), ("29", "インダストリアル"), ("30", "未来構想|未来"), ("31", "メディア"), ("32", "音響")]


def _courses_in(text):
    return [k for k, kw in ART_COURSES if re.search(kw, text)]


def _years(g):
    g = g.replace("～", "-").replace("~", "-")
    m = re.search(r"(\d)\s*-\s*(\d)", g)
    if m:
        return list(range(int(m.group(1)), int(m.group(2)) + 1))
    return sorted({int(d) for d in re.findall(r"[1-4]", g)})


def art_targets(o):
    """芸術工学部の科目の対象コース・学年・必修選択を読む。
    cx = {コース番号(28環境 29ID 30未来 31メディア 32音響): h=必修 / s=選択必修 / e=選択}, yr = 対象学年のリスト(空=全学年)"""
    tg = re.split(r"[A-Za-z]", o.get("対象学部等", ""), 1)[0]
    targets = _courses_in(tg) or [k for k, _ in ART_COURSES]
    rq = re.split(r"[A-Za-z]", o.get("必修選択", ""), 1)[0]
    code = {"必修": "h", "選択必修": "s", "選択": "e"}
    cx = {}
    segs = re.findall(r"(選択必修|選択|必修)\s*[:：]\s*(.*?)(?=(?:選択必修|選択|必修)\s*[:：]|$)", rq, re.S)
    if segs:
        for kind, body in segs:
            hit = _courses_in(body)
            if "以外" in body:
                hit = [k for k, _ in ART_COURSES if k not in hit]
            for k in hit:
                cx[k] = code[kind]
        for k in targets:
            cx.setdefault(k, "e")
    else:
        m = re.match(r"\s*(選択必修|選択|必修)", rq)
        for k in targets:
            cx[k] = code[m.group(1)] if m else "e"
    g = re.split(r"[A-Za-z]", o.get("対象学年", ""), 1)[0]
    return {"cx": cx, "yr": [] if "全学年" in g else _years(g)}


def enrich(row, detail):
    s = detail.get("sections", {})
    o = next((v for k, v in s.items() if "概要" in k), {})
    p = next((v for k, v in s.items() if "目的" in k), {})
    row.update(cat=o.get("学部カテゴリ", ""), kbn=o.get("授業科目区分", ""), lang=o.get("使用言語", ""),
               credit=o.get("単位数", ""), campus=o.get("開講地区", ""), grade=o.get("対象学年", ""),
               kw=p.get("キーワード", ""))
    if row["cat"] == "芸術工学部":
        row.update(art_targets(o))
    # 全文形式のページ: 本文から拾えるものだけ拾う
    full = o.get("全文", "")
    if full:
        lines = full.split("\n")
        def after(label):
            for i, x in enumerate(lines[:-1]):
                if x == label and lines[i + 1]:
                    return lines[i + 1]
            return ""
        row["credit"] = row["credit"] or after("単位数")
        row["lang"] = row["lang"] or after("使用言語")
        row["kw"] = row["kw"] or after("キーワード")
    return row


# ---------------------------------------------------------------- 講義一覧
def form_data(soup, overrides, button):
    """同じ name を複数送れるよう (name, value) のリストで作る"""
    form = soup.find("form")
    if not form:
        raise RuntimeError("検索フォームが見つかりません")
    data = []
    for el in form.find_all(["input", "select", "textarea"]):
        name = el.get("name")
        if not name:
            continue
        typ = (el.get("type") or "").lower()
        if typ in ("button", "submit", "image", "reset"):
            continue
        if typ in ("checkbox", "radio"):
            if el.has_attr("checked"):
                data.append((name, el.get("value", "")))
            continue
        if el.name == "select":
            o = el.find("option", selected=True) or el.find("option")
            data.append((name, o.get("value", "") if o else ""))
        elif el.name == "textarea":
            data.append((name, el.get_text()))
        else:
            data.append((name, el.get("value", "")))
    for key, value in overrides.items():
        data = [(k, v) for k, v in data if k != key]
        for v in (value if isinstance(value, (list, tuple)) else [value]):
            data.append((key, str(v)))
    data = [(k, v) for k, v in data if k != "buttonName"] + [("buttonName", button)]
    return urljoin(BASE, form.get("action") or ""), data


def post_form(sess, soup, overrides, button, delay, debug):
    url, data = form_data(soup, overrides, button)
    time.sleep(delay)
    r = sess.post(url, data=data, headers=UA, timeout=90)
    r.raise_for_status()
    if debug:
        (OUT / "debug_last.html").write_text(r.text, encoding="utf-8")
    return r.text


def live_list(year, delay, debug):
    sess = requests.Session()
    print("検索ページを取得中...")
    r = sess.get(SEARCH, headers=UA, timeout=60)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    form = soup.find("form")
    if not form:
        raise RuntimeError("検索フォームが見つかりません")
    faculties = [x.get("value") for x in form.find_all(
        "input", attrs={"type": "checkbox", "name": "values(multiKaikoSyozoku)"}) if x.get("value")]
    if not faculties:
        raise RuntimeError("開講学部・学府のチェックボックスが見つかりません")
    print(f"  検索条件: 年度={year}, 開講学部・学府={len(faculties)}件")
    html = post_form(sess, soup, {"value(nendo)": str(year), "values(multiKaikoSyozoku)": faculties},
                     "searchKougi", delay, debug)
    rows, total = parse_list(html)
    print(f"  検索結果: {total}件")
    if not total:
        return []
    html = post_form(sess, BeautifulSoup(html, "lxml"),
                     {"value(pageCount)": "", "value(maxCount)": "200"}, "navigateKougiList", delay, debug)
    rows, t2 = parse_list(html)
    total = t2 or total
    seen = {r_["c"]: r_ for r_ in rows}
    pages = math.ceil(total / 200)
    for p in range(2, pages + 1):
        html = post_form(sess, BeautifulSoup(html, "lxml"),
                         {"value(pageCount)": str(p), "value(maxCount)": "200"}, "navigateKougiList", delay, debug)
        page_rows, _ = parse_list(html)
        for r_ in page_rows:
            seen[r_["c"]] = r_
        print(f"  {p}/{pages}ページ (累計 {len(seen)}件)")
    return list(seen.values())


# ---------------------------------------------------------------- 保存
def save_index(rows):
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / "index.json.tmp"
    tmp.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(OUT / "index.json")


def load_index():
    """使える index.json だけ返す(なければ None)"""
    p = OUT / "index.json"
    try:
        rows = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(rows, list) or not rows:
        return None
    if not all(isinstance(r, dict) and all(r.get(k) for k in ("c", "y", "s", "cr", "n")) for r in rows):
        return None
    return rows


def read_detail(code):
    p = DETAIL_DIR / f"{code}.json"
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        return d if detail_ok(d) else None
    except Exception:
        return None


def write_detail(code, d):
    p = DETAIL_DIR / f"{code}.json"
    tmp = DETAIL_DIR / f"{code}.json.tmp"
    tmp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    tmp.replace(p)


# ---------------------------------------------------------------- 詳細(並列)
class Pace:
    """通信エラーが出たら全ワーカーがまとめて一休みする"""
    def __init__(self):
        self.until = 0.0
        self.lock = threading.Lock()

    def wait(self):
        d = self.until - time.time()
        if d > 0:
            time.sleep(d)

    def cool(self, sec):
        with self.lock:
            self.until = max(self.until, time.time() + sec)


class Unparsed(Exception):
    """通信は成功したが、シラバスの内容を読み取れなかったページ"""
    def __init__(self, html, status=200, url=""):
        super().__init__("読み取れないページ")
        self.html = html
        self.status = status
        self.url = url


def find_next_url(html, base):
    """フレーム/iframe/リダイレクトで本文が別URLにある場合、そのURLを返す"""
    soup = BeautifulSoup(html, "lxml")
    for t in soup.find_all(["frame", "iframe"]):
        if t.get("src") and not t["src"].startswith(("javascript:", "about:")):
            return urljoin(base, t["src"])
    m = soup.find("meta", attrs={"http-equiv": re.compile("refresh", re.I)})
    if m:
        mm = re.search(r"url\s*=\s*['\"]?([^'\";]+)", m.get("content", ""), re.I)
        if mm:
            return urljoin(base, mm.group(1).strip())
    mm = re.search(r"location(?:\.href)?\s*=\s*['\"]([^'\"]+)['\"]", html)
    if mm:
        return urljoin(base, mm.group(1))
    return None


def fetch_one(row, delay, retries, pace, local, backoff):
    sess = getattr(local, "sess", None)
    if sess is None:
        sess = local.sess = requests.Session()
    url = DETAIL.format(y=row["y"], s=row["s"], c=row["c"], cr=row["cr"])
    err = None
    unparsed = 0
    for attempt in range(1, retries + 1):
        pace.wait()
        time.sleep(delay * random.uniform(0.7, 1.3))
        try:
            r = sess.get(url, headers=UA, timeout=90)
            # 404 など「そのページが無い」系は通信の問題ではないので、全体を休ませず除外扱いにする
            if 400 <= r.status_code < 500 and r.status_code not in (408, 429):
                raise Unparsed(decode_html(r), r.status_code, r.url)
            r.raise_for_status()
            html = decode_html(r)
            d = parse_detail(html, row)
            if not detail_ok(d):
                nxt = find_next_url(html, r.url)      # 本文が別ページ(フレーム等)にある場合
                if nxt and nxt != r.url:
                    time.sleep(delay)
                    r2 = sess.get(nxt, headers=UA, timeout=90)
                    r2.raise_for_status()
                    html2 = decode_html(r2)
                    d = parse_detail(html2, row)
                    if detail_ok(d):
                        d["url"] = url
                    else:
                        raise Unparsed(html2, r2.status_code, r2.url)
                else:
                    raise Unparsed(html, r.status_code, r.url)
            write_detail(row["c"], d)
            return d
        except Unparsed as e:
            # 通信は成功している。全体を休ませず、1回だけ短く待って再確認する
            unparsed += 1
            err = e
            if unparsed >= 2 or e.status >= 400:
                raise
            time.sleep(3)
        except Exception as e:
            err = e
            local.sess = sess = requests.Session()   # 接続を作り直す
            wait = min(backoff * attempt, backoff * 6)
            pace.cool(wait)
            print(f"  ⚠ {row['c']} 通信失敗({attempt}/{retries}): {type(e).__name__} → 全体で{wait}秒休みます")
    raise err


def preview(html, n=300):
    txt = BeautifulSoup(html, "lxml").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", txt)[:n]


def page_title(html):
    t = BeautifulSoup(html, "lxml").title
    return re.sub(r"\s+", " ", t.get_text(" ", strip=True))[:60] if t else ""


def diagnose(items):
    """読み取れなかったページの特徴をまとめて表示・保存する(原因調べ用)"""
    report, groups = {}, {}
    for code, html, status, url in items:
        txt = BeautifulSoup(html, "lxml").get_text(" ", strip=True)
        txt = re.sub(r"\s+", " ", txt)
        info = {"status": status, "len": len(txt), "title": page_title(html), "hits": syllabus_hits(txt),
                "html_bytes": len(html), "final_url": url, "head": txt[:160]}
        report[code] = info
        key = (status, info["title"], txt[:40], min(len(txt) // 500, 6))
        groups.setdefault(key, []).append(code)
    (OUT / "unparsed_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\n---- 読み取れなかったページの内訳(多い順) ----")
    for (status, title, head, lb), codes in sorted(groups.items(), key=lambda x: -len(x[1]))[:6]:
        print(f"  {len(codes):4d}件  HTTP {status} / タイトル「{title}」 / 冒頭「{head}」 / 文字数 約{lb*500}〜 例: {codes[0]}")
    print("  詳細は data/unparsed_report.json、HTMLは data/unparsed/<講義コード>.html にあります\n")


def reparse_saved(rows):
    """ネットに繋がずに、data/unparsed/ に保存済みのHTMLを今のパーサーで読み直す"""
    by_code = {r["c"]: r for r in rows}
    skipped = load_skipped()
    ok = left = 0
    for p in sorted(UNP.glob("*.html")):
        row = by_code.get(p.stem)
        if not row:
            continue
        d = parse_detail(p.read_text(encoding="utf-8"), row)
        if detail_ok(d):
            write_detail(row["c"], d)
            enrich(row, d)
            skipped.pop(row["c"], None)
            p.unlink()
            ok += 1
        else:
            left += 1
    save_index(rows)
    save_skipped(skipped)
    print(f"読み直し結果: 読めた {ok}件 / まだ読めない {left}件")


def load_skipped():
    try:
        return json.loads((OUT / "skipped.json").read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_skipped(sk):
    (OUT / "skipped.json").write_text(json.dumps(sk, ensure_ascii=False, indent=0), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--workers", type=int, default=6, help="同時取得数(推奨 4〜8)")
    ap.add_argument("--delay", type=float, default=0.5, help="各ワーカーのリクエスト間隔(秒)")
    ap.add_argument("--retries", type=int, default=5)
    ap.add_argument("--backoff", type=float, default=10, help="失敗時の待ち時間の基準(秒)")
    ap.add_argument("--refresh-list", action="store_true", help="講義一覧を取り直す")
    ap.add_argument("--retry-skipped", action="store_true", help="読み取れなかった講義も再挑戦する")
    ap.add_argument("--priority", help="このJSON(data/btable.json)に載っている講義コードを先に取得する")
    ap.add_argument("--reparse", action="store_true", help="通信せず、data/unparsed/ のHTMLを読み直す")
    ap.add_argument("--plan", help="このJSON(data/btable.json)に載っている講義だけ、授業計画(回ごとの表)を取り直す")
    ap.add_argument("--probe", help="講義コード1件だけ取得して、授業計画の見つかり方を表示する")
    ap.add_argument("--reparse-plan", action="store_true", help="通信せず、data/raw/ の保存済みHTMLから授業計画を読み直す")
    ap.add_argument("--enrich", action="store_true", help="通信せず、保存済みの詳細から index.json の学部カテゴリ等を更新する")
    ap.add_argument("--force", action="store_true", help="--plan で取得済みの講義も取り直す")
    ap.add_argument("--debug", action="store_true")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    DETAIL_DIR.mkdir(parents=True, exist_ok=True)

    # 1. 講義一覧
    rows = None if a.refresh_list else load_index()
    if rows:
        print(f"既存の index.json を使います: {len(rows)}件 (取り直すなら --refresh-list)")
    else:
        print("講義一覧を取得中...")
        try:
            rows = live_list(a.year, 1.5, a.debug)
        except Exception as e:
            print(f"講義一覧を取得できませんでした: {type(e).__name__}: {e}")
            rows = load_index()
            if rows:
                print(f"→ 既存の index.json ({len(rows)}件) で続行します")
        if not rows:
            print("講義一覧が0件のため終了します。")
            return
        save_index(rows)
        print(f"✓ index.json を保存 ({len(rows)}件)")

    if a.probe:
        run_probe(rows, a.probe, a)
        return
    if a.enrich:
        enrich_all(rows)
        return
    if a.reparse_plan:
        reparse_plan(rows)
        return
    if a.plan:
        run_plan(rows, a)
        enrich_all(rows)
        return
    if a.reparse:
        reparse_saved(rows)
        return

    # 2. 取得済みの詳細を index に反映し、未取得を洗い出す
    skipped = {} if a.retry_skipped else load_skipped()
    todo, n_skip = [], 0
    for row in rows:
        d = read_detail(row["c"])
        if d:
            enrich(row, d)
        elif row["c"] in skipped:
            n_skip += 1
        else:
            todo.append(row)
    if a.priority:
        try:
            pri = set(json.loads(pathlib.Path(a.priority).read_text(encoding="utf-8")).get("rows", {}))
        except Exception as e:
            pri = set()
            print(f"--priority のファイルを読めませんでした: {e}")
        todo.sort(key=lambda r: r["c"] not in pri)          # 先に取りたい講義を前へ(それ以外の順番は変えない)
        print(f"優先して取得する講義: {sum(1 for r in todo if r['c'] in pri)}件")
    done0 = len(rows) - len(todo) - n_skip
    save_index(rows)
    print(f"詳細: 取得済み {done0}件 / 読み取れず除外 {n_skip}件 / 未取得 {len(todo)}件 → {a.workers}並列で取得します")
    if not todo:
        print("すべて取得済みです。")
        return

    # 3. 並列取得
    pace, local = Pace(), threading.local()
    ok = fail = nparse = 0
    unp_items = []
    UNP.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    ex = ThreadPoolExecutor(max_workers=a.workers)
    try:
        futs = {ex.submit(fetch_one, r, a.delay, a.retries, pace, local, a.backoff): r for r in todo}
        for i, f in enumerate(as_completed(futs), 1):
            row = futs[f]
            try:
                enrich(row, f.result())
                ok += 1
            except Unparsed as e:
                nparse += 1
                skipped[row["c"]] = f"読み取れないページ(HTTP {e.status})"
                (UNP / f"{row['c']}.html").write_text(e.html, encoding="utf-8")
                unp_items.append((row["c"], e.html, e.status, e.url))
                if nparse <= 3:
                    print(f"  ✗ {row['c']} は内容を読み取れません(HTML保存: data/unparsed/{row['c']}.html)")
                    print(f"      画面の文字: {preview(e.html)}")
            except Exception as e:
                fail += 1
                print(f"  ❌ {row['c']} をあきらめました: {type(e).__name__}")
            if i % 100 == 0:
                save_index(rows)
                save_skipped(skipped)
                rate = i / (time.time() - t0)
                left = (len(todo) - i) / rate / 60 if rate else 0
                print(f"  {done0 + i}/{len(rows)} (今回 成功{ok} 読み取れず{nparse} 通信失敗{fail}) 残り約{left:.0f}分")
    except KeyboardInterrupt:
        print("\n中断します。取得済みの分は保存されています…")
        ex.shutdown(wait=False, cancel_futures=True)
    finally:
        ex.shutdown(wait=True, cancel_futures=True)
        save_index(rows)
        save_skipped(skipped)
        if unp_items:
            diagnose(unp_items)

    print("\n==== 終了 ====")
    print(f"今回 成功 {ok}件 / 読み取れず {nparse}件 / 通信失敗 {fail}件 / 全体の取得済み {done0 + ok}/{len(rows)}件")
    if fail:
        print("もう一度同じコマンドを実行すると、未取得分だけ続きから取得します。")


if __name__ == "__main__":
    main()
