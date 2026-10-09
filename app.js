const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const zen=s=>s.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248));
const DAYS=['月','火','水','木','金'];
const SEMS=['前期','後期','春','夏','秋','冬'];
const BASESEM=new Set(['前期','後期','春学期','夏学期','秋学期','冬学期']);
// クラス記号(A表より)。value = B表の担当クラスと同じ書き方
const CLASSDEF=[['共創学部',[['I1-1',''],['I1-2',''],['I1-3','']]],
 ['文学部',[['L1-1',''],['L1-2',''],['L1-3',''],['L1-4','']]],['教育学部',[['L1-5','']]],['法学部',[['L1-6',''],['L1-7',''],['L1-8',''],['L1-9','']]],
 ['経済学部',[['L1-10','経済・経営'],['L1-11','経済・経営'],['L1-12','経済・経営'],['L1-13','経済工学'],['L1-14','経済工学']]],
 ['理学部',[['S1-1','物理'],['S1-2','化学'],['S1-3','地球惑星科学'],['S1-4','数学'],['S1-5','生物']]],
 ['医学部',[['S1-6','医学科'],['S1-7','医学科・生命科学科'],['S1-8','保健(看護)'],['S1-9','保健(放射線)'],['S1-10','保健(検査)']]],
 ['歯学部',[['S1-11','']]],['薬学部',[['S1-12','創薬科学'],['S1-13','臨床薬学']]],
 ['工学部',[['S1-14','Ⅰ群'],['S1-15','Ⅰ群'],['S1-16','Ⅱ群'],['S1-17','Ⅱ群'],['S1-18','Ⅱ群'],['S1-19','Ⅲ群'],['S1-20','Ⅲ群'],['S1-21','Ⅲ群'],['S1-22','Ⅳ群'],['S1-23','Ⅳ群'],['S1-24','Ⅴ群(建築)'],['S1-25','Ⅵ群'],['S1-26','Ⅵ群'],['S1-27','Ⅵ群']]],
 ['芸術工学部',[['S1-28','環境設計'],['S1-29','インダストリアルデザイン'],['S1-30','未来構想デザイン'],['S1-31','メディアデザイン'],['S1-32','音響設計'],['S1-33','学科一括']]],
 ['農学部',[['S1-34',''],['S1-35',''],['S1-36',''],['S1-37','']]],
 ['芸術工学部 2〜4年',[28,29,30,31,32].flatMap(k=>[2,3,4].map(y=>['D'+k+'-'+y,'']))]];
const ARTC={28:'環境設計',29:'インダストリアルデザイン',30:'未来構想デザイン',31:'メディアデザイン',32:'音響設計'};
const clsName=v=>{const m=/^D(\d\d)-(\d)$/.exec(v||'');return m?ARTC[m[1]]+' '+m[2]+'年':v};
const upM=()=>/^D(\d\d)-(\d)$/.exec(CLS||'');
const CKEY='kyudai-syllabus-class';
const CLSSET=new Set(CLASSDEF.flatMap(([,a])=>a.map(([v])=>v)));
const okCls=v=>typeof v==='string'&&CLSSET.has(v);
let CLS=(()=>{try{const v=localStorage.getItem(CKEY)||'';return okCls(v)?v:''}catch(e){return ''}})();
/* 利用者のプロフィール(チュートリアルで登録): {fac:学部名|'', year:1|2|3|4|'G', skipped:bool} */
const PFKEY='kyudai-syllabus-profile';
const FACS=['共創学部','文学部','教育学部','法学部','経済学部','理学部','医学部','歯学部','薬学部','工学部','芸術工学部','農学部'];
let PROF=(()=>{try{return JSON.parse(localStorage.getItem(PFKEY)||'null')}catch(e){return null}})();
const profSave=()=>{try{localStorage.setItem(PFKEY,JSON.stringify(PROF))}catch(e){}};
// クラス記号から学部・学年を推定(I1/L1/S1 は1年、D28-2 は芸工2年)
function profFromCls(v){
  let m=/^D(\d\d)-(\d)$/.exec(v||'');if(m)return{fac:'芸術工学部',year:+m[2]};
  m=/^([ILS])1-(\d+)$/.exec(v||'');if(!m)return null;const n=+m[2];
  const f=m[1]==='I'?'共創学部':m[1]==='L'?(n<=4?'文学部':n===5?'教育学部':n<=9?'法学部':'経済学部'):(n<=5?'理学部':n<=10?'医学部':n===11?'歯学部':n<=13?'薬学部':n<=27?'工学部':n<=33?'芸術工学部':'農学部');
  return{fac:f,year:1};
}
// 一覧の既定の表示範囲: 「基幹教育+自分の学部」か「全学部」か
const myFac=()=>PROF&&PROF.fac||'';
// 学部を登録していない(スキップ・その他)ときは基幹教育だけ。プロフィールが無い旧来の状態は基幹教育・芸工
const scopeRe=()=>{const f=myFac();if(PROF&&!f)return /^基幹教育/;return new RegExp('^基幹教育|'+(!f||f==='芸術工学部'?'芸術工':'^'+f))};
const scopeLabel=()=>{const f=myFac();if(PROF&&!f)return '基幹教育';return '基幹教育・'+(!f||f==='芸術工学部'?'芸工':f)};
const defAll=()=>!!PROF&&(!!PROF.skipped||!PROF.fac||PROF.year==='G');
const allOn=()=>{const v=params().get('all');return v==='1'||(v!=='0'&&defAll())};
function setClass(v){
  try{localStorage.removeItem('kyudai-syllabus-gcourse')}catch(_){}
  CLS=v;try{localStorage.setItem(CKEY,CLS)}catch(_){}
  const g=profFromCls(v);if(PROF&&g&&!PROF.skipped){PROF.fac=g.fac;PROF.year=g.year;profSave()}
  typeof meLabel==='function'&&meLabel();
}
let BT=null,BTV={};
// クラスが設定されていれば、既定で「受講可のみ」。?mine=0 で解除
const mineOn=()=>!!CLS&&params().get('mine')!=='0';
// 受講可否: yes / no / intl(留学生向け) / unk(B表の対象外の科目) / nodata(基幹教育なのにB表に無く、対象学年も1年生でない=高年次用)
function elig(c){
  const b=c.b,um=upM();
  if(um){   // 芸術工学部 2〜4年: 芸工の科目は「対象コース・学年」、基幹教育はB表の全学年・高年次だけ
    const y=+um[2];
    if(c.cx)return c.cx[um[1]]&&(!c.yr.length||c.yr.includes(y))?'yes':'no';
    if(b){if(b.fl.includes('ALL'))return /・日本語】/.test(b.cat)?'intl':'yes';return b.fl.includes('HIGH')&&y>=3?'yes':'no'}
    return /基幹教育/.test(c.cat||'')?'nodata':'unk';
  }
  const sm=/^S1-(\d\d)$/.exec(CLS||'');
  if(c.cx&&sm&&+sm[1]>=28&&+sm[1]<=33)return (sm[1]==='33'?Object.keys(c.cx).length:c.cx[sm[1]])&&(!c.yr.length||c.yr.includes(1))?'yes':'no';
  // 基幹教育セミナー・課題発見科目・総合科目などはB表に載らない。対象学年が1年生・全学年なら受講できる候補として扱う
  if(!b)return /基幹教育/.test(c.cat||'')&&!gradeOK(c)?'nodata':'unk';
  if(b.cs.includes(CLS))return 'yes';
  if(b.fl.includes('ALL'))return /・日本語】/.test(b.cat)?'intl':'yes';
  return 'no';
}
const placeOf=c=>{const b=c.b;
  if(!b){const x=c.campus||'';return /大橋|馬出/.test(x)?'大橋':/病院/.test(x)?'病院':/伊都/.test(x)?'伊都':''}
  if(/大橋/.test(b.campus))return '大橋';
  if(/遠隔/.test(b.room)||/遠隔/.test(b.campus))return '遠隔';
  if(/イースト/.test(b.campus))return '伊都(イースト)';if(/病院/.test(b.campus))return '病院';
  return /センター/.test(b.campus)?'伊都(センター)':'その他'};
