(function (global) {
  'use strict';
  const KEY = 'mingli_jwt_v2';

  function getToken() {
    try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
  }
  function setToken(t) {
    try { localStorage.setItem(KEY, t); } catch (_) {}
  }
  function clearToken() {
    try { localStorage.removeItem(KEY); } catch (_) {}
  }

  function apiBase() {
    return (global.MINGLI_CONFIG && global.MINGLI_CONFIG.API_BASE || '').replace(/\/$/, '');
  }

  function friendlyNetError(e, fallback) {
    const msg = (e && e.message) || String(e || '');
    if (/Failed to fetch|NetworkError|Load failed|aborted|timeout/i.test(msg)) {
      return '无法连接后台服务。请确认 Railway 已部署成功，并在浏览器打开 API 地址/health 应返回 ok。';
    }
    return fallback || msg || '请求失败';
  }

  async function fetchJson(path, options, timeoutMs) {
    const base = apiBase();
    if (!base) throw new Error('未配置 API 地址（请检查 js/config.js）');
    const ctrl = new AbortController();
    const ms = timeoutMs || 30000;
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(base + path, { ...options, signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    } catch (e) {
      throw new Error(friendlyNetError(e));
    } finally {
      clearTimeout(timer);
    }
  }

  async function login(email, password) {
    const body = email && email.includes('@')
      ? { email, password }
      : { password: password || email };
    const { res, data } = await fetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(data.error || '登录失败');
    setToken(data.token);
    return data;
  }

  async function register(email, password, inviteCode) {
    const { res, data } = await fetchJson('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, inviteCode }),
    });
    if (!res.ok) throw new Error(data.error || '注册失败');
    setToken(data.token);
    return data;
  }

  async function checkAuth() {
    const base = apiBase();
    const token = getToken();
    if (!base || !token) return false;
    try {
      const { res } = await fetchJson('/api/auth/check', {
        headers: { Authorization: 'Bearer ' + token },
      }, 5000);
      if (!res.ok) { clearToken(); return false; }
      return true;
    } catch (_) {
      return false;
    }
  }

  async function me() {
    const token = getToken();
    if (!apiBase() || !token) return null;
    try {
      const { res, data } = await fetchJson('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function logout(opts) {
    opts = opts || {};
    if (!opts.force) {
      const busy = typeof global.shouldConfirmLeave === 'function' && global.shouldConfirmLeave();
      const tip = busy
        ? '当前有未保存内容或测算结果，确定退出登录并离开？'
        : '确定退出登录并返回登录页？';
      if (!confirm(tip)) return;
    }
    global.__ALLOW_LEAVE = true;
    if (typeof global.markChartSaved === 'function') global.markChartSaved();
    clearToken();
    location.href = 'index.html';
  }

  global.MingliAuth = { getToken, setToken, clearToken, login, register, checkAuth, me, logout };
})(window);
