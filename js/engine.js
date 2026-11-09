/* ブロックくずしの物理と進行（DOMを触らない。見た目は render.js、音と通知は handlers 経由） */
(function () {
  var KB = (window.KB = window.KB || {});
  var C = KB.CONFIG;
  var s = null;        // 状態
  var handlers = {};   // { sound(name), roundEnded(reason), pictureCleared(info), feverDone() }

  function emit(name, a) { if (handlers[name]) handlers[name](a); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function rad(deg) { return deg * Math.PI / 180; }
  function multiplier() { return 1 + Math.min(s.streak, C.STREAK_CAP); }
  function center(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
  function aliveBricks() { return s.bricks.filter(function (b) { return b.alive; }); }

  // ---------- ブロックの組み立て ----------
  function buildBricks(picIndex, hpList) {
    var pic = KB.PICTURES[picIndex % KB.PICTURES.length];
    var step = C.BRICK_W + C.BRICK_GAP;
    var x0 = (C.W - (C.COLS * step - C.BRICK_GAP)) / 2;
    var list = [];
    pic.rows.forEach(function (row, r) {
      for (var col = 0; col < C.COLS; col++) {
        var ch = row.charAt(col);
        if (!ch || ch === '.') continue;
        var special = KB.SPECIAL[ch];
        var kind = special ? special.kind : 'n';
        list.push({
          x: x0 + col * step, y: C.BRICK_TOP + r * C.ROW_STEP, w: C.BRICK_W, h: C.BRICK_H,
          kind: kind, color: special ? special.color : KB.COLORS[ch],
          hp: kind === 'hard' ? C.HARD_HP : 1, alive: true
        });
      }
    });
    // セーブから もどす（数が合う時だけ。ぜんぶ こわれていたら あたらしく）
    if (hpList && hpList.length === list.length && hpList.some(function (hp) { return hp > 0; })) {
      list.forEach(function (b, i) { b.hp = hpList[i]; b.alive = hpList[i] > 0; });
    }
    return list;
  }

  function newStuckBall() {
    return { x: s.paddle.x + s.paddle.w / 2, y: C.PADDLE_Y - C.BALL_R, vx: 0, vy: 0, r: C.BALL_R, stuck: true };
  }

  // ---------- 開始・準備 ----------
  function reset(opts) {
    var tune = KB.GRADE_TUNING[opts.grade];
    s = {
      grade: opts.grade, tune: tune,
      bricks: [], balls: [], items: [], particles: [], floaters: [],
      paddle: { x: (C.W - tune.paddleW) / 2, w: tune.paddleW, wideUntil: 0 },
      speed: tune.baseSpeed, time: 0, phase: 'waiting',
      fireUntil: 0, pendingFire: false, streak: 0, points: opts.points || 0,
      picIndex: opts.picIndex || 0, shakeUntil: 0, shakeMag: 0,
      roundStart: 0, coins: 0, clearAt: 0, fever: null
    };
    s.bricks = buildBricks(s.picIndex, opts.bricksHp);
    s.balls = [newStuckBall()];
  }

  function prepareRound() {
    s.phase = 'waiting';
    s.speed = s.tune.baseSpeed;
    s.fireUntil = 0;
    s.pendingFire = false;
    s.balls = [newStuckBall()];
  }

  // 問題に こたえた ごほうび。streak は れんぞく せいかい数
  function grantLaunch(opts) {
    if (s.phase !== 'waiting') return;
    s.phase = 'ready';
    s.pendingFire = !!opts.fire;
    s.streak = opts.streak || 0;
  }

  function launch() {
    if (!s || s.phase !== 'ready') return false;
    s.phase = 'playing';
    s.roundStart = s.time;
    s.speed = s.tune.baseSpeed;
    var big = s.streak >= C.BIGBALL_STREAK;
    var radius = big ? C.BALL_R * C.BIG_BALL_SCALE : C.BALL_R;
    var count = 1 + (s.streak >= C.MULTIBALL_STREAK ? C.MULTIBALL_EXTRA : 0);
    var base = s.balls[0];
    var spread = rad(C.LAUNCH_SPREAD_DEG);
    s.balls = [];
    for (var i = 0; i < count; i++) {
      var angle = count === 1 ? rand(-spread, spread) : (i - (count - 1) / 2) * spread * 0.9;
      s.balls.push({
        x: base.x, y: base.y, r: radius, stuck: false,
        vx: s.speed * Math.sin(angle), vy: -s.speed * Math.cos(angle)
      });
    }
    if (s.pendingFire) s.fireUntil = s.time + C.FIRE_MS;
    emit('sound', 'launch');
    return true;
  }

  function movePaddleTo(x) {
    if (!s) return;
    s.paddle.x = clamp(x - s.paddle.w / 2, 0, C.W - s.paddle.w);
  }

  // ---------- 演出（粒・ふきだし・ゆれ） ----------
  function shake(mag) { s.shakeUntil = s.time + C.SHAKE_MS; s.shakeMag = mag; }

  function burst(x, y, color, count, power) {
    for (var i = 0; i < count; i++) {
      var ang = rand(0, Math.PI * 2), sp = rand(40, power);
      s.particles.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
        life: 0, max: rand(350, 700), color: color, size: rand(2, 5) });
    }
  }

  function floater(x, y, text, color) {
    s.floaters.push({ x: x, y: y, text: text, color: color || '#fff', life: 0, max: 800 });
  }

  // ---------- ブロックの破壊 ----------
  function damage(brick, source) {
    if (!brick.alive) return;
    brick.hp -= 1;
    if (brick.hp > 0) {
      var cc = center(brick);
      burst(cc.x, cc.y, '#ffffff', 5, 120);
      emit('sound', 'hard');
      return;
    }
    breakBrick(brick, source);
  }

  function breakBrick(brick, source) {
    if (!brick.alive) return;
    brick.alive = false;
    brick.hp = 0;
    var cc = center(brick);
    var base = brick.kind === 'n' ? C.POINT_BRICK : C.POINT_SPECIAL;
    var gained = base * multiplier();
    s.points += gained;
    burst(cc.x, cc.y, brick.color, 10, 220);
    floater(cc.x, cc.y, '+' + gained, '#ffffff');
    s.speed = Math.min(s.tune.baseSpeed * C.MAX_SPEED_RATIO, s.speed + C.SPEEDUP_PER_BRICK);
    emit('sound', 'break');

    if (brick.kind === 'bomb') {
      explode(cc.x, cc.y, C.BOMB_RADIUS);
    } else if (brick.kind === 'item') {
      spawnItem(cc.x, cc.y);
    } else if (brick.kind === 'star') {
      s.coins += 1;
      floater(cc.x, cc.y - 18, 'ほし！', '#FFC93C');
      emit('sound', 'star');
    }
    if (source === 'fire') {
      blast(cc.x, cc.y, C.BLAST_RADIUS + C.BLAST_PER_STREAK * Math.min(s.streak, C.STREAK_CAP));
    }
  }

  function explode(x, y, radius) {
    shake(C.SHAKE_BIG);
    emit('sound', 'bomb');
    burst(x, y, '#FF9F43', 18, 320);
    s.bricks.forEach(function (o) {
      if (!o.alive) return;
      var oc = center(o);
      if (Math.hypot(oc.x - x, oc.y - y) <= radius) breakBrick(o, 'bomb');
    });
  }

  function blast(x, y, radius) {
    burst(x, y, '#FFB56B', 8, 260);
    s.bricks.forEach(function (o) {
      if (!o.alive) return;
      var oc = center(o);
      if (Math.hypot(oc.x - x, oc.y - y) <= radius) damage(o, 'blast');
    });
  }

  function spawnItem(x, y) {
    var def = KB.ITEMS[Math.floor(Math.random() * KB.ITEMS.length)];
    s.items.push({ x: x - C.ITEM_W / 2, y: y, w: C.ITEM_W, h: C.ITEM_H, def: def });
  }

  function collectItem(item) {
    emit('sound', 'item');
    floater(item.x + item.w / 2, C.PADDLE_Y - 20, item.def.label + '！', item.def.color);
    if (item.def.id === 'wide') {
      s.paddle.wideUntil = s.time + C.WIDE_MS;
    } else if (item.def.id === 'multi' && s.phase === 'playing' && s.balls.length > 0) {
      var src = s.balls[0];
      for (var i = 0; i < C.MULTIBALL_EXTRA; i++) {
        var turn = (i === 0 ? 1 : -1) * rad(25);
        var cos = Math.cos(turn), sin = Math.sin(turn);
        s.balls.push({ x: src.x, y: src.y, r: src.r, stuck: false,
          vx: src.vx * cos - src.vy * sin, vy: src.vx * sin + src.vy * cos });
      }
    }
  }

  // ---------- ボールの移動と当たり判定 ----------
  function fixVelocity(b) {
    var sp = Math.hypot(b.vx, b.vy);
    if (sp === 0) return;
    var k = s.speed / sp;
    b.vx *= k; b.vy *= k;
    var minVy = C.MIN_VERTICAL_RATIO * s.speed;
    if (Math.abs(b.vy) < minVy) {
      b.vy = (b.vy < 0 ? -1 : 1) * minVy;
      var rest = Math.sqrt(Math.max(0, s.speed * s.speed - b.vy * b.vy));
      b.vx = (b.vx < 0 ? -1 : 1) * rest;
    }
  }

  function bounceOffBrick(b, brick, cx, cy) {
    var dx = b.x - cx, dy = b.y - cy;
    if (dx === 0 && dy === 0) { b.vy = -b.vy; return; }
    var insideX = b.x >= brick.x && b.x <= brick.x + brick.w;
    var insideY = b.y >= brick.y && b.y <= brick.y + brick.h;
    if (insideX) {
      b.vy = dy < 0 ? -Math.abs(b.vy) : Math.abs(b.vy);
      b.y = dy < 0 ? brick.y - b.r : brick.y + brick.h + b.r;
    } else if (insideY) {
      b.vx = dx < 0 ? -Math.abs(b.vx) : Math.abs(b.vx);
      b.x = dx < 0 ? brick.x - b.r : brick.x + brick.w + b.r;
    } else {
      var dist = Math.hypot(dx, dy), nx = dx / dist, ny = dy / dist;
      var dot = b.vx * nx + b.vy * ny;
      if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
      b.x = cx + nx * b.r; b.y = cy + ny * b.r;
    }
  }

  // false を返すと ボールが下に おちた
  function stepBall(b, h) {
    b.x += b.vx * h; b.y += b.vy * h;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); emit('sound', 'wall'); }
    else if (b.x > C.W - b.r) { b.x = C.W - b.r; b.vx = -Math.abs(b.vx); emit('sound', 'wall'); }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); emit('sound', 'wall'); }
    if (b.y > C.H + b.r) return false;

    var p = s.paddle;
    if (b.vy > 0 && b.y + b.r >= C.PADDLE_Y && b.y < C.PADDLE_Y + C.PADDLE_H * 0.6 &&
        b.x >= p.x - b.r && b.x <= p.x + p.w + b.r) {
      var rel = clamp((b.x - (p.x + p.w / 2)) / (p.w / 2), -1, 1);
      var ang = rel * rad(C.MAX_BOUNCE_DEG);
      b.vx = s.speed * Math.sin(ang);
      b.vy = -s.speed * Math.cos(ang);
      b.y = C.PADDLE_Y - b.r;
      emit('sound', 'paddle');
    }

    var fire = s.time < s.fireUntil;
    var bounced = false;
    for (var i = 0; i < s.bricks.length; i++) {
      var br = s.bricks[i];
      if (!br.alive) continue;
      var cx = clamp(b.x, br.x, br.x + br.w), cy = clamp(b.y, br.y, br.y + br.h);
      var dx = b.x - cx, dy = b.y - cy;
      if (dx * dx + dy * dy > b.r * b.r) continue;
      if (fire) {
        damage(br, 'fire');
      } else if (!bounced) {
        bounceOffBrick(b, br, cx, cy);
        bounced = true;
        damage(br, 'ball');
        break;
      }
    }
    fixVelocity(b);
    return true;
  }

  // ---------- 1フレーム ----------
  function update(dt) {
    if (!s) return;
    dt = Math.min(dt, C.MAX_FRAME_SEC);
    s.time += dt * 1000;

    // パドルの はば
    var targetW = s.time < s.paddle.wideUntil ? s.tune.paddleWideW : s.tune.paddleW;
    var center0 = s.paddle.x + s.paddle.w / 2;
    s.paddle.w += (targetW - s.paddle.w) * Math.min(1, dt * 10);
    s.paddle.x = clamp(center0 - s.paddle.w / 2, 0, C.W - s.paddle.w);

    if (s.phase === 'waiting' || s.phase === 'ready') {
      var held = s.balls[0];
      if (held) { held.x = s.paddle.x + s.paddle.w / 2; held.y = C.PADDLE_Y - held.r; }
    }

    if (s.phase === 'playing') updatePlaying(dt);
    updateItems(dt);
    updateEffects(dt);
    updatePictureClear();
    if (s.phase === 'fever') updateFever(dt);
  }

  function updatePlaying(dt) {
    var h = dt / C.SUBSTEPS;
    for (var step = 0; step < C.SUBSTEPS; step++) {
      s.balls = s.balls.filter(function (b) { return stepBall(b, h); });
      if (s.balls.length === 0) break;
    }
    if (s.balls.length === 0) { endRound('lost'); return; }
    if (s.time - s.roundStart > s.tune.roundMaxMs) { s.balls = []; endRound('timeout'); }
  }

  function endRound(reason) {
    s.phase = 'between';
    emit('roundEnded', reason);
  }

  function updateItems(dt) {
    var p = s.paddle;
    s.items = s.items.filter(function (it) {
      it.y += C.ITEM_FALL_SPEED * dt;
      var hit = it.y + it.h >= C.PADDLE_Y && it.y <= C.PADDLE_Y + C.PADDLE_H &&
                it.x + it.w >= p.x && it.x <= p.x + p.w;
      if (hit) { collectItem(it); return false; }
      return it.y < C.H;
    });
  }

  function updateEffects(dt) {
    s.particles = s.particles.filter(function (q) {
      q.life += dt * 1000;
      q.vy += 600 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      return q.life < q.max;
    });
    s.floaters = s.floaters.filter(function (f) {
      f.life += dt * 1000; f.y -= 30 * dt;
      return f.life < f.max;
    });
  }

  // 絵を ぜんぶ くずしたら ごほうび → すこし まって つぎの絵
  function updatePictureClear() {
    if (s.phase === 'fever' || s.phase === 'done') return;
    if (s.clearAt === 0 && aliveBricks().length === 0) {
      s.clearAt = s.time + C.CLEAR_DELAY_MS;
      s.points += C.POINT_PICTURE;
      shake(C.SHAKE_BIG);
      emit('sound', 'clear');
      emit('pictureCleared', { picIndex: s.picIndex, fever: false });
    } else if (s.clearAt !== 0 && s.time >= s.clearAt) {
      s.clearAt = 0;
      s.picIndex += 1;
      s.bricks = buildBricks(s.picIndex);
    }
  }

  // ---------- フィーバー（さいごに のこりを ぜんぶ くずす） ----------
  function startFever() {
    var left = aliveBricks();
    s.clearAt = 0;
    s.balls = [];
    if (left.length === 0) { s.phase = 'done'; emit('feverDone'); return; }
    left.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    s.phase = 'fever';
    s.fever = { queue: left, acc: 0 };
    emit('sound', 'fever');
  }

  function updateFever(dt) {
    var f = s.fever;
    f.acc += dt * 1000;
    while (f.acc >= C.FEVER_INTERVAL_MS && f.queue.length > 0) {
      f.acc -= C.FEVER_INTERVAL_MS;
      for (var i = 0; i < C.FEVER_PER_TICK && f.queue.length > 0; i++) breakBrick(f.queue.shift(), 'fever');
    }
    if (f.queue.length === 0 && aliveBricks().length === 0) {
      s.phase = 'done';
      s.points += C.POINT_PICTURE;
      emit('sound', 'clear');
      emit('pictureCleared', { picIndex: s.picIndex, fever: true });
      emit('feverDone');
    }
  }

  // セーブ用（ブロックの のこり）
  function snapshot() {
    return {
      bricks: s.bricks.map(function (b) { return b.alive ? b.hp : 0; }),
      picIndex: s.picIndex, points: s.points
    };
  }

  KB.Engine = {
    setHandlers: function (h) { handlers = h || {}; },
    reset: reset,
    prepareRound: prepareRound,
    grantLaunch: grantLaunch,
    launch: launch,
    update: update,
    startFever: startFever,
    movePaddleTo: movePaddleTo,
    snapshot: snapshot,
    getState: function () { return s; },
    isPhase: function (name) { return !!s && s.phase === name; }
  };
})();