const APPLY={'○':['事前申請','Moodleから事前申請が必要。抽選で受講者が決まります'],'●':['要登録・抽選','Campusmate-Jで履修登録。登録者数により抽選の可能性があります'],'※':['申請・抽選あり','シラバス等の案内に従って申し込みます'],'※●':['申請・抽選あり','シラバス等の案内に従って申し込みます']};
function badgeHTML(c){
  const b=c.b;if(!b)return '';let h='';
  const ap=b.apply&&(APPLY[b.apply]||['申請あり','']);
  if(ap)h+=` <span class="tag w" title="${esc(ap[1])}">${esc(ap[0])}</span>`;
  if(placeOf(c)==='遠隔')h+=' <span class="tag w">遠隔</span>';
  if(/→/.test(b.room))h+=` <span class="tag w">教室変更 ${esc(b.room)}</span>`;
  if(/履修登録不可/.test(b.note))h+=' <span class="tag w">別途申請</span>';
  if(CLS&&c.cx){const k=(upM()||/^S1-(\d\d)$/.exec(CLS)||[])[1],r=k&&c.cx[k];if(r==='h')h+=' <span class="tag w">必修</span>';else if(r==='s')h+=' <span class="tag w">選択必修</span>'}
  if(CLS){const e=elig(c);if(e==='no')h+=' <span class="tag no">対象外</span>';if(e==='intl')h+=' <span class="tag w">留学生向け</span>'}
  return h;
}
function condHTML(c){
  const b=c.b;if(!b)return '';
  const e=CLS?elig(c):'';
  const verdict=e==='yes'?`<b class="ok">${esc(clsName(CLS))} は受講できます</b>`:e==='no'?`<b class="ng">${esc(clsName(CLS))} は対象外です</b>`:e==='intl'?'<b>留学生向けの科目です</b>':'';
  const ap=b.apply?(APPLY[b.apply]||['申請あり',''])[1]:'不要';
  const rows=[['対象クラス',b.fl.includes('ALL')?'全学年':b.cls],['教室',[b.campus,b.room].filter(Boolean).join('　')],['事前申請',ap],['備考',b.note]].filter(r=>r[1]);
  return `<section class="cond"><h3>受講条件</h3>${verdict?`<p class="verdict">${verdict}</p>`:''}<dl class="rows">${rows.map(([k,x])=>`<div><dt>${esc(k)}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl><p class="srcnote">B表(${esc(b.term)}期 ${esc(BTV[b.term]||'')}版)より</p></section>`;
}
const subOf=c=>c.b?c.b.cat:(c.kbn||'');
/* 科目区分を整理: B表の区分とCampusmateの区分(日英併記・表記ゆれ)を、グループ→項目の2段にそろえる */
const SUB_G=['セミナー・課題発見・アプローチ','言語文化','文系ディシプリン','理系ディシプリン','総合科目','健康・スポーツ','サイバーセキュリティ','高年次基幹教育','芸術工学部'];
const SUB_I={'言語文化':['英語','ドイツ語','フランス語','中国語','ロシア語','スペイン語','韓国語','日本語','多文化入門講義','その他の言語文化'],
  '文系ディシプリン':['人文系','社会系','心理系','教育系','法学系','経済系','一般系'],'理系ディシプリン':['数学','物理','化学','生物','地球科学','情報','感性','実験','複合系'],
  '芸術工学部':['デザインリテラシー科目','コース基礎科目','コース専門科目','コース演習科目 (PBL)','融合プロジェクト・プラットフォーム','卒業研究・設計','専攻教育科目']};
const SUB_EN={'Subjects in Science':'理系ディシプリン科目','Subjects in Humanities and Social Science':'文系ディシプリン科目','Cybersecurity':'サイバーセキュリティ科目','Subject for Health and Sports Science':'健康・スポーツ科目'};
function subKey(c){
  if(c._sk)return c._sk;
  let t=String(c.b?c.b.cat:(c.kbn||'')).replace(/[\u3000\s]+/g,' ').trim();
  t=SUB_EN[t]||t.split(/ (?=[A-Za-z])/)[0].replace(/[：:].*$/,'').trim();
  let g,i,m;
  if(c.cat==='芸術工学部'){g='芸術工学部';i=t||'専攻教育科目'}
  else if(c.cat!=='基幹教育科目'){g=c.cat||'その他';i=t||'その他'}
  else if(/^(基幹教育セミナー|課題発見科目|学術アプローチ科目)/.test(t)){g='セミナー・課題発見・アプローチ';i=t.replace(/科目$/,'')}
  else if(/言語文化/.test(t)){g='言語文化';i=(m=t.match(/言語文化・([^】]+)/))?m[1]:'その他の言語文化'}
  else if(/文D|文系ディシプリン/.test(t)){g='文系ディシプリン';i=(m=t.match(/文D・([^】]+)/))?m[1]:'その他'}
  else if(/理D|理系ディシプリン/.test(t)){g='理系ディシプリン';i=(m=t.match(/理D・([^】]+)】/))?m[1]:'その他'}
  else if(/総合/.test(t)){g='総合科目';i=/フロンティア/.test(t)?'フロンティア科目':'オープン科目'}
  else if(/健スポ|健康・スポーツ/.test(t)){g='健康・スポーツ';i=/実習/.test(t)?'実習':/講義/.test(t)?'講義':'その他'}
  else if(/サイバー|Cyber/.test(t)){g='サイバーセキュリティ';i='サイバーセキュリティ'}
  else if(/高年次/.test(t)){g='高年次基幹教育';i='高年次基幹教育'}
  else{g='その他';i=t||'その他'}
  return c._sk={g,i};
}
const subMatch=(c,sub)=>{const k=subKey(c),[g,i]=sub.split('|');return k.g===g&&(!i||k.i===i)};
function subOptions(cat,cur){
  const m=new Map();
  pool().filter(c=>!cat||c.cat===cat).forEach(c=>{const k=subKey(c);if(!m.has(k.g))m.set(k.g,new Map());const mi=m.get(k.g);mi.set(k.i,(mi.get(k.i)||0)+1)});
  const gs=[...m.keys()].sort((a,b)=>{const x=SUB_G.indexOf(a),y=SUB_G.indexOf(b);return (x<0?99:x)-(y<0?99:y)||a.localeCompare(b,'ja')});
  const h=gs.map(g=>{
    const mi=m.get(g),tot=[...mi.values()].reduce((a,b)=>a+b,0),order=SUB_I[g]||[];
    const its=[...mi.keys()].sort((a,b)=>{const x=order.indexOf(a),y=order.indexOf(b);return (x<0?99:x)-(y<0?99:y)||mi.get(b)-mi.get(a)});
    const one=its.length===1&&its[0]===g;
    const v=g+'|';
    return `<optgroup label="${esc(g)}">${one?'':`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(g)}すべて (${tot})</option>`}${its.map(i=>{const val=g+'|'+i;return `<option value="${esc(val)}"${val===cur?' selected':''}>${esc(one?g:i)} (${mi.get(i)})</option>`}).join('')}</optgroup>`}).join('');
  return '<option value="">科目区分</option>'+h;
}
const pool=()=>{if(allOn())return DATA;const re=scopeRe();return DATA.filter(c=>re.test(c.cat||''))};
let DATA=[],shown=100,listScroll=0;
const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
const slots=c=>c.when.map(w=>{const d=w.match(/([月火水木金土日])曜日/),p=zen(w).match(/(\d)時限/);return{sem:w.split(/[\s\u3000]+/)[0],d:d&&d[1],p:p&&p[1]}});

function setP(k,v){const p=params();v?p.set(k,v):p.delete(k);if(k==='cat')p.delete('sub');history.replaceState(null,'','#/?'+p);shown=100;syncCtl();renderList()}
function opts(id,label,vals,cur){$(id).innerHTML=`<option value="">${label}</option>`+vals.map(v=>`<option${v===cur?' selected':''}>${esc(v)}</option>`).join('')}
function uniq(f){return [...new Set(pool().flatMap(f).filter(Boolean))].sort()}
function syncCtl(){
  const p=params();$('#q').value!==(p.get('q')||'')&&($('#q').value=p.get('q')||'');
  opts('#sem','集中など',uniq(c=>slots(c).map(s=>s.sem)).filter(x=>!BASESEM.has(x)),p.get('sem'));
  $('#sems').innerHTML=SEMS.map(x=>`<button class="chip" aria-pressed="${p.get('sem')===x}" data-s="${x}">${x}</button>`).join('');
  opts('#cat','区分',uniq(c=>[c.cat]),p.get('cat'));
  $('#sub').innerHTML=subOptions(p.get('cat'),p.get('sub'));
  $('#pers').innerHTML=['1','2','3','4','5','6'].map(x=>`<button class="chip" aria-pressed="${p.get('per')===x}" data-per="${x}">${x}限</button>`).join('');
  $('#myrow').hidden=$('#myrow2').hidden=false;
  const nocat=!DATA.some(c=>c.cat);
  $('#btnote').hidden=!!BT&&!nocat;
  $('#btnote').textContent=nocat?'⚠ index.json に学部カテゴリがありません(絞り込みが空になります)。python3 scrape.py --enrich を実行してください。':(BT?'':'⚠ B表データ(btable.json)が読み込めません。data フォルダに置いて、Cmd+Shift+R で再読み込みしてください。');
  $('#btver').textContent=BT?'B表: '+Object.entries(BTV).map(([k,x])=>`${k} ${String(x).replace(/^\d{4}\//,'')}版`).join(' / '):'';
  if(BT){
    $('#cls').innerHTML='<option value="">クラス未設定</option>'+CLASSDEF.map(([g,a])=>`<optgroup label="${g}">${a.map(([v,l])=>`<option value="${v}"${v===CLS?' selected':''}>${/^D/.test(v)?clsName(v):v+(l?' '+esc(l):'')}</option>`).join('')}</optgroup>`).join('');
    opts('#place','場所',['大橋','伊都','伊都(センター)','伊都(イースト)','病院','遠隔'],p.get('place'));
    $('#mine').setAttribute('aria-pressed',String(mineOn()));$('#nolot').setAttribute('aria-pressed',String(!!p.get('nolot')));
  }
  $('#days').innerHTML=DAYS.map(d=>`<button class="chip" aria-pressed="${p.get('d')===d}" data-d="${d}">${d}</button>`).join('');
  const na=['cat','sub','per','place','d','nolot'].filter(k=>p.get(k)).length+(p.get('sem')&&!SEMS.includes(p.get('sem'))?1:0);
  $('#fltn').hidden=!na;$('#fltn').textContent=na;
}
$('#fltt').addEventListener('click',()=>{const f=$('#flt'),o=f.hidden;f.hidden=!o;$('#fltt').setAttribute('aria-expanded',o);measureHead()});
// 検索用の正規化: 全角半角(NFKC)・大文字小文字・カタカナ→ひらがな をそろえる。科目名の読み(data/yomi.json)も検索対象
let YOMI={};
const kn=s=>String(s).normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
function filtered(){
  const p=params(),q=kn(p.get('q')||'').split(/[\s\u3000]+/).filter(Boolean);
  const sem=p.get('sem'),cat=p.get('cat'),sub=p.get('sub'),d=p.get('d'),per=p.get('per');
  return pool().filter(c=>{
    if(cat&&c.cat!==cat)return false;
    if(sub&&sub.includes('|')&&!subMatch(c,sub))return false;
    const hay=c._hay||(c._hay=kn(c.n+' '+c.t+' '+(c.kw||'')+' '+c.c+' '+(c.cat||'')+' '+(YOMI[c.n]||'')+' '+c.n.replace(/[\u2160-\u2169]/g,ch=>String(ch.charCodeAt(0)-0x215F))));
    if(!q.every(t=>hay.includes(t)))return false;
    if(mineOn()){const e=elig(c);if(e!=='yes'&&e!=='unk')return false}
    if(p.get('nolot')&&c.b&&c.b.apply)return false;
    if(p.get('place')){const pl=placeOf(c),w=p.get('place');if(!(pl===w||(w==='伊都'&&pl.startsWith('伊都'))))return false}
    if(sem||d||per)return slots(c).some(s=>(!sem||s.sem.startsWith(sem))&&(!d||s.d===d)&&(!per||s.p===per));
    return true;
  });
}
const HKEY='kyudai-syllabus-history';
let histOpen=false;
function histGet(){try{const a=JSON.parse(localStorage.getItem(HKEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function histAdd(code){try{localStorage.setItem(HKEY,JSON.stringify([code,...histGet().filter(x=>x!==code)].slice(0,30)))}catch(e){}}
function histClear(){try{localStorage.removeItem(HKEY)}catch(e){}}
let histAll=false;
const hl=t=>{
  const q=(params().get('q')||'').trim();if(!q)return esc(t);
  const ks=[...new Set(q.split(/[\s\u3000]+/).filter(Boolean))].map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(!ks.length)return esc(t);
  return String(t).split(new RegExp('('+ks.join('|')+')','gi')).map((x,i)=>i%2?`<mark>${esc(x)}</mark>`:esc(x)).join('');
};
const itemHTML=c=>`<a class="item" href="#/c/${esc(c.c)}"><i class="cd">${esc(c.c)}</i><b>${hl(c.n)}</b><span class="meta">${hl(c.t)}　${c.when.map(w=>esc(w.replace(/[\s\u3000]+/g,' '))).join(' / ')}</span><div>${c.credit?`<span class="tag s">${esc(c.credit)}単位</span> `:''}${c.cat?`<span class="tag">${esc(c.cat)}</span> `:''}${c.lang?`<span class="tag">${esc(c.lang)}</span>`:''}${badgeHTML(c)}${PL.p[c.c]?` <span class="tag s">${PL.p[c.c]==='done'?'修得済み':'履修予定'}</span>`:''}</div></a>`;
function renderList(){
  const r=filtered(),v=$('#view'),p=params();
  $('#ctl').hidden=false;
  const active=['q','sem','cat','sub','d','per'].some(k=>p.get(k));
  const byCode=Object.fromEntries(DATA.map(c=>[c.c,c]));
  const hist=histGet().map(x=>byCode[x]).filter(Boolean);
  let h='';
  if(!active&&hist.length){
    h+=`<details class="hist"${histOpen?' open':''}><summary>最近見た講義 <small>${hist.length}件</small></summary><div class="sechead"><span></span><button class="lnk" id="hclear" type="button">履歴を消す</button></div>${hist.slice(0,histAll?30:5).map(itemHTML).join('')}${hist.length>5&&!histAll?'<button class="lnk" id="hmore" type="button">もっと見る</button>':''}</details>`;
  }
  h+=`<section><h2 class="lh" data-e="Courses">講義を探す</h2><div class="ltools"><p class="count"><b>${r.length}</b> 件</p><div class="seg sm" role="group" aria-label="表示する学部" style="--i:${allOn()?1:0}"><button type="button" id="scope0" aria-pressed="${!allOn()}">${esc(scopeLabel())}</button><button type="button" id="scope1" aria-pressed="${allOn()}">全学部</button></div></div>${active||p.get('place')||p.get('nolot')?'<button class="lnk fclr" id="fclear" type="button">条件をクリア ×</button>':''}${mineOn()?`<p class="count"><b>${esc(clsName(CLS))}</b> で受講できる授業(B表で判定)</p>`:''}${r.length?'':'<div class="empty"><div class="eg" aria-hidden="true">∅</div><p><b>条件に合う講義がありません</b></p><p class="note">キーワードを短くするか、絞り込みを減らしてみてください。</p></div>'}${r.slice(0,shown).map(itemHTML).join('')}${r.length>shown?'<button class="chip more" id="more">さらに表示</button>':''}</section>`;
  v.innerHTML=h;
  const m=$('#more');m&&(m.onclick=()=>{shown+=100;renderList()});
  const fc=$('#fclear');fc&&(fc.onclick=()=>{const q=params();['q','sem','cat','sub','d','per','place','nolot'].forEach(k=>q.delete(k));history.replaceState(null,'','#/'+(q.toString()?'?'+q:''));shown=100;syncCtl();renderList()});
  const setAll=w=>{if(w!==allOn())setP('all',w===defAll()?'':(w?'1':'0'))};
  $('#scope0').onclick=()=>setAll(false);$('#scope1').onclick=()=>setAll(true);
  const hd=$('details.hist');hd&&hd.addEventListener('toggle',()=>{histOpen=hd.open});
  const hc=$('#hclear');hc&&(hc.onclick=()=>{histClear();renderList()});
  const hm=$('#hmore');hm&&(hm.onclick=()=>{histAll=true;renderList()});
}
const link=s=>esc(s).replace(/https?:\/\/[^\s<]+/g,u=>{const m=u.match(/[)）。、,.;:]+$/)||[''],t=m[0];return `<a href="${u.slice(0,u.length-t.length)}" target="_blank" rel="noopener">${u.slice(0,u.length-t.length)}</a>${t}`});

/* ---------- 詳細画面 ---------- */
let inApp=false;
const NAMEKEYS=['科目名称','授業科目名','科目名','授業科目','講義名'];
const OFFICIAL=r=>`https://ku-portal.kyushu-u.ac.jp/campusweb/slbssbdr.do?value(risyunen)=${r.y}&value(semekikn)=${r.s}&value(kougicd)=${r.c}&value(crclumcd)=${r.cr}`;
// 全文テキスト形式のページを項目ごとに分けるための、既知の項目名(→ 表示するカード)
const LABELS={
 '概要':['授業科目名','科目名称','科目名','担当教員','担当者','学部カテゴリ','授業科目区分','開講学期','開講時期','曜限','曜日・時限','曜日時限','単位数','使用言語','対象学年','開講地区','開講学部','授業形態','授業の概要','講義概要'],
 '目的':['授業の目的','到達目標','達成目標','キーワード','履修条件','履修要件','関連科目','関連する科目'],
 '進め方':['授業計画','授業の進め方','授業の方法','事前・事後学修','事前学修','事後学修','教科書','参考書','教材','履修上の注意','学修上の注意','準備学習'],
 '成績評価':['成績評価の方法','成績評価の基準','成績評価','評価方法','評価基準'],
 '相談':['オフィスアワー','相談窓口','連絡先','メールアドレス','備考','その他']};
const LABEL2SEC=Object.fromEntries(Object.entries(LABELS).flatMap(([s,ls])=>ls.map(l=>[l,s])));
function splitFull(text){
  const lines=text.split('\n'),out={};let cur=null,buf=[],n=0;
  const flush=()=>{if(cur){let k=cur.l,i=2;const sec=out[cur.s]=out[cur.s]||{};while(k in sec)k=cur.l+`(${i++})`;sec[k]=buf.join('\n').trim()}buf=[]};
  for(const raw of lines){
    const x=raw.trim().replace(/[:：]$/,'');
    if(LABEL2SEC[x]&&!(cur&&cur.l===x&&!buf.length)){flush();cur={l:x,s:LABEL2SEC[x]};n++}
    else if(cur)buf.push(raw);
  }
  flush();
  return n>=3?out:null;
}
// 詳細JSONを {見出し:{項目:内容}} にそろえる(全文形式は項目ごとに分ける)
const BOIL={labels:new Set(['授業計画']),pairs:new Set()};   // どの講義でも同じ項目(data/boilerplate.json でも追加できる)
function normalize(d){
  const secs=d.sections||{},res={};
  for(const [t,f] of Object.entries(secs)){
    if(f&&f['全文']){
      const sp=splitFull(f['全文']);
      if(sp){for(const [st,sf] of Object.entries(sp))res[st]={...(res[st]||{}),...sf};continue}
      res[t]={...f};res[t]['全文']=f['全文'];continue;
    }
    res[t]={...(res[t]||{}),...f};
  }
  for(const f of Object.values(res))for(const [k,x] of Object.entries(f)){
    const b=k.replace(/\(\d+\)$/,'');
    if(k!=='全文'&&(BOIL.labels.has(b)||BOIL.pairs.has(b+'\u0000'+String(x).trim())))delete f[k];
  }
  return res;
}
const kindOf=t=>/成績|評価/.test(t)?['grade','成績評価']:/相談|オフィス|連絡|備考|その他/.test(t)?['contact','相談']:/目的|到達|目標/.test(t)?['goal','目的']:/計画|進め|方法/.test(t)?['method','進め方']:/概要/.test(t)?['overview','概要']:['other',t];
const short=v=>v&&!v.includes('\n')&&v.length<=36;
const isNone=v=>/^(none|なし|無し|無|-|－|ー|―|0|0[%％]|該当なし|n\/a)$/i.test(v.trim());
function fieldHTML(k,v){
  if(/キーワード|Keywords?/i.test(k)){
    const ws=v.split(/[,、，;；\n]+/).map(x=>x.trim()).filter(Boolean);
    return `<div class="f"><dt>${esc(k)}</dt><dd><div class="tags">${ws.map(w=>`<a class="kw" href="#/?q=${encodeURIComponent(w)}">${esc(w)}</a>`).join('')}</div></dd></div>`;
  }
  const ls=v.split('\n').map(x=>x.trim()).filter(Boolean);
  if(ls.length>=2&&ls.length<=6&&ls.every(x=>x.length<=22)&&!/https?:/.test(v))
    return `<div class="f"><dt>${esc(k)}</dt><dd><div class="tags">${ls.map(x=>`<span>${esc(x)}</span>`).join('')}</div></dd></div>`;
  const long=v.length>260||ls.length>8;
  return `<div class="f"><dt>${esc(k)}</dt><dd><div class="body${long?' clamp':''}">${link(v)}</div>${long?'<button class="morebtn" type="button">続きを読む</button>':''}</dd></div>`;
}
function parseGrade(f){
  const rows=[],notes=[],unused=[];
  const NOTE=/基準|方法|備考|注意|コメント|詳細|について/, MISC=/出席|欠席|その他|備考|注意/;
  const PLINE=/^(.+?)[\s:：=＝]*(\d+(?:\.\d+)?\s*[%％])\s*$/;
  for(const [k,v0] of Object.entries(f)){
    const v=String(v0||'').trim();if(!v)continue;
    const ls=v.split('\n').map(x=>x.trim()).filter(Boolean);
    if(ls.length>=2&&ls.every(x=>PLINE.test(x))){for(const x of ls){const m=x.match(PLINE);rows.push({k:m[1].trim(),n:parseFloat(m[2]),v:m[2].replace(/\s/g,''),sub:'',extra:''})}continue}
    if(NOTE.test(k)){notes.push([k,v]);continue}
    if(isNone(v)){unused.push(k);continue}
    const ms=[...v.matchAll(/(\d+(?:\.\d+)?)\s*[%％]/g)];
    // 「（60%）」のようにカッコで囲まれた割合を優先。なければ最初の割合(短い値、または割合が1つだけの長文)
    const wrapped=ms.find(m=>/[（(]\s*$/.test(v.slice(0,m.index))&&/^\s*[)）]/.test(v.slice(m.index+m[0].length)));
    const pick=wrapped||(ms.length&&(v.length<=24||(ms.length===1&&!MISC.test(k)))?ms[0]:null);
    if(!pick){notes.push([k,v]);continue}
    let st=pick.index,en=pick.index+pick[0].length;
    const pre=v.slice(0,st).match(/[（(]\s*$/),post=v.slice(en).match(/^\s*[)）]/);
    if(pre&&post){st-=pre[0].length;en+=post[0].length}
    let rest=(v.slice(0,st)+' '+v.slice(en)).replace(/\s+/g,' ').trim();
    let extra='';const x=rest.indexOf('※');
    if(x>=0){extra=rest.slice(x).trim();rest=rest.slice(0,x).trim()}
    rest=rest.replace(/^[\s:：=＝()（）]+|[\s:：=＝]+$/g,'');
    rows.push({k,n:parseFloat(pick[1]),v:pick[1]+'%',sub:rest,extra});
  }
  return{rows,notes,unused};
}
function gradeHTML(f){
  const{rows,notes,unused}=parseGrade(f);
  let h='';
  if(rows.length){
    const tot=rows.reduce((a,r)=>a+r.n,0);
    if(tot>0)h+=`<div class="stack" role="img" aria-label="評価の配分">${rows.map((r,i)=>`<i style="width:${r.n/Math.max(tot,100)*100}%;background:var(--c${i%5})"></i>`).join('')}</div>`;
    h+='<div class="legend">'+rows.map((r,i)=>`<div class="lg"><span class="sw" style="background:var(--c${i%5})"></span><span class="lk">${esc(r.k)}${r.sub&&r.sub!==r.k?`<small>${esc(r.sub)}</small>`:''}${r.extra?`<small class="x">${esc(r.extra)}</small>`:''}</span><span class="lv">${esc(r.v)}</span></div>`).join('')+'</div>';
  }
  if(unused.length)h+=`<p class="unused">使わない項目: ${unused.map(esc).join('、')}</p>`;
  if(notes.length)h+=notes.map(([k,v])=>`<div class="gn"><b>${esc(k)}</b><p>${link(v)}</p></div>`).join('');
  return h||'<p class="note">記載がありません</p>';
}
function planHTML(p){
  if(!p||!Array.isArray(p.rows)||!p.rows.length)return '';
  const head=p.head||[],multi=p.rows.some(r=>r.length>2);
  const items=p.rows.map(r=>{
    const c=r.map(x=>String(x||'').trim());
    const badge=c.length>1&&c[0].length<=6?c.shift():'';
    const off=badge?1:0;
    const cells=c.map((x,i)=>x?`<div class="pc${i===0?' pt':''}">${multi&&i>0&&head[i+off]?`<small>${esc(head[i+off])}</small>`:''}${link(x)}</div>`:'').join('');
    return `<li>${badge?`<span class="pn">${esc(badge)}</span>`:''}<div class="pb">${cells}</div></li>`;
  }).join('');
  return `<div class="f"><dt>授業計画(各回)</dt><dd><ol class="plan">${items}</ol></dd></div>`;
}
function goBack(){inApp?history.back():(location.hash='#/')}
const KM={grade:{tab:'成績',title:'成績のつけ方',rank:0},overview:{tab:'概要',title:'授業の概要',rank:1},goal:{tab:'目的',title:'目的と到達目標',rank:2},method:{tab:'進め方',title:'授業の進め方',rank:3},other:{rank:4},info:{tab:'',title:'基本情報',rank:5},contact:{tab:'相談',title:'相談',rank:6}};
async function renderDetail(code){
  $('#ctl').hidden=true;$('#h1').hidden=true;$('#dbar').hidden=false;
  const v=$('#view'),known=DATA.find(c=>c.c===code),row=known||{c:code,n:code,t:'',when:[]};
  if(known)histAdd(code);
  $('#dtitle').textContent=row.n;
  const heroHTML=(extra={})=>{
    const chips=[[row.kbn||row.cat],[row.lang],[row.grade]].filter(x=>x[0]);
    const sl=row.when&&row.when.length?cslots(row):[];
    const byD=new Map();sl.forEach(x=>{(byD.get(x.d)||byD.set(x.d,new Set()).get(x.d)).add(x.p)});const tm=[...byD].slice(0,3).map(([d,ps])=>[d,[...ps].sort().join('·')]);
    const facts=[
      [(row.when&&row.when[0]||'').split(/[\s\u3000]+/)[0]||'開講',tm.length?tm.map(x=>`${x[0]}<small>${x[1]}限</small>`).join('<span class="sl">/</span>'):(row.when&&row.when.length?'<small>集中ほか</small>':'—')],
      ['単位',row.credit?`${esc(row.credit)}<small>単位</small>`:'—'],
      ['場所',row.campus?esc(String(row.campus).replace(/地区$/,'')):'—']];
    return `<section class="hero"><h2>${esc(extra.name||row.n)}</h2>${row.t?`<p class="teacher">${esc(row.t)}</p>`:''}<dl class="facts">${facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl><div class="chips">${chips.map(([t,s])=>`<span class="pill${s?' strong':''}">${esc(t)}</span>`).join('')}</div><a class="src top" href="${esc(/^https:\/\//.test(extra.url||'')?extra.url:OFFICIAL(row))}" target="_blank" rel="noopener">Campusmateの元ページを開く ${EXTSVG}</a></section>`};
  v.innerHTML=heroHTML()+'<p class="note">読み込み中…</p>';
  window.scrollTo(0,0);measureHead();
  try{
    const res=await fetch(`data/detail/${encodeURIComponent(code.replace(/([a-z])/g,'_$1'))}.json`);if(!res.ok)throw 0;
    const d=await res.json(),secs=normalize(d);
    document.title=row.n+' - 九大シラバス';
    const find=k=>{for(const f of Object.values(secs))if(f[k])return f[k];return ''};
    const name=NAMEKEYS.map(find).find(Boolean)||row.n;
    row.t=row.t||find('担当教員')||find('担当者');
    row.credit=row.credit||find('単位数');row.kbn=row.kbn||find('授業科目区分');row.lang=row.lang||find('使用言語');
    row.campus=row.campus||find('開講地区');row.grade=row.grade||find('対象学年');
    const skip=new Set([...NAMEKEYS,'担当教員','担当者','全文']);
    const info=[],cards=[];
    for(const [t,f] of Object.entries(secs)){
      const [kind]=kindOf(t),ent=Object.entries(f).filter(([k,x])=>x&&String(x).trim());
      let body='';
      if(kind==='grade')body=gradeHTML(Object.fromEntries(ent));
      else{
        const rest=[];
        for(const [k,x] of ent){
          if(skip.has(k))continue;
          if(kind==='overview'&&short(x)&&!/キーワード/.test(k))info.push([k,x]);else rest.push([k,x]);
        }
        body=rest.map(([k,x])=>fieldHTML(k,x)).join('');
      }
      if(f['全文'])body+=`<div class="f"><dt>全文</dt><dd><div class="fulltext body${f['全文'].length>600?' clamp':''}">${link(f['全文'])}</div>${f['全文'].length>600?'<button class="morebtn" type="button">続きを読む</button>':''}</dd></div>`;
      if(body.trim())cards.push({kind,key:kind==='other'?t:kind,body,title:kind==='other'?t:KM[kind].title,tab:kind==='other'?(t.length>8?'その他':t):KM[kind].tab});
    }
    const pl=planHTML(d.plan);
    if(pl){const m=cards.find(c=>c.kind==='method');m?m.body+=pl:cards.push({kind:'method',key:'method',title:KM.method.title,tab:KM.method.tab,body:pl})}
    if(info.length)cards.push({kind:'info',key:'info',title:KM.info.title,tab:'',body:`<dl class="rows">${info.map(([k,x])=>`<div><dt>${esc(k)}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>`});
    const merged=[];for(const c of cards){const m=merged.find(x=>x.key===c.key);m?m.body+=c.body:merged.push({...c})}
    merged.sort((a,b)=>KM[a.kind].rank-KM[b.kind].rank);
    const tabs=merged.filter(c=>c.tab).length>1?`<nav class="tabs" aria-label="セクション">${merged.map((c,i)=>c.tab?`<a href="#" data-t="sec-${i}">${esc(c.tab)}</a>`:'').join('')}</nav>`:'';
    v.innerHTML=heroHTML({name,url:d.url})+condHTML(row)+(known?planBoxHTML(row):'')+tabs+merged.map((c,i)=>`<section class="card" id="sec-${i}"><h3>${esc(c.title)}</h3>${c.body}</section>`).join('');
    measureHead();initTabs();
  }catch(e){
    console.error(e);
    v.innerHTML=heroHTML()+condHTML(row)+(known?planBoxHTML(row):'')+'<div class="warn" style="margin-top:14px">この講義の詳細データはまだ取得されていません。上のボタンから元ページで確認できます。</div>';
  }
}
const EXTSVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
/* 一覧で下へスクロールしたら検索・絞り込みを畳む。上へ戻すか、ボタンで開く */
(()=>{
  const ctl=$('#ctl'),bar=$('#ctlbar'),btn=$('#ctlt');let last=scrollY,lock=0,pin=false;
  const setCc=(on,keep)=>{
    if(ctl.classList.contains('cc')===on)return;
    const h0=document.querySelector('header').offsetHeight;
    ctl.classList.toggle('cc',on);btn.textContent=on?'検索・絞り込みを開く ▾':'';
    lock=Date.now()+200;measureHead();
    if(keep)scrollBy({top:document.querySelector('header').offsetHeight-h0,behavior:'instant'});   // 画面上の位置を保つ
    sync();
  };
  const sync=()=>{bar.hidden=ctl.hidden||!ctl.classList.contains('cc')};
  addEventListener('scroll',()=>{
    const y=scrollY;if(Date.now()<lock||ctl.hidden){last=y;return}
    if(y<20){pin=false;if(y<last)setCc(false,false)}
    else if(y>last+6&&y>160&&!pin)setCc(true,true);
    last=y;
  },{passive:true});
  window.__cc={get:()=>ctl.classList.contains('cc'),set:on=>{ctl.classList.toggle('cc',on);measureHead();sync();last=scrollY;lock=Date.now()+300}};
  btn.addEventListener('click',()=>{pin=true;setCc(false,false);ctl.scrollIntoView({block:'nearest'})});
  new MutationObserver(()=>{if(ctl.hidden)ctl.classList.remove('cc');sync()}).observe(ctl,{attributes:true,attributeFilter:['hidden']});
})();
function measureHead(){document.documentElement.style.setProperty('--hh',document.querySelector('header').offsetHeight+'px')}
function initTabs(){
  const links=[...document.querySelectorAll('.tabs a')];if(!links.length)return;
  if(!('IntersectionObserver'in window))return;
  const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){links.forEach(a=>a.classList.toggle('on',a.dataset.t===e.target.id))}},{rootMargin:'-30% 0px -60% 0px'});
  links.forEach(a=>{const el=document.getElementById(a.dataset.t);el&&io.observe(el)});
  links[0].classList.add('on');
}
/* 戻る操作でスクロール位置と「もっと見る」の件数を元に戻す(履歴の項目ごとに覚える) */
const SCP={};let curKey=null,keySeq=0;const _rs=history.replaceState.bind(history);
history.replaceState=(st,t,u)=>_rs(st||history.state,t,u);
function saveScroll(){if(curKey)SCP[curKey]={y:scrollY,shown,cc:window.__cc?window.__cc.get():false}}
function restoreScroll(sv){
  if(!sv){window.scrollTo(0,0);return}
  if(window.__cc&&!$('#ctl').hidden)window.__cc.set(!!sv.cc);
  let n=0;const go=()=>{window.scrollTo(0,sv.y);if(Math.abs(scrollY-sv.y)>2&&n++<30)requestAnimationFrame(go)};go();
}
let vtBusy=false;
/* ---------- 初回チュートリアル(学部・学年・クラス) ---------- */
const OB={step:0,fac:'',year:0,cls:'',fromMenu:false};
function meLabel(){const el=$('#mel');if(!el)return;el.textContent=CLS?clsName(CLS):PROF&&PROF.fac?PROF.fac+(PROF.year==='G'?' 院':PROF.year?' '+PROF.year+'年':''):'設定'}
function obSteps(){
  // 1年: 学部のクラスを選ぶ / 芸工2〜4年: コースを選ぶ / それ以外: クラスの手順は省く
  const st=['hello','fac','year'];
  if(OB.fac&&OB.year===1&&CLASSDEF.some(([g])=>g===OB.fac))st.push('cls');
  else if(OB.fac==='芸術工学部'&&[2,3,4].includes(OB.year))st.push('course');
  st.push('done');
  return OB.fromMenu?st.slice(1):st;
}
function obOpen(fromMenu){
  const g=profFromCls(CLS)||{};
  Object.assign(OB,{step:0,fromMenu:!!fromMenu,fac:(PROF&&PROF.fac)||g.fac||'',year:(PROF&&PROF.year)||g.year||0,cls:CLS});
  let el=$('#ob');if(!el){el=document.createElement('div');el.id='ob';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','obh');el.innerHTML='<div class="ob-card"><div class="ob-top"></div><div class="ob-body"></div><div class="ob-foot"></div></div>';document.body.appendChild(el)}
  OB.shown='';OB.busy=false;
  document.body.classList.add('obon');obRender();
}
function obClose(){const el=$('#ob');el&&el.remove();document.body.classList.remove('obon');meLabel()}
function obSkip(){
  if(!PROF){PROF={skipped:true};profSave()}
  obClose();syncCtl();rerenderAll();
}
function obFinish(){
  PROF={fac:OB.fac,year:OB.year||'',skipped:false};profSave();
  const want=OB.year===1||OB.fac==='芸術工学部'&&[2,3,4].includes(OB.year)?OB.cls:'';
  if(want!==CLS){try{localStorage.removeItem('kyudai-syllabus-gcourse')}catch(_){}CLS=want;try{localStorage.setItem(CKEY,CLS)}catch(_){}}
  // 表示範囲は回答から決まる既定値に戻す
  const q=params();if(q.has('all')){q.delete('all');history.replaceState(null,'',location.hash.split('?')[0]+(q.toString()?'?'+q:''))}
  obClose();syncCtl();rerenderAll();
}
function rerenderAll(){const h=location.hash;if(h.startsWith('#/c/'))return;if(/^#\/[atwg](\?|$)/.test(h))rerender();else renderList()}
function obRender(){
  const el=$('#ob');if(!el)return;
  const st=obSteps(),k=st[OB.step],n=st.length,first=OB.step===0;
  const opt=(val,label,sub,on,attr)=>`<button type="button" class="ob-opt" ${attr}="${esc(val)}" aria-pressed="${on}"><b>${esc(label)}</b>${sub?`<small>${esc(sub)}</small>`:''}</button>`;
  let body='';
  if(k==='hello')body=`<p class="eyebrow">Welcome</p><h2 id="obh">はじめに、あなたのことを教えてください</h2><p class="ob-p">学部・学年・クラスを登録すると、次のことができるようになります。</p><ul class="ob-ul"><li><b>受講できる授業</b>だけを一覧に表示</li><li>時間割に<b>必修</b>をまとめて追加</li><li>コースの<b>卒業要件</b>を集計</li></ul><p class="ob-note">設定はこの端末のブラウザにだけ保存されます。あとからいつでも変えられます。</p>`;
  if(k==='fac')body=`<p class="eyebrow">Step ${OB.step+(OB.fromMenu?1:0)} / ${n-(OB.fromMenu?0:1)}</p><h2 id="obh">学部は?</h2><div class="ob-opts">${FACS.map(f=>opt(f,f,'',OB.fac===f,'data-ofac')).join('')}${opt('','その他・学外','全学部の授業を表示します',OB.fac===''&&OB.year!==0,'data-ofac')}</div>`;
  if(k==='year')body=`<p class="eyebrow">Step ${OB.step+(OB.fromMenu?1:0)} / ${n-(OB.fromMenu?0:1)}</p><h2 id="obh">学年は?</h2><div class="ob-opts">${[[1,'1年'],[2,'2年'],[3,'3年'],[4,'4年以上'],['G','大学院']].map(([v,l])=>opt(v,l,v==='G'?'全学部の授業を表示します':'',OB.year===v,'data-oyear')).join('')}</div>`;
  if(k==='cls'){const grp=CLASSDEF.find(([g])=>g===OB.fac);body=`<p class="eyebrow">Step ${OB.step+(OB.fromMenu?1:0)} / ${n-(OB.fromMenu?0:1)}</p><h2 id="obh">クラスは?</h2><p class="ob-p">A表・B表のクラス記号です。分からなければ、あとで選べます。</p><div class="ob-opts">${grp[1].map(([v,l])=>opt(v,v,l,OB.cls===v,'data-ocls')).join('')}${opt('','わからない・あとで','',OB.cls===''&&OB.step>0&&false,'data-ocls')}</div>`}
  if(k==='course')body=`<p class="eyebrow">Step ${OB.step+(OB.fromMenu?1:0)} / ${n-(OB.fromMenu?0:1)}</p><h2 id="obh">コースは?</h2><div class="ob-opts">${Object.entries(ARTC).map(([c,l])=>opt('D'+c+'-'+OB.year,l,'',OB.cls==='D'+c+'-'+OB.year,'data-ocls')).join('')}${opt('','まだ決まっていない','',false,'data-ocls')}</div>`;
  if(k==='done'){
    const cl=(OB.year===1||OB.fac==='芸術工学部'&&[2,3,4].includes(OB.year))?OB.cls:'';
    const all=!OB.fac||OB.year==='G';
    body=`<p class="eyebrow">Ready</p><h2 id="obh">これで準備ができました</h2><dl class="ob-sum"><div><dt>学部</dt><dd>${esc(OB.fac||'その他・学外')}</dd></div><div><dt>学年</dt><dd>${OB.year==='G'?'大学院':OB.year?OB.year+'年':'—'}</dd></div><div><dt>クラス</dt><dd>${cl?esc(clsName(cl)):'—'}</dd></div></dl><ul class="ob-ul"><li>一覧は<b>${all?'全学部':esc('基幹教育と'+(OB.fac==='芸術工学部'?'芸術工学部・芸術工学府':OB.fac))}</b>の授業を表示します(切り替えもできます)</li>${cl?'<li><b>受講できる授業だけ</b>を表示します</li>':'<li>クラスを選ぶと、受講できる授業だけに絞れます</li>'}</ul>`;
  }
  const foot=k==='hello'?`<button type="button" class="ob-main" data-onext>はじめる</button><button type="button" class="ob-sub" data-oskip>スキップして使う</button>`
    :k==='done'?`<button type="button" class="ob-main" data-odone>使いはじめる</button><button type="button" class="ob-sub" data-oback>戻る</button>`
    :`<button type="button" class="ob-sub" data-oback${first?' hidden':''}>戻る</button>`;
  el.querySelector('.ob-top').innerHTML=`<div class="ob-prog" aria-hidden="true">${st.map((_,i)=>`<i${i<=OB.step?' class="on"':''}></i>`).join('')}</div>${OB.fromMenu?'<button type="button" class="ob-x" data-oclose aria-label="閉じる">閉じる</button>':k!=='hello'&&k!=='done'?'<button type="button" class="ob-x" data-oskip>スキップ</button>':''}`;
  const bd=el.querySelector('.ob-body');bd.innerHTML=body;el.querySelector('.ob-foot').innerHTML=foot;
  if(OB.shown!==k){bd.classList.remove('enter');void bd.offsetWidth;bd.classList.add('enter');OB.shown=k}
  const f=el.querySelector('[aria-pressed=true]')||el.querySelector('.ob-main,.ob-opt');f&&f.focus({preventScroll:true});
}
document.addEventListener('click',e=>{
  const ob=e.target.closest('#ob');if(!ob)return;
  let b;const go=d=>{if(OB.busy)return;OB.step=Math.max(0,Math.min(obSteps().length-1,OB.step+d));obRender()};
  const pick=(btn,fn)=>{if(OB.busy)return;OB.busy=true;fn();btn.closest('.ob-opts').querySelectorAll('.ob-opt').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));setTimeout(()=>{OB.busy=false;go(1)},180)};
  if(e.target===ob){if(OB.fromMenu)obClose();return}
  if(b=e.target.closest('[data-ofac]'))return pick(b,()=>{const v=b.dataset.ofac;if(v!==OB.fac)OB.cls='';OB.fac=v;OB.year=OB.year||0});
  if(b=e.target.closest('[data-oyear]'))return pick(b,()=>{const v=b.dataset.oyear;const y=v==='G'?'G':+v;if(y!==OB.year)OB.cls='';OB.year=y});
  if(b=e.target.closest('[data-ocls]'))return pick(b,()=>{OB.cls=b.dataset.ocls});
  if(e.target.closest('[data-onext]'))return go(1);
  if(e.target.closest('[data-oback]'))return go(-1);
  if(e.target.closest('[data-oskip]'))return obSkip();
  if(e.target.closest('[data-oclose]'))return obClose();
  if(e.target.closest('[data-odone]'))return obFinish();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#ob')){OB.fromMenu?obClose():obSkip()}});
$('#me').addEventListener('click',()=>obOpen(true));
/* 数字のカウントアップ */
function countUp(root){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  (root||document).querySelectorAll('[data-count]').forEach(el=>{
    const to=+el.dataset.count;if(!to)return;const t0=performance.now(),D=900;
    const f=t=>{const k=Math.min(1,(t-t0)/D),e=1-Math.pow(1-k,4);el.textContent=Math.round(to*e);if(k<1)requestAnimationFrame(f)};
    el.textContent=0;requestAnimationFrame(f);
  });
}
function route(){
  const st0=history.state;let sv=null;
  if(st0&&st0.k){curKey=st0.k;sv=SCP[st0.k]||null}else{curKey='k'+(++keySeq)+'_'+Date.now();_rs({k:curKey},'')}
  if(sv&&/^#\/?(\?|$)/.test(location.hash))shown=sv.shown||shown;
  const h=location.hash;
  $('#dbar').hidden=true;$('#dtitle').textContent='';$('#h1').hidden=false;
  renderNav();
  if(h.startsWith('#/c/')){renderDetail(decodeURIComponent(h.slice(4)))}
  else if(/^#\/[atwg](\?|$)/.test(h)){
    document.title={t:'時間割',a:'A表',w:'科目比較',g:'卒業要件'}[h[2]]+' - 九大シラバス';
    $('#ctl').hidden=true;rerender();measureHead();restoreScroll(sv);
  }
  else{document.title='九大シラバス';syncCtl();renderList();measureHead();restoreScroll(sv)}
}
$('#q').addEventListener('input',e=>setP('q',e.target.value));
$('#pers').addEventListener('click',e=>{const b=e.target.closest('[data-per]');b&&setP('per',params().get('per')===b.dataset.per?'':b.dataset.per)});
for(const id of ['sem','cat','sub'])$('#'+id).addEventListener('change',e=>setP(id,e.target.value));
$('#sems').addEventListener('click',e=>{const b=e.target.closest('[data-s]');b&&setP('sem',params().get('sem')===b.dataset.s?'':b.dataset.s)});
$('#cls').addEventListener('change',e=>{setClass(e.target.value);shown=100;syncCtl();renderList()});
$('#mine').addEventListener('click',()=>{if(!CLS){$('#cls').focus();return}setP('mine',mineOn()?'0':'')});
$('#nolot').addEventListener('click',()=>setP('nolot',params().get('nolot')?'':'1'));
$('#place').addEventListener('change',e=>setP('place',e.target.value));
$('#days').addEventListener('click',e=>{const b=e.target.closest('[data-d]');b&&setP('d',params().get('d')===b.dataset.d?'':b.dataset.d)});
$('#view').addEventListener('click',e=>{if(e.target.closest('.item'))listScroll=window.scrollY});
window.addEventListener('hashchange',()=>{
  saveScroll();inApp=true;
  const go=()=>{route();countUp()};
  if(document.startViewTransition&&!document.hidden&&!vtBusy&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    try{vtBusy=true;const t=document.startViewTransition(go);const off=()=>{vtBusy=false};t.finished.then(off,off);t.ready.catch(()=>{});t.updateCallbackDone.catch(()=>{})}catch(e){vtBusy=false;go()}
  }else go();
});
window.addEventListener('resize',measureHead);
/* バージョン欄: 配信されているファイルの更新日時(Last-Modified)を見せる */
(()=>{
  const fmt=d=>d&&!isNaN(d)?`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:'不明';
  const lm=u=>fetch(u,{method:'HEAD',cache:'no-cache'}).then(r=>{const h=r.headers.get('last-modified');return h?new Date(h):null}).catch(()=>null);
  let site=null,dat=null;
  const load=Promise.all([lm(location.pathname),lm('data/index.json'),lm('app.js')]).then(([a,b,c])=>{if(c&&(!a||c>a))a=c;site=a;dat=b;if(a){$('#ver').innerHTML='<span class="vl">更新 </span>'+(a.getMonth()+1)+'/'+a.getDate()}});
  const btn=$('#ver'),box=$('#verinfo');
  btn.addEventListener('click',async()=>{
    const open=box.hidden;if(open){await load;const bv=BTV&&(BTV['前期']||BTV['後期'])?`　B表: 前期 ${BTV['前期']||'-'} / 後期 ${BTV['後期']||'-'}`:'';box.innerHTML=`サイト(画面・機能)の更新: <b>${fmt(site)}</b><br>講義データの更新: <b>${fmt(dat)}</b>${bv?'<br>'+esc(bv.trim()):''}<br><span class="srcnote">配信サーバー上のファイルの更新日時です。</span>`}
    box.hidden=!open;btn.setAttribute('aria-expanded',open);measureHead();
  });
})();
$('#bk').addEventListener('click',goBack);
$('#view').addEventListener('click',e=>{
  const t=e.target.closest('.tabs a');
  if(t){e.preventDefault();const el=document.getElementById(t.dataset.t);el&&el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});return}
  const m=e.target.closest('.morebtn');
  if(m){const b=m.previousElementSibling;const on=b.classList.toggle('clamp');m.textContent=on?'続きを読む':'閉じる';return}
  if(e.target.closest('.kw'))listScroll=0;
});
/* ================= 履修プラン・時間割・科目比較・卒業要件 ================= */
const PKEY='kyudai-syllabus-plan';
// 履修プランの検証(localStorage・読み込んだファイルの両方)。想定外のキー・値は捨てる
const plClean=o=>{const P={p:{},adj:{},md:{}},obj=x=>x&&typeof x==='object'&&!Array.isArray(x);o=obj(o)?o:{};
  if(obj(o.p))for(const[k,v]of Object.entries(o.p))if(/^[0-9A-Za-z]{1,16}$/.test(k)&&(v==='plan'||v==='done'))P.p[k]=v;
  if(obj(o.adj))for(const[k,v]of Object.entries(o.adj))if(/^[\w-]{1,40}$/.test(k)&&Number.isInteger(v)&&v>=0&&v<=200)P.adj[k]=v;
  if(obj(o.md))for(const[k,v]of Object.entries(o.md))if(k.length<=120&&k!=='__proto__'&&(v==='plan'||v==='done'||v==='-'))P.md[k]=v;
  return P};
let PL=(()=>{try{return plClean(JSON.parse(localStorage.getItem(PKEY)||'{}'))}catch(e){return plClean({})}})();
const plSave=()=>{try{localStorage.setItem(PKEY,JSON.stringify(PL))}catch(e){}};
let BYC={},MDREQ=null,ATABLE=null,COURSEREQ=null,AGRID=null,CWARI={},KREQ=null;const SER=new Map();
const TIMES={1:'8:40',2:'10:30',3:'13:00',4:'14:50',5:'16:40'};
const QMAP={'前期':['春','夏'],'春学期':['春'],'夏学期':['夏'],'後期':['秋','冬'],'秋学期':['秋'],'冬学期':['冬']};
const TERMQ={'前期':['春','夏'],'後期':['秋','冬']};
const crOf=c=>parseFloat(zen(String(c.credit||'')))||0;
const gradeOK=c=>{const g=zen(c.grade||'');return !g||(!/^(修士|博士)/.test(g)&&/全学年|1/.test(g))};
const termOf=c=>{const x=((c.when||[])[0]||'').split(/[\s\u3000]+/)[0]||'';return /^(前期|春|夏)/.test(x)?'前期':/^(後期|秋|冬)/.test(x)?'後期':''};
const defTerm=()=>{const m=new Date().getMonth()+1;return m>=9||m<=3?'後期':'前期'};
// URL の t は前期/後期だけを受け付ける(それ以外の文字列を HTML に埋め込まないため)
const termP=p=>{const t=p.get('t');return t==='前期'||t==='後期'?t:defTerm()};
const qHit=(a,b)=>a.some(x=>b.includes(x));
function cslots(c){
  if(!c._sl)c._sl=slots(c).filter(s=>s.d&&s.p&&DAYS.includes(s.d)&&QMAP[s.sem]).map(s=>({d:s.d,p:+s.p,q:QMAP[s.sem],sem:s.sem}));
  return c._sl;
}
const inTerm=(c,t)=>cslots(c).some(s=>qHit(s.q,TERMQ[t]));
const grpOf=c=>{const p=c.b?placeOf(c):(c.campus||'');return p==='遠隔'?'遠隔':/病院/.test(p)?'病院':/大橋|馬出/.test(p)?'大橋':/イースト/.test(p)?'イースト':'伊都'};
function okFor(c){
  if(!CLS)return true;
  const e=elig(c);
  if(upM())return e==='yes';
  return e==='yes'||(e==='unk'&&gradeOK(c));
}
const planned=st=>Object.entries(PL.p).filter(([,s])=>!st||s===st).map(([k,s])=>({c:BYC[k],st:s})).filter(x=>x.c);
function setPlan(code,st){
  if(!st)delete PL.p[code];else PL.p[code]=st;
  plSave();
}
const stLabel={plan:'履修予定',done:'修得済み'};
const hm=s=>esc(s);
// 自動で履修予定に入れられる必修: 1年生はA表(data/atable.json)、芸工2〜4年は対象コース・学年で「必修」の科目
const REQC={};
function reqFor(){
  if(!CLS)return null;
  // 1年生: A表の必修 + Moodle のクラス割でクラス単位に決まる学術英語
  const cw=(CWARI[CLS]&&CWARI[CLS].req)||[],at=ATABLE&&ATABLE[CLS];
  if(at||cw.length)return {codes:[...new Set([...(at?at.codes:[]),...cw])],manual:at?at.manual:[]};
  const um=upM();if(!um)return null;
  if(REQC[CLS])return REQC[CLS];
  const k=um[1],y=+um[2],g=new Map();
  DATA.forEach(c=>{if(c.cx&&c.cx[k]==='h'&&(!c.yr.length||c.yr.includes(y))){const n=nameKey(c.n);(g.get(n)||g.set(n,[]).get(n)).push(c)}});
  const codes=[],manual=[];
  g.forEach((a,n)=>a.length===1?codes.push(a[0].c):manual.push({n,t:n+': 同じ科目が'+a.length+'件あるので、クラス・時間を選んで入れる'}));
  return REQC[CLS]={codes,manual};
}

/* ---------- 時間割 ---------- */
function slotIndex(term,nolot){
  const m=new Map(),tq=TERMQ[term];
  for(const c of pool()){
    if(PL.p[c.c]||!okFor(c))continue;
    if(nolot&&c.b&&c.b.apply)continue;
    for(const s of cslots(c)){
      if(!qHit(s.q,tq))continue;
      const k=s.d+'-'+s.p;
      if(!m.has(k))m.set(k,[]);
      m.get(k).push(c);
    }
  }
  return m;
}
function occupancy(term){
  const m=new Map(),tq=TERMQ[term];
  for(const {c,st} of planned('plan'))for(const s of cslots(c)){
    if(!qHit(s.q,tq))continue;
    const k=s.d+'-'+s.p;
    if(!m.has(k))m.set(k,[]);
    m.get(k).push({c,s});
  }
  return m;
}
function conflictsOf(term){
  const out=[];
  for(const [k,a] of occupancy(term))
    for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)
      if(a[i].c!==a[j].c&&qHit(a[i].s.q,a[j].s.q))out.push({k,a:a[i].c,b:a[j].c});
  return out;
}
function warnings(term){
  const w=[],occ=occupancy(term);
  for(const x of conflictsOf(term)){const [d,p]=x.k.split('-');w.push(['bad',`${d}曜${p}限が重なっています: ${x.a.n} と ${x.b.n}`])}
  for(const d of DAYS){
    const ps=[1,2,3,4,5,6].filter(p=>occ.has(d+'-'+p));
    let run=1;
    for(let i=0;i<ps.length;i++){
      if(i>0&&ps[i]===ps[i-1]+1){
        run++;
        const a=occ.get(d+'-'+ps[i-1])[0].c,b=occ.get(d+'-'+ps[i])[0].c;
        const ga=grpOf(a),gb=grpOf(b);
        if(a!==b&&ga!==gb)w.push(['warn',`${d}曜 ${ps[i-1]}限→${ps[i]}限: ${ga}から${gb}へ移動(${a.n} → ${b.n})`]);
      }else run=1;
      if(run===4)w.push(['note',`${d}曜は4コマ以上連続しています`]);
    }
  }
  return w;
}
let REQSET=new Set();
function buildReq(){
  REQSET=new Set();const r=reqFor();if(r)r.codes.forEach(c=>REQSET.add(c));
  const k=(upM()||/^S1-(\d\d)$/.exec(CLS||'')||[])[1];
  if(k)DATA.forEach(c=>{if(c.cx&&c.cx[k]==='h'&&elig(c)==='yes')REQSET.add(c.c)});
}
function cellHTML(term,d,p,occ,idx,sel,confKeys){
  const k=d+'-'+p,os=occ.get(k)||[],n=(idx.get(k)||[]).length;
  const bad=confKeys.has(k);
  // 空きコマでも、A表で自分のクラスの必修枠(第2外国語・学術英語などクラス割の発表前のもの)なら枠として示す
  const ag=!os.length&&AGRID&&AGRID.classes[CLS]&&AGRID.classes[CLS][term],ac=ag&&(ag[p-1]||[])[DAYS.indexOf(d)],rqf=ac&&ac.k.includes('r')&&ac.t?`<span class="rqf" title="A表の必修枠(まだ授業を入れていない)">${esc(ac.t)}</span>`:'';
  const inner=os.length?os.map(({c,s})=>`<span class="cc">${s.q.length===1?`<i>${s.q[0]}</i>`:''}${esc(c.n)}</span>`).join(''):`${rqf}<span class="fr">${n?n+'<small>件</small>':''}</span>`;
  return `<button type="button" class="cell${d===DAYS[(new Date().getDay()+6)%7]?' col-today':''}${os.length?' has':''}${os.length>1?' multi':''}${os.length&&os.every(o=>REQSET.has(o.c.c))?' rq':''}${bad?' bad':''}${sel===k?' sel':''}" data-cell="${k}" aria-label="${d}曜${p}限">${inner}</button>`;
}
function clashes(c,term){
  if(!term||PL.p[c.c])return false;
  const tq=TERMQ[term],occ=occupancy(term);
  return cslots(c).some(s=>qHit(s.q,tq)&&(occ.get(s.d+'-'+s.p)||[]).some(o=>qHit(o.s.q,s.q)));
}
function candRow(c,term){
  const cf=clashes(c,term);
  return `<div class="pi"><a class="pit" href="#/c/${esc(c.c)}"><b>${esc(c.n)}</b><span class="meta">${esc(c.t)}　${c.when.map(w=>esc(w.replace(/[\s\u3000]+/g,' '))).join(' / ')}</span><span>${crOf(c)?`<span class="tag s">${crOf(c)}単位</span> `:''}${badgeHTML(c)}${CLS&&CWARI[CLS]&&[...(CWARI[CLS].req||[]),...(CWARI[CLS].sec||[])].includes(c.c)?' <span class="tag s">クラス割</span>':''}${cf?' <span class="tag no">重複</span>':''}</span></a><button type="button" class="chip add" data-add="${esc(c.c)}">追加</button></div>`;
}
// 同じ科目名が複数(クラス・教員違い)ある候補は1行にまとめて、開くと一覧が出る
function candList(cands,term,limit){
  const g=new Map();
  cands.forEach(c=>{const k=nameKey(c.n);(g.get(k)||g.set(k,[]).get(k)).push(c)});
  const arr=[...g.values()].sort((a,b)=>a[0].n.localeCompare(b[0].n,'ja'));
  const html=arr.slice(0,limit).map(a=>{
    if(a.length===1)return candRow(a[0],term);
    const free=a.filter(c=>!clashes(c,term)).length,n0=a[0].n;
    return `<details class="cgrp"><summary><b>${esc(n0)}</b> <span class="tag s">${a.length}クラス</span>${free<a.length?` <span class="tag w">重複なし ${free}</span>`:''}</summary><a class="lnk" href="#/w?n=${encodeURIComponent(nameKey(n0))}&mine=0">成績配分で比べる →</a>${a.sort((x,y)=>x.t.localeCompare(y.t,'ja')).map(c=>candRow(c,term)).join('')}</details>`;
  }).join('');
  return {html,groups:arr.length,more:arr.length>limit};
}
function planRow(c,st){
  return `<div class="pi"><a class="pit" href="#/c/${esc(c.c)}"><b>${esc(c.n)}</b><span class="meta">${esc(c.t)}　${c.when.map(w=>esc(w.replace(/[\s\u3000]+/g,' '))).join(' / ')}${crOf(c)?`　${crOf(c)}単位`:''}</span></a><span class="pib">${st==='plan'?`<button type="button" class="chip" data-done="${esc(c.c)}">修得済みにする</button>`:`<button type="button" class="chip" data-back="${esc(c.c)}">予定に戻す</button>`}<button type="button" class="chip" data-rm="${esc(c.c)}">外す</button></span></div>`;
}
function renderTT(){
  const v=$('#view'),p=params(),term=termP(p),sel=p.get('s')||'',nolot=!!p.get('nolot');
  buildReq();
  const td=(new Date().getDay()+6)%7,nowP=(()=>{const m=new Date().getHours()*60+new Date().getMinutes();return [[520,610],[630,720],[780,870],[890,980],[1000,1090]].findIndex(([a,b])=>m>=a&&m<b)+1})();
  const occ=occupancy(term),idx=slotIndex(term,nolot),confKeys=new Set(conflictsOf(term).map(x=>x.k));
  const six=[...occ.keys(),...idx.keys()].some(k=>k.endsWith('-6')),per=six?6:5;
  let g=`<div class="tt"><div class="th"></div>${DAYS.map((d,di)=>`<div class="th${di===td?' today':''}">${d}</div>`).join('')}`;
  for(let i=1;i<=per;i++){
    g+=`<div class="tl${i===nowP&&td<5?' now':''}"><b>${i}</b><small>${TIMES[i]||''}</small></div>`+DAYS.map(d=>cellHTML(term,d,i,occ,idx,sel,confKeys)).join('');
  }
  g+='</div>';
  const clsOpts=`<option value="">クラス未設定</option>${CLASSDEF.map(([gn,a])=>`<optgroup label="${gn}">${a.map(([x,l])=>`<option value="${x}"${x===CLS?' selected':''}>${/^D/.test(x)?clsName(x):x+(l?' '+esc(l):'')}</option>`).join('')}</optgroup>`).join('')}`;
  let h=`<div class="pghead"><h2 class="lh" data-e="Timetable">時間割</h2><div class="seg" role="group" aria-label="学期" style="--i:${term==='後期'?1:0}">${['前期','後期'].map(t=>`<button type="button" data-tt="${t}" aria-pressed="${t===term}">${t}</button>`).join('')}</div></div><div class="ctlrow"><select id="tcls" aria-label="自分のクラス">${clsOpts}</select><a class="chip" href="#/a?t=${term}">A表 ›</a></div>`;
  const at=reqFor();
  let atb='',atd='';
  if(at){
    const todo=at.codes.filter(c=>!PL.p[c]);
    atb=todo.length?`<button class="reqbar" id="patb" type="button"><span><b>${at.codes.length===todo.length?'必修':'未登録の必修'} ${todo.length}科目</b>を一括で追加</span><i>＋</i></button>`:`<p class="reqdone">${at.codes.length?'✓ 必修は履修予定に入れ済み':'自動で入れられる必修はありません'}</p>`;
    atd=at.manual&&at.manual.length?`<details class="note manual"><summary>自動では入れられない必修 <b>${at.manual.length}</b></summary><ul>${at.manual.map(x=>typeof x==='string'?`<li>${esc(x)}</li>`:`<li><a href="#/w?n=${encodeURIComponent(x.n)}">${esc(x.t)}</a></li>`).join('')}</ul></details>`:'';
  }
  else if(!CLS)atb='<p class="hint">まず<b>自分のクラス</b>を選んでください。受講できる授業だけが数えられ、必修の授業もまとめて入れられます。</p>';
  else atb='<p class="reqdone">このクラスの必修データはまだありません</p>';
  h+=atb+g+`<div class="tfoot">${REQSET.size?'<p class="tlg"><span><i class="sg rq"></i>必修</span><span><i class="sg el"></i>選択・その他</span><span><i class="sg bad"></i>重複</span>'+(AGRID&&AGRID.classes[CLS]?'<span><i class="sg rqf"></i>A表の必修枠(未登録)</span>':'')+'</p>':''}<div class="tline"><button class="chip sm" data-nolot="1" aria-pressed="${nolot}">抽選なしのみ</button></div><p class="count">数字は${CLS?esc(clsName(CLS))+' で受講できる':'(クラス未設定のため全部の)'}授業の件数。コマをタップで一覧。</p></div>${atd}`;
  if(sel){
    const [d,pp]=sel.split('-'),cands=(idx.get(sel)||[]).slice().sort((a,b)=>a.n.localeCompare(b.n,'ja')),os=occ.get(sel)||[];
    h+=`<section class="panel"><h3>${esc(d)}曜 ${esc(pp)}限 <small>${TIMES[pp]||''}〜　${term}</small><button class="lnk" type="button" data-totop="1">↑ 時間割に戻る</button></h3>`;
    if(os.length)h+=`<h4>入れてある授業</h4>`+os.map(({c})=>planRow(c,'plan')).join('');
    const cl=candList(cands,term,60);
    h+=`<h4>この枠で取れる授業 ${cl.groups}科目${cl.groups!==cands.length?`(${cands.length}クラス)`:''}</h4>`;
    h+=cands.length?cl.html+(cl.more?`<p class="note">先頭60科目を表示。抽選なし・クラス設定で絞れます。</p>`:''):'<p class="note">該当する授業がありません。</p>';
    h+='</section>';
  }
  const ws=warnings(term);
  if(ws.length)h+=`<section class="panel"><h3>確認してください</h3>${ws.map(([k,t])=>`<p class="wl ${k}">${esc(t)}</p>`).join('')}</section>`;
  const pl=planned('plan'),dn=planned('done');
  const sum=a=>a.reduce((s,x)=>s+crOf(x.c),0),tsum=t=>sum(pl.filter(x=>termOf(x.c)===t));
  h+=`<section class="panel"><h3>履修プラン <small>予定 ${sum(pl)}単位(前期 ${tsum('前期')} / 後期 ${tsum('後期')})　修得済み ${sum(dn)}単位</small></h3>`;
  for(const t of ['前期','後期','']){
    const a=pl.filter(x=>termOf(x.c)===t).sort((x,y)=>x.c.n.localeCompare(y.c.n,'ja'));
    if(a.length)h+=`<h4>${t||'その他'}</h4>`+a.map(x=>planRow(x.c,'plan')).join('');
  }
  if(!pl.length)h+='<p class="note">まだ入れていません。コマをタップして追加するか、講義の詳細画面から入れられます。</p>';
  const off=pl.filter(x=>!cslots(x.c).length);
  if(off.length)h+=`<p class="note">曜日・時限が決まっていない授業(集中講義など): ${off.map(x=>esc(x.c.n)).join('、')}</p>`;
  if(dn.length)h+=`<details><summary>修得済み ${dn.length}件</summary>${dn.map(x=>planRow(x.c,'done')).join('')}</details>`;
  h+=`<div class="row" style="margin-top:12px"><button class="chip" id="pimg" type="button">${term}の時間割を画像で保存</button>${pl.length||dn.length?'<button class="chip" id="pclr" type="button">プランを全部消す</button>':''}</div><div class="row" style="margin-top:8px"><button class="chip" id="pexp" type="button">プランを書き出す</button><button class="chip" id="pimp" type="button">プランを読み込む</button><input type="file" id="pfile" accept="application/json,.json" hidden></div><p class="srcnote">履修プランはこの端末のブラウザにだけ保存されます。機種変更や別の端末で使うときは、書き出したファイルを読み込んでください。</p></section>`;
  $('#ctl').hidden=true;
  v.innerHTML=h;
}
function ttImage(term){
  const occ=occupancy(term),conf=new Set(conflictsOf(term).map(x=>x.k));
  const per=[...occ.keys()].some(k=>k.endsWith('-6'))?6:5,lw=70,cw=210,hh=54,rh=132,pad=24;
  const W=lw+cw*5+pad*2,H=hh+rh*per+pad*2+72,cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const x=cv.getContext('2d'),F='"Hiragino Sans","Noto Sans JP",sans-serif';
  x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#17212b';x.font=`700 26px ${F}`;x.textBaseline='top';
  x.fillText(`時間割 ${term}${CLS?'  '+clsName(CLS):''}`,pad,pad-6);
  const ox=pad+lw,oy=pad+40;
  x.font=`700 22px ${F}`;x.textAlign='center';
  DAYS.forEach((d,i)=>{x.fillStyle='#e2ebf7';x.fillRect(ox+i*cw,oy,cw-2,hh-2);x.fillStyle='#123f80';x.fillText(d,ox+i*cw+cw/2,oy+13)});
  for(let r=1;r<=per;r++){
    x.fillStyle='#5d6b79';x.font=`600 20px ${F}`;x.fillText(`${r}限`,pad+lw/2,oy+hh+(r-1)*rh+30);
    x.font=`400 14px ${F}`;x.fillText(TIMES[r]||'',pad+lw/2,oy+hh+(r-1)*rh+58);
    DAYS.forEach((d,i)=>{
      const k=d+'-'+r,os=occ.get(k)||[],X=ox+i*cw,Y=oy+hh+(r-1)*rh;
      x.fillStyle=os.length?(conf.has(k)?'#fbdedb':os.every(o=>REQSET.has(o.c.c))?'#d9f0e3':'#e2ebf7'):'#f5f7fa';x.fillRect(X,Y,cw-2,rh-2);
      x.textAlign='left';x.fillStyle='#17212b';x.font=`600 17px ${F}`;
      let ly=Y+8;
      for(const {c} of os.slice(0,2)){
        const t=c.n;let line='';
        for(const ch of t){if(x.measureText(line+ch).width>cw-16){x.fillText(line,X+8,ly);ly+=22;line=ch;if(ly>Y+rh-50)break}else line+=ch}
        if(ly<=Y+rh-30)x.fillText(line,X+8,ly);ly+=26;
      }
      x.textAlign='center';
    });
  }
  x.textAlign='left';x.fillStyle='#8a97a5';x.font=`400 14px ${F}`;x.fillText('九大シラバス 履修プラン',pad,oy+hh+rh*per+12);
  cv.toBlob(b=>{if(!b)return;const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`時間割-${term}.png`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)});
}

/* ---------- Ⅰ→Ⅱ の関連づけ・同名科目 ---------- */
const ROMAN={'Ⅰ':1,'Ⅱ':2,'Ⅲ':3,'Ⅳ':4,'Ⅴ':5},ROMANS=['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'];
const nameKey=n=>zen(String(n||'')).replace(/[\s\u3000]+/g,' ').trim();
function seriesOf(n){
  const s=nameKey(n);
  let m=s.match(/^(.*?)\s*([ⅠⅡⅢⅣⅤ])(\s*[（(][^）)]*[）)])?$/);
  if(m)return{base:m[1]+'|'+(m[3]||'').trim(),idx:ROMAN[m[2]],st:'r'};
  m=s.match(/^(.*\S)\s+(\d)(\s*[（(][^）)]*[）)])?$/);
  if(m&&+m[2]<=9)return{base:m[1]+'|'+(m[3]||'').trim(),idx:+m[2],st:'d'};
  m=s.match(/^(.*\S)\s+(I{1,3}|IV|V)$/);
  if(m)return{base:m[1]+'|',idx:{I:1,II:2,III:3,IV:4,V:5}[m[2]],st:'a'};
  return null;
}
function buildSeries(){
  SER.clear();
  for(const c of DATA){
    const s=seriesOf(c.n);c._ser=s;
    if(!s)continue;
    const k=s.base+'#'+s.idx;
    if(!SER.has(k))SER.set(k,[]);
    SER.get(k).push(c);
  }
}
const serLabel=(s,i)=>s.st==='r'?ROMANS[i]:s.st==='a'?['','I','II','III','IV','V'][i]:String(i);
function relHTML(c){
  let h='';
  if(c._ser){
    const s=c._ser;
    for(const [d,lab] of [[1,'つづきの科目'],[-1,'前の科目']]){
      let a=(SER.get(s.base+'#'+(s.idx+d))||[]).filter(x=>!CLS||!x.b||elig(x)!=='no');
      a=a.sort((x,y)=>(y.t===c.t)-(x.t===c.t));
      if(!a.length)continue;
      h+=`<div class="rel"><b>${lab}(${serLabel(s,s.idx+d)})</b><div class="tags">${a.slice(0,5).map(x=>`<a href="#/c/${esc(x.c)}">${x.t===c.t?'同じ教員 ':''}${esc(x.t)}　${esc((x.when[0]||'').replace(/[\s\u3000]+/g,' '))}</a>`).join('')}</div>${a.length>5?`<p class="srcnote">他 ${a.length-5}件。一覧で「${esc(s.base.split('|')[0])}」を検索してください</p>`:''}</div>`;
    }
  }
  const same=DATA.filter(x=>nameKey(x.n)===nameKey(c.n));
  if(same.length>=2)h+=`<a class="rel cmp" href="#/w?n=${encodeURIComponent(nameKey(c.n))}">同じ科目名の授業 ${same.length}件を、成績配分で比べる →</a>`;
  return h;
}
function planBoxHTML(c){
  const st=PL.p[c.c]||'';
  return `<div class="pbox" id="relbox" data-code="${esc(c.c)}"><div class="row">${st?`<span class="tag s">${stLabel[st]}</span>`:''}${st!=='plan'?`<button class="chip" data-set="plan" data-code="${esc(c.c)}">履修予定に入れる</button>`:''}${st!=='done'?`<button class="chip" data-set="done" data-code="${esc(c.c)}">修得済みにする</button>`:''}${st?`<button class="chip" data-set="" data-code="${esc(c.c)}">外す</button>`:''}</div>${relHTML(c)}</div>`;
}

/* ---------- 同名科目の比較 ---------- */
const GC={};
async function gradeOf(code){
  if(GC[code])return GC[code];
  try{
    const r=await fetch(`data/detail/${encodeURIComponent(code.replace(/([a-z])/g,'_$1'))}.json`);if(!r.ok)throw 0;
    const secs=normalize(await r.json());let rows=[];
    for(const [t,f] of Object.entries(secs))if(kindOf(t)[0]==='grade')rows=rows.concat(parseGrade(Object.fromEntries(Object.entries(f).filter(([,x])=>x&&String(x).trim()))).rows);
    return GC[code]={rows};
  }catch(e){return GC[code]={rows:[],err:1}}
}
const sumBy=(rows,re)=>rows.filter(r=>re.test(r.k)).reduce((a,r)=>a+r.n,0);
const METRIC={
  name:['教員名順',()=>0],
  exam:['試験が少ない順',r=>sumBy(r,/試験|テスト/)],
  report:['レポート・課題が多い順',r=>-sumBy(r,/レポート|課題|作品|発表/)],
  attend:['出席・参加が多い順',r=>-sumBy(r,/出席|貢献|参加|平常/)]};
function cmpBar(rows){
  const tot=rows.reduce((a,r)=>a+r.n,0);
  if(!rows.length)return '<p class="note">成績配分を読み取れませんでした</p>';
  return `<div class="stack">${rows.map((r,i)=>`<i style="width:${r.n/Math.max(tot,100)*100}%;background:var(--c${i%5})"></i>`).join('')}</div><div class="cl">${rows.map((r,i)=>`<span><i class="sw" style="background:var(--c${i%5})"></i>${esc(r.k)} <b>${esc(r.v)}</b></span>`).join('')}</div>`;
}
async function renderCmp(){
  const v=$('#view'),p=params(),n=p.get('n')||'';
  $('#ctl').hidden=true;
  if(!n){
    const m=new Map(),mine0=CLS&&p.get('mine')!=='0';
    for(const c of pool()){if(mine0&&!okFor(c))continue;const k=nameKey(c.n);if(!m.has(k))m.set(k,[]);m.get(k).push(c)}
    const a=[...m].filter(([,x])=>x.length>=3).sort((x,y)=>y[1].length-x[1].length);
    v.innerHTML=`<h2 class="lh" data-e="Compare">科目比較</h2><p class="count">同じ科目名で複数のクラス・教員に分かれている授業を、成績配分で比べられます。</p>${CLS?`<div class="row"><button class="chip" data-cmine="1" aria-pressed="${mine0}">${esc(clsName(CLS))}で受講可のみ</button></div>`:''}<input id="cmpq" type="search" placeholder="科目名で絞り込み" style="width:100%;margin-bottom:8px">`+a.map(([k,x])=>`<a class="item" data-nm="${esc(k.toLowerCase())}" href="#/w?n=${encodeURIComponent(k)}"><b>${esc(k)}</b><span class="meta">${x.length}クラス　${[...new Set(x.map(c=>c.t))].length}人の教員</span></a>`).join('')||'<p class="note">該当なし</p>';
    $('#cmpq').addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();document.querySelectorAll('#view .item[data-nm]').forEach(el=>{el.hidden=!!q&&!el.dataset.nm.includes(q)})});
    return;
  }
  const sortKey=p.get('o')||'name',mine=CLS&&p.get('mine')!=='0';
  let cs=pool().filter(c=>nameKey(c.n)===n);
  if(!cs.length)cs=pool().filter(c=>nameKey(c.n).startsWith(n));
  const total=cs.length;
  if(mine)cs=cs.filter(c=>!c.b||elig(c)!=='no');
  v.innerHTML=`<a class="back" href="#/w">‹ 科目一覧</a><h2 class="lh" data-e="Compare / 同名科目">${esc(n)}</h2><p class="count">${cs.length}件${mine&&total!==cs.length?`(${esc(clsName(CLS))} で受講できるもの。全 ${total}件)`:''}</p><div class="row">${CLS?`<button class="chip" data-cmine="1" aria-pressed="${!!mine}">${esc(clsName(CLS))}で受講可のみ</button>`:''}${Object.entries(METRIC).map(([k,[l]])=>`<button class="chip" data-co="${k}" aria-pressed="${k===sortKey}">${l}</button>`).join('')}</div><div id="cmplist"></div>`;
  const box=$('#cmplist'),draw=()=>{
    const arr=cs.map(c=>({c,g:GC[c.c]})).sort((a,b)=>{
      const f=METRIC[sortKey][1],x=a.g&&!a.g.err?f(a.g.rows):99,y=b.g&&!b.g.err?f(b.g.rows):99;
      return x-y||a.c.t.localeCompare(b.c.t,'ja');
    });
    box.innerHTML=arr.map(({c,g})=>`<section class="cmp"><div class="cmph"><a href="#/c/${esc(c.c)}"><b>${esc(c.t||'担当未定')}</b></a>${PL.p[c.c]?` <span class="tag s">${stLabel[PL.p[c.c]]}</span>`:''}${badgeHTML(c)}${clashes(c,termOf(c))?' <span class="tag no">重複</span>':''}<button type="button" class="chip cpb" data-cplan="${esc(c.c)}">${PL.p[c.c]==='plan'?'外す':'履修予定に入れる'}</button></div><span class="meta">${c.when.map(w=>esc(w.replace(/[\s\u3000]+/g,' '))).join(' / ')}${c.b&&c.b.cls?'　'+esc(c.b.cls):''}</span>${g?cmpBar(g.rows):'<p class="note">読み込み中…</p>'}</section>`).join('')||'<p class="note">該当する授業がありません。</p>';
  };
  draw();
  let i=0;
  const run=async()=>{while(i<cs.length){const c=cs[i++];await gradeOf(c.c)}};
  await Promise.all([run(),run(),run(),run(),run()]);
  if(location.hash.startsWith('#/w')&&(params().get('n')||'')===n)draw();
}

