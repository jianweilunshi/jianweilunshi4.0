(function (global) {
  'use strict';

  let CLOUD_CASE_ID = null;
  let CLOUD_DIVINE = null;
  let CHAT_SESSION_ID = null;

  global.CloudBridge = {
    get caseId() { return CLOUD_CASE_ID; },
    set caseId(v) { CLOUD_CASE_ID = v; },
    get divine() { return CLOUD_DIVINE; },
    set divine(v) { CLOUD_DIVINE = v; },
  };

  function $(s) { return document.querySelector(s); }

  function applyDivineResult(data) {
    if (!data) return;
    CLOUD_CASE_ID = data.caseId || CLOUD_CASE_ID;
    CLOUD_DIVINE = data;
    if (typeof global.DV_R !== 'undefined') global.DV_R = data.bazi;
    if (data.bazi && typeof global.LAST_BAZI !== 'undefined') {
      global.LAST_BAZI = data.bazi;
      if (typeof updateWendaoBaziNote === 'function') updateWendaoBaziNote();
    }
    if (typeof global.PAST_ROWS !== 'undefined') {
      global.PAST_ROWS = (data.pastRows || []).map(r => ({
        yr: r.yr, gz: r.gz, dy: r.dy, ev: r.ev || [],
      }));
    }
    if (typeof global.MP_BACKTEST_ROWS !== 'undefined') {
      global.MP_BACKTEST_ROWS = data.mpBacktest || [];
    }
    if (typeof global.CALIB !== 'undefined') global.CALIB = data.calib || {};
    if (typeof global.DV_SECTIONS !== 'undefined' && data.sections) {
      global.DV_SECTIONS = { title: '卜算详批', sections: data.sections };
    }
    if (data.hardClaims) global._SHARE_HARD = data.hardClaims;
  }

  function renderCalibBars(calib, answered) {
    const keys = Object.keys(calib || {}).sort((a, b) => (calib[b] || 0) - (calib[a] || 0));
    if (!keys.length) return '';
    let h = '<div class="flow-wrap" style="margin-top:12px;border-color:var(--dai);background:rgba(58,90,107,.06)">'
      + '<div class="flow-head" style="color:var(--dai)">校准结果 · 据 ' + (answered || keys.length) + ' 条回验</div>'
      + '<div class="flow-text"><div class="muted">各应期信号历史应验率：</div><div class="calib-bars">';
    keys.forEach(k => {
      const v = calib[k];
      const lab = v >= 0.66 ? '高' : v >= 0.34 ? '中' : '低';
      h += '<div class="calib-bar"><span class="cb-lab">' + k + '</span><span class="cb-track"><span class="cb-fill" style="width:'
        + Math.round(v * 100) + '%"></span></span><b>' + Math.round(v * 100) + '%</b>·' + lab + '</div>';
    });
    h += '</div></div></div>';
    return h;
  }

  async function cloudRunDivine(opts) {
    opts = opts || {};
    const dt = typeof resolveDate === 'function' ? await resolveDate('dv') : {};
    const y = dt.y || +($('#dv-y')?.value), m = dt.m || +($('#dv-m')?.value);
    const d = dt.d || +($('#dv-d')?.value), h = +($('#dv-h')?.value || 0);
    const min = +($('#dv-min')?.value || 0);
    const g = $('#dv-g')?.value || '男';
    const lon = typeof placeLon === 'function' ? placeLon('dv') : null;
    const school = ($('#dv-school') || {}).value || 'mangpai';
    const topic = ($('#dv-topic') || {}).value || 'all';
    const pastFrom = +($('#dv-pastfrom')?.value || 0);
    const job = ($('#dv-job')?.value || '').trim();
    const data = await E.divineRun({
      y, m, d, h, min, gender: g, lon, school, topic, pastFrom, job,
      place: typeof placeLabel === 'function' ? placeLabel('dv') : '',
      calNote: dt.note || '',
    });
    applyDivineResult(data);
    if (typeof markChartDirty === 'function') markChartDirty();
    if (global.LAST_BAZI) {
      global.LAST_BAZI._birth = { y, m, d, h, min, g, lon, place: typeof placeLabel === 'function' ? placeLabel('dv') : '' };
      if (typeof updateWendaoBaziNote === 'function') updateWendaoBaziNote();
    }
    const core = data.inline?.coreCard || '';
    const hard = data.inline?.hardClaimsHtml || data.hardClaimsHtml || '';
    const summary = data.inline?.summary || '';
    // 与本地版一致：手机「一眼看盘/三句硬断」入口；PC 双栏（概要 | 核心定论+硬断）
    let inline = '<div class="dv-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px">'
      + '<button type="button" class="calbtn" onclick="copyDivine().catch(console.error)">📋 复制信息+结果</button>'
      + '<button type="button" class="ask-btn" style="margin:0" onclick="goAskMaster(\'dv\')">☯ 问先生 · 带结果去 AI 请教</button>'
      + '<button type="button" class="calbtn ghost" onclick="submitFeedbackToServer().catch(console.error)">☁ 提交至服务器</button>'
      + '<span id="dv-copy-tip" class="muted"></span></div>'
      + '<textarea id="dv-copytext" readonly style="display:none;width:100%;min-height:160px"></textarea>';
    inline += '<div class="mobile-summary-actions">'
      + '<button type="button" class="summary-launch" data-summary="core" onclick="openSummaryCard(\'core\')">一眼看盘</button>'
      + '<button type="button" class="summary-launch" data-summary="hard" onclick="openSummaryCard(\'hard\')">三句硬断</button></div>'
      + '<div class="pc-split"><div class="pc-summary-left">' + summary + '</div>'
      + '<div class="pc-summary-right">' + core + hard + '</div></div>';
    if (dt.note) inline += '<p class="muted" style="margin:-6px 0 8px">' + dt.note + '</p>';
    if (data.caseId) inline += '<p class="muted" style="font-size:12px">案例已建档：' + data.caseId + ' · 可在「我的」查看</p>';
    inline += '<button type="button" class="detail-btn" onclick="openDivineSections()">📖 查看完整详批 · 运势 / 姻缘 / 事业 / 过往 ▸</button>';
    const out = $('#dv-out');
    if (out) {
      out.innerHTML = inline;
      if (typeof decorate === 'function') decorate('dv-out');
    }
    if (!opts.noPopup && !opts.inline && typeof openSectioned === 'function' && data.sections) {
      openSectioned('卜算详批', data.sections);
    }
    return data;
  }

  function openSummaryCard(kind) {
    const data = CLOUD_DIVINE;
    if (!data || !data.inline) {
      alert('请先完成测算');
      return;
    }
    const title = kind === 'hard' ? '三句可验硬断' : '一眼看盘 · 核心定论';
    const body = kind === 'hard'
      ? (data.inline.hardClaimsHtml || data.hardClaimsHtml || '')
      : (data.inline.coreCard || '');
    if (!body) {
      alert('暂无内容，请重新测算一次');
      return;
    }
    if (typeof openPop === 'function') {
      openPop('<h4 style="color:var(--cinnabar);margin:0 0 10px">' + title + '</h4>' + body);
    }
  }

  async function cloudCalibratePast() {
    if (!CLOUD_DIVINE || !CLOUD_DIVINE.pastRows?.length) {
      alert('请先完成测算');
      return;
    }
    const feedback = {};
    CLOUD_DIVINE.pastRows.forEach((x, i) => {
      const sel = document.querySelector('input[name="cal' + i + '"]:checked');
      if (sel) feedback[i] = sel.value;
    });
    if (!Object.keys(feedback).length) {
      alert('请先勾选回验项');
      return;
    }
    if (CLOUD_CASE_ID) {
      const cal = await E.caseCalibrate(CLOUD_CASE_ID, {
        pastRows: CLOUD_DIVINE.pastRows,
        feedback,
      });
      if (typeof global.CALIB !== 'undefined') global.CALIB = cal.calib || {};
      const box = document.getElementById('dv-calib');
      if (box) {
        let html = renderCalibBars(cal.calib, cal.answered);
        if (cal.calibratedYunHtml) html += '<div class="flow-wrap">' + cal.calibratedYunHtml + '</div>';
        box.innerHTML = html;
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return cal;
    }
    alert('已记录本地回验；登录账号后将同步至服务器');
  }

  async function submitFeedbackToServer() {
    if (!CLOUD_CASE_ID) {
      alert('请先完成一次测算（需登录）');
      return;
    }
    const pastFeedback = {};
    (CLOUD_DIVINE?.pastRows || []).forEach((x, i) => {
      const sel = document.querySelector('input[name="cal' + i + '"]:checked');
      if (sel) pastFeedback[i] = sel.value;
    });
    const mpFeedback = {};
    (CLOUD_DIVINE?.mpBacktest || []).forEach((x, i) => {
      const sel = document.querySelector('input[name="mpcal' + i + '"]:checked');
      if (sel) mpFeedback[i] = sel.value;
    });
    if (!Object.keys(pastFeedback).length && !Object.keys(mpFeedback).length) {
      alert('请先勾选回验项');
      return;
    }
    await E.caseFeedback(CLOUD_CASE_ID, { pastFeedback, mpFeedback });
    await cloudCalibratePast();
    alert('回验已提交至服务器，权重已更新');
    if (typeof refreshMyCases === 'function') refreshMyCases();
  }

  async function sendChatMsg() {
    const inp = document.getElementById('chat-input');
    const box = document.getElementById('chat-msgs');
    if (!inp || !box) return;
    const text = inp.value.trim();
    if (!text) return;
    if (!CHAT_SESSION_ID) {
      const s = await E.chatCreate(CLOUD_CASE_ID);
      CHAT_SESSION_ID = s.sessionId;
    }
    box.innerHTML += '<div style="margin:8px 0;text-align:right"><span style="background:#e7d6ab;padding:6px 10px;border-radius:8px;display:inline-block">' + text + '</span></div>';
    inp.value = '';
    const r = await E.chatSend(CHAT_SESSION_ID, text);
    box.innerHTML += '<div style="margin:8px 0"><span style="background:#fff;padding:8px 12px;border:1px solid var(--gold);border-radius:8px;display:inline-block;max-width:90%;white-space:pre-wrap">' + (r.reply || '') + '</span></div>';
    box.scrollTop = box.scrollHeight;
  }

  async function refreshMyCases() {
    const box = document.getElementById('me-cases');
    if (!box) return;
    if (!global.E?.listCases) {
      box.innerHTML = '<p class="muted">案例列表需云端版</p>';
      return;
    }
    try {
      const data = await E.listCases();
      const items = data.items || [];
      if (!items.length) {
        box.innerHTML = '<p class="muted">暂无案例。完成一次「测算」后将出现在此。</p>';
        return;
      }
      box.innerHTML = items.map(c => {
        const p = c.pillars || {};
        const b = c.birth || {};
        const pillars = [p.year, p.month, p.day, p.hour].filter(Boolean).join(' ');
        const birth = b.y ? (b.y + '-' + b.m + '-' + b.d) : '';
        return '<div class="me-case">'
          + '<div class="mc-title">' + (pillars || '案例') + '</div>'
          + '<div class="mc-meta">' + birth + ' · ' + (c.school || '') + '/' + (c.topic || '')
          + ' · 轮次 ' + (c.roundCount || 0) + ' · 回验 ' + (c.feedbackCount || 0)
          + '<br>' + (c.created_at || '') + '</div>'
          + '<div class="me-actions">'
          + '<button type="button" class="calbtn ghost" onclick="openCaseDetail(\'' + c.id + '\')">查看回验</button>'
          + '<button type="button" class="calbtn ghost" onclick="reuseCaseBirth(' + JSON.stringify(b).replace(/"/g, '&quot;') + ')">回填出生</button>'
          + '</div></div>';
      }).join('');
    } catch (e) {
      box.innerHTML = '<p class="muted" style="color:var(--cinnabar)">' + (e.message || '加载失败') + '</p>';
    }
  }

  async function openCaseDetail(id) {
    try {
      const data = await E.getCase(id);
      const fb = data.feedback || [];
      const rounds = data.rounds || [];
      let html = '<div class="me-block"><h3>案例详情</h3>';
      html += '<p class="muted">轮次 ' + rounds.length + ' · 回验条目 ' + fb.length + '</p>';
      if (fb.length) {
        html += fb.map(f => '<div class="struct">' + (f.claim_key || '') + '：<b>' + (f.verdict || '') + '</b> '
          + (f.note ? (' ' + f.note) : '') + '</div>').join('');
      } else html += '<p class="muted">尚无回验条目（点测算报告内「提交核验」即可写入）</p>';
      html += '</div>';
      if (typeof openPop === 'function') openPop(html);
      else alert('回验 ' + fb.length + ' 条');
    } catch (e) {
      alert(e.message || '加载失败');
    }
  }

  function reuseCaseBirth(b) {
    if (!b || !b.y) return;
    ['dv', 'bz', 'ha'].forEach(prefix => {
      const set = (id, v) => { const el = document.getElementById(prefix + '-' + id); if (el && v != null) el.value = v; };
      set('y', b.y); set('m', b.m); set('d', b.d); set('h', b.h || 0); set('min', b.min || 0);
      const g = document.getElementById(prefix + '-g'); if (g && b.gender) g.value = b.gender;
    });
    if (typeof goMain === 'function') goMain('divine');
    alert('已回填出生信息到测算表单');
  }

  async function loadMeAccount() {
    const box = document.getElementById('me-account-body');
    if (!box) return;
    try {
      const me = await global.MingliAuth?.me?.();
      if (me && me.email) {
        box.innerHTML = '已登录：<b>' + me.email + '</b>（' + (me.role || 'user') + '）'
          + '<div class="me-actions" style="margin-top:8px"><button type="button" class="calbtn ghost" onclick="MingliAuth.logout()">退出</button></div>';
      } else {
        box.innerHTML = '兼容密码登录（无独立邮箱）。案例仍会写入服务器（legacy_site）。'
          + '<div class="me-actions" style="margin-top:8px"><button type="button" class="calbtn ghost" onclick="MingliAuth.logout()">退出</button></div>';
      }
    } catch (e) {
      box.innerHTML = '未获取到账号信息';
    }
  }

  let WD_HISTORY_LOADED = false;
  async function loadWendaoHistory() {
    if (WD_HISTORY_LOADED || !E.askHistory) return;
    const stream = document.getElementById('wd-stream');
    if (!stream) return;
    try {
      const data = await E.askHistory();
      const items = (data.items || []).slice().reverse();
      if (!items.length) return;
      WD_HISTORY_LOADED = true;
      items.forEach(it => {
        if (typeof wdBubble === 'function') {
          wdBubble('user', escHtml(it.question || ''));
          wdBubble('master', '<div style="white-space:pre-wrap">' + escHtml(it.answer || '') + '</div>');
        } else {
          stream.innerHTML += '<div class="wd-msg user">' + escHtml(it.question || '') + '</div>'
            + '<div class="wd-msg master"><div style="white-space:pre-wrap">' + escHtml(it.answer || '') + '</div></div>';
        }
      });
      if (typeof global.WD_HISTORY !== 'undefined') {
        items.forEach(it => {
          global.WD_HISTORY.push({ role: 'user', content: it.question });
          global.WD_HISTORY.push({ role: 'assistant', content: it.answer });
        });
      }
    } catch (e) {
      console.warn('[wendao history]', e);
    }
  }

  function getWendaoContext() {
    const payload = {};
    if (CLOUD_CASE_ID) payload.caseId = CLOUD_CASE_ID;
    let r = global.LAST_BAZI;
    if ((!r || !r.year) && typeof global.readBirthFromPrefix === 'function' && typeof global.refreshWendaoContextFromBirth === 'function') {
      const p = global.readBirthFromPrefix('dv') || global.readBirthFromPrefix('bz');
      if (p) global.refreshWendaoContextFromBirth(p);
      r = global.LAST_BAZI;
    }
    if (r && r.year) {
      const b = r._birth || {};
      payload.baziContext = {
        pillars: { year: r.year, month: r.month, day: r.day, hour: r.hour },
        dayMaster: r.dayGan || (r.day && r.day[0]) || '',
        strength: (r.strength && r.strength.level) || (r.strong ? '偏强' : '偏弱'),
        birth: b.y ? `${b.y}-${b.m}-${b.d} ${b.h || 0}:${b.min || 0} ${b.g || ''}`.trim() : '',
        place: r._place || b.place || '',
      };
    }
    return payload;
  }

  function updateWendaoBaziNote() {
    const note = document.getElementById('wd-note');
    const r = global.LAST_BAZI;
    if (!note || !r || !r.year) return;
    note.style.display = 'block';
    note.innerHTML = '已关联八字：<b>' + escHtml(r.year + ' ' + r.month + ' ' + r.day + ' ' + r.hour)
      + '</b>（日主 ' + escHtml(r.dayGan || '') + '）— 先生将结合此盘作答。';
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function uiShowError(outId, label, e) {
    const out = document.getElementById(outId);
    const msg = (e && e.message) ? e.message : String(e);
    console.error('[' + label + ']', e);
    if (out) {
      out.innerHTML = '<p style="color:#9e3b2f;margin:12px 0">' + label + '失败：' + msg + '</p>'
        + '<p class="muted">登录过期请 <a href="index.html">重新登录</a>；API 不可达请检查 Railway。</p>';
    }
    if (/登录|401|过期|未授权|JWT/.test(msg)) setTimeout(() => { location.href = 'index.html'; }, 2500);
  }

  global.cloudRunDivine = cloudRunDivine;
  global.cloudCalibratePast = cloudCalibratePast;
  global.submitFeedbackToServer = submitFeedbackToServer;
  global.submitVerifyAndCalibrate = submitFeedbackToServer;
  global.sendChatMsg = sendChatMsg;
  global.applyDivineResult = applyDivineResult;
  global.openSummaryCard = openSummaryCard;
  global.refreshMyCases = refreshMyCases;
  global.openCaseDetail = openCaseDetail;
  global.reuseCaseBirth = reuseCaseBirth;
  global.loadMeAccount = loadMeAccount;
  global.loadWendaoHistory = loadWendaoHistory;
  global.getWendaoContext = getWendaoContext;
  global.updateWendaoBaziNote = updateWendaoBaziNote;
  global.uiShowError = uiShowError;
  Object.defineProperty(global, 'CLOUD_DIVINE', { get() { return CLOUD_DIVINE; } });

  // 注意：不要在此覆盖 window.runDivine —— 页面内联脚本的 runDivine
  // 会把云端返回写回页面级变量（DV_SECTIONS/DV_R/LAST_BAZI/PAST_ROWS），
  // 覆盖后「查看完整详批」等按钮将失效。
})(window);
