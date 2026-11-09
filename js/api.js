/* ガス（サーバー）との通信。つながらない時は「みそうしん」として手元にためて、あとで送りなおす */
(function () {
  var KB = (window.KB = window.KB || {});
  var C = KB.CONFIG;
  var flushing = false;

  function isEnabled() { return !!C.API_URL; }

  // 失敗は例外にせず { ok:false, reason:'network' } で返す
  function call(action, payload) {
    return new Promise(function (resolve) {
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (controller) controller.abort();
        resolve({ ok: false, reason: 'network' });
      }, C.API_TIMEOUT_MS);
      var body = JSON.stringify(Object.assign({ action: action }, payload || {}));
      // Content-Type を付けない（text/plain）ことで、事前確認の通信を避ける
      fetch(C.API_URL, { method: 'POST', body: body, signal: controller ? controller.signal : undefined })
        .then(function (res) { return res.json(); })
        .then(function (data) { clearTimeout(timer); resolve(data); })
        .catch(function () { clearTimeout(timer); resolve({ ok: false, reason: 'network' }); });
    });
  }

  function who(student) { return { grade: student.grade, classId: student.classId, number: student.number }; }

  // ---------- みそうしん ----------
  function readPending() {
    try { return JSON.parse(window.localStorage.getItem(C.PENDING_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function writePending(list) {
    try { window.localStorage.setItem(C.PENDING_KEY, JSON.stringify(list)); } catch (e) { /* 保存できなくても つづける */ }
  }
  function newAttemptId() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }

  // 送りなおし。成功か「もう送れない」とわかった分だけ消す。つながらない・停止中は のこす
  function flushPending() {
    if (!isEnabled() || flushing) return Promise.resolve();
    flushing = true;
    function next() {
      var list = readPending();
      if (list.length === 0) { flushing = false; return Promise.resolve(); }
      var item = list[0];
      return call('save', Object.assign(who(item.student), { result: item.result })).then(function (res) {
        if (res.ok || res.reason === 'invalid') {
          writePending(readPending().slice(1));
          return next();
        }
        flushing = false;
        return undefined;
      });
    }
    return next();
  }

  function sendResult(student, result) {
    var item = { student: who(student), result: Object.assign({ attemptId: newAttemptId() }, result) };
    writePending(readPending().concat([item]));
    return flushPending();
  }

  KB.Api = {
    isEnabled: isEnabled,
    status: function () { return call('status'); },
    check: function (student) { return call('check', who(student)); },
    login: function (student) { return call('login', who(student)); },
    sendResult: sendResult,
    flushPending: flushPending,
    pendingCount: function () { return readPending().length; }
  };
  window.addEventListener('online', function () { flushPending(); });
})();
