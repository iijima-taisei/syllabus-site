#!/usr/bin/env python3
"""科目名の読み(ひらがな)を作り data/yomi.json に保存する。ひらがなで科目名を検索するための非表示のふりがな。
使い方: python3 build_yomi.py   (pykakasi が必要。通信なし)
出力: {"科目名": "よみ", ...}  読みが科目名と同じ(英語名など)ものは入れない。"""
import json, pathlib, unicodedata
import pykakasi

ROOT = pathlib.Path(__file__).parent
kks = pykakasi.kakasi()


def yomi(name):
    s = "".join(x["hira"] for x in kks.convert(name))
    return unicodedata.normalize("NFKC", s).lower().replace(" ", "")


def main():
    rows = json.loads((ROOT / "data" / "index.json").read_text(encoding="utf-8"))
    out = {}
    for n in sorted({r["n"] for r in rows if r.get("n")}):
        y = yomi(n)
        if y and y != unicodedata.normalize("NFKC", n).lower().replace(" ", ""):
            out[n] = y
    (ROOT / "data" / "yomi.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"data/yomi.json: {len(out)}件")


if __name__ == "__main__":
    main()
