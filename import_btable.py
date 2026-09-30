#!/usr/bin/env python3
"""基幹教育科目 開講一覧(B表)のPDFを読み取り、data/btable.json を作る。

準備:  pip3 install pdfplumber
実行:  python3 import_btable.py 2026z_jikan_tableB_20260616.pdf 2026k_jikan_tableB_20260929.pdf
       (前期・後期のPDFを続けて指定。何度でも作り直せます)

出力 data/btable.json:  {"versions":{"前期":"2026/6/16","後期":"2026/9/29"},
  "rows":{"<講義コード>":{cat,name,sem,day[],per[],cls,cs[],fl[],campus,room,apply,teacher,note,term}}}
  cs = 担当クラスを展開したもの(例 "S1-31")、fl = ALL(全学年) / IUPE / HIGH(3年生以上)
index.html はこのファイルを読んで「自分のクラスで受講可能」の絞り込みや抽選バッジを出します。
"""
import argparse, json, pathlib, re, sys, unicodedata
import pdfplumber

OUT = pathlib.Path(__file__).parent / "data"
# 表の見出しの左端(pt)。PDFのレイアウトが変わったら警告を出す
HEAD_X = {"講義コード": 71, "科目区分": 111, "科目名": 201, "学期": 274, "曜日": 290, "時限": 303,
          "担当クラス": 378, "開講地区": 470, "教室": 512, "事前申請": 537, "担当教員氏名": 579, "備考": 698}
CUTS = [("code", 92), ("cat", 147), ("name", 270), ("sem", 285), ("day", 298), ("per", 314), ("cls", 462),
        ("campus", 510), ("room", 536), ("apply", 555), ("teacher", 629), ("note", 10**6)]
MARKS = set("○〇●※")


def nk(t):
    return unicodedata.normalize("NFKC", t)


def nc(t):                      # 互換漢字(令・年など)を通常の字にそろえる
    return unicodedata.normalize("NFC", t)


COLS = ["code", "cat", "name", "sem", "day", "per", "cls", "campus", "room", "apply", "teacher", "note"]


def make_cuts(page):
    """表の縦罫線から列の境目を取る(ページごとに表の幅が違うため)。罫線が読めなければ既定値"""
    xs = sorted(e["x0"] for e in page.edges if e["orientation"] == "v" and e["bottom"] - e["top"] > 100)
    cl = []
    for x in xs:
        if not cl or x - cl[-1] > 1.5:
            cl.append(x)
    if len(cl) != len(COLS) + 1:
        return None
    return [(name, cl[i + 1] - 0.5) for i, name in enumerate(COLS[:-1])] + [("note", 10**6)]


def col_of(x0, cuts=CUTS):
    for name, lim in cuts:
        if x0 < lim:
            return name


def norm_dash(s):
    return re.sub(r"[‒‑–—−﹣－]", "-", s)


CLASS_MAX = {"I1": 3, "L1": 14}   # I1-1〜3 / L1-1〜14 まで。超える番号は S1(理・医・工・芸工・農)の続き(例「L1-5、28、29」)


def pre_of(cur, n):
    return "S1" if cur in CLASS_MAX and n > CLASS_MAX[cur] else cur


def expand_classes(raw):
    """「S1‒8～10、16～18、L1‒1～4」→ ({'S1-8',...}, {'ALL'...})"""
    s = norm_dash(raw.replace("\u3000", " "))
    flags = set()
    if "全学年" in s:
        flags.add("ALL")
    if "IUPE" in s:
        flags.add("IUPE")
    if "全学部" in s or "3年生以上" in s or "３年生以上" in s:
        flags.add("HIGH")
    out, cur = set(), None
    body = re.sub(r"[（(][^）)]*[）)]", lambda m: "" if re.fullmatch(r"[（(]\d[）)]", m.group()) else m.group(), s)
    for tok in re.split(r"[、,，]", re.sub(r"\s+", "", body)):
        m = re.match(r"^([A-Z]\d)-(.+)$", tok)
        if m:
            cur, tok = m.group(1), m.group(2)
        if not cur:
            continue
        m = re.match(r"^(\d+)[～〜~∼-](\d+)$", tok)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            out.update(f"{pre_of(cur, i)}-{i}" for i in range(a, b + 1))
        elif re.fullmatch(r"\d+", tok):
            out.add(f"{pre_of(cur, int(tok))}-{tok}")
    return sorted(out, key=lambda x: (x[:2], int(x.split("-")[1]))), sorted(flags)


def signature(words):
    """見出しの位置の並び。同じ並びのページは同じ列幅とみなす"""
    H = {}
    for w in words:
        t = nk(w["text"])
        if t in HEAD_X and t not in H:
            H[t] = round(w["x0"])
    return tuple(H.get(k) for k in HEAD_X)


