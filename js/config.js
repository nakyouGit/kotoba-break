/* 設定値はすべてここに集約する（マジックナンバーをほかのファイルに書かない） */
(function () {
  var KB = (window.KB = window.KB || {});

  KB.CONFIG = {
    // 画面（縦長 3:4）
    W: 540, H: 720,
    PADDLE_H: 16, PADDLE_Y: 676,
    // ボール
    BALL_R: 9, BIG_BALL_SCALE: 1.8,
    MAX_SPEED_RATIO: 1.8, SPEEDUP_PER_BRICK: 3,
    MIN_VERTICAL_RATIO: 0.28, MAX_BOUNCE_DEG: 60, LAUNCH_SPREAD_DEG: 20,
    SUBSTEPS: 3, MAX_FRAME_SEC: 0.033,
    // ごほうび
    FIRE_MS: 6000, BLAST_RADIUS: 80, BLAST_PER_STREAK: 14, BOMB_RADIUS: 70,
    STREAK_CAP: 5, MULTIBALL_STREAK: 3, MULTIBALL_EXTRA: 2, BIGBALL_STREAK: 5,
    WIDE_MS: 9000,
    // アイテム
    ITEM_FALL_SPEED: 170, ITEM_W: 90, ITEM_H: 28,
    // 点数
    POINT_BRICK: 10, POINT_SPECIAL: 30, POINT_PICTURE: 300,
    // フィーバー・演出
    FEVER_INTERVAL_MS: 40, FEVER_PER_TICK: 3, CLEAR_DELAY_MS: 700,
    NEXT_QUESTION_DELAY_MS: 500, ANSWER_DONE_DELAY_MS: 450,
    SHAKE_MS: 160, SHAKE_SMALL: 3, SHAKE_BIG: 8,
    // ブロック配置
    COLS: 8, BRICK_W: 56, BRICK_H: 30, BRICK_GAP: 6, BRICK_TOP: 56, ROW_STEP: 38,
    HARD_HP: 2,
    // 星の判定（1かいめで せいかい した わりあい）
    STAR3_RATIO: 0.9, STAR2_RATIO: 0.7,
    // 保存
    STORAGE_KEY: 'kotoba-break-v1',
    // ガス（サーバー）との連携。URLを入れると、学年・組・出席番号のログインと記録の送信が有効になる。
    // 空のままなら、ログインなしで この端末だけに保存して あそべる。
    API_URL: '',
    API_TIMEOUT_MS: 8000,
    PENDING_KEY: 'kotoba-break-pending',
    DEFAULT_CLASS_COUNT: 5,
    MAX_NUMBER: 40,
    GRADE_LIST: [1, 2],
    FONT: "'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', 'Yu Gothic', sans-serif"
  };

  // 学年ごとの調整（2年は少しはやく、ちょっとせまい）
  KB.GRADE_TUNING = {
    1: { baseSpeed: 280, paddleW: 150, paddleWideW: 220, roundMaxMs: 18000 },
    2: { baseSpeed: 320, paddleW: 130, paddleWideW: 200, roundMaxMs: 15000 }
  };

  KB.COLORS = { o: '#FFB56B', y: '#FFD66B', p: '#FF8FA3', b: '#7FB8F5', g: '#8AD7A0', w: '#F4F1EA' };
  // 特別ブロックの文字 → 種類と色
  KB.SPECIAL = {
    H: { kind: 'hard', color: '#C9D1DE' },
    B: { kind: 'bomb', color: '#E5484D' },
    I: { kind: 'item', color: '#7FB8F5' },
    S: { kind: 'star', color: '#FFC93C' }
  };
  KB.ITEMS = [
    { id: 'wide', label: 'のびる', color: '#8AD7A0' },
    { id: 'multi', label: 'ふえる', color: '#FF8FA3' }
  ];
  KB.STAR_TEXT = { full: '★', empty: '☆' };
})();
