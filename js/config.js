(function () {
  var host = (typeof location !== 'undefined' && location.hostname) || '';
  var onGithub = /\.github\.io$/.test(host);
  // GitHub Pages 上改成新后台地址（Railway 或自定义 API 域名），不要末尾斜杠。
  // 若网页本身就开在 Railway / 自定义域名上（同源），会自动用当前域名。
  var remoteApi = 'https://REPLACE_WITH_NEW_RAILWAY_OR_DOMAIN';
  window.MINGLI_CONFIG = {
    API_BASE: onGithub ? remoteApi : (typeof location !== 'undefined' ? location.origin : remoteApi),
  };
})();
