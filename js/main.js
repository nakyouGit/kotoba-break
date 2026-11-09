/* 画面の切りかえ・ステージの流れ・セーブ・結果画面 */
(function () {
  var KB = window.KB, C = KB.CONFIG, Q = KB.Q;
  var $ = function (id) { return document.getElementById(id); };

  var screens = { login: $('screen-login'), start: $('screen-start'), map: $('screen-map'), play: $('screen-play') };
  var canvas = $('c'), ctx = canvas.getContext('2d');
  var overlay = $('overlay');

  var run = null;         // 今あそんでいる ステージの状態
  var loopId = 0, lastTs = 0;
  var mapGrade = 1;
  var student = null;     // ログイン中の児童 { grade, classId, number }。ガス連携なしの時は null
  var loginPick = { grade: 0, classId: 0 };
  var classCounts = {};

  // ---------- 画面 ----------
  function showScreen(name) {
    Object.keys(screens).forEach(function (key) { screens[key].hidden = key !== name; });
    window.scrollTo(0, 0);
  }

  function starText(count) {
    var out = '';
    for (var i = 0; i < 3; i++) out += i < count ? KB.STAR_TEXT.full : KB.STAR_TEXT.empty;
    return out;
  }

  // ---------- ログイン（学年・組・出席番号） ----------
  function classCountFor(grade) { return classCounts[grade] || C.DEFAULT_CLASS_COUNT; }

  function buildPickButtons(boxId, values, labelFn, selected, onPick) {
    var box = $(boxId);
    box.textContent = '';
    values.forEach(function (value) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick-btn' + (value === selected ? ' sel' : '');
      btn.textContent = labelFn(value);
      btn.addEventListener('click', function () { onPick(value); });
      box.appendChild(btn);
    });
  }

  function renderLoginPicks() {
    buildPickButtons('login-grades', C.GRADE_LIST, function (g) { return g + 'ねんせい'; }, loginPick.grade, function (g) {
      loginPick.grade = g;
      if (loginPick.classId > classCountFor(g)) loginPick.classId = 0;
      renderLoginPicks();
    });
    var classes = [];
    for (var i = 1; i <= (loginPick.grade ? classCountFor(loginPick.grade) : C.DEFAULT_CLASS_COUNT); i++) classes.push(i);
    buildPickButtons('login-classes', classes, function (n) { return n + 'くみ'; }, loginPick.classId, function (n) {
      loginPick.classId = n;
      renderLoginPicks();
    });
  }

  function setLoginMessage(text) { $('login-message').textContent = text || ''; }

  function renderLogin() {
    student = null;
    KB.Storage.setUser('');
    loginPick = { grade: 0, classId: 0 };
    $('login-number').value = '';
    setLoginMessage('');
    renderLoginPicks();
    showScreen('login');
    KB.Api.status().then(function (res) {
      if (!res.ok) return;
      classCounts = res.classCounts || {};
      renderLoginPicks();
      var all = (res.stopped || []).filter(function (item) { return item.scope === 'ALL'; })[0];
      if (all) setLoginMessage(all.message || '');
    });
  }

  function enterAs(picked, remote) {
    student = picked;
    KB.Storage.setUser([picked.grade, picked.classId, picked.number].join('-'));
    if (remote) KB.Storage.mergeRemote(remote);
    KB.Api.flushPending();
    renderMap(picked.grade);
  }

  function onLoginGo() {
    var number = Number($('login-number').value);
    if (!loginPick.grade || !loginPick.classId || !(Number.isInteger(number) && number >= 1 && number <= C.MAX_NUMBER)) {
      setLoginMessage('がくねん・くみ・ばんごうを えらんでね。');
      return;
    }
    var picked = { grade: loginPick.grade, classId: loginPick.classId, number: number };
    setLoginMessage('ちょっと まってね…');
    KB.Api.login(picked).then(function (res) {
      if (res.ok) { enterAs(picked, res); return; }
      if (res.reason === 'network') {
        // つながらない時は、この端末だけで あそべるようにする（記録は あとで おくる）
        enterAs(picked, null);
        return;
      }
      setLoginMessage(res.message || '');
    });
  }

  // ---------- スタート画面 ----------
  function renderStart() {
    [1, 2].forEach(function (grade) {
      $('sub-grade-' + grade).textContent = KB.Storage.countCleared(grade) + ' / ' + KB.STAGES[grade].length + ' クリア';
    });
    showScreen('start');
  }

  // ---------- ステージえらび ----------
  function renderMap(grade) {
    mapGrade = grade;
    $('map-title').textContent = grade + 'ねんせい ことばクエスト';
    $('map-coins').textContent = 'ほし ' + KB.Storage.getCoins();
    $('map-student').textContent = student ? student.classId + 'くみ ' + student.number + 'ばん' : '';
    $('open-all').hidden = KB.Api.isEnabled();   // ログインありの時は、児童が全開放できないようにする
    setMapNotice(pendingNotice());
    $('open-all').textContent = KB.Storage.isOpenAll() ? 'ぜんぶ ひらく：ON' : 'ぜんぶ ひらく：OFF';
    var list = $('map-list');
    list.textContent = '';

    KB.CHAPTERS[grade].forEach(function (chapter) {
      var head = document.createElement('h2');
      head.className = 'chapter-title';
      head.textContent = chapter.title;
      list.appendChild(head);
      chapter.stages.forEach(function (stage) { list.appendChild(buildStageRow(stage)); });
    });
    showScreen('map');
  }

  function pendingNotice() {
    var n = KB.Api.pendingCount();
    return n > 0 ? 'きろくの そうしんが まだ のこっているよ（' + n + '）。つながると じどうで おくるよ。' : '';
  }
  function setMapNotice(text) {
    $('map-notice').textContent = text || '';
    $('map-notice').hidden = !text;
  }

  function buildStageRow(stage) {
    var info = KB.Storage.getStage(stage.id);
    var unlocked = KB.Storage.isUnlocked(stage);
    var saved = KB.Storage.getProgress(stage.id);

    var row = document.createElement('div');
    row.className = 'stage-row' + (unlocked ? '' : ' locked') + (info.cleared ? ' cleared' : '');

    var main = document.createElement('button');
    main.type = 'button';
    main.className = 'stage-main';
    main.disabled = !unlocked;
    var num = document.createElement('span'); num.className = 'stage-num'; num.textContent = stage.ordinal + 1;
    var body = document.createElement('span'); body.className = 'stage-body';
    var title = document.createElement('span'); title.className = 'stage-title'; title.textContent = stage.title;
    var sub = document.createElement('span'); sub.className = 'stage-sub';
    sub.textContent = unlocked ? (saved ? 'つづきが あるよ' : stage.sub) : 'まえの ステージを クリアしよう';
    body.appendChild(title); body.appendChild(sub);
    var stars = document.createElement('span'); stars.className = 'stage-stars'; stars.textContent = info.cleared ? starText(info.bestStars) : '';
    main.appendChild(num); main.appendChild(body); main.appendChild(stars);
    main.addEventListener('click', function () { startStage(stage, !!saved); });
    row.appendChild(main);

    if (unlocked && saved) {
      var again = document.createElement('button');
      again.type = 'button'; again.className = 'stage-restart'; again.textContent = 'はじめから';
      again.addEventListener('click', function () { startStage(stage, false); });
      row.appendChild(again);
    }
    return row;
  }

  // ---------- ステージ開始・再開 ----------
  function startStage(stage, resume) {
    KB.Audio.ensure();
    if (!student || !KB.Api.isEnabled()) { beginStage(stage, resume); return; }
    // 停止中・凍結中は、はじめる前にことわる（つながらない時は あそべる）
    KB.Api.check(student).then(function (res) {
      if (!res.ok && (res.reason === 'stopped' || res.reason === 'frozen')) {
        overlay.hidden = true;
        stopLoop();
        run = null;
        renderMap(stage.grade);
        setMapNotice(res.message || '');
        return;
      }
      beginStage(stage, resume);
    });
  }

  function beginStage(stage, resume) {
    var saved = resume ? KB.Storage.getProgress(stage.id) : null;
    var qIds = saved ? saved.queue.map(function (item) { return item.id; }) : KB.buildQuestionIds(stage);

    run = {
      stage: stage,
      queue: saved ? saved.queue : qIds.map(function (id) { return { id: id, retry: false }; }),
      qi: saved ? saved.qi : 0,
      firstCount: saved ? saved.firstCount : 0,
      retryAdded: saved ? saved.retryAdded : {},
      streak: saved ? saved.streak : 0,
      coins: saved ? saved.coins : 0,
      pictures: saved ? saved.pictures : [],
      originalCount: saved ? saved.originalCount : qIds.length,
      wrongIds: saved && saved.wrongIds ? saved.wrongIds : [],
      finishing: false
    };
    KB.Engine.reset({
      grade: stage.grade,
      picIndex: saved ? saved.picIndex : KB.pictureIndexFor(stage),
      bricksHp: saved ? saved.bricks : null,
      points: saved ? saved.points : 0
    });
    KB.Engine.setHandlers({
      sound: function (name) { KB.Audio.play(name); },
      roundEnded: onRoundEnded,
      pictureCleared: onPictureCleared,
      feverDone: onFeverDone
    });

    $('play-title').textContent = stage.title;
    overlay.hidden = true;
    showScreen('play');
    showQuestion();
    startLoop();
  }

  // ---------- 問題 ----------
  function updateProgress() {
    var item = run.queue[Math.min(run.qi, run.queue.length - 1)];
    var label = Math.min(run.qi + 1, run.queue.length) + ' / ' + run.queue.length;
    $('progress').textContent = (item && item.retry ? 'ふくしゅう ' : '') + label;
  }

  function showQuestion() {
    if (run.qi >= run.queue.length) { beginFinish(); return; }
    var item = run.queue[run.qi];
    KB.Engine.prepareRound();
    KB.QuestionUI.show(KB.getQuestion(item.id), onAnswered);
    updateProgress();
    saveProgress();
  }

  function onAnswered(result) {
    var item = run.queue[run.qi];
    if (!item.retry) {
      if (result.firstTry) run.firstCount += 1;
      else if (!run.retryAdded[item.id]) {
        run.retryAdded[item.id] = true;
        run.queue.push({ id: item.id, retry: true });   // まちがえた問題は あとで もういちど
        run.wrongIds.push(item.id);                      // 先生用の「よくまちがえる問題」に つかう
      }
    }
    run.streak = result.firstTry ? run.streak + 1 : 0;
    KB.Engine.grantLaunch({ fire: result.firstTry, streak: run.streak });
    run.qi += 1;
    KB.QuestionUI.note(result.firstTry ? 'ボールを タップして はっしゃ！ ファイヤーボールだよ。' : 'ボールを タップして はっしゃ！');
    saveProgress();
  }

  function onRoundEnded() {
    setTimeout(showQuestion, C.NEXT_QUESTION_DELAY_MS);
  }

  function onPictureCleared(info) {
    var picture = KB.PICTURES[info.picIndex % KB.PICTURES.length];
    if (run.pictures.indexOf(picture.id) < 0) run.pictures.push(picture.id);
    KB.Storage.addZukan(picture.id);
  }

  // ---------- セーブ ----------
  function saveProgress() {
    if (!run || run.finishing) return;
    var snap = KB.Engine.snapshot();
    KB.Storage.saveProgress({
      stageId: run.stage.id, queue: run.queue, qi: run.qi, firstCount: run.firstCount,
      retryAdded: run.retryAdded, streak: run.streak, coins: run.coins + KB.Engine.getState().coins,
      pictures: run.pictures, originalCount: run.originalCount, wrongIds: run.wrongIds,
      bricks: snap.bricks, picIndex: snap.picIndex, points: snap.points
    });
  }

  // ---------- 終了 → フィーバー → 結果 ----------
  function beginFinish() {
    run.finishing = true;
    KB.Storage.clearProgress();
    KB.QuestionUI.clear();
    KB.QuestionUI.note('ぜんぶ おわったよ！ のこりの ブロックを ぜんぶ くずすよ！');
    KB.Engine.startFever();
  }

  function onFeverDone() {
    setTimeout(showResult, C.CLEAR_DELAY_MS);
  }

  function calcStars(ratio) {
    if (ratio >= C.STAR3_RATIO) return 3;
    if (ratio >= C.STAR2_RATIO) return 2;
    return 1;
  }

  function showResult() {
    var state = KB.Engine.getState();
    var ratio = run.firstCount / run.originalCount;
    var stars = calcStars(ratio);
    var coins = run.coins + state.coins;
    KB.Storage.recordResult(run.stage.id, { stars: stars, score: state.points, coins: coins, pictures: run.pictures });
    if (student && KB.Api.isEnabled()) {
      KB.Api.sendResult(student, { stageId: run.stage.id, stars: stars, score: state.points, coins: coins, pictures: run.pictures,
        firstCount: run.firstCount, total: run.originalCount, wrongIds: run.wrongIds });
    }

    $('result-stars').textContent = starText(stars);
    $('result-score').textContent = '1かいめで せいかい： ' + run.firstCount + ' / ' + run.originalCount;
    $('result-points').textContent = 'スコア ' + state.points + '　ほし ' + coins;
    renderZukan();

    var nextStage = KB.STAGES[run.stage.grade][run.stage.ordinal + 1];
    $('next').hidden = !nextStage;
    overlay.hidden = false;
  }

  function renderZukan() {
    var box = $('zukan');
    box.textContent = '';
    var got = KB.Storage.getZukan();
    KB.PICTURES.forEach(function (picture) {
      var cell = document.createElement('div');
      cell.className = 'zukan-cell';
      var thumb = document.createElement('canvas');
      thumb.width = 64; thumb.height = 64;
      var found = got.indexOf(picture.id) >= 0;
      KB.Render.drawThumb(thumb, picture, found);
      var label = document.createElement('span');
      label.textContent = found ? picture.name : '？';
      cell.appendChild(thumb); cell.appendChild(label);
      box.appendChild(cell);
    });
  }

  // ---------- ループ ----------
  function frame(ts) {
    var dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;
    KB.Engine.update(dt);
    KB.Render.draw(ctx, KB.Engine.getState(), null);
    loopId = requestAnimationFrame(frame);
  }
  function startLoop() { stopLoop(); lastTs = 0; loopId = requestAnimationFrame(frame); }
  function stopLoop() { if (loopId) cancelAnimationFrame(loopId); loopId = 0; }

  function leavePlay() {
    stopLoop();
    KB.Audio.stopSpeaking();
    if (run && !run.finishing) saveProgress();
    run = null;
    renderMap(mapGrade);
  }

  // ---------- 入力 ----------
  function canvasX(event) {
    var rect = canvas.getBoundingClientRect();
    return (event.clientX - rect.left) * (C.W / rect.width);
  }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    KB.Audio.ensure();
    KB.Engine.movePaddleTo(canvasX(e));
    KB.Engine.launch();
  });
  canvas.addEventListener('pointermove', function (e) { KB.Engine.movePaddleTo(canvasX(e)); });
  window.addEventListener('keydown', function (e) {
    var state = KB.Engine.getState();
    if (screens.play.hidden || !state) return;
    var step = 28;
    if (e.key === 'ArrowLeft') KB.Engine.movePaddleTo(state.paddle.x + state.paddle.w / 2 - step);
    else if (e.key === 'ArrowRight') KB.Engine.movePaddleTo(state.paddle.x + state.paddle.w / 2 + step);
    else if (e.key === ' ' && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); KB.Engine.launch(); }
  });

  // ---------- ボタン ----------
  $('btn-grade-1').addEventListener('click', function () { KB.Audio.ensure(); renderMap(1); });
  $('btn-grade-2').addEventListener('click', function () { KB.Audio.ensure(); renderMap(2); });
  $('map-back').addEventListener('click', function () { if (KB.Api.isEnabled()) renderLogin(); else renderStart(); });
  $('login-go').addEventListener('click', onLoginGo);
  $('play-back').addEventListener('click', leavePlay);
  $('to-map').addEventListener('click', function () { overlay.hidden = true; leavePlay(); });
  $('again').addEventListener('click', function () { var stage = run.stage; overlay.hidden = true; stopLoop(); startStage(stage, false); });
  $('next').addEventListener('click', function () {
    var next = KB.STAGES[run.stage.grade][run.stage.ordinal + 1];
    overlay.hidden = true; stopLoop(); startStage(next, false);
  });
  $('open-all').addEventListener('click', function () {
    KB.Storage.setOpenAll(!KB.Storage.isOpenAll());
    renderMap(mapGrade);
  });
  $('speak').addEventListener('click', function () {
    var q = KB.QuestionUI.currentQuestion();
    if (q) KB.Audio.speak(Q.speechText(q));
  });
  $('mute').addEventListener('click', function () {
    var next = !KB.Audio.isMuted();
    KB.Audio.setMuted(next);
    KB.Storage.setMuted(next);
    $('mute').textContent = next ? 'おと：なし' : 'おと：あり';
  });

  // ---------- 起動 ----------
  KB.QuestionUI.init({
    prompt: $('card-prompt'), stem: $('card-stem'), choices: $('card-choices'),
    actions: $('card-actions'), feedback: $('card-feedback')
  });
  KB.Audio.setMuted(KB.Storage.isMuted());
  $('mute').textContent = KB.Audio.isMuted() ? 'おと：なし' : 'おと：あり';
  if (KB.Api.isEnabled()) renderLogin(); else renderStart();
})();
