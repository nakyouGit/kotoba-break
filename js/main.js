/* 画面の切りかえ・ステージの流れ・セーブ・結果画面 */
(function () {
  var KB = window.KB, C = KB.CONFIG, Q = KB.Q;
  var $ = function (id) { return document.getElementById(id); };

  var screens = { start: $('screen-start'), map: $('screen-map'), play: $('screen-play') };
  var canvas = $('c'), ctx = canvas.getContext('2d');
  var overlay = $('overlay');

  var run = null;         // 今あそんでいる ステージの状態
  var loopId = 0, lastTs = 0;
  var mapGrade = 1;

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
      pictures: run.pictures, originalCount: run.originalCount,
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
  $('map-back').addEventListener('click', renderStart);
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
  renderStart();
})();
