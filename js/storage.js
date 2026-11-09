/* セーブデータ（localStorage）。使えない環境でも あそべるように、すべて try/catch で守る */
(function () {
  var KB = (window.KB = window.KB || {});
  var BASE_KEY = KB.CONFIG.STORAGE_KEY;
  var userKey = '';          // ログイン中の児童（学年-組-番号）。空なら ログインなしの保存先
  var memoryFallback = null; // localStorage が使えない時の しのぎ

  // 1台のタブレットを何人かで使っても、児童ごとに保存先を分ける
  function storageKey() { return userKey ? BASE_KEY + ':' + userKey : BASE_KEY; }

  function blank() {
    return { v: 1, stages: {}, progress: null, zukan: [], totalCoins: 0, openAll: false, muted: false };
  }

  function load() {
    var raw = null;
    try { raw = window.localStorage.getItem(storageKey()); } catch (e) { return memoryFallback || blank(); }
    if (!raw) return memoryFallback || blank();
    try {
      var data = JSON.parse(raw);
      var base = blank();
      Object.keys(base).forEach(function (key) { if (data[key] === undefined) data[key] = base[key]; });
      return data;
    } catch (e) {
      return blank();
    }
  }

  function write(data) {
    memoryFallback = data;
    try { window.localStorage.setItem(storageKey(), JSON.stringify(data)); } catch (e) { /* 保存できなくても あそべる */ }
  }

  KB.Storage = {
    setUser: function (key) { userKey = key || ''; memoryFallback = null; },
    // サーバーの記録を取りこむ（星は多いほう、ずかんはまとめる、ほしは大きいほう）
    mergeRemote: function (remote) {
      var data = load();
      Object.keys(remote.stages || {}).forEach(function (id) {
        var r = remote.stages[id], l = data.stages[id] || { cleared: false, bestStars: 0, bestScore: 0, plays: 0 };
        data.stages[id] = { cleared: l.cleared || !!r.cleared, bestStars: Math.max(l.bestStars, r.bestStars || 0),
          bestScore: Math.max(l.bestScore, r.bestScore || 0), plays: Math.max(l.plays, r.plays || 0) };
      });
      (remote.zukan || []).forEach(function (id) { if (data.zukan.indexOf(id) < 0) data.zukan.push(id); });
      data.totalCoins = Math.max(data.totalCoins, remote.coins || 0);
      write(data);
    },
    getStage: function (stageId) {
      return load().stages[stageId] || { cleared: false, bestStars: 0, bestScore: 0, plays: 0 };
    },
    // 結果を記録（星は いちばん多い ほうを のこす）
    recordResult: function (stageId, result) {
      var data = load();
      var old = data.stages[stageId] || { cleared: false, bestStars: 0, bestScore: 0, plays: 0 };
      data.stages[stageId] = {
        cleared: true,
        bestStars: Math.max(old.bestStars, result.stars),
        bestScore: Math.max(old.bestScore, result.score),
        plays: old.plays + 1
      };
      data.totalCoins += result.coins || 0;
      (result.pictures || []).forEach(function (picId) {
        if (data.zukan.indexOf(picId) < 0) data.zukan.push(picId);
      });
      data.progress = null;
      write(data);
    },
    getProgress: function (stageId) {
      var p = load().progress;
      return p && p.stageId === stageId ? p : null;
    },
    saveProgress: function (progress) {
      var data = load();
      data.progress = progress;
      write(data);
    },
    clearProgress: function () {
      var data = load();
      data.progress = null;
      write(data);
    },
    addZukan: function (picId) {
      var data = load();
      if (data.zukan.indexOf(picId) < 0) { data.zukan.push(picId); write(data); }
    },
    getZukan: function () { return load().zukan.slice(); },
    getCoins: function () { return load().totalCoins; },
    isOpenAll: function () { return !!load().openAll; },
    setOpenAll: function (flag) { var d = load(); d.openAll = !!flag; write(d); },
    isMuted: function () { return !!load().muted; },
    setMuted: function (flag) { var d = load(); d.muted = !!flag; write(d); },
    countCleared: function (grade) {
      var data = load();
      return KB.STAGES[grade].filter(function (s) { return data.stages[s.id] && data.stages[s.id].cleared; }).length;
    },
    // ステージが あそべるか（ひとつ前を クリアすると ひらく）
    isUnlocked: function (stage) {
      var data = load();
      if (data.openAll || stage.ordinal === 0) return true;
      var prev = KB.STAGES[stage.grade][stage.ordinal - 1];
      return !!(data.stages[prev.id] && data.stages[prev.id].cleared);
    }
  };
})();
