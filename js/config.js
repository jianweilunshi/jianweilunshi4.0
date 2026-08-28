(function () {
  var host = (typeof location !== 'undefined' && location.hostname) || '';
  var onGithub = /\.github\.io$/.test(host);
  var remoteApi = 'https://web-production-64a88.up.railway.app';
  window.MINGLI_CONFIG = {
    API_BASE: onGithub ? remoteApi : (typeof location !== 'undefined' ? location.origin : remoteApi),
  };
})();
