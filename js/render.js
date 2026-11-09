/* 描画だけを担当（状態は変えない）。draw(ctx, state, hud) と ずかん用の drawThumb */
(function () {
  var KB = (window.KB = window.KB || {});
  var C = KB.CONFIG;

  var STYLE = {
    bgTop: '#FFF6E5', bgBottom: '#FFE3C7',
    paddle: '#6C63FF', paddleShine: '#9A93FF',
    ball: '#ffffff', ballFire: '#FF7A1A', ballStroke: '#6C63FF',
    text: '#5A4632', hudFontPx: 18, messageFontPx: 26
  };

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function starPath(ctx, cx, cy, outer, inner) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawBrick(ctx, b) {
    var radius = 7;
    ctx.fillStyle = b.color;
    roundRectPath(ctx, b.x, b.y, b.w, b.h, radius);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRectPath(ctx, b.x + 3, b.y + 3, b.w - 6, 8, 4);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    roundRectPath(ctx, b.x, b.y, b.w, b.h, radius);
    ctx.stroke();

    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (b.kind === 'hard') {
      ctx.lineWidth = 3; ctx.strokeStyle = '#7B8597';
      roundRectPath(ctx, b.x + 2, b.y + 2, b.w - 4, b.h - 4, radius);
      ctx.stroke();
      if (b.hp < C.HARD_HP) {
        ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(cx - 10, b.y + 4); ctx.lineTo(cx - 2, cy); ctx.lineTo(cx - 8, b.y + b.h - 4);
        ctx.moveTo(cx + 6, b.y + 4); ctx.lineTo(cx + 12, cy + 2);
        ctx.stroke();
      }
    } else if (b.kind === 'bomb') {
      ctx.fillStyle = '#2B2B2B';
      ctx.beginPath(); ctx.arc(cx, cy + 2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#FFE08A'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + 4, cy - 5); ctx.lineTo(cx + 9, cy - 11); ctx.stroke();
    } else if (b.kind === 'item') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px ' + C.FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('？', cx, cy + 1);
    } else if (b.kind === 'star') {
      ctx.fillStyle = '#ffffff';
      starPath(ctx, cx, cy, 11, 5); ctx.fill();
    }
  }

  function drawItem(ctx, it) {
    ctx.fillStyle = it.def.color;
    roundRectPath(ctx, it.x, it.y, it.w, it.h, 14); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px ' + C.FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.def.label, it.x + it.w / 2, it.y + it.h / 2 + 1);
  }

  function drawBall(ctx, b, fire) {
    if (fire) {
      var glow = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.r * 3);
      glow.addColorStop(0, 'rgba(255,140,40,0.85)');
      glow.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = fire ? STYLE.ballFire : STYLE.ball;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = STYLE.ballStroke; ctx.stroke();
  }

  function drawPaddle(ctx, p) {
    ctx.fillStyle = STYLE.paddle;
    roundRectPath(ctx, p.x, C.PADDLE_Y, p.w, C.PADDLE_H, 8); ctx.fill();
    ctx.fillStyle = STYLE.paddleShine;
    roundRectPath(ctx, p.x + 4, C.PADDLE_Y + 3, p.w - 8, 4, 2); ctx.fill();
  }

  function drawText(ctx, text, x, y, px, color, align) {
    ctx.font = 'bold ' + px + 'px ' + C.FONT;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawHud(ctx, s) {
    drawText(ctx, 'スコア ' + s.points, 12, 22, STYLE.hudFontPx, STYLE.text, 'left');
    if (s.streak > 0) drawText(ctx, 'れんぞく ' + s.streak + '  ×' + (1 + Math.min(s.streak, C.STREAK_CAP)), C.W - 12, 22, STYLE.hudFontPx, '#E5484D', 'right');
    if (s.time < s.fireUntil) {
      var ratio = (s.fireUntil - s.time) / C.FIRE_MS;
      ctx.fillStyle = 'rgba(255,122,26,0.25)'; ctx.fillRect(12, 38, 120, 6);
      ctx.fillStyle = STYLE.ballFire; ctx.fillRect(12, 38, 120 * ratio, 6);
    }
  }

  function messageFor(s, hud) {
    if (hud && hud.message) return hud.message;
    if (s.phase === 'waiting') return 'もんだいに こたえよう！';
    if (s.phase === 'ready') return s.pendingFire ? 'ファイヤー！ タップで はっしゃ！' : 'タップで はっしゃ！';
    if (s.phase === 'fever') return 'フィーバー！';
    return '';
  }

  function draw(ctx, s, hud) {
    ctx.save();
    var bg = ctx.createLinearGradient(0, 0, 0, C.H);
    bg.addColorStop(0, STYLE.bgTop); bg.addColorStop(1, STYLE.bgBottom);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, C.W, C.H);

    if (s.time < s.shakeUntil) {
      ctx.translate((Math.random() - 0.5) * s.shakeMag * 2, (Math.random() - 0.5) * s.shakeMag * 2);
    }
    s.bricks.forEach(function (b) { if (b.alive) drawBrick(ctx, b); });
    s.items.forEach(function (it) { drawItem(ctx, it); });
    drawPaddle(ctx, s.paddle);
    var fire = s.time < s.fireUntil || (s.phase === 'ready' && s.pendingFire);
    s.balls.forEach(function (b) { drawBall(ctx, b, fire); });

    s.particles.forEach(function (q) {
      ctx.globalAlpha = Math.max(0, 1 - q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    });
    ctx.globalAlpha = 1;
    s.floaters.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, 1 - f.life / f.max);
      drawText(ctx, f.text, f.x, f.y, 16, f.color === '#ffffff' ? STYLE.text : f.color);
    });
    ctx.globalAlpha = 1;

    drawHud(ctx, s);
    var msg = messageFor(s, hud);
    if (msg) {
      var pulse = s.phase === 'ready' ? 1 + Math.sin(s.time / 150) * 0.05 : 1;
      drawText(ctx, msg, C.W / 2, C.H * 0.58, Math.round(STYLE.messageFontPx * pulse), '#6C63FF');
    }
    ctx.restore();
  }

  // ずかん・結果画面用に、絵を小さく描く（found=false なら シルエット）
  function drawThumb(canvas, picture, found) {
    var cx = canvas.getContext('2d');
    var cell = Math.floor(canvas.width / C.COLS);
    cx.clearRect(0, 0, canvas.width, canvas.height);
    picture.rows.forEach(function (row, r) {
      for (var col = 0; col < C.COLS; col++) {
        var ch = row.charAt(col);
        if (!ch || ch === '.') continue;
        var special = KB.SPECIAL[ch];
        cx.fillStyle = found ? (special ? special.color : KB.COLORS[ch]) : '#D8D2C8';
        cx.fillRect(col * cell + 1, r * cell + 1, cell - 2, cell - 2);
      }
    });
  }

  KB.Render = { draw: draw, drawThumb: drawThumb };
})();