/* ---------- 卒業要件 ---------- */
function mdStatus(name){
  if(PL.md[name])return PL.md[name]==='-'?'':PL.md[name];
  const c=DATA.find(x=>PL.p[x.c]&&nameKey(x.n)===nameKey(name));
  return c?PL.p[c.c]:'';
}
function kibanEarn(g){
  let d=0,pl=0;
  if(g.match){const re=new RegExp(g.match);for(const {c,st} of planned()){if(c.b&&re.test(c.b.cat)){st==='done'?d+=crOf(c):pl+=crOf(c)}}}
  if(g.byName){const re=new RegExp(g.byName);for(const {c,st} of planned()){if(!c.b&&re.test(nameKey(c.n))){st==='done'?d+=crOf(c)||1:pl+=crOf(c)||1}}}
  const adj=PL.adj[g.id]||0;
  return{d:d+adj,pl};
}
function bar(d,pl,req){
  const w=x=>Math.min(100,x/req*100);
  return `<div class="gbar" role="img" aria-label="${d}/${req}"><i class="d" style="width:${w(d)}%"></i><i class="p" style="width:${Math.max(0,w(d+pl)-w(d))}%"></i></div>`;
}
function stepper(id,val,label){
  return `<span class="stp"><button type="button" data-adj="${id}" data-dv="-1" aria-label="減らす">−</button><b>${label||'手入力'} ${val}</b><button type="button" data-adj="${id}" data-dv="1" aria-label="増やす">＋</button></span>`;
}
// 1年次の修得目標・進級の条件で数える科目(前方一致。工学倫理(Ⅰ群) なども 工学倫理 として数える)
function advStatus(name){
  if(PL.md[name])return PL.md[name]==='-'?'':PL.md[name];
  const k=nameKey(name),c=DATA.find(x=>PL.p[x.c]&&nameKey(x.n).startsWith(k));
  return c?PL.p[c.c]:'';
}
// 要項(data/kibanreq.json)の「1年次において○単位を修得する」と進級の条件
function advHTML(kc,kd,kp){
  if(!kc)return '';
  const a=kc.adv||{};let rows='',checks=0,ok=true,okp=true;
  const row=(label,d,p,req,note)=>`<div class="grow"><div class="gh"><b>${label}</b><span class="gn2">${d}${p?`(+${p})`:''} / ${req}${d>=req?' ✓':''}</span></div>${bar(d,p,req)}${note?`<p class="srcnote">${note}</p>`:''}</div>`;
  if(a.kiban){checks++;ok=ok&&kd>=a.kiban;okp=okp&&kd+kp>=a.kiban;rows+=row('進級に必要な基幹教育',kd,kp,a.kiban,'区分ごとの必要単位までを数えた合計で判定しています。')}
  if(a.names){
    let d=0,p=0,each=true,eachP=true;
    const items=a.names.map(([n,cr])=>{const st=advStatus(n);if(st==='done')d+=cr;else if(st==='plan')p+=cr;if(st!=='done')each=false;if(!st)eachP=false;
      return `<div class="pi mdc"><span class="pit"><b>${esc(n)}</b><span class="meta">${cr}単位　<a href="#/?q=${encodeURIComponent(n)}&all=1">シラバスで探す</a></span></span><button type="button" class="chip st${st?' on':''}" data-md="${esc(n)}" data-pfx="1">${st==='done'?'修得済み':st==='plan'?'履修予定':'未'}</button></div>`}).join('');
    const need=a.anyName||0;checks++;
    if(need){ok=ok&&d>=need;okp=okp&&d+p>=need}else{ok=ok&&each;okp=okp&&eachP}
    rows+=`<div class="grow"><div class="gh"><b>${need?`次のうち ${need}単位以上`:'修得が必要な科目'}</b><span class="gn2">${d}${p?`(+${p})`:''} / ${need||a.names.reduce((s,[,c])=>s+c,0)}</span></div>${items}</div>`;
  }
  const verdict=checks?(ok?'<p class="wl ok">進級の条件(ここで判定できる分)を満たしています</p>':okp?'<p class="wl note">履修予定どおりに修得すれば、進級の条件(ここで判定できる分)を満たします</p>':'<p class="wl warn">進級の条件(ここで判定できる分)に足りないものがあります</p>'):'';
  return `<section class="gsec"><h3>1年次の目標・進級 <small>要項</small></h3>${kc.y1?row(`1年次に修得する単位 <small>(目安)</small>`,kd,kp,kc.y1,`要項「1年次において${kc.y1}単位を修得する」。基幹教育の区分ごとの必要単位までを数えた合計と比べています。`):''}${verdict}<p class="srcnote" style="font-size:.85rem">${esc(a.text||'')}</p>${rows}</section>`;
}
const GK='kyudai-syllabus-gcourse';
// 卒業要件のコース: 保存した選択 → クラスから(芸工2〜4年はコース番号、1年生は要項のクラス対応) → メディアデザイン
function gradCourse(){
  const KC=(KREQ&&KREQ.courses)||[];
  let gk='';try{gk=localStorage.getItem(GK)||''}catch(e){}
  if(KC.some(c=>c.id===gk)||ARTC[gk])return gk;
  const um=upM();if(um&&ARTC[um[1]])return um[1];
  const c=KC.find(c=>c.cls.includes(CLS));return c?c.id:'31';
}
function renderGrad(){
  const v=$('#view');$('#ctl').hidden=true;
  const KC=(KREQ&&KREQ.courses)||[],gk=gradCourse(),kc=KC.find(c=>c.id===gk)||null;
  let R;
  if(ARTC[gk]&&MDREQ){
    // 芸術工学部: 便覧から作った専攻教育まで含む要件(mdreq / coursereq)
    R=gk==='31'||!COURSEREQ||!COURSEREQ[gk]?MDREQ:COURSEREQ[gk];
    if(kc)R.kiban.groups.forEach(g=>{const x=kc.groups.find(y=>y.id===g.id);if(x&&x.byName)g.byName=x.byName});
  }else if(kc){
    R={course:kc.name,total:kc.total,range:kc.totalRange,note:kc.note,kiban:{total:kc.kiban,groups:kc.groups},senkou:{total:kc.senkou,groups:[]},rules:[],source:KREQ.source};
  }else{v.innerHTML='<h2 class="lh">卒業要件</h2><p class="note">卒業要件のデータ(data/kibanreq.json・data/mdreq.json)が読み込めません。</p>';return}
  const fac=n=>n.split(' ')[0];
  const opts=KC.length?[...new Set(KC.map(c=>fac(c.name)))].map(f=>{const cs=KC.filter(c=>fac(c.name)===f);return cs.length===1?`<option value="${esc(cs[0].id)}"${cs[0].id===gk?' selected':''}>${esc(cs[0].name)}</option>`:`<optgroup label="${esc(f)}">${cs.map(c=>`<option value="${esc(c.id)}"${c.id===gk?' selected':''}>${esc(c.name.slice(f.length).trim()||f)}</option>`).join('')}</optgroup>`}).join('')
    :Object.entries(ARTC).map(([k,n])=>`<option value="${k}"${k===gk?' selected':''}>${n}コース</option>`).join('');
  let out=`<h2 class="lh" data-e="Graduation">卒業要件</h2><div class="row"><select id="gcourse" aria-label="学部・学科・コース">${opts}</select></div>${R.note?`<p class="srcnote">${esc(R.note)}</p>`:''}`;
  let doneAll=0,planAll=0;
  // --- 基幹教育
  const K=R.kiban;let kd=0,kp=0,excess=0;const kr=[];
  for(const g of K.groups){
    if(g.other)continue;
    const e=kibanEarn(g),tot=e.d+e.pl;
    if(['kb-en','kb-l2','kb-bun','kb-ri','kb-hs','kb-so','kb-hi'].includes(g.id))excess+=Math.max(0,tot-g.req);
    kr.push({g,e});
  }
  const og=K.groups.find(g=>g.other)||{id:'kb-ot',req:0,none:true};
  const oadj=PL.adj[og.id]||0,oauto=Math.min(og.req,excess);
  let hk=`<section class="gsec"><h3>基幹教育科目 <small>${K.total}単位</small></h3>`;
  for(const {g,e} of kr){
    const cap=Math.min(e.d,g.req),capP=Math.min(e.d+e.pl,g.req)-cap;
    kd+=cap;kp+=capP;
    hk+=`<div class="grow"><div class="gh"><b>${esc(g.name)}</b><span class="gn2">${e.d}${e.pl?`(+${e.pl})`:''} / ${g.req}${e.d>=g.req?' ✓':''}</span></div>${bar(e.d,e.pl,g.req)}<p class="srcnote">${esc(g.note||'')}</p>${stepper(g.id,PL.adj[g.id]||0,'手入力の修得単位')}</div>`;
  }
  const od=Math.min(og.req,oauto+oadj);kd+=od;
  if(og.none)hk+='</section>';else hk+=`<div class="grow"><div class="gh"><b>${esc(og.name)}</b><span class="gn2">${od} / ${og.req}${od>=og.req?' ✓':''}</span></div>${bar(od,0,og.req)}<p class="srcnote">${esc(og.note)}(自動: 各区分の超過分 ${oauto}単位)</p>${stepper(og.id,oadj,'手入力(他コース等)')}</div></section>`;
  // --- 専攻教育
  const S=R.senkou;const gs={};
  const cnt=courses=>{let d=0,pl=0;for(const c of courses){const st=mdStatus(c.n);if(st==='done')d+=c.cr;else if(st==='plan')pl+=c.cr}return{d,pl}};
  const courseList=(courses)=>`<details><summary>科目 ${courses.length}件を開く</summary>${courses.map(c=>{const st=mdStatus(c.n);return `<div class="pi mdc"><span class="pit"><b>${c.t?`<span class="mk">${c.t}</span>`:''}${esc(c.n)}</b><span class="meta">${c.cr}単位　<a href="#/?q=${encodeURIComponent(c.n)}">シラバスで探す</a></span>${c.note?`<span class="srcnote">${esc(c.note)}</span>`:''}</span><button type="button" class="chip st${st?' on':''}" data-md="${esc(c.n)}">${st==='done'?'修得済み':st==='plan'?'履修予定':'未'}</button></div>`}).join('')}</details>`;
  let hs='';
  if(!S.groups.length){
    if(S.total){
      const sd=PL.adj['sk-done']||0,sp=PL.adj['sk-plan']||0,c=Math.min(sd,S.total);
      doneAll+=c;planAll+=Math.min(sd+sp,S.total)-c;
      hs=`<section class="gsec"><h3>専攻教育科目 <small>${S.total}単位</small></h3><div class="grow"><div class="gh"><b>専攻教育科目</b><span class="gn2">${sd}${sp?`(+${sp})`:''} / ${S.total}${sd>=S.total?' ✓':''}</span></div>${bar(sd,sp,S.total)}<p class="srcnote">この学部・学科の専攻教育科目の一覧はまだ取り込んでいないので、単位を手入力してください。</p>${stepper('sk-done',sd,'修得済み')} ${stepper('sk-plan',sp,'履修予定')}</div></section>`;
    }else hs=`<section class="gsec"><h3>専攻教育科目</h3><p class="srcnote">専攻教育科目の単位数は学科(配属先)によって違います${R.range?`(卒業要件は学科により ${R.range[0]}〜${R.range[1]}単位)`:''}。学科の履修要項で確認してください。</p></section>`;
  }else{
  hs=`<section class="gsec"><h3>専攻教育科目 <small>${S.total}単位</small></h3>`;
  for(const g of S.groups){
    if(g.derived)continue;
    let d=0,pl=0,body='';
    if(g.sub){
      for(const sg of g.sub){const c=cnt(sg.courses);d+=c.d;pl+=c.pl;const ok=c.d>=sg.min;body+=`<div class="sgl"><b>${esc(sg.name)}</b> <span class="gn2">${c.d}${c.pl?`(+${c.pl})`:''}単位 ${ok?'✓':`(${sg.min}単位以上が必要)`}</span></div>`+courseList(sg.courses)}
    }else{const c=cnt(g.courses);d=c.d;pl=c.pl;body=courseList(g.courses)}
    gs[g.id]={d,pl};
    const cap=Math.min(d,g.req);
    doneAll+=cap;planAll+=Math.min(d+pl,g.req)-cap;
    hs+=`<div class="grow"><div class="gh"><b>${esc(g.name)}</b><span class="gn2">${d}${pl?`(+${pl})`:''} / ${g.req}${d>=g.req?' ✓':''}</span></div>${bar(d,pl,g.req)}${g.note?`<p class="srcnote">${esc(g.note)}</p>`:''}${body}</div>`;
  }
  const dg=S.groups.find(g=>g.derived),oth=PL.adj['sk-other']||0,OM=R.otherMin||4,SR=id=>(S.groups.find(g=>g.id===id)||{req:0}).req;
  const exD=Math.max(0,(gs['sk-sen']||{d:0}).d-SR('sk-sen'))+Math.max(0,(gs['sk-pbl']||{d:0}).d-SR('sk-pbl'))+oth;
  const exP=Math.max(0,((gs['sk-sen']||{d:0,pl:0}).d+(gs['sk-sen']||{pl:0}).pl)-SR('sk-sen'))+Math.max(0,((gs['sk-pbl']||{d:0,pl:0}).d+(gs['sk-pbl']||{pl:0}).pl)-SR('sk-pbl'))+oth-exD;
  const dd=Math.min(dg.req,exD),dp=Math.min(dg.req-dd,Math.max(0,exP));
  doneAll+=dd;planAll+=dp;
  hs+=`<div class="grow"><div class="gh"><b>${esc(dg.name)}</b><span class="gn2">${dd}${dp?`(+${dp})`:''} / ${dg.req}${dd>=dg.req?' ✓':''}</span></div>${bar(dd,dp,dg.req)}<p class="srcnote">${esc(dg.note)}</p>${stepper('sk-other',oth,'他コースの専門・演習')}<p class="srcnote">他コース科目 ${oth}単位 ${oth>=OM?`(${OM}単位以上の条件を満たしています)`:`(${OM}単位以上が必要)`}</p></div></section>`;
  }
  const tD=kd+doneAll,tP=kp+planAll;
  // 卒業要件の総単位: 学科で違う群は最小値、配属前(工学部Ⅵ群)は基幹教育だけ
  const TT=R.total||(R.range&&R.range[0])||K.total,tlabel=R.total?'':R.range?`<p class="srcnote">卒業要件は学科により ${R.range[0]}〜${R.range[1]}単位(ここでは ${R.range[0]}単位で計算)</p>`:'<p class="srcnote">配属先の群・学科が決まるまでは、基幹教育の単位だけを数えています。</p>';
  out+=`<section class="gsec total"><p class="eyebrow">修得済みの単位</p><div class="big"><span data-count="${tD}">${tD}</span><span class="of">/ ${TT}</span></div><p class="bigsub">あと <b>${Math.max(0,TT-tD)}</b> 単位${tP?`　・　履修予定を含めると <b>${tD+tP}</b> 単位`:''}</p>${bar(tD,tP,TT)}<p class="srcnote">各区分は上限(必要単位)までを数えています。</p>${tlabel}</section>`+advHTML(kc,kd,kp)+hk+hs;
  out+=`<section class="gsec"><h3>履修条件・注意</h3>${R.rules.map(r=>`<p class="srcnote" style="font-size:.85rem">${esc(r)}</p>`).join('')}<p class="srcnote">出典: ${esc(R.source)}${kc&&R.source!==KREQ.source?` / ${esc(KREQ.source)}(1年次の目標・進級)`:''}</p><p class="srcnote">単位は履修プランの「修得済み」「履修予定」と、この画面の手入力から集計しています。正式な確認は学務システム・便覧で行ってください。</p></section>`;
  v.innerHTML=out;
}

