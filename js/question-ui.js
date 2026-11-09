/* 問題カード（DOM）。4つの形式を表示して、せいかいで onDone({firstTry}) を呼ぶ */
(function () {
  var KB = (window.KB = window.KB || {});
  var Q = KB.Q;
  var C = KB.CONFIG;
  var root = {};
  var current = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function init(elements) { root = elements; }

  function setFeedback(text, kind) {
    root.feedback.textContent = text || '';
    root.feedback.className = 'feedback' + (kind ? ' ' + kind : '');
  }

  function reset() {
    root.prompt.textContent = '';
    root.stem.textContent = '';
    root.choices.textContent = '';
    root.actions.textContent = '';
    setFeedback('', '');
  }

  function lockAll() {
    Array.prototype.forEach.call(root.choices.querySelectorAll('button'), function (b) { b.disabled = true; });
    root.actions.textContent = '';
  }

  // せいかい：理由を見せて、すこし まってから つぎへ
  function finish() {
    if (!current || current.done) return;
    current.done = true;
    lockAll();
    KB.Audio.play(current.wrong ? 'ok' : 'correct');
    var note = Q.noteFor(current.q, null);
    setFeedback((current.wrong ? 'せいかい！ ' : 'せいかい！ すごい！ ') + note, 'ok');
    var done = current.onDone, firstTry = !current.wrong;
    setTimeout(function () { done({ firstTry: firstTry }); }, C.ANSWER_DONE_DELAY_MS);
  }

  // まちがい：理由を出して、もういちど えらばせる
  function miss(tappedWord) {
    current.wrong = true;
    KB.Audio.play('wrong');
    setFeedback('ざんねん！ ' + Q.noteFor(current.q, tappedWord) + ' もういちど えらぼう。', 'ng');
  }

  function showChoose(q) {
    Q.shuffle(q.choices).forEach(function (text) {
      var btn = el('button', 'choice', text);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        if (current.done) return;
        if (text === q.answer) { btn.classList.add('ok'); finish(); }
        else { btn.classList.add('ng'); btn.disabled = true; miss(text); }
      });
      root.choices.appendChild(btn);
    });
  }

  function showCollect(q) {
    var buttons = [];
    Q.shuffle(q.choices).forEach(function (text) {
      var btn = el('button', 'choice', text);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        if (current.done) return;
        btn.classList.toggle('sel');
      });
      buttons.push(btn);
      root.choices.appendChild(btn);
    });
    var decide = el('button', 'action-btn', 'これで きまり！');
    decide.type = 'button';
    decide.addEventListener('click', function () {
      if (current.done) return;
      var chosen = buttons.filter(function (b) { return b.classList.contains('sel'); }).map(function (b) { return b.textContent; });
      if (chosen.length === 0) { setFeedback('ぜんぶ えらんでから おしてね。', ''); return; }
      var wrongOnes = chosen.filter(function (t) { return q.answers.indexOf(t) < 0; });
      var missing = q.answers.filter(function (t) { return chosen.indexOf(t) < 0; });
      if (wrongOnes.length === 0 && missing.length === 0) {
        buttons.forEach(function (b) { if (b.classList.contains('sel')) b.classList.add('ok'); });
        finish();
        return;
      }
      // まちがった ものだけ はずす（せいかいの ものは のこす）
      buttons.forEach(function (b) {
        if (wrongOnes.indexOf(b.textContent) >= 0) { b.classList.remove('sel'); b.classList.add('ng'); b.disabled = true; }
      });
      miss(null);
    });
    root.actions.appendChild(decide);
  }

  function showOrder(q) {
    var answerLine = el('div', 'order-line');
    var bank = el('div', 'order-bank');
    root.choices.appendChild(answerLine);
    root.choices.appendChild(bank);

    var shuffled = Q.shuffle(q.pieces);
    for (var tries = 0; tries < 10 && shuffled.join('|') === q.pieces.join('|'); tries++) shuffled = Q.shuffle(q.pieces);

    var chosen = []; // 選んだ順の ことば
    var bankButtons = {};

    function refresh() {
      answerLine.textContent = '';
      chosen.forEach(function (text) {
        var piece = el('button', 'choice picked', text);
        piece.type = 'button';
        piece.addEventListener('click', function () {
          if (current.done) return;
          chosen.splice(chosen.indexOf(text), 1);
          refresh();
        });
        answerLine.appendChild(piece);
      });
      Object.keys(bankButtons).forEach(function (text) {
        bankButtons[text].classList.toggle('used', chosen.indexOf(text) >= 0);
      });
    }

    function check() {
      if (chosen.join('|') === q.pieces.join('|')) {
        Array.prototype.forEach.call(answerLine.children, function (b) { b.classList.add('ok'); });
        finish();
      } else {
        Array.prototype.forEach.call(answerLine.children, function (b) { b.classList.add('ng'); });
        miss(null);
        setTimeout(function () { if (!current.done) { chosen = []; refresh(); } }, 700);
      }
    }

    shuffled.forEach(function (text) {
      var btn = el('button', 'choice', text);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        if (current.done || chosen.indexOf(text) >= 0) return;
        chosen.push(text);
        refresh();
        if (chosen.length === q.pieces.length) check();
      });
      bankButtons[text] = btn;
      bank.appendChild(btn);
    });
    refresh();
  }

  function showPoint(q) {
    var row = el('div', 'word-row');
    q.words.forEach(function (word, index) {
      var btn = el('button', 'choice word', word);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        if (current.done) return;
        if (index === q.target) { btn.classList.add('ok'); finish(); }
        else { btn.classList.add('ng'); btn.disabled = true; miss(word); }
      });
      row.appendChild(btn);
    });
    root.choices.appendChild(row);
  }

  function show(q, onDone) {
    reset();
    current = { q: q, wrong: false, done: false, onDone: onDone };
    if (q.promptHtml) root.prompt.innerHTML = q.promptHtml; else root.prompt.textContent = q.prompt;
    root.stem.textContent = q.stem || '';
    if (q.type === 'choose') showChoose(q);
    else if (q.type === 'collect') showCollect(q);
    else if (q.type === 'order') showOrder(q);
    else if (q.type === 'point') showPoint(q);
  }

  // 答えたあとの 案内文（カードの下の ひとこと）
  function note(text) { root.feedback.textContent += '\n' + text; }

  function clear() { reset(); current = null; }

  function currentQuestion() { return current ? current.q : null; }

  KB.QuestionUI = { init: init, show: show, note: note, clear: clear, currentQuestion: currentQuestion };
})();
