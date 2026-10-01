#!/usr/bin/env python3
"""基幹教育科目開講時間割枠(A表)のPDF → data/agrid.json (クラスごとの曜日×時限の枠)
使い方: python3 import_atable_grid.py <A表PDF>   (pdfplumber が必要)
枠の種類は塗りの色から読む: 黄=必修(r) / 橙=専攻教育(m) / 白=選択・選択必修(e) / 灰=原則履修不可(x)。
文字は枠の中にある語をつなげただけ。1つのコマが左右で色分けされているときは k が2文字(左右)になる。"""
import json, re, sys, unicodedata
from pathlib import Path
import pdfplumber

COL = {(1.0, 1.0, 0.0): "r", (1.0, 0.75, 0.0): "m", (0.74609, 0.74609, 0.74609): "x", (1.0, 1.0, 1.0): "e"}
LABEL_GRAY = 0.94531
CODE = re.compile(r"([ILS])[1１][－-]([０-９0-9]+)")
DAYS = "月火水木金"


def fill(r):
    c = r.get("non_stroking_color")
    if isinstance(c, (int, float)):
        c = (c, c, c)
    return tuple(round(float(x), 5) for x in c) if c and len(c) == 3 else None


def kind_at(rects, x, y):
    k = "e"
    for r in rects:   # 後から描かれたものが上
        if r["x0"] - 0.5 <= x <= r["x1"] + 0.5 and r["top"] - 0.5 <= y <= r["bottom"] + 0.5:
            f = fill(r)
            if f in COL and f != (1.0, 1.0, 1.0):
                k = COL[f]
    return k


def block_grid(page, rects, words, top, bottom, half):
    x_lo, x_hi = (10, 405) if half == 0 else (405, 810)
    labs = [r for r in rects if fill(r) == (LABEL_GRAY,) * 3 and x_lo <= r["x0"] <= x_lo + 12 and r["x1"] - r["x0"] < 40 and top <= r["top"] <= bottom]
    rows = {}
    for r in labs:
        t = "".join(w["text"] for w in words if r["x0"] <= w["x0"] and w["x1"] <= r["x1"] + 1 and r["top"] <= w["top"] <= r["bottom"])
        if t in "12345" and t:
            rows[int(t)] = r
    if len(rows) < 5:
        return None
    cs = rows[1]["x1"]
    colw = (x_hi - cs) / 5 if half == 1 else 72.0
    grid = []
    for p in range(1, 6):
        r = rows[p]
        line = []
        for d in range(5):
            x0, x1 = cs + colw * d, cs + colw * (d + 1)
            y0, y1 = r["top"], r["bottom"]
            yc = (y0 + y1) / 2
            kl, kr = kind_at(rects, x0 + (x1 - x0) * 0.2, yc), kind_at(rects, x0 + (x1 - x0) * 0.8, yc)
            ws = [w for w in words if x0 - 1 <= (w["x0"] + w["x1"]) / 2 <= x1 + 1 and y0 - 1 <= (w["top"] + w["bottom"]) / 2 <= y1 + 1]
            if not ws:   # 複数の時限にまたがる枠: その枠の中の文字を使う
                for rr in rects:
                    if fill(rr) in COL and fill(rr) != (1.0, 1.0, 1.0) and rr["x0"] - 1 <= (x0 + x1) / 2 <= rr["x1"] + 1 and rr["top"] - 1 <= yc <= rr["bottom"] + 1 and rr["bottom"] - rr["top"] > 25:
                        ws = [w for w in words if rr["x0"] - 1 <= (w["x0"] + w["x1"]) / 2 <= rr["x1"] + 1 and rr["top"] - 1 <= (w["top"] + w["bottom"]) / 2 <= rr["bottom"] + 1]
            ws.sort(key=lambda w: (round(w["top"] / 3), w["x0"]))
            txt = " ".join(w["text"] for w in ws)
            line.append({"k": kl if kl == kr else kl + kr, "t": unicodedata.normalize("NFKC", txt)})
        grid.append(line)
    return grid


def build(path):
    out = {}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            rects = page.rects
            words = page.extract_words()
            heads = []
            for ln in page.extract_text_lines():
                m = CODE.search(ln["text"]) if ln["text"].startswith("【") else None
                if m:
                    heads.append((ln["top"], f"{m.group(1)}1-{int(unicodedata.normalize('NFKC', m.group(2)))}"))
            heads.sort()
            for i, (top, code) in enumerate(heads):
                bottom = heads[i + 1][0] if i + 1 < len(heads) else page.height
                g1, g2 = (block_grid(page, rects, words, top, bottom, h) for h in (0, 1))
                if g1 and g2:
                    out[code] = {"前期": g1, "後期": g2}
                else:
                    print("読めませんでした:", code, bool(g1), bool(g2))
    return out


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    res = build(sys.argv[1])
    Path("data/agrid.json").write_text(json.dumps({"source": "令和8年度 基幹教育科目開講時間割枠(A表) 1年生用 2026/4/14版", "classes": res}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(len(res), "クラス →", "data/agrid.json", sorted(res)[:6], "…")
