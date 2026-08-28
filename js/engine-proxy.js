(function (global) {
  'use strict';

  const STEMS = '甲乙丙丁戊己庚辛壬癸';
  const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const GAN_YANG = { 甲: 1, 乙: 0, 丙: 1, 丁: 0, 戊: 1, 己: 0, 庚: 1, 辛: 0, 壬: 1, 癸: 0 };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  function shishen(dayGan, gan) {
    const dw = GAN_WX[dayGan], gw = GAN_WX[gan], same = GAN_YANG[dayGan] === GAN_YANG[gan];
    if (!dw || !gw) return '—';
    if (gw === dw) return same ? '比肩' : '劫财';
    if (SHENG[dw] === gw) return same ? '食神' : '伤官';
    if (KE[dw] === gw) return same ? '偏财' : '正财';
    if (KE[gw] === dw) return same ? '七杀' : '正官';
    if (SHENG[gw] === dw) return same ? '偏印' : '正印';
    return '—';
  }

  function hourBranchIdx(h) { return ((Math.floor((h + 1) / 2) % 12) + 12) % 12; }
  function hourGZ(dayStem, h) {
    const start = { 甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4, 辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8 };
    const hb = hourBranchIdx(h);
    return STEMS[(start[dayStem] + hb) % 10] + BRANCHES[hb];
  }

  const mod = (n, m) => ((n % m) + m) % m;
  const JIE_CHRONO_IDX = [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const JIE_CHRONO_ZHI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];
  function jieRow(y) {
    const t = global.JIE_TABLE || global.window?.JIE_TABLE;
    return t && t[String(y)];
  }
  function jieOf(y, idx) {
    const r = jieRow(y);
    if (!r) return null;
    const [jm, jd, jt] = r[idx];
    return { m: jm, d: jd, t: jt };
  }
  function cmpDT(y, m, d, h, min, jie) {
    h = h ?? 12; min = min ?? 0;
    const bt = h * 60 + min;
    if (m !== jie.m) return m < jie.m ? -1 : 1;
    if (d !== jie.d) return d < jie.d ? -1 : 1;
    return bt < jie.t ? -1 : (bt > jie.t ? 1 : 0);
  }
  function monthBranchIdxAccurate(y, m, d, h, min) {
    const bounds = [];
    [y - 1, y].forEach(yr => {
      JIE_CHRONO_IDX.forEach((ji, k) => {
        const j = jieOf(yr, ji);
        if (j) bounds.push({ ...j, zhi: JIE_CHRONO_ZHI[k], ord: yr * 10000 + j.m * 100 + j.d });
      });
    });
    bounds.sort((a, b) => a.ord - b.ord || a.t - b.t);
    let zhi = 0;
    bounds.forEach(b => { if (cmpDT(y, m, d, h, min, b) >= 0) zhi = b.zhi; });
    return zhi;
  }
  function dayDiff(y, m, d) {
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2000, 0, 1)) / 86400000);
  }
  function dayGZ(y, m, d) {
    const i = 54 + dayDiff(y, m, d);
    return STEMS[mod(i, 10)] + BRANCHES[mod(i, 12)];
  }
  function yearGZraw(y) {
    const i = mod(y - 4, 60);
    return STEMS[i % 10] + BRANCHES[i % 12];
  }
  function yearGZ(y, m, d, h, min) {
    h = h ?? 12; min = min ?? 0;
    const lc = jieOf(y, 0);
    const before = lc && cmpDT(y, m, d, h, min, lc) < 0;
    return yearGZraw(before ? y - 1 : y);
  }
  function monthGZ(y, m, d, h, min) {
    h = h ?? 12; min = min ?? 0;
    const zi = monthBranchIdxAccurate(y, m, d, h, min);
    const ystem = yearGZ(y, m, d, h, min)[0];
    const yinStart = { 甲: 2, 己: 2, 乙: 4, 庚: 4, 丙: 6, 辛: 6, 丁: 8, 壬: 8, 戊: 0, 癸: 0 }[ystem];
    return STEMS[mod(yinStart + mod(zi - 2, 12), 10)] + BRANCHES[zi];
  }

  /** 紫微大限/流年四化（本地计算，无需 API 往返） */
  const ZW_SIHUA = {
    甲: { 禄: '廉贞', 权: '破军', 科: '武曲', 忌: '太阳' },
    乙: { 禄: '天机', 权: '天梁', 科: '紫微', 忌: '太阴' },
    丙: { 禄: '天同', 权: '天机', 科: '文昌', 忌: '廉贞' },
    丁: { 禄: '太阴', 权: '天同', 科: '天机', 忌: '巨门' },
    戊: { 禄: '贪狼', 权: '太阴', 科: '右弼', 忌: '天机' },
    己: { 禄: '武曲', 权: '贪狼', 科: '天梁', 忌: '文曲' },
    庚: { 禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同' },
    辛: { 禄: '巨门', 权: '太阳', 科: '文曲', 忌: '文昌' },
    壬: { 禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲' },
    癸: { 禄: '破军', 权: '巨门', 科: '太阴', 忌: '贪狼' },
  };
  function ziweiLuckSihua(chart, stem) {
    const hua = ZW_SIHUA[stem];
    if (!hua || !chart || !chart.palaces) return Promise.resolve(null);
    const hits = [];
    chart.palaces.forEach((p, i) => {
      (p.stars || []).forEach(s => {
        const name = s.name || s;
        for (const k of ['禄', '权', '科', '忌']) {
          if (hua[k] === name) hits.push({ pidx: i, gong: p.gong, star: name, type: k });
        }
      });
    });
    return Promise.resolve({ gan: stem, hua, hits });
  }

  /** 六爻 / 梅花：本地计算（primer-data.js 已含完整 liuyao 数据） */
  function nowDT() {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate(), h: n.getHours() };
  }
  function lyData() {
    const ly = global.PRIMER_DATA?.liuyao;
    if (!ly?.xiantian_num || !ly.trigrams || !ly.gua64) {
      throw new Error('六爻数据未加载，请刷新页面');
    }
    return ly;
  }
  function wuxingRel(ti, yong) {
    const sheng = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
    const ke = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    if (ti === yong) return { rel: '比和', desc: '体用比和，比助，吉。' };
    if (sheng[yong] === ti) return { rel: '用生体', desc: '用生体，得生气，吉。' };
    if (sheng[ti] === yong) return { rel: '体生用', desc: '体生用，泄气耗力，小凶。' };
    if (ke[yong] === ti) return { rel: '用克体', desc: '用克体，受制，凶。' };
    if (ke[ti] === yong) return { rel: '体克用', desc: '体克用，可制，吉中带劳。' };
    return { rel: '—', desc: '' };
  }
  function guaName(upper, lower, ly) {
    ly = ly || lyData();
    const key = ly.trigrams[lower].bits + ly.trigrams[upper].bits;
    return ly.gua64[key].name;
  }
  function buildChartLocal(yaoBits, moving, dt) {
    const ly = lyData();
    const key = yaoBits.join('');
    const ben = ly.gua64[key];
    const dg = dayGZ(dt.y, dt.m, dt.d);
    const lsStart = ly.liushen_start[dg[0]];
    function najiaOf(gua, i) {
      const lo = ly.trigrams[gua.lower], up = ly.trigrams[gua.upper];
      return i < 3 ? lo.najia_in[i] : up.najia_out[i - 3];
    }
    function rowsOf(gua, mv) {
      const out = [];
      for (let i = 0; i < 6; i++) {
        const nj = najiaOf(gua, i);
        const wx = ly.zhi_wx[nj[1]];
        out.push({
          yao: i + 1, yin: yaoBits[i] === 0, bit: yaoBits[i],
          najia: nj, wuxing: wx,
          liuqin: ly.liuqin[ben.gong_wx][wx],
          liushen: ly.liushen[mod(lsStart + i, 6)],
          moving: !!mv[i], shi: (i + 1) === ben.shi, ying: (i + 1) === ben.ying,
        });
      }
      return out;
    }
    const res = {
      benName: ben.name, gong: ben.gong, gongWx: ben.gong_wx,
      shi: ben.shi, ying: ben.ying, rows: rowsOf(ben, moving),
      gz: {
        year: yearGZ(dt.y, dt.m, dt.d), month: monthGZ(dt.y, dt.m, dt.d),
        day: dg, hour: hourGZ(dg[0], dt.h ?? 0),
      },
    };
    if (moving.some(Boolean)) {
      const bb = yaoBits.map((b, i) => (moving[i] ? 1 - b : b));
      const bian = ly.gua64[bb.join('')];
      const brows = [];
      for (let i = 0; i < 6; i++) {
        const lo = ly.trigrams[bian.lower], up = ly.trigrams[bian.upper];
        const nj = i < 3 ? lo.najia_in[i] : up.najia_out[i - 3];
        const wx = ly.zhi_wx[nj[1]];
        brows.push({ yao: i + 1, yin: bb[i] === 0, najia: nj, wuxing: wx, liuqin: ly.liuqin[ben.gong_wx][wx] });
      }
      res.bianName = bian.name; res.bianGong = bian.gong; res.bianRows = brows;
    }
    return res;
  }
  function castByNumbersLocal(n1, n2, n3, dt) {
    const ly = lyData();
    const upper = ly.xiantian_num[mod(n1, 8)], lower = ly.xiantian_num[mod(n2, 8)];
    const dong = mod(n3, 6) || 6;
    const bits = (ly.trigrams[lower].bits + ly.trigrams[upper].bits).split('').map(Number);
    const moving = [0, 0, 0, 0, 0, 0]; moving[dong - 1] = 1;
    return buildChartLocal(bits, moving, dt || nowDT());
  }
  function castCoinsLocal(dt, rng) {
    rng = rng || Math.random;
    const bits = [], moving = [];
    for (let i = 0; i < 6; i++) {
      let yang = 0; for (let c = 0; c < 3; c++) yang += rng() < 0.5 ? 0 : 1;
      bits.push(yang >= 2 ? 1 : 0); moving.push(yang === 0 || yang === 3 ? 1 : 0);
    }
    return buildChartLocal(bits, moving, dt || nowDT());
  }
  function meihuaLocal(n1, n2, dt, dongOverride) {
    const ly = lyData();
    const upperName = ly.xiantian_num[mod(n1, 8)], lowerName = ly.xiantian_num[mod(n2, 8)];
    const dong = dongOverride != null ? dongOverride : (mod(n1 + n2, 6) || 6);
    const bits = (ly.trigrams[lowerName].bits + ly.trigrams[upperName].bits).split('').map(Number);
    const dongLower = dong <= 3;
    const yong = dongLower ? lowerName : upperName;
    const ti = dongLower ? upperName : lowerName;
    const tiWx = ly.trigrams[ti].wx, yongWx = ly.trigrams[yong].wx;
    const rel = wuxingRel(tiWx, yongWx);
    const huLowerBits = [bits[1], bits[2], bits[3]].join('');
    const huUpperBits = [bits[2], bits[3], bits[4]].join('');
    const huName = guaName(ly.bits2tri[huUpperBits], ly.bits2tri[huLowerBits], ly);
    const bb = bits.slice(); bb[dong - 1] = 1 - bb[dong - 1];
    const benName = guaName(upperName, lowerName, ly);
    const bianName = guaName(ly.bits2tri[bb.slice(3).join('')], ly.bits2tri[bb.slice(0, 3).join('')], ly);
    return {
      benName, huName, bianName, dong,
      upper: upperName, lower: lowerName,
      ti, yong, tiWx, yongWx, rel,
    };
  }

  async function api(path, body, method) {
    const base = global.MINGLI_CONFIG?.API_BASE;
    const token = global.MingliAuth?.getToken?.() || '';
    if (!base) throw new Error('未配置 API 地址（config.js）');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 45000) : null;
    let res;
    try {
      res = await fetch(base + path, {
        method: method || (body ? 'POST' : 'GET'),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (err) {
      if (err && err.name === 'AbortError') throw new Error('API 请求超时（45s），请检查 Railway 是否在线');
      throw new Error('无法连接 API：' + (err.message || '网络错误'));
    } finally {
      if (timer) clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      global.MingliAuth?.clearToken?.();
      throw new Error(data.error || '登录已过期，请重新登录');
    }
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  }

  const CloudEngine = {
    bazi(y, m, d, h, minute, gender, lon) {
      return api('/api/bazi', { y, m, d, h, min: minute || 0, gender, lon: lon ?? null });
    },
    liunian(dayGan, birthYear, fromAge, toAge) {
      return api('/api/bazi/liunian', { dayGan, birthYear, from: fromAge, to: toAge }).then(x => x.liunian);
    },
    liuyue(dayGan, year) {
      return api('/api/bazi/liuyue', { dayGan, year }).then(x => x.liuyue);
    },
    liuri(dayGan, year, month) {
      return api('/api/bazi/liuri', { dayGan, year, month }).then(x => x.liuri);
    },
    castByNumbers(n1, n2, n3, dt) {
      return Promise.resolve(castByNumbersLocal(n1, n2, n3, dt));
    },
    castCoins(dt) {
      return Promise.resolve(castCoinsLocal(dt));
    },
    buildChart(bits, moving, dt) {
      return Promise.resolve(buildChartLocal(bits, moving, dt || nowDT()));
    },
    meihua(n1, n2, dt, dongOverride) {
      return Promise.resolve(meihuaLocal(n1, n2, dt, dongOverride));
    },
    ziweiChart(lyearGZ, lmonth, lday, hourIdx, gender) {
      return api('/api/ziwei/chart', { lyearGZ, lmonth, lday, hourIdx, gender });
    },
    ziweiLuckSihua,
    solar2lunar(y, m, d) {
      return api('/api/bazi/solar2lunar', { y, m, d });
    },
    lunar2solar(y, m, d, isLeap) {
      return api('/api/bazi/lunar2solar', { y, m, d, isLeap: !!isLeap });
    },
    dayGZ,
    yearGZ,
    monthGZ,
    shishen,
    hourGZ,
    nowDT() {
      return nowDT();
    },
    divineRun(payload) {
      return api('/api/divine/run', payload);
    },
    caseCalibrate(caseId, payload) {
      return api('/api/cases/' + caseId + '/calibrate', payload);
    },
    caseFeedback(caseId, payload) {
      return api('/api/cases/' + caseId + '/feedback', payload);
    },
    listCases(limit) {
      return api('/api/cases' + (limit ? ('?limit=' + limit) : ''), null, 'GET');
    },
    getCase(id) {
      return api('/api/cases/' + id, null, 'GET');
    },
    askHistory() {
      return api('/api/ask/history', null, 'GET');
    },
    adminStats() {
      return api('/api/admin/stats', null, 'GET');
    },
    chatCreate(caseId) {
      return api('/api/chat/sessions', { caseId });
    },
    chatSend(sessionId, content) {
      return api('/api/chat/' + sessionId + '/messages', { content });
    },
    /* 姓名断取：字库与引擎已随前端外置，能本地算就不必往返服务端；
       字库未就绪时（首屏尚在加载）再退回同源接口。 */
    namingAnalyze(surname, given, chart, opts) {
      if (global.NamingEngine && global.NamingEngine.ready()) {
        return Promise.resolve(global.NamingEngine.namingAnalyze(surname, given, chart, opts));
      }
      return api('/api/naming/analyze', { surname, given, chart, opts });
    },
    namingSuggest(surname, chart, opts) {
      if (global.NamingEngine && global.NamingEngine.ready()) {
        return Promise.resolve(global.NamingEngine.namingSuggest(surname, chart, opts));
      }
      return api('/api/naming/suggest', { surname, chart, opts });
    },
    STEMS,
    BRANCHES,
  };

  global.Engine = CloudEngine;
  global.E = CloudEngine;
  global.MingliApi = { post: api };
})(window);