def boundaries(page):
    ys = sorted(e["top"] for e in page.edges if e["orientation"] == "h" and e["x1"] - e["x0"] > 400)
    merged = []
    for y in ys:
        if not merged or y - merged[-1] > 2:
            merged.append(y)
    return merged


def join_col(words, sep, f=None):
    f = f or nc
    lines = {}
    for w in words:
        lines.setdefault(round(w["top"] / 2), []).append(w)
    out = []
    for k in sorted(lines):
        out.append(" ".join(w["text"] for w in sorted(lines[k], key=lambda w: w["x0"])))
    return f(sep.join(out))


def parse_pdf(path):
    rows, term, date = {}, None, None
    with pdfplumber.open(path) as pdf:
        pages = []
        by_sig = {}
        for pi, page in enumerate(pdf.pages):                 # 1周目: 罫線から列位置を取る
            words = page.extract_words(x_tolerance=1.5, y_tolerance=2)
            cuts, sig = make_cuts(page), signature(words)
            if cuts:
                by_sig.setdefault(sig, cuts)
            pages.append((page, words, cuts, sig))
        for pi, (page, words, cuts, sig) in enumerate(pages):
            text = nk(" ".join(w["text"] for w in words[:40]))
            if term is None:
                m = re.search(r"令和\S*年度(前期|後期)", text)
                term = m.group(1) if m else None
                m = re.search(r"\d{4}/\d{1,2}/\d{1,2}", text)
                date = m.group() if m else None
            if not cuts:                                       # 罫線が読めないページは、同じ体裁のページの列位置を借りる
                cuts = by_sig.get(sig)
                if cuts is None:
                    print(f"  ⚠ p{pi+1}: 罫線が読めず、同じ体裁のページもありません。既定の列位置で読みます。", file=sys.stderr)
                    cuts = CUTS
            bs = boundaries(page)
            for b0, b1 in zip(bs, bs[1:]):
                if not (5 < b1 - b0 < 90):
                    continue
                inside = [w for w in words if b0 <= (w["top"] + w["bottom"]) / 2 < b1]
                code = next((w for w in inside if re.fullmatch(r"\d{8}", w["text"]) and w["x0"] < cuts[0][1]), None)
                if not code:
                    continue
                cols = {}
                for w in inside:
                    cols.setdefault(col_of(w["x0"], cuts), []).append(w)
                # 事前申請の欄に印以外の文字が来たら、教室の続きとして扱う
                ap = [w for w in cols.pop("apply", []) if True]
                marks = [w for w in ap if set(nk(w["text"])) <= MARKS]
                cols.setdefault("room", []).extend(w for w in ap if w not in marks)
                apply = "".join(sorted(set(re.sub("〇", "○", "".join(w["text"] for w in marks)))))
                cls = join_col(cols.get("cls", []), "", nk)
                cs, fl = expand_classes(cls)
                room = join_col(cols.get("room", []), " ").strip()
                per = [int(x) for x in re.findall(r"\d", join_col(cols.get("per", []), " ", nk))]
                day = [d for d in re.findall(r"[月火水木金土日]", join_col(cols.get("day", []), " ", nk))]
                rec = dict(
                    cat=join_col(cols.get("cat", []), ""), name=join_col(cols.get("name", []), " "),
                    sem=join_col(cols.get("sem", []), "", nk), day=day, per=per, cls=norm_dash(cls), cs=cs, fl=fl,
                    campus=join_col(cols.get("campus", []), ""), room="" if room in ("-", "‒") else room,
                    apply=apply, teacher=join_col(cols.get("teacher", []), "、"),
                    note=join_col(cols.get("note", []), " "), term=term)
                rows.setdefault(code["text"], rec)      # 連続コマの授業は各時限に載るので先勝ち
    return term, date, rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", nargs="+")
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    versions, allrows = {}, {}
    for p in a.pdf:
        term, date, rows = parse_pdf(p)
        print(f"{p}: {term} {date} → {len(rows)}件")
        if term:
            versions[term] = date
        allrows.update(rows)
    noclass = [c for c, r in allrows.items() if not r["cs"] and not r["fl"]]
    print(f"合計 {len(allrows)}件 / 担当クラスを読み取れなかった講義 {len(noclass)}件" + (f" 例: {noclass[:5]}" if noclass else ""))
    overlap = [c for c, r in allrows.items() if not r["sem"] or not r["day"]]
    if overlap:
        print(f"科目名が長くて隣の列と重なり、学期・曜日を読めなかった講義 {len(overlap)}件(受講可否の判定には影響しません)")
    (OUT / "btable.json").write_text(json.dumps({"versions": versions, "rows": allrows}, ensure_ascii=False,
                                                separators=(",", ":")), encoding="utf-8")
    print(f"→ {OUT/'btable.json'} を保存しました")


if __name__ == "__main__":
    main()
