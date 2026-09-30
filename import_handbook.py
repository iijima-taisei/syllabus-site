#!/usr/bin/env python3
"""芸術工学部 学生便覧(PDF) → data/coursereq.json (メディアデザイン以外の4コースの卒業要件)
使い方: python3 import_handbook.py <学生便覧PDF>   (pdfplumber が必要)
基幹教育科目の要件とデザインリテラシー科目は data/mdreq.json(全コース共通)から流用し、
専攻教育科目の配当表(各コース2ページ)から科目・単位・必修印(◎必修 ○選択必修 空欄=選択)を読む。
配当表の文字は一部が崩れるので、崩れる箇所は FIX / ADD に手で書いてある。出力は必ず便覧と見比べること。"""
import json, re, sys
from pathlib import Path
import pdfplumber

KEI = r"(?:講義|演習|実習|実験|講義[･・]演習|講義[･・]実習|実験[･・]実習|講義[･・]実験[･・])"
ROW = re.compile(r"^(?:[^\sA-Za-z0-9]\s)*(?P<n>\S.*?)\s+(?P<k>" + KEI + r")\s+(?P<c>\d)(?:\s+(?P<m>[◎○]))?(?:\s|$)")
FIX = {"計業卒業研究Ⅰ": "卒業研究Ⅰ", "目（プラットフォーム演習Ｂ": "プラットフォーム演習Ｂ", "メディアデザイン概論I": "メディアデザイン概論Ⅰ",
       "メディアデザイン概論II": "メディアデザイン概論Ⅱ", "Intellectual Property Rights :": "Intellectual Property Rights : Global Perspective"}
LIT_N = 13   # 各コース共通: デザインリテラシー科目は配当表の先頭13行
FUSION = [("コース融合プロジェクトＡ", 4), ("コース融合プロジェクトＢ", 4)]   # 表の文字が崩れて読めない行
COURSES = {
    "28": dict(name="環境設計コース", pages=(19, 20), sen="構造理論Ⅰ", pbl="環境設計プロジェクトＣ", kiso=10, sen_req=30, pbl_req=12, other_min=4,
               kiso_note="必修(◎)を含み、1年次秋学期と冬学期の開講科目から各1単位以上。学科一括入試入学者用の科目を含む",
               start="環境設計プロジェクトC〜Hから8単位以上(コース演習科目PBL)"),
    "29": dict(name="インダストリアルデザインコース", pages=(26, 27), sen="プロダクトデザイン実践論", pbl="プロダクトデザイン実践論・演習Ⅰ", kiso=7, sen_req=21, pbl_req=24, other_min=4,
               kiso_note="必修(◎)を含み、残りは○から。学科一括入試入学者用の科目を含む", start=""),
    "30": dict(name="未来構想デザインコース", pages=(33, 34), sen="芸術表現論", pbl="共通課題PBL演習Ａ", kiso=10, sen_req=30, pbl_req=12, other_min=8,
               kiso_note="必修(◎)を含み、1年次秋学期と冬学期の開講科目から各1単位以上。学科一括入試入学者用の科目を含む", start=""),
    "32": dict(name="音響設計コース", pages=(47, 48), sen="知覚心理学", pbl="音響プログラミング演習", kiso=14, sen_req=22, pbl_req=16, other_min=4,
               kiso_note="必修(◎)14単位すべて", start="コース演習科目(PBL)に「音楽理論表現演習」「音響実験Ⅰ」「音響実験Ⅱ」の単位を含む"),
}
ADD = {   # 読み落とした行: (コース, この科目の直前の科目名) → [(名前, 単位, 印)]
    ("30", "プログラミング基礎"): [("情報科学Ⅰ", 1, "◎"), ("生命科学入門Ⅰ", 1, "◎")],
    ("30", "Design Pitching Skills"): [("Intellectual Property Rights : Global Perspective", 1, "")],
}


EXTRA = {"32": [("データマイニングⅠ", 1), ("データマイニングⅡ", 1)]}   # シラバスにあるが便覧の配当表に無い科目


def parse(pdf, pages):
    rows = []
    for pn in pages:
        for ln in (pdf.pages[pn - 1].extract_text() or "").split("\n"):
            m = ROW.match(ln.strip())
            if not m:
                continue
            n = m["n"].strip()
            n = n if re.search(r"[A-Za-z]{3}", n) else re.sub(r"\s+", "", n)
            if "講義･" in n or "義･義" in n:   # 文字が崩れた行
                continue
            rows.append({"n": FIX.get(n, n), "cr": int(m["c"]), "t": m["m"] or ""})
    return rows


