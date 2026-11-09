/* 問題の4つの形式と、問題プールの登録 */
(function () {
  var KB = (window.KB = window.KB || {});
  var Q = (KB.Q = {});
  KB.POOLS = {};

  // 「主語」「述語」の問いかけ（ふりがな付き）
  KB.ASK = {
    subject: {
      html: '<ruby>主語<rt>しゅご</rt></ruby>（「だれが」「なにが」）に あたる ことばを さわろう',
      speech: 'しゅごに あたる ことばを さわろう。「だれが」「なにが」に あたる ことばだよ。'
    },
    predicate: {
      html: 'じゅつ<ruby>語<rt>ご</rt></ruby>（「どうする」「どんなだ」）に あたる ことばを さわろう',
      speech: 'じゅつごに あたる ことばを さわろう。「どうする」に あたる ことばだよ。'
    }
  };

  // 文のなかの ことばが どんな はたらきかの 説明
  KB.WORD_NOTES = {
    'ねこが': '「ねこが」は「だれが」にあたる、主語だよ。',
    'ねる': '「ねる」は「どうする」にあたる、じゅつ語だよ。',
    'まどで': '「まどで」は「どこで」をくわしくする ことばだよ。',
    'いぬが': '「いぬが」は「だれが」にあたる、主語だよ。',
    'はしる': '「はしる」は「どうする」にあたる、じゅつ語だよ。',
    'ぼくは': '「ぼくは」は「だれが」にあたる、主語だよ。',
    'こうえんへ': '「こうえんへ」は「どこへ」をくわしくする ことばだよ。',
    'いく': '「いく」は「どうする」にあたる、じゅつ語だよ。',
    'はなが': '「はなが」は「なにが」にあたる、主語だよ。',
    'きれいに': '「きれいに」は「どんなふうに」をくわしくする ことばだよ。',
    'さく': '「さく」は「どうする」にあたる、じゅつ語だよ。',
    'おとうとが': '「おとうとが」は「だれが」にあたる、主語だよ。',
    'ごはんを': '「ごはんを」は「なにを」をくわしくする ことばだよ。',
    'たべる': '「たべる」は「どうする」にあたる、じゅつ語だよ。',
    'おおきな': '「おおきな」は「どんな」をくわしくする ことばだよ。',
    'げんきに': '「げんきに」は「どんなふうに」をくわしくする ことばだよ。',
    'ことりが': '「ことりが」は「だれが」にあたる、主語だよ。',
    'たかい': '「たかい」は「どんな」をくわしくする ことばだよ。',
    'きに': '「きに」は「どこに」をくわしくする ことばだよ。',
    'とまる': '「とまる」は「どうする」にあたる、じゅつ語だよ。'
  };

  // ---- 問題の作り方 ----
  Q.choose = function (prompt, stem, choices, answer, note) {
    return { type: 'choose', prompt: prompt, stem: stem || '', choices: choices, answer: answer, note: note || '' };
  };
  Q.collect = function (prompt, choices, answers, note) {
    return { type: 'collect', prompt: prompt, choices: choices, answers: answers, note: note || '' };
  };
  Q.order = function (prompt, pieces, note) {
    return { type: 'order', prompt: prompt, pieces: pieces, note: note || '' };
  };
  Q.point = function (words, target, ask) {
    return { type: 'point', prompt: KB.ASK[ask].speech, promptHtml: KB.ASK[ask].html, words: words, target: target, ask: ask, note: '' };
  };
  Q.definePool = function (id, title, questions) {
    KB.POOLS[id] = { id: id, title: title, questions: questions };
  };

  // ---- ユーティリティ ----
  Q.shuffle = function (list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  // まちがえた時に出すヒント（さわった ことばの説明があれば それを優先）
  Q.noteFor = function (q, tappedWord) {
    if (q.type === 'point' && tappedWord && KB.WORD_NOTES[tappedWord]) return KB.WORD_NOTES[tappedWord];
    if (q.type === 'point') return KB.WORD_NOTES[q.words[q.target]] || '';
    return q.note;
  };

  // 読み上げ用テキスト
  Q.speechText = function (q) {
    var parts = [q.prompt];
    if (q.stem) parts.push(q.stem);
    if (q.type === 'point') parts.push(q.words.join('、'));
    else if (q.type === 'order') parts.push(q.pieces.join('、'));
    else parts.push(q.choices.join('、'));
    return parts.join('。 ');
  };

  // データの正しさを調べる（開発用。問題が壊れていたら文字列で返す）
  Q.validate = function (q) {
    var problems = [];
    var unique = function (list) { return list.every(function (v, i) { return list.indexOf(v) === i; }); };
    if (!q.prompt) problems.push('prompt なし');
    if (q.type === 'choose') {
      if (!q.choices || q.choices.length < 2) problems.push('choices が少ない');
      else {
        if (q.choices.indexOf(q.answer) < 0) problems.push('answer が choices にない');
        if (!unique(q.choices)) problems.push('choices が重複');
      }
    } else if (q.type === 'collect') {
      if (!q.answers || q.answers.length < 1) problems.push('answers なし');
      else if (!q.answers.every(function (a) { return q.choices.indexOf(a) >= 0; })) problems.push('answers が choices にない');
      if (q.choices.length <= q.answers.length) problems.push('まちがい選択肢がない');
      if (!unique(q.choices)) problems.push('choices が重複');
    } else if (q.type === 'order') {
      if (!q.pieces || q.pieces.length < 2) problems.push('pieces が少ない');
      else if (!unique(q.pieces)) problems.push('pieces が重複');
    } else if (q.type === 'point') {
      if (!q.words || q.target < 0 || q.target >= q.words.length) problems.push('target が範囲外');
      if (!KB.ASK[q.ask]) problems.push('ask が不明');
      if (!KB.WORD_NOTES[q.words && q.words[q.target]]) problems.push('target の説明なし');
    } else {
      problems.push('type が不明: ' + q.type);
    }
    return problems;
  };
})();
