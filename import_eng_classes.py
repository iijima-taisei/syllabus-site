#!/usr/bin/env python3
"""Moodle「英語のクラス割」の Excel(学術英語・アカデミックリテラシー)から、
クラス記号 → 担当の講義コード の対応だけを作り data/englit.json に保存する。
使い方: python3 import_eng_classes.py <リテラシーのクラス割.xlsx>   (openpyxl が必要。通信なし)
- 学籍番号・氏名などの個人の情報は読み捨て、出力には入れない。
- クラスの学生全員が1つのコマ(1人の教員)に割り振られているクラスだけを出力する(個人単位で分かれるクラスは対象外)。
- コマ・教員名を B表(data/btable.json)の講義と突き合わせて講義コードにする。"""
import collections, json, pathlib, re, sys, unicodedata
import openpyxl

ROOT = pathlib.Path(__file__).parent
DAYS = "月火水木金"


def nz(x):
    s = unicodedata.normalize("NFKC", str(x or ""))
    return re.sub(r"[\s,，.．・]", "", s).lower()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    bt = json.loads((ROOT / "data" / "btable.json").read_text(encoding="utf-8"))
    lit = {k: v for k, v in bt["rows"].items() if "アカデミックリテラシー" in v["name"]}
    wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
    agg = collections.defaultdict(collections.Counter)   # クラス → Counter((学期, 曜, 限, 教員))
    for ws in wb.worksheets:
        t = nz(ws.title)
        m = re.search(rf"([{DAYS}])(\d)", t)
        sem = "秋学期" if "秋" in t else "冬学期" if "冬" in t else ""
        if not m or not sem:
            print("シート名を読めません:", ws.title)
            continue
        teacher = None
        for r in ws.iter_rows(values_only=True):
            c0 = nz(r[0]) if r else ""
            if c0.startswith("担当"):
                teacher = re.split(r"[:：]", unicodedata.normalize("NFKC", str(r[0])), maxsplit=1)[-1]
                continue
            cls = next((nz(c).upper() for c in r if re.fullmatch(r"[ils]1-\d+", nz(c))), None)
            if cls and teacher:
                agg[cls][(sem, m.group(1), int(m.group(2)), teacher)] += 1

    def code_for(sem, d, p, teacher):
        cands = [k for k, v in lit.items() if v["sem"] == sem and d in v["day"] and p in v["per"]]
        tn = nz(teacher)
        hit = [k for k in cands if nz(lit[k]["teacher"])[:3] == tn[:3] or tn in nz(lit[k]["teacher"]) or nz(lit[k]["teacher"]) in tn]
        return hit[0] if len(hit) == 1 else None

    out, skip = {}, []
    for cls, cnt in sorted(agg.items()):
        if len(cnt) != 1:
            skip.append(cls)
            continue
        key = next(iter(cnt))
        code = code_for(*key)
        if code:
            out[cls] = code
        else:
            print("B表の講義と対応づけられません:", cls, key[:3])
    (ROOT / "data" / "englit.json").write_text(json.dumps({
        "source": "Moodle「令和８年度・基幹教育科目履修関係ページ」英語のクラス割(秋冬学期, 2026/9/28更新)のうち、クラス単位で担当が決まる学術英語・アカデミックリテラシー",
        "classes": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"data/englit.json: {len(out)}クラス / 個人単位で分かれるため対象外: {skip}")


if __name__ == "__main__":
    main()