def build(pdf_path):
    md = json.load(open("data/mdreq.json", encoding="utf-8"))
    lit_group = md["senkou"]["groups"][0]
    out = {}
    with pdfplumber.open(pdf_path) as pdf:
        for key, c in COURSES.items():
            rows = parse(pdf, range(c["pages"][0], c["pages"][1] + 1))
            for (k, after), add in ADD.items():
                if k == key:
                    i = next(i for i, r in enumerate(rows) if r["n"] == after)
                    rows[i + 1:i + 1] = [{"n": n, "cr": cr, "t": t} for n, cr, t in add]
            names = [r["n"] for r in rows]
            i_sen, i_pbl = names.index(c["sen"]), names.index(c["pbl"])
            i_res = names.index("卒業研究Ⅰ")
            lit, kiso = rows[:LIT_N], rows[LIT_N:i_sen]
            if key == "32":   # 音響は専門の前に必修の基礎科目(聴覚生理学〜ディジタル信号処理)が並ぶ
                kiso, lit = rows[LIT_N:i_sen], rows[:LIT_N]
            sen, pbl, res = rows[i_sen:i_pbl], rows[i_pbl:i_res], rows[i_res:]
            pbl += [{"n": n, "cr": cr, "t": ""} for n, cr in FUSION]
            sen += [{"n": n, "cr": cr, "t": "", "note": "便覧には載っていない科目(シラバスでは選択必修)"} for n, cr in EXTRA.get(key, [])]
            def tidy(a):
                return [{k: v for k, v in r.items() if v != "" or k == "t"} for r in a]
            nr = sum(r["cr"] for r in kiso if r["t"] == "◎")
            out[key] = {
                "course": c["name"], "total": 128, "kiban": md["kiban"],
                "source": "令和8(2026)年度 芸術工学部学生便覧 pp.5(必要修得単位数表), 履修細目一覧, 専攻教育科目配当表から機械的に読み取り。必ず便覧で確認してください",
                "senkou": {"total": 80, "groups": [
                    lit_group,
                    {"id": "sk-kiso", "name": "コース基礎科目", "req": c["kiso"], "courses": tidy(kiso), "note": c["kiso_note"]},
                    {"id": "sk-sen", "name": "コース専門科目", "req": c["sen_req"], "courses": tidy(sen), "note": "科目群ごとの最低修得単位があります(便覧の配当表で確認)"},
                    {"id": "sk-pbl", "name": "コース演習科目(PBL)・融合プロジェクト", "req": c["pbl_req"], "courses": tidy(pbl), "note": c["start"] or None},
                    {"id": "sk-sin", "name": "深化・展開科目", "req": 12, "derived": True,
                     "note": f"コース専門・演習の最低単位を超えた分 + 他コースの専門・演習科目。うち{c['other_min']}単位以上は他コースの科目"},
                    {"id": "sk-res", "name": "卒業研究・設計", "req": 8, "courses": tidy(res)},
                ]},
                "otherMin": c["other_min"],
                "rules": [
                    "3年次以降の専攻教育科目を履修するには、2年次終了までに45単位を修得(基幹教育の必修的な区分の卒業要件単位を満たし、かつデザインリテラシー基礎を修得していること)。理系ディシプリンからは数理統計学・デザイン史A/B" + ("・空間表現実習Ⅱ" if key == "29" else "") + "を除いて数える",
                    "卒業研究の着手条件: 3年次終了時に総修得104単位以上、基幹教育科目は高年次基幹教育を除いて修得済み、専攻教育科目は必修3単位を含むデザインリテラシー科目8単位(各科目群から1単位以上)" + {
                        "28": "・コース基礎科目10単位・環境設計プロジェクトC〜Hから8単位以上",
                        "29": "・コース基礎科目7単位",
                        "30": "・コース基礎科目7単位",
                        "32": "・コース基礎科目14単位・コース専門科目20単位・コース演習科目(PBL)16単位(音楽理論表現演習・音響実験Ⅰ・音響実験Ⅱを含む)"}[key] + "を修得していること",
                ],
            }
    return out


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    res = build(sys.argv[1])
    for k, v in res.items():
        g = {x["id"]: x for x in v["senkou"]["groups"]}
        print(k, v["course"], {i: (len(x.get("courses", [])), sum(c["cr"] for c in x.get("courses", [])), x["req"]) for i, x in g.items() if "courses" in x})
    Path("data/coursereq.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print("→ data/coursereq.json")
