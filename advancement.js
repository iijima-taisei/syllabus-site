// 1年次の進級要件判定ロジック
function renderAdvancement(cid, R, doneAll, planAll, kd, kp) {
  // 1年次進級要件を判定する。
  const count = (names) => {
    let d = 0, p = 0;
    for (const n of names) {
      const st = mdStatus(n);
      const c = DATA.find(x => nameKey(x.n) === nameKey(n));
      if (st === 'done') d += (c ? c.cr : 1);
      else if (st === 'plan') p += (c ? c.cr : 1);
    }
    return { d, p, tot: d + p };
  };

  let h = '<section class="gsec"><h3>1年次の進級要件</h3>';
  let rules = [];
  let isTarget = true;

  if (cid.startsWith('文学部')) {
    const jinbun = count(['人文学基礎Ⅰ', '人文学基礎Ⅱ']);
    const kiban = kd + kp;
    // 要項: 文学部国際コースは36単位、通常コースは37単位
    const base = cid === '文学部 国際コース' ? 36 : 37;
    const total = cid === '文学部 国際コース' ? 38 : 39;
    rules.push({ name: `基幹教育科目 ${base}単位以上`, ok: kd >= base, ok_p: kiban >= base });
    rules.push({ name: '専攻教育科目「人文学基礎Ⅰ」または「人文学基礎Ⅱ」から2単位以上', ok: jinbun.d >= 2, ok_p: jinbun.tot >= 2 });
    rules.push({ name: `合計 ${total}単位以上`, ok: kd + jinbun.d >= total, ok_p: kiban + jinbun.tot >= total });
  } else if (cid === '教育学部') {
    const kiban = kd + kp;
    const req1 = count(['基幹教育セミナー', '課題発見科目', '学術アプローチ科目']);
    const req2 = count(['心理学入門', '現代教育学入門', '教育基礎学入門']);
    rules.push({ name: '基幹教育セミナー、課題発見科目、学術アプローチ科目（計3単位）', ok: req1.d >= 3, ok_p: req1.tot >= 3 });
    rules.push({ name: '心理学入門、現代教育学入門、教育基礎学入門（計4単位）', ok: req2.d >= 4, ok_p: req2.tot >= 4 });
    rules.push({ name: '基幹教育科目 合計30単位以上', ok: kd >= 30, ok_p: kiban >= 30 });
  } else if (cid === '理学部 物理学科') {
    const jikken = count(['自然科学総合実験']);
    const kiban = kd + kp;
    rules.push({ name: '自然科学総合実験（1単位）', ok: jikken.d >= 1, ok_p: jikken.tot >= 1 });
    rules.push({ name: '基幹教育科目 合計26単位以上', ok: kd >= 26, ok_p: kiban >= 26 });
  } else if (cid === '理学部 化学科') {
    const req = count(['基幹教育セミナー', '課題発見科目', '学術アプローチ科目', '自然科学総合実験']);
    const kiban = kd + kp;
    rules.push({ name: '基幹教育セミナー、課題発見科目、学術アプローチ科目、自然科学総合実験（計4単位）', ok: req.d >= 4, ok_p: req.tot >= 4 });
    rules.push({ name: '基幹教育科目 合計26単位以上', ok: kd >= 26, ok_p: kiban >= 26 });
  } else if (cid === '理学部 地球惑星科学科') {
    const kiban = kd + kp;
    rules.push({ name: '基幹教育科目 合計26単位以上', ok: kd >= 26, ok_p: kiban >= 26 });
  } else if (cid === '理学部 生物学科') {
    const req = count(['基幹教育セミナー', '課題発見科目', '学術アプローチ科目', '自然科学総合実験']);
    const kiso = count(['基礎生命科学', '生態学']); // "基礎生物学" refers to low year major courses. Assume 基礎生命科学 or 生態学. Let's just say "専攻教育の選択必修から2単位"
    const kiban = kd + kp;
    rules.push({ name: '基幹教育セミナー、課題発見科目、学術アプローチ科目、自然科学総合実験（計4単位）', ok: req.d >= 4, ok_p: req.tot >= 4 });
    rules.push({ name: '専攻教育科目の選択必修科目(基礎生物学)から2単位', ok: kiso.d >= 2, ok_p: kiso.tot >= 2 });
    rules.push({ name: '合計26単位以上', ok: kd + kiso.d >= 26, ok_p: kiban + kiso.tot >= 26 });
  } else if (cid === '医学部 医学科' || cid === '医学部 生命科学科') {
    const kiban = kd + kp;
    rules.push({ name: '1年次に修得すべき基幹教育科目 39単位すべて', ok: kd >= 39, ok_p: kiban >= 39 });
  } else if (cid === '医学部 保健学科 看護学専攻') {
    const kiban = kd + kp;
    const senmon = count(['コミュニケーション論']);
    rules.push({ name: '1年次に修得すべき基幹教育科目 37単位以上', ok: kd >= 37, ok_p: kiban >= 37 });
    rules.push({ name: 'コミュニケーション論（1単位）', ok: senmon.d >= 1, ok_p: senmon.tot >= 1 });
  } else if (cid === '医学部 保健学科 放射線技術科学専攻') {
    const kiban = kd + kp;
    const senmon = count(['放射線技術科学入門Ⅰ', '放射線技術科学入門Ⅱ']);
    rules.push({ name: '1年次に修得すべき基幹教育科目 37単位以上', ok: kd >= 37, ok_p: kiban >= 37 });
    rules.push({ name: '放射線技術科学入門Ⅰ・Ⅱ（計4単位）', ok: senmon.d >= 4, ok_p: senmon.tot >= 4 });
  } else if (cid === '医学部 保健学科 検査技術科学専攻') {
    const kiban = kd + kp;
    const senmon = count(['臨床検査学概論Ⅰ', '臨床検査学概論Ⅱ']);
    rules.push({ name: '1年次に修得すべき基幹教育科目 37単位以上', ok: kd >= 37, ok_p: kiban >= 37 });
    rules.push({ name: '臨床検査学概論Ⅰ・Ⅱ（計2単位）', ok: senmon.d >= 2, ok_p: senmon.tot >= 2 });
  } else if (cid === '歯学部') {
    const kiban = kd + kp;
    const senmon = count(['歯学オリエンテーション', '歯学概論１', '歯学概論２', '歯学概論３', '歯学概論４', '解剖学１', '口腔組織学１', '口腔解剖学１', '口腔解剖学３', '口腔解剖学４', '口腔生理学１']);
    rules.push({ name: '1年次に修得すべき基幹教育科目 37単位すべて', ok: kd >= 37, ok_p: kiban >= 37 });
    rules.push({ name: '指定された専攻教育科目 11科目（計8.5単位）', ok: senmon.d >= 8.5, ok_p: senmon.tot >= 8.5 });
  } else if (cid.startsWith('薬学部')) {
    const kiban = kd + kp;
    const senmon = count(['創薬科学総論Ⅰ', '創薬科学総論Ⅱ', '創薬科学総論Ⅲ', '創薬科学総論Ⅳ', '物理薬学Ⅰ', '生命薬学ⅠA']);
    // Total required for 1st year: Kiban 38, Senmon 7 = 45. Max allowed missing is 4.
    rules.push({ name: '1年次必修・選択必修の未修得が4単位以下 (基幹38+専攻7=45単位中41単位以上)', ok: kd + senmon.d >= 41, ok_p: kiban + senmon.tot >= 41 });
  } else {
    isTarget = false;
  }

  if (!isTarget) {
    h += '<p class="note">この学部・学科には1年次から2年次への明確な進級要件単位数が定められていないか、便覧等で個別に確認する必要があります。</p></section>';
    return h;
  }

  let all_ok = true;
  let all_ok_p = true;
  let r_html = '<ul class="plan">';
  for (const r of rules) {
    if (!r.ok) all_ok = false;
    if (!r.ok_p) all_ok_p = false;
    const mark = r.ok_p ? (r.ok ? '<span class="ok" style="color:var(--ok)">達成</span>' : '<span class="ok" style="color:var(--ok)">予定</span>') : '<span class="ng" style="color:var(--ng)">不足</span>';
    r_html += `<li><span style="font-weight:bold; width: 3em; display: inline-block;">${mark}</span> ${r.name}</li>`;
  }
  r_html += '</ul>';

  const v_msg = all_ok ? '<div class="warn ok" style="background:var(--okbg);color:var(--ok);font-weight:bold;margin-bottom:8px">🎉 1年次の進級要件を満たしています！</div>' : 
                (all_ok_p ? '<div class="warn ok" style="background:var(--okbg);color:var(--ok);font-weight:bold;margin-bottom:8px">✅ 予定通り修得すれば1年次の進級要件を満たします</div>' : 
                            '<div class="warn ng" style="background:var(--wnbg);color:var(--ng);font-weight:bold;margin-bottom:8px">⚠️ 1年次の進級要件に不足があります</div>');
  
  h += v_msg + r_html + '</section>';
  return h;
}
