/* ステージ定義（東京書籍「新編 新しい国語」の ことばの単元に そった構成）と、問題IDの引き当て */
(function () {
  var KB = window.KB, Q = KB.Q;

  var G1_ALL = ['g1-dakuten', 'g1-bun', 'g1-ha', 'g1-wo-he', 'g1-tsu', 'g1-nobasu', 'g1-ishiya',
    'g1-katakana-find', 'g1-katakana-katachi', 'g1-hizuke', 'g1-matome', 'g1-kanji'];

  // pools: 使う問題プール / count: 出す問題数（なければ全部）/ mix: true なら ランダムに選ぶ
  function stage(id, title, sub, pools, opts) {
    opts = opts || {};
    return { id: id, title: title, sub: sub, pools: pools, count: opts.count || 0, mix: !!opts.mix };
  }

  KB.CHAPTERS = {
    1: [
      { title: '1がっき', stages: [
        stage('g1-01', 'だくおん・はんだくおん', 'てんてん と まる', ['g1-dakuten']),
        stage('g1-02', 'ぶんを つくろう', 'ことばを ならべる', ['g1-bun']),
        stage('g1-03', '「は」の つかいかた', 'わ と かく は', ['g1-ha']),
        stage('g1-04', '「を」と「へ」', 'お と え の かきかた', ['g1-wo-he']),
        stage('g1-05', 'ちいさい「っ」', 'つまる おと', ['g1-tsu']),
        stage('g1-06', 'のばす おん', 'おとうさん・おねえさん', ['g1-nobasu']),
        stage('g1-07', 'ちいさい「ゃゅょ」', 'しゃ・しゅ・しょ', ['g1-ishiya']),
        stage('g1-08', '1がっきの まとめ', 'ここまでの ふくしゅう', ['g1-matome'])
      ] },
      { title: '2がっき', stages: [
        stage('g1-09', 'かたかなで かく ことば', 'バス・テレビ', ['g1-katakana-find']),
        stage('g1-10', 'かたかなの かたち', 'ア・イ・ウ', ['g1-katakana-katachi'])
      ] },
      { title: '3がっき', stages: [
        stage('g1-11', 'ひづけと ようび', 'ついたち・ふつか', ['g1-hizuke']),
        stage('g1-12', 'かんじの よみかた', 'やま・かわ・いぬ', ['g1-kanji'])
      ] }
    ],
    2: [
      { title: '1年の ふくしゅう', stages: [
        stage('g2-01', 'ふくしゅう① おとの きまり', 'てんてん・っ・のばす', ['g1-dakuten', 'g1-tsu', 'g1-nobasu'], { count: 6, mix: true }),
        stage('g2-02', 'ふくしゅう② は・を・へ', 'つかいかた', ['g1-ha', 'g1-wo-he'], { count: 6, mix: true }),
        stage('g2-03', 'ふくしゅう③ ぶんを つくる', 'ことばの じゅんばん', ['g1-bun']),
        stage('g2-04', 'ふくしゅう④ ゃゅょ・かたかな', 'ちいさい もじ', ['g1-ishiya', 'g1-katakana-find', 'g1-katakana-katachi'], { count: 6, mix: true }),
        stage('g2-05', 'ふくしゅう⑤ ひづけ・かんじ', 'ようび・よみかた', ['g1-hizuke', 'g1-kanji'], { count: 6, mix: true }),
        stage('g2-06', '1年の まとめ', 'ぜんぶ ふくしゅう', G1_ALL, { count: 10, mix: true })
      ] },
      { title: 'かたかな', stages: [
        stage('g2-07', 'かたかなの ことば', 'ー・ッ・がいこくの ことば', ['g2-katakana']),
        stage('g2-08', 'かたかなの まとめ', 'かたかな ぜんぶ', ['g2-katakana', 'g1-katakana-find', 'g1-katakana-katachi'], { count: 8, mix: true })
      ] },
      { title: 'ことばの はたらき', stages: [
        stage('g2-09', 'ものの なまえ', 'ひと・もの・ばしょ', ['g2-mono']),
        stage('g2-10', 'しゅごと じゅつご', 'だれが どうする', ['g2-shugo']),
        stage('g2-11', 'なかまの ことば', 'くだもの・どうぶつ', ['g2-nakama']),
        stage('g2-12', 'うごきの ことば', 'どうする', ['g2-ugoki']),
        stage('g2-13', 'ことばの はたらき まとめ', 'ここまでの ふくしゅう', ['g2-mono', 'g2-shugo', 'g2-nakama', 'g2-ugoki'], { count: 8, mix: true })
      ] },
      { title: 'ことばの いみ', stages: [
        stage('g2-14', 'かんじの よみかた', '2年の かんじ', ['g2-yomi']),
        stage('g2-15', 'はんたいの ことば', 'おおきい⇔ちいさい', ['g2-hantai']),
        stage('g2-16', 'にた いみの ことば', 'きれい・うつくしい', ['g2-nitai']),
        stage('g2-17', 'ことばの いみ まとめ', '2年の しあげ', ['g2-yomi', 'g2-hantai', 'g2-nitai'], { count: 8, mix: true })
      ] }
    ]
  };

  // 学年ごとの ステージ一覧（章の番号つき）
  KB.STAGES = {};
  [1, 2].forEach(function (grade) {
    var list = [];
    KB.CHAPTERS[grade].forEach(function (chapter, chapterIndex) {
      chapter.stages.forEach(function (s) {
        s.grade = grade; s.chapterIndex = chapterIndex; s.ordinal = list.length;
        list.push(s);
      });
    });
    KB.STAGES[grade] = list;
  });

  KB.findStage = function (stageId) {
    var found = null;
    [1, 2].forEach(function (g) {
      KB.STAGES[g].forEach(function (s) { if (s.id === stageId) found = s; });
    });
    return found;
  };

  // 問題ID（"プールID:番号"）から 問題を取り出す
  KB.getQuestion = function (qid) {
    var parts = qid.split(':');
    var pool = KB.POOLS[parts[0]];
    return pool ? pool.questions[Number(parts[1])] : null;
  };

  // ステージで出す問題IDのならび
  KB.buildQuestionIds = function (stage) {
    var ids = [];
    stage.pools.forEach(function (poolId) {
      KB.POOLS[poolId].questions.forEach(function (_, i) { ids.push(poolId + ':' + i); });
    });
    if (stage.mix) ids = Q.shuffle(ids);
    if (stage.count && stage.count < ids.length) ids = ids.slice(0, stage.count);
    return ids;
  };

  // 最初に出す絵（ステージごとに かわる）
  KB.pictureIndexFor = function (stage) { return stage.ordinal % KB.PICTURES.length; };
})();
