/* 姓名推算引擎 · 断名 / 取名
 *
 * 理论定位：以八字喜用定五行方向为主，音、形、义为辅；
 *           五格三才只列数不计分，并标注各家有异。
 * 依赖：window.NAMING_DATA（由 data/naming/scripts/build.mjs 生成）
 */
(function (global) {
  'use strict';

  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const WX5 = ['木', '火', '土', '金', '水'];
  const invSheng = (w) => WX5.find(k => SHENG[k] === w);
  const invKe = (w) => WX5.find(k => KE[k] === w);

  /* ---------- 字库装载（首次调用时解析，之后复用） ---------- */
  let DB = null;
  function db() {
    if (DB) return DB;
    const raw = global.NAMING_DATA;
    if (!raw || !raw.chars) throw new Error('姓名字库未加载');
    const map = new Map();
    const byWx = { 木: [], 火: [], 土: [], 金: [], 水: [] };
    raw.chars.split('\n').forEach(line => {
      const f = line.split('\t');
      if (f.length < 13) return;
      const flags = +f[12];
      const rec = {
        ch: f[0], stroke: +f[1], kangxi: +f[2], pinyin: f[3], tone: +f[4],
        poly: +f[5] === 1, radical: f[6], structIdx: +f[7],
        struct: (raw.enums.struct[+f[7]] || '其他'),
        wx: f[8], wxBasis: +f[9], tier: +f[10], gender: +f[11], flags,
        avoid: !!(flags & 1), homo: !!(flags & 2), common: !!(flags & 4), rare: !!(flags & 8)
      };
      rec.meaning = (raw.meaning && raw.meaning[rec.ch]) || '';
      rec.homoNote = (raw.homophone && raw.homophone[rec.ch]) || '';
      map.set(rec.ch, rec);
      if (rec.common && !rec.avoid && byWx[rec.wx]) byWx[rec.wx].push(rec);
    });
    WX5.forEach(w => byWx[w].sort((a, b) => a.tier - b.tier || a.stroke - b.stroke));
    DB = { raw, map, byWx };
    return DB;
  }
  function charOf(ch) { try { return db().map.get(ch) || null; } catch (e) { return null; } }

  const WX_BASIS_LABEL = ['义类（典籍）', '人工校订', '笔画数理（近代通行·各家有异）'];

  /* ---------- 拼音声母 / 韵母 ---------- */
  const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
  function splitPy(py) {
    py = (py || '').toLowerCase();
    for (const i of INITIALS) if (py.startsWith(i)) return { i, f: py.slice(i.length) };
    return { i: '', f: py };
  }

  /* ---------- 八字喜用 → 取名目标五行 ---------- */
  function namingTargets(chart) {
    const stat = (chart && chart.stat) || {};
    let xi = (chart && chart.xiyong) || [];
    if (!xi.length && chart && chart.dayGan) {
      const dw = ({ 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' })[chart.dayGan];
      xi = chart.strong ? [invKe(dw), SHENG[dw], KE[dw]] : [invSheng(dw), dw];
      xi = [...new Set(xi)].filter(Boolean);
    }
    /* 喜用之中，原局越薄的越该补 */
    const ranked = xi.slice().sort((a, b) => (stat[a] || 0) - (stat[b] || 0));
    const ji = WX5.filter(w => !xi.includes(w));
    /* 忌神里原局最旺者为最忌，取名须回避 */
    const worst = ji.slice().sort((a, b) => (stat[b] || 0) - (stat[a] || 0))[0] || null;
    return {
      xi: ranked, ji, worst,
      primary: ranked[0] || null,
      secondary: ranked[1] || ranked[0] || null,
      stat,
      strong: !!(chart && chart.strong),
      level: (chart && chart.strength && chart.strength.level) || '',
      dayGan: (chart && chart.dayGan) || '',
      note: (chart && chart.strong)
        ? '日主偏旺，宜克泄耗：取官杀、食伤、财之五行为用'
        : '日主偏弱，宜生扶：取印、比劫之五行为用'
    };
  }

  /* ---------- 五格三才（仅列，不计分） ---------- */
  const LUCKY81 = new Set([1, 3, 5, 6, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 29, 31, 32, 33, 35, 37, 38, 39, 41, 45, 47, 48, 52, 57, 58, 61, 63, 65, 67, 68, 73, 75, 77, 78, 80, 81]);
  function num81(n) { const v = ((n - 1) % 81) + 1; return { n: v, luck: LUCKY81.has(v) ? '吉' : '凶' }; }
  function strokeWx(n) { const d = n % 10; return d === 1 || d === 2 ? '木' : d === 3 || d === 4 ? '火' : d === 5 || d === 6 ? '土' : d === 7 || d === 8 ? '金' : '水'; }
  function wuge(sRecs, gRecs) {
    const sk = sRecs.map(r => r.kangxi), gk = gRecs.map(r => r.kangxi);
    const sSum = sk.reduce((a, b) => a + b, 0), gSum = gk.reduce((a, b) => a + b, 0);
    const tian = sk.length === 1 ? sSum + 1 : sSum;
    const ren = sk[sk.length - 1] + (gk[0] || 0);
    const di = gk.length === 1 ? gSum + 1 : gSum;
    const zong = sSum + gSum;
    let wai = zong - ren + 1;
    if (sk.length === 1 && gk.length === 1) wai = 2;
    const sancai = [strokeWx(tian), strokeWx(ren), strokeWx(di)];
    const rel = (a, b) => SHENG[a] === b ? '生' : SHENG[b] === a ? '被生' : KE[a] === b ? '克' : KE[b] === a ? '被克' : '同';
    return {
      tian: num81(tian), ren: num81(ren), di: num81(di), wai: num81(wai), zong: num81(zong),
      sancai: sancai.join(''),
      sancaiRel: rel(sancai[0], sancai[1]) + '·' + rel(sancai[1], sancai[2]),
      disputed: true,
      note: '五格三才为近代（熊崎健翁一系）算法，笔画取繁体字形近似康熙笔画，各家算法与吉凶归类互有出入。本报告只列数不计分，仅供参考。'
    };
  }

  /* ---------- 各维度评分 ---------- */
  const POS_W = { 1: [1], 2: [0.6, 0.4], 3: [0.45, 0.35, 0.2] };

  function dimXiyong(gRecs, t) {
    const w = POS_W[gRecs.length] || POS_W[2];
    const notes = [];
    let acc = 0;
    gRecs.forEach((r, i) => {
      const pw = w[i] != null ? w[i] : 0;
      let v, why;
      if (r.wx === t.primary) { v = 1.0; why = '正补首要喜用' + r.wx; }
      else if (t.xi.includes(r.wx)) { v = 0.8; why = '合喜用' + r.wx; }
      else if (r.wx === t.worst) { v = 0.05; why = '落原局最旺忌神' + r.wx + '，添旺其所忌'; }
      else if (t.xi.includes(SHENG[r.wx])) { v = 0.45; why = r.wx + '能生喜用' + SHENG[r.wx] + '，间接可用'; }
      else { v = 0.18; why = '属忌神' + r.wx; }
      acc += pw * v;
      notes.push(r.ch + '（' + r.wx + '·' + WX_BASIS_LABEL[r.wxBasis] + '）' + why);
    });
    return { raw: acc, notes };
  }

  function dimFlow(sRecs, gRecs) {
    const chain = sRecs.concat(gRecs);
    if (chain.length < 2) return { raw: 0.75, notes: ['单字无从论流通'] };
    const notes = [];
    let acc = 0, n = 0;
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i].wx, b = chain[i + 1].wx;
      let v, txt;
      if (SHENG[a] === b) { v = 1.0; txt = a + '生' + b + '，顺行相生'; }
      else if (a === b) { v = 0.75; txt = a + '与' + b + '比和，同气相助'; }
      else if (SHENG[b] === a) { v = 0.6; txt = b + '生' + a + '，逆生，名反哺姓'; }
      else if (KE[a] === b) { v = 0.3; txt = a + '克' + b + '，前克后，气滞'; }
      else { v = 0.35; txt = b + '克' + a + '，后克前，犯上'; }
      acc += v; n++;
      notes.push(chain[i].ch + '→' + chain[i + 1].ch + '：' + txt);
    }
    return { raw: acc / n, notes };
  }

  function dimSound(sRecs, gRecs) {
    const all = sRecs.concat(gRecs);
    const tones = all.map(r => r.tone), pys = all.map(r => splitPy(r.pinyin));
    const notes = [];
    let v = 0.65;
    const uniqTone = new Set(tones).size;
    if (uniqTone === 1) { v -= 0.3; notes.push('三字同一声调，读来平直无起伏'); }
    else if (uniqTone === all.length) { v += 0.3; notes.push('声调各异，抑扬有致'); }
    else { v += 0.15; notes.push('声调有别，尚成起伏'); }
    if (tones.every(t => t === 3)) { v -= 0.25; notes.push('通篇上声，连读拗口'); }
    const inits = pys.map(p => p.i);
    if (new Set(inits).size === 1 && inits[0]) { v -= 0.3; notes.push('三字声母全同，绕口'); }
    else {
      for (let i = 0; i < inits.length - 1; i++) {
        if (inits[i] && inits[i] === inits[i + 1]) { v -= 0.15; notes.push(all[i].ch + all[i + 1].ch + '声母相同，稍显黏连'); break; }
      }
    }
    for (let i = 0; i < pys.length - 1; i++) {
      if (pys[i].f && pys[i].f === pys[i + 1].f) { v -= 0.18; notes.push(all[i].ch + all[i + 1].ch + '韵母相同，叠韵'); break; }
    }
    const polys = gRecs.filter(r => r.poly);
    if (polys.length) { v -= 0.1 * polys.length; notes.push('多音字：' + polys.map(r => r.ch).join('、') + '，易被读错'); }
    return { raw: Math.max(0, Math.min(1, v)), notes };
  }

  function dimForm(sRecs, gRecs) {
    const all = sRecs.concat(gRecs);
    const notes = [];
    let v = 0.7;
    const st = all.map(r => r.stroke);
    const diff = Math.max(...st) - Math.min(...st);
    if (diff <= 8) { v += 0.25; notes.push('笔画相当（' + st.join('·') + '），字形匀称'); }
    else if (diff <= 14) { v += 0.05; notes.push('笔画略悬殊（' + st.join('·') + '）'); }
    else { v -= 0.2; notes.push('笔画轻重悬殊（' + st.join('·') + '），书写失衡'); }
    if (gRecs.length >= 2 && gRecs[0].struct === gRecs[1].struct) {
      v -= 0.18; notes.push('名二字同为' + gRecs[0].struct + '，字形重复');
      if (sRecs[sRecs.length - 1].struct === gRecs[0].struct) { v -= 0.12; notes.push('连姓三字同结构，尤显板滞'); }
    } else if (gRecs.length >= 2) {
      v += 0.1; notes.push('名二字结构相异（' + gRecs.map(r => r.struct).join('、') + '），错落有致');
    }
    const rares = gRecs.filter(r => r.rare);
    if (rares.length) { v -= 0.3 * rares.length; notes.push('生僻字：' + rares.map(r => r.ch).join('、') + '，录入与认读都费事'); }
    const heavy = gRecs.filter(r => r.stroke > 16);
    if (heavy.length) { v -= 0.12 * heavy.length; notes.push('笔画过繁：' + heavy.map(r => r.ch + r.stroke + '画').join('、')); }
    return { raw: Math.max(0, Math.min(1, v)), notes };
  }

  function dimMeaning(sRecs, gRecs, gender) {
    const notes = [];
    let v = 0.68;
    const bad = gRecs.filter(r => r.avoid);
    if (bad.length) {
      notes.push('不宜字：' + bad.map(r => r.ch).join('、') + '，义涉衰病凶厄，取名当避');
      return { raw: 0, notes, hard: true };
    }
    const homo = sRecs.concat(gRecs).filter(r => r.homo);
    if (homo.length) { v -= 0.35; notes.push('谐音需留意：' + homo.map(r => r.ch + '（' + r.homoNote + '）').join('、')); }
    const withMeaning = gRecs.filter(r => r.meaning);
    withMeaning.forEach(r => notes.push(r.ch + '：' + r.meaning));
    v += Math.min(0.2, 0.1 * withMeaning.length);
    if (gender) {
      const want = gender === '男' ? 1 : 2, other = gender === '男' ? 2 : 1;
      const mis = gRecs.filter(r => r.gender === other);
      const fit = gRecs.filter(r => r.gender === want);
      if (mis.length) { v -= 0.25 * mis.length; notes.push('用字偏' + (other === 1 ? '男' : '女') + '：' + mis.map(r => r.ch).join('、') + '，与' + gender + '命不侔'); }
      if (fit.length) { v += 0.08 * fit.length; notes.push('用字合' + gender + '命气质'); }
    }
    const allCommon = gRecs.every(r => r.tier === 1);
    if (allCommon) { v += 0.06; notes.push('全为常用字，通行无碍'); }
    return { raw: Math.max(0, Math.min(1, v)), notes };
  }

  const DIMS = [
    { key: 'xiyong', label: '八字喜用', weight: 40, cite: '〔穷通宝鉴·月令调候〕〔滴天髓·衰旺〕' },
    { key: 'flow', label: '五行流通', weight: 15, cite: '《五行大义·卷一·论相生》' },
    { key: 'sound', label: '音律', weight: 15, cite: '《五行大义·卷三·论配声音》' },
    { key: 'form', label: '字形', weight: 15, cite: '〔字形匀称·书写通行〕' },
    { key: 'meaning', label: '字义', weight: 15, cite: '《五行大义·卷五·论人配五行》' }
  ];

  function gradeOf(total) {
    if (total >= 88) return '上吉';
    if (total >= 78) return '吉';
    if (total >= 68) return '中上';
    if (total >= 58) return '中平';
    return '待改';
  }

  /* ---------- 断名 ---------- */
  function namingAnalyze(surname, given, chart, opts) {
    opts = opts || {};
    surname = String(surname || '').replace(/\s/g, '');
    given = String(given || '').replace(/\s/g, '');
    if (!surname) throw new Error('请填姓');
    if (!given) throw new Error('请填名');

    const missing = [];
    const toRecs = (s) => [...s].map(ch => {
      const r = charOf(ch);
      if (!r) { missing.push(ch); return null; }
      return r;
    }).filter(Boolean);

    const sRecs = toRecs(surname), gRecs = toRecs(given);
    if (missing.length) throw new Error('字库未收：' + missing.join('、') + '（多为异体或生僻字，可换用通行字形）');

    const t = namingTargets(chart);
    const gender = opts.gender || (chart && chart.gender) || (chart && chart._gender) || '';

    const results = {
      xiyong: dimXiyong(gRecs, t),
      flow: dimFlow(sRecs, gRecs),
      sound: dimSound(sRecs, gRecs),
      form: dimForm(sRecs, gRecs),
      meaning: dimMeaning(sRecs, gRecs, gender)
    };

    let total = 0;
    const dims = DIMS.map(d => {
      const r = results[d.key];
      const score = Math.round(d.weight * r.raw * 10) / 10;
      total += score;
      return { key: d.key, label: d.label, weight: d.weight, score, pct: Math.round(r.raw * 100), notes: r.notes, cite: d.cite };
    });
    total = Math.round(total * 10) / 10;

    const warnings = [];
    if (results.meaning.hard) warnings.push('名中含不宜字，其余各项再好也建议更换。');
    if (gRecs.some(r => r.wx === t.worst)) warnings.push('名中五行落在原局最旺的忌神上，等于给本来就过的一头再加码。');
    if (gRecs.every(r => !t.xi.includes(r.wx))) warnings.push('名中无一字落在喜用五行，八字这一层没有补到。');
    const disputed = gRecs.filter(r => r.wxBasis === 2);
    if (disputed.length) warnings.push('「' + disputed.map(r => r.ch).join('、') + '」的五行依笔画数理推定，典籍无明文，各家有异，此判较软。');

    const highlights = [];
    if (results.xiyong.raw >= 0.8) highlights.push('用字五行正对八字所喜，是这个名字最站得住的一处。');
    if (results.flow.raw >= 0.9) highlights.push('姓名三字五行顺次相生，气脉不滞。');
    if (results.sound.raw >= 0.85) highlights.push('声调错落，念着上口。');

    return {
      surname, given, full: surname + given,
      chars: sRecs.map(r => Object.assign({ role: '姓' }, r))
        .concat(gRecs.map((r, i) => Object.assign({ role: gRecs.length > 1 ? '名' + (i + 1) : '名' }, r))),
      targets: t, gender,
      dims, total, grade: gradeOf(total),
      wuge: wuge(sRecs, gRecs),
      warnings, highlights
    };
  }

  /* ---------- 取名 ---------- */
  function pickPool(wx, gender, opts) {
    const pool = (db().byWx[wx] || []).filter(r => {
      if (r.avoid || r.homo) return false;
      if (r.rare) return false;
      if (r.tier > 2) return false;
      if (r.stroke > 18) return false;
      if (opts.excludeSet && opts.excludeSet.has(r.ch)) return false;
      if (gender) { const other = gender === '男' ? 2 : 1; if (r.gender === other) return false; }
      return true;
    });
    /* 有字义注解者优先，其次常用度、笔画适中 */
    return pool
      .sort((a, b) => (b.meaning ? 1 : 0) - (a.meaning ? 1 : 0) || a.tier - b.tier || Math.abs(a.stroke - 10) - Math.abs(b.stroke - 10))
      .slice(0, opts.poolSize || 48);
  }

  function namingSuggest(surname, chart, opts) {
    opts = opts || {};
    surname = String(surname || '').replace(/\s/g, '');
    if (!surname) throw new Error('请填姓');
    if (![...surname].every(ch => charOf(ch))) throw new Error('字库未收此姓，请换用通行字形');

    const t = namingTargets(chart);
    if (!t.primary) throw new Error('未能定出喜用五行，请先完成排盘');
    const gender = opts.gender || (chart && chart.gender) || (chart && chart._gender) || '';
    const len = opts.length === 1 ? 1 : 2;
    const count = opts.count || 12;
    const excludeSet = new Set([...(opts.exclude || ''), ...surname]);
    /* 喜用有三种时收窄每池取字数，控制组合总量 */
    const wxList = [...new Set(t.xi)];
    const po = { poolSize: opts.poolSize || (wxList.length >= 3 ? 32 : 48), excludeSet };

    /* 全部喜用都要参与选字，不可只取首要与次选，否则第三个喜用永远落空、候选池塌缩 */
    const pools = wxList.map(w => ({ wx: w, list: pickPool(w, gender, po) })).filter(p => p.list.length);
    if (!pools.length) throw new Error('喜用' + t.xi.join('、') + '在常用字池中无合适候选，可放宽性别或回避用字');

    const seen = new Set(), out = [];
    const tryName = (given) => {
      if (seen.has(given)) return;
      seen.add(given);
      try {
        const r = namingAnalyze(surname, given, chart, { gender });
        if (r.total >= (opts.minScore || 0)) out.push(r);
      } catch (e) { /* 跳过无法评分的组合 */ }
    };

    if (len === 1) {
      pools.forEach(p => p.list.forEach(a => tryName(a.ch)));
    } else {
      /* 喜用两两配对，正反序皆试，由评分决定高下 */
      pools.forEach(A => pools.forEach(B => {
        A.list.forEach(a => B.list.forEach(b => { if (a.ch !== b.ch) tryName(a.ch + b.ch); }));
      }));
    }

    /* 同分时，有典籍字义注解者优先，其次常用度高者 */
    const annotated = (r) => r.chars.filter(c => c.role !== '姓' && c.meaning).length;
    const tierSum = (r) => r.chars.filter(c => c.role !== '姓').reduce((a, c) => a + c.tier, 0);
    out.sort((a, b) => b.total - a.total || annotated(b) - annotated(a) || tierSum(a) - tierSum(b) || a.given.localeCompare(b.given));

    /* 榜单去同质化：限同一首字、限单字全表复用次数、限同一五行组合占比，
       否则同分并列会让十几条推荐挤在十来个字里反复排列。 */
    const wxKey = (r) => r.chars.filter(c => c.role !== '姓').map(c => c.wx).join('');
    const headCap = 2, charCap = 2;
    const comboCap = Math.max(2, Math.ceil(count * 0.4));
    const headCount = new Map(), charCount = new Map(), comboCount = new Map();
    const mirrorSeen = new Set();
    const picked = [], spill = [];
    const charsOf = (r) => [...r.given];
    /* 同两字的正反序只留高分那一个：「立珊 / 珊立」并列纯属凑数 */
    const mirrorKey = (r) => charsOf(r).slice().sort().join('');
    const takeable = (r, relax) => {
      if (mirrorSeen.has(mirrorKey(r))) return false;
      if (!relax && (headCount.get(r.given[0]) || 0) >= headCap) return false;
      if (!relax && (comboCount.get(wxKey(r)) || 0) >= comboCap) return false;
      return charsOf(r).every(c => (charCount.get(c) || 0) < charCap + (relax ? 1 : 0));
    };
    const take = (r) => {
      mirrorSeen.add(mirrorKey(r));
      headCount.set(r.given[0], (headCount.get(r.given[0]) || 0) + 1);
      comboCount.set(wxKey(r), (comboCount.get(wxKey(r)) || 0) + 1);
      charsOf(r).forEach(c => charCount.set(c, (charCount.get(c) || 0) + 1));
      picked.push(r);
    };
    for (const r of out) {
      if (picked.length >= count) break;
      if (takeable(r, false)) take(r); else spill.push(r);
    }
    /* 严格额度下凑不满时，放宽一档再补 */
    for (const r of spill) {
      if (picked.length >= count) break;
      if (takeable(r, true)) take(r);
    }
    picked.sort((a, b) => b.total - a.total || annotated(b) - annotated(a) || a.given.localeCompare(b.given));

    return {
      surname, gender, length: len, targets: t,
      scanned: out.length,
      list: picked.map(r => ({
        full: r.full, given: r.given, total: r.total, grade: r.grade,
        wx: r.chars.filter(c => c.role !== '姓').map(c => c.wx).join('·'),
        pinyin: r.chars.map(c => c.pinyin).join(' '),
        dims: r.dims, chars: r.chars, wuge: r.wuge,
        reason: buildReason(r), warnings: r.warnings
      })),
      basis: '先以八字定喜用（' + t.xi.join('、') + '），再于常用字中择五行相符者，逐一按音、形、义评分排序。'
    };
  }

  function buildReason(r) {
    const g = r.chars.filter(c => c.role !== '姓');
    const parts = [];
    parts.push(g.map(c => c.ch + '属' + c.wx).join('、') + '，' + (r.targets.primary ? '正应喜用' + r.targets.primary : ''));
    const m = g.filter(c => c.meaning);
    if (m.length) parts.push(m.map(c => c.ch + '取「' + c.meaning + '」').join('；'));
    const flow = r.dims.find(d => d.key === 'flow');
    if (flow && flow.pct >= 90) parts.push('三字五行顺次相生');
    const sound = r.dims.find(d => d.key === 'sound');
    if (sound && sound.pct >= 85) parts.push('声调错落上口');
    return parts.filter(Boolean).join('。') + '。';
  }

  /* ---------- 供「问先生」带走的文本 ---------- */
  function namingAskText(res, mode) {
    if (!res) return '';
    let t = '【姓名信息】\n';
    if (mode === 'suggest') {
      t += '姓：' + res.surname + (res.gender ? '　性别：' + res.gender : '') + '\n';
      t += '八字喜用：' + res.targets.xi.join('、') + '（' + res.targets.note + '）\n';
      if (res.targets.worst) t += '最忌：' + res.targets.worst + '\n';
      t += '候选（按评分）：\n';
      res.list.slice(0, 10).forEach((x, i) => {
        t += (i + 1) + '. ' + x.full + '（' + x.wx + '　' + x.total + '分·' + x.grade + '）' + x.reason + '\n';
      });
    } else {
      t += '姓名：' + res.full + (res.gender ? '　性别：' + res.gender : '') + '\n';
      t += '用字：' + res.chars.map(c => c.ch + '（' + c.wx + '·' + c.stroke + '画·' + c.pinyin + '）').join('　') + '\n';
      t += '八字喜用：' + res.targets.xi.join('、') + '（' + res.targets.note + '）\n';
      if (res.targets.worst) t += '最忌：' + res.targets.worst + '\n';
      t += '评分：' + res.total + ' 分（' + res.grade + '）　';
      t += res.dims.map(d => d.label + ' ' + d.score + '/' + d.weight).join('　') + '\n';
      t += '五格（仅参考·各家有异）：天' + res.wuge.tian.n + ' 人' + res.wuge.ren.n + ' 地' + res.wuge.di.n + ' 外' + res.wuge.wai.n + ' 总' + res.wuge.zong.n + '　三才' + res.wuge.sancai + '\n';
      if (res.warnings.length) t += '需留意：' + res.warnings.join(' ') + '\n';
    }
    return t;
  }

  global.NamingEngine = {
    namingAnalyze, namingSuggest, namingTargets, namingAskText,
    charOf, wuge, gradeOf,
    stats() { const d = db(); return { chars: d.map.size, pools: WX5.reduce((o, w) => (o[w] = d.byWx[w].length, o), {}) }; },
    ready() { try { return !!db(); } catch (e) { return false; } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