/* ---------- 共通: ナビ・イベント・初期化 ---------- */
const NAVI={
  '#/':'<path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20"/><circle cx="4.2" cy="6.5" r=".9"/><circle cx="4.2" cy="12" r=".9"/><circle cx="4.2" cy="17.5" r=".9"/>',
  '#/t':'<rect x="3.5" y="4.5" width="17" height="16" rx="2.2"/><path d="M3.5 9.5h17M9.2 9.5v11M3.5 15h17"/>',
  '#/g':'<circle cx="12" cy="12" r="8.5"/><path d="M8 12.4l2.8 2.8L16.4 9"/>',
  '#/w':'<path d="M5 20V11M12 20V4M19 20v-6"/>'};
function renderNav(){
  const h=location.hash,items=[['#/','一覧',h===''||h==='#'||h.startsWith('#/?')||h==='#/'],['#/t','時間割',h.startsWith('#/t')||h.startsWith('#/a')],['#/g','卒業要件',h.startsWith('#/g')],['#/w','科目比較',h.startsWith('#/w')]];
  const n=$('#nav');n.hidden=h.startsWith('#/c/');
  n.innerHTML=items.map(([u,l,on])=>`<a href="${u}"${on?' class="on" aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${NAVI[u]}</svg><span>${l}</span></a>`).join('');
}
/* ---------- A表(基幹教育科目の開講時間割枠) ---------- */
const AK={r:['必修','rq'],m:['専攻教育','mj'],e:['選択・選択必修','el'],x:['原則履修不可','xx']};
function renderA(){
  const v=$('#view'),p=params(),term=termP(p);$('#ctl').hidden=true;
  const cls=p.get('c')||(/^D/.test(CLS||'')?'':CLS)||'';
  const A=AGRID&&AGRID.classes;
  if(!A){v.innerHTML='<h2 class="lh">A表</h2><p class="note">data/agrid.json が読み込めません。</p>';return}
  const opts=CLASSDEF.filter(([g])=>!/2〜4年/.test(g)).map(([gn,a])=>`<optgroup label="${gn}">${a.filter(([x])=>A[x]).map(([x,l])=>`<option value="${x}"${x===cls?' selected':''}>${x}${l?' '+esc(l):''}</option>`).join('')}</optgroup>`).join('');
  let h=`<a class="back" href="#/t?t=${term}">‹ 時間割</a><h2 class="lh" data-e="Table A">A表 <small>基幹教育科目の開講時間割枠(1年生用)</small></h2><div class="row">${['前期','後期'].map(t=>`<button class="chip" data-at="${t}" aria-pressed="${t===term}">${t}</button>`).join('')}<select id="acls" aria-label="クラス" style="flex:1 1 100%"><option value="">クラスを選んでください</option>${opts}</select></div>`;
  if(/^D/.test(CLS||'')&&!p.get('c'))h+='<p class="hint">A表は1年生用の資料です。2年生以上の芸術工学部の授業は、時間割の「この枠で取れる授業」で確認できます。</p>';
  const g=cls&&A[cls]&&A[cls][term];
  if(!g){h+=A&&cls?'<p class="note">このクラスのA表はありません。</p>':'<p class="hint">クラスを選ぶと、そのクラスの枠が表示されます。</p>'}
  else{
    h+=`<div class="tlg">${Object.entries(AK).map(([k,[l,c]])=>`<span><i class="ak ${c}"></i>${l}</span>`).join('')}</div><div class="tt atb"><div class="th"></div>${DAYS.map(d=>`<div class="th">${d}</div>`).join('')}`;
    g.forEach((row,i)=>{
      h+=`<div class="tl"><b>${i+1}</b><small>${TIMES[i+1]}</small></div>`;
      row.forEach((c,di)=>{
        const ks=c.k.length===2&&c.k[0]!==c.k[1]?[c.k[0],c.k[1]]:[c.k[0]];
        const side=ks.length>1?(ks[1]==='x'?' sp-l':ks[0]==='x'?' sp-r':''):'';
        h+=`<a class="acell${ks.length>1?' sp':''}${side}" href="#/t?t=${term}&s=${DAYS[di]}-${i+1}"${ks.length>1?` style="background:linear-gradient(90deg,var(--ak-${ks[0]}) 50%,var(--ak-${ks[1]}) 50%)"`:` style="background:var(--ak-${ks[0]})"`} aria-label="${DAYS[di]}曜${i+1}限 ${esc(ks.map(k=>AK[k][0]).join('・'))}"><span>${esc(c.t)}</span></a>`;
      });
    });
    h+='</div><p class="srcnote">コマをタップすると、時間割でその枠に入れられる授業を見られます。文字は資料の図から機械的に読み取っているため、崩れている場合があります。正式な内容は資料(A表)で確認してください。</p>';
    h+=`<p class="srcnote">${esc(AGRID.source)}</p>`;
  }
  v.innerHTML=h;
}
function rerender(){
  const h=location.hash;
  if(h.startsWith('#/t'))renderTT();else if(h.startsWith('#/a'))renderA();else if(h.startsWith('#/g'))renderGrad();else if(h.startsWith('#/w'))renderCmp();
}
function bumpTT(code){/* 追加・削除のあと、同じ画面を描き直す */rerender()}
$('#view').addEventListener('click',e=>{
  const t=e.target,by=s=>t.closest(s);let b;
  if(b=by('[data-totop]')){document.querySelector('.tt').scrollIntoView({behavior:'smooth',block:'start'});return}
  if(b=by('[data-cell]')){const p=params(),k=b.dataset.cell;p.get('s')===k?p.delete('s'):p.set('s',k);history.replaceState(null,'','#/t?'+p);const y=scrollY,opening=p.get('s')===k;renderTT();scrollTo(0,y);if(opening){const pn=document.querySelector('.panel');if(pn)pn.scrollIntoView({behavior:'smooth',block:'start'})}return}
  if(b=by('[data-at]')){const q=params();q.set('t',b.dataset.at);history.replaceState(null,'','#/a?'+q);renderA();return}
  if(b=by('[data-tt]')){const p=params();p.set('t',b.dataset.tt);p.delete('s');history.replaceState(null,'','#/t?'+p);renderTT();return}
  if(b=by('[data-nolot]')){const p=params();p.get('nolot')?p.delete('nolot'):p.set('nolot','1');history.replaceState(null,'','#/t?'+p);renderTT();return}
  if(b=by('[data-add]')){const y=scrollY;setPlan(b.dataset.add,'plan');renderTT();scrollTo(0,y);return}
  if(b=by('[data-rm]')){const y=scrollY;setPlan(b.dataset.rm,'');bumpTT();scrollTo(0,y);return}
  if(b=by('[data-done]')){const y=scrollY;setPlan(b.dataset.done,'done');bumpTT();scrollTo(0,y);return}
  if(b=by('[data-back]')){const y=scrollY;setPlan(b.dataset.back,'plan');bumpTT();scrollTo(0,y);return}
  if(b=by('[data-set]')){if(b.dataset.set==='plan'&&CLS&&BYC[b.dataset.code]&&elig(BYC[b.dataset.code])==='no'&&!confirm(clsName(CLS)+' では対象外の授業です。それでも履修予定に入れますか?'))return;setPlan(b.dataset.code,b.dataset.set);const c=BYC[b.dataset.code];const box=$('#relbox');if(c&&box)box.outerHTML=planBoxHTML(c);return}
  if(b=by('#pimg')){try{ttImage(termP(params()))}catch(err){console.error(err);alert('画像を作れませんでした')}return}
  if(b=by('#patb')){const at=reqFor();if(at){at.codes.forEach(c=>{if(!PL.p[c])PL.p[c]='plan'});plSave();renderTT()}return}
  if(b=by('#pexp')){const blob=new Blob([JSON.stringify({v:1,cls:CLS,plan:PL},null,1)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='syllabus-plan.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return}
  if(b=by('#pimp')){$('#pfile').click();return}
  if(b=by('#pclr')){if(confirm('履修プランを全部消しますか?(卒業要件の手入力は残ります)')){PL.p={};plSave();renderTT()}return}
  if(b=by('[data-co]')){const p=params();p.set('o',b.dataset.co);history.replaceState(null,'','#/w?'+p);renderCmp();return}
  if(b=by('[data-cplan]')){const code=b.dataset.cplan,c=BYC[code];if(c&&PL.p[code]!=='plan'&&CLS&&elig(c)==='no'&&!confirm(clsName(CLS)+' では対象外の授業です。それでも履修予定に入れますか?'))return;setPlan(code,PL.p[code]==='plan'?'':'plan');const y=scrollY;renderCmp().then(()=>scrollTo(0,y));return}
  if(b=by('[data-cmine]')){const p=params();p.get('mine')==='0'?p.delete('mine'):p.set('mine','0');history.replaceState(null,'','#/w?'+p);renderCmp();return}
  if(b=by('[data-md]')){const n=b.dataset.md,pf=!!b.dataset.pfx,cur=pf?advStatus(n):mdStatus(n),nx=cur===''?'plan':cur==='plan'?'done':'-';PL.md[n]=nx;if(nx==='-'&&!DATA.some(x=>PL.p[x.c]&&(pf?nameKey(x.n).startsWith(nameKey(n)):nameKey(x.n)===nameKey(n))))delete PL.md[n];plSave();const y=scrollY,open=[...document.querySelectorAll('#view details')].map(d=>d.open);renderGrad();document.querySelectorAll('#view details').forEach((d,i)=>d.open=!!open[i]);scrollTo(0,y);return}
  if(b=by('[data-adj]')){const id=b.dataset.adj;PL.adj[id]=Math.max(0,(PL.adj[id]||0)+ +b.dataset.dv);plSave();const y=scrollY,open=[...document.querySelectorAll('#view details')].map(d=>d.open);renderGrad();document.querySelectorAll('#view details').forEach((d,i)=>d.open=!!open[i]);scrollTo(0,y);return}
});
$('#view').addEventListener('change',e=>{
  if(e.target.id==='pfile'){
    const f=e.target.files[0];if(!f)return;
    f.text().then(t=>{
      if(t.length>2e6)throw new Error('大きすぎます');
      const o=JSON.parse(t),pl=o&&o.plan;
      if(!pl||typeof pl.p!=='object'||Array.isArray(pl.p))throw new Error('形式が違います');
      const n=Object.keys(pl.p).length;
      if(!confirm('読み込むと、いまの履修プランを置き換えます(読み込む内容: '+n+'科目)。よろしいですか?'))return;
      PL=plClean(pl);plSave();
      if(okCls(o.cls)){CLS=o.cls;try{localStorage.setItem(CKEY,CLS)}catch(_){}}
      renderTT();
    }).catch(()=>alert('読み込めませんでした。書き出したファイル(JSON)を選んでください。'));
    e.target.value='';return;
  }
  if(e.target.id==='acls'){const q=params();e.target.value?q.set('c',e.target.value):q.delete('c');history.replaceState(null,'','#/a?'+q);renderA();return}
  if(e.target.id==='gcourse'){try{localStorage.setItem(GK,e.target.value)}catch(_){}renderGrad();return}
  if(e.target.id==='tcls'){setClass(e.target.value);renderTT()}
});
function initFeatures(){
  BYC=Object.fromEntries(DATA.map(c=>[c.c,c]));
  buildSeries();
}

Promise.all([fetch('data/index.json',{cache:'no-cache'}).then(r=>r.json()),fetch('data/boilerplate.json').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/btable.json',{cache:'no-cache'}).then(r=>r.ok?r:fetch('btable.json',{cache:'no-cache'})).then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/mdreq.json').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/atable.json').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/coursereq.json').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/agrid.json').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/yomi.json').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/classwari.json').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/kibanreq.json').then(r=>r.ok?r.json():null).catch(()=>null)]).then(([j,b,bt,md,at,cr,ag,yo,el,kr])=>{DATA=j;KREQ=kr;YOMI=yo||{};CWARI=(el&&el.classes)||{};MDREQ=md;ATABLE=at;COURSEREQ=cr;AGRID=ag;if(bt&&bt.rows){BT=bt.rows;BTV=bt.versions||{};DATA.forEach(c=>{c.b=BT[c.c]})}if(b){(b.labels||[]).forEach(l=>BOIL.labels.add(l));(b.pairs||[]).forEach(([k,x])=>BOIL.pairs.add(k+'\u0000'+x))}initFeatures();route();countUp();meLabel();if(!PROF)obOpen(false)}).catch(err=>{console.error(err);$('#view').innerHTML='<p class="note">data/index.json を読み込めません。scrape.py を実行するか、ローカルサーバー経由で開いてください。</p>'});
