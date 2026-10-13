/*
 * Homepage interactions: typewriter title block, revision history,
 * the reading-depth chart (Fig. 2), and the little 8-bit author who hops
 * between headings and boxes (the `data-plat` elements) as you scroll.
 *
 * The revision text lives in the <script id="revisions"> block in
 * index.html. Set either option below to false to turn that piece off.
 */
(function () {
  'use strict';

  var OPTIONS = {
    typeOnLoad: true, // type the title block in on page load
    author: true      // show the 8-bit author
  };

  var TICK_MS = 30;
  var BARS = 40;

  function init() {
    var root = document.querySelector('[data-report-root]');
    var dataEl = document.getElementById('revisions');
    if (!root || !dataEl) return;

    var REVS = JSON.parse(dataEl.textContent);
    var CURRENT = REVS.length - 1;
    var NAME = root.querySelector('[data-type="name"]').textContent;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var state = { rev: CURRENT, clk: 0, retype: false, samples: [], maxDepth: 0 };
    var t0 = Date.now();

    function q(sel) { return root.querySelector(sel); }
    function qa(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
    function bind(key, text) { qa('[data-bind="' + key + '"]').forEach(function (el) { el.textContent = text; }); }

    // One button per revision, one div per chart bar.
    var btnWrap = q('[data-rev-buttons]');
    REVS.forEach(function (r, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-rev', String(i));
      b.textContent = r.tag + ' · ' + r.stage;
      btnWrap.appendChild(b);
    });
    var chartEl = q('[data-depth-chart]');
    for (var i = 0; i < BARS; i++) chartEl.appendChild(document.createElement('div'));
    document.getElementById('tr-rev').max = String(CURRENT);

    var el = {
      name: q('[data-type="name"]'),
      abstract: q('[data-type="abstract"]'),
      absGhost: q('[data-ghost="abstract"]'),
      caretAbs: q('[data-caret="abstract"]'),
      stampCurrent: q('[data-stamp="current"]'),
      stampOld: q('[data-stamp="old"]'),
      slider: document.getElementById('tr-rev'),
      buttons: qa('[data-rev]'),
      chart: q('[data-depth-chart]'),
      photo: q('[data-photo]'),
      canvas: q('[data-sprite]')
    };
    var bars = el.chart ? Array.prototype.slice.call(el.chart.children) : [];

    /* ---------- typing engine ---------- */

    function isText(op) { return op.text != null; }

    function fullText(ops) {
      return ops.map(function (op) { return isText(op) ? op.text : op.right; }).join('');
    }

    function plan(rev, retype) {
      var R = REVS[rev];
      var sp = retype ? { abs: 7 } : { abs: 3.5 };
      var nameStart = 8;
      var nameEnd = retype ? 0 : nameStart + NAME.length;
      var absStart = nameEnd + (retype ? 2 : 10);
      var absEnd = absStart + Math.ceil(R.abstract.length / sp.abs);
      return { R: R, sp: sp, retype: retype, nameStart: nameStart, absStart: absStart, end: absEnd };
    }

    function renderTyping() {
      var p = plan(state.rev, state.retype);
      var R = p.R;
      var clk = state.clk;
      function prog(start, speed) { return Math.max(0, Math.floor((clk - start) * speed)); }

      var nameN = p.retype ? Infinity : prog(p.nameStart, 1);
      var absN = prog(p.absStart, p.sp.abs);
      var nameDone = nameN >= NAME.length;
      var absDone = absN >= R.abstract.length;

      el.name.textContent = NAME.slice(0, nameN);
      el.abstract.textContent = R.abstract.slice(0, absN);

      el.caretAbs.hidden = !(nameDone && !absDone);
    }

    function renderRev() {
      var R = REVS[state.rev];
      var sub = fullText(R.subtitle);
      bind('tag', R.tag);
      bind('year', R.year);
      bind('author', R.author);
      bind('affiliation', R.affiliation);
      bind('keywords', R.keywords);
      bind('caption', R.caption || '');
      bind('sub', sub);
      bind('abstract', R.abstract);
      el.absGhost.textContent = R.abstract + '_';
      if (el.photo && R.photo) {
        el.photo.src = R.photo;
        el.photo.alt = R.photoAlt || '';
      }
      el.stampCurrent.hidden = state.rev !== CURRENT;
      el.stampOld.hidden = state.rev === CURRENT;
      if (el.slider) {
        el.slider.value = String(state.rev);
        el.slider.setAttribute('aria-valuetext', R.tag + ', ' + R.stage);
      }
      el.buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', Number(b.getAttribute('data-rev')) === state.rev ? 'true' : 'false');
      });
    }

    var typer = null;

    function startTyping() {
      clearInterval(typer);
      if (reduce || !OPTIONS.typeOnLoad) {
        state.clk = 1e7;
        renderTyping();
        return;
      }
      renderTyping();
      typer = setInterval(function () {
        var p = plan(state.rev, state.retype);
        if (state.clk >= p.end) { clearInterval(typer); return; }
        state.clk += 1;
        renderTyping();
      }, TICK_MS);
    }

    function setRev(r) {
      if (r === state.rev || !REVS[r]) return;
      state.rev = r;
      state.clk = 0;
      state.retype = true;
      changePuff();
      renderRev();
      startTyping();
    }

    if (el.slider) el.slider.addEventListener('input', function () { setRev(Number(el.slider.value)); });
    el.buttons.forEach(function (b) {
      b.addEventListener('click', function () { setRev(Number(b.getAttribute('data-rev'))); });
    });

    /* ---------- Fig. 2: reading depth ---------- */

    function pct(v) { return Math.round((v || 0) * 100) + '%'; }

    function sampleDepth() {
      // 0 at the top of the page, 1 once scrolled all the way to the bottom
      // (or if the whole page fits on screen).
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      var d = maxScroll > 0 ? Math.max(0, Math.min(1, window.scrollY / maxScroll)) : 1;
      state.samples = state.samples.concat([d]).slice(-BARS);
      state.maxDepth = Math.max(state.maxDepth, d);

      var s = state.samples;
      bars.forEach(function (bar, i) {
        var v = s[i - (BARS - s.length)];
        bar.style.height = v == null ? '0%' : Math.round(v * 100) + '%';
      });

      var secs = Math.round((Date.now() - t0) / 1000);
      var now = pct(s[s.length - 1]);
      bind('depthNow', now);
      bind('depthMax', pct(state.maxDepth));
      bind('elapsed', secs >= 60 ? Math.floor(secs / 60) + ' min ' + (secs % 60) + ' s' : secs + ' s');
      if (el.chart) {
        el.chart.setAttribute('aria-label', 'Bar chart of how far down this page you have read over the last 40 seconds; currently ' + now + '.');
      }
    }

    /* ---------- 8-bit author ---------- */

    var hero = null;
    var bits = [];
    var lastScroll = 0;

    function origin() {
      var r = root.getBoundingClientRect();
      return { x: r.left, y: r.top };
    }

    /*
     * Surfaces the author can stand on. A plain `data-plat` element is a box
     * with a drawn top edge (tilted if the box is rotated); `data-plat="text"`
     * means the tops of the letters on its first line, from where the text
     * starts to where it ends. Each surface is { el, top, left, right, slope }
     * in viewport pixels, with `top` measured at `left`.
     */
    function platforms() {
      var list = [];
      qa('[data-plat]').forEach(function (node) {
        var r = node.getBoundingClientRect();
        var p = node.getAttribute('data-plat') === 'text' ? textPlat(node, r) : boxPlat(node, r);
        if (p && p.right - p.left > 60) { p.el = node; list.push(p); }
      });
      return list;
    }

    function yAt(p, x) { return p.top + (x - p.left) * p.slope; }

    function boxPlat(node, r) {
      var tf = getComputedStyle(node).transform;
      var m = tf && tf !== 'none' ? tf.match(/-?[\d.]+(?:e-?\d+)?/g).map(Number) : null;
      var a = m ? Math.atan2(m[1], m[0]) : 0;
      if (!a) return { top: r.top, left: r.left, right: r.right, slope: 0 };
      var hw = node.offsetWidth / 2 * Math.cos(a);
      var cx = (r.left + r.right) / 2 + node.offsetHeight / 2 * Math.sin(a);
      var cy = (r.top + r.bottom) / 2 - node.offsetHeight / 2 * Math.cos(a);
      return { top: cy - hw * Math.tan(a), left: cx - hw, right: cx + hw, slope: Math.tan(a) };
    }

    // Text surfaces are measured relative to their element and remeasured
    // only when its size or text changes (or a web font finishes loading).
    var textCache = new WeakMap();
    var inkCache = {};
    var measureCtx = document.createElement('canvas').getContext('2d');
    if (document.fonts) {
      document.fonts.addEventListener('loadingdone', function () { textCache = new WeakMap(); inkCache = {}; });
    }

    function textPlat(node, r) {
      var sig = r.width + 'x' + r.height + ':' + node.textContent.length;
      var c = textCache.get(node);
      if (!c || c.sig !== sig) {
        var s = textSurface(node);
        c = { sig: sig, s: s && { dy: s.top - r.top, dl: s.left - r.left, dr: s.right - r.left } };
        textCache.set(node, c);
      }
      return c.s && { top: r.top + c.s.dy, left: r.left + c.s.dl, right: r.left + c.s.dr, slope: 0 };
    }

    function textSurface(node) {
      var rects = [];
      var range = document.createRange();
      var walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (var t = walk.nextNode(); t; t = walk.nextNode()) {
        if (!t.data.trim() || t.parentNode.closest('.ghost, .sr-only, [hidden]')) continue;
        range.selectNodeContents(t);
        var inset = inkInset(t);
        Array.prototype.forEach.call(range.getClientRects(), function (q) {
          if (q.width > 0) rects.push({ top: q.top, bottom: q.bottom, left: q.left, right: q.right, ink: q.top + inset });
        });
      }
      if (!rects.length) return null;
      var lineEnd = Math.min.apply(null, rects.map(function (q) { return q.bottom; }));
      var line = rects.filter(function (q) { return q.top < lineEnd; });
      return {
        top: Math.min.apply(null, line.map(function (q) { return q.ink; })),
        left: Math.min.apply(null, line.map(function (q) { return q.left; })),
        right: Math.max.apply(null, line.map(function (q) { return q.right; }))
      };
    }

    // Gap between the top of a line of text and the top of its tallest letter.
    function inkInset(t) {
      var cs = getComputedStyle(t.parentNode);
      var font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var key = font + '|' + t.data;
      if (!(key in inkCache)) {
        measureCtx.font = font;
        var m = measureCtx.measureText(t.data.trim());
        inkCache[key] = m.fontBoundingBoxAscent != null
          ? Math.max(0, m.fontBoundingBoxAscent - m.actualBoundingBoxAscent)
          : parseFloat(cs.fontSize) * 0.2;
      }
      return inkCache[key];
    }

    function targetPlat(plats, vh) {
      var best = null, bd = 1e9;
      plats.forEach(function (p) {
        if (p.top < 80 || p.top > vh - 70) return;
        var d = Math.abs(p.top - vh * 0.45);
        if (d < bd) { bd = d; best = p; }
      });
      return best;
    }

    function jumpTo(plat, x, h, dur) {
      hero.jump = { sx: hero.x, sy: hero.y, ex: x, plat: plat.el, t0: performance.now(), dur: dur, h: h };
      if (Math.abs(x - hero.x) > 2) hero.face = x > hero.x ? 1 : -1;
      hero.plat = null;
    }

    function updateHero(now, o, vh) {
      var plats = platforms();
      function find(node) {
        for (var i = 0; i < plats.length; i++) if (plats[i].el === node) return plats[i];
        return null;
      }
      var scrolling = now - lastScroll < 180;
      var t;

      if (!hero) {
        t = targetPlat(plats, vh);
        if (!t) return;
        var x0 = t.left - o.x + Math.min(120, (t.right - t.left) * 0.2);
        hero = { x: x0, y: -o.y - 60, face: 1, plat: null, jump: null, landT: 0, idleT: now };
        jumpTo(t, x0, 10, 520);
        return;
      }

      if (hero.jump) {
        var j = hero.jump;
        var jp = find(j.plat);
        var ey = jp ? yAt(jp, j.ex + o.x + SPRITE_W / 2) - o.y : j.sy;
        var u = Math.min(1, (now - j.t0) / j.dur);
        hero.x = j.sx + (j.ex - j.sx) * u;
        hero.y = j.sy + (ey - j.sy) * u - j.h * 4 * u * (1 - u);
        if (u >= 1) {
          hero.plat = j.plat; hero.jump = null; hero.landT = now; hero.idleT = now;
          for (var i = 0; i < 7; i++) {
            bits.push({ x: hero.x + SPRITE_W / 2, y: hero.y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, t: now, c: '#9DB5AB', s: 3 });
          }
        }
        return;
      }

      var cur = find(hero.plat);
      if (!cur) {
        t = targetPlat(plats, vh);
        if (t) jumpTo(t, Math.max(t.left - o.x, Math.min(t.right - o.x - SPRITE_W - 2, hero.x)), 60, 500);
        return;
      }
      var minX = cur.left - o.x + 2, maxX = cur.right - o.x - SPRITE_W;
      hero.x = Math.max(minX, Math.min(maxX, hero.x));
      hero.y = yAt(cur, hero.x + o.x + SPRITE_W / 2) - o.y;
      var offscreen = cur.top < 40 || cur.top > vh - 20;

      if (scrolling || offscreen) {
        t = targetPlat(plats, vh);
        if (t && t.el !== cur.el) {
          var x = Math.max(t.left - o.x, Math.min(t.right - o.x - SPRITE_W - 2, hero.x + (Math.random() - 0.3) * 260 * hero.face));
          var dy = Math.abs((t.top - o.y) - hero.y);
          jumpTo(t, x, (t.top - o.y) < hero.y ? 50 + dy * 0.25 : 46, 360 + Math.min(420, dy * 0.45));
        } else if (scrolling && now - hero.landT > 60) {
          var nx = hero.x + hero.face * 26;
          if (nx > maxX || nx < minX) { hero.face *= -1; nx = hero.x + hero.face * 26; }
          jumpTo(cur, Math.max(minX, Math.min(maxX, nx)), 26, 260);
        }
      } else if (now - hero.idleT > 2600) {
        hero.idleT = now;
        if (Math.random() < 0.5) hero.face *= -1;
        else jumpTo(cur, hero.x, 18, 240);
      }
    }

    /*
     * One outfit per revision, oldest first, on a 14 x 18 grid of 3 px cells.
     * Each sprite is built from a head (rows 0-6), a torso (rows 7-13) and
     * legs (rows 14-17), plus arms that depend on the pose. `decal` cells are
     * drawn unmirrored on top, so the jersey number still reads "12" when the
     * author faces left.
     */
    var PX = 3, COLS = 14, ROWS = 18;
    var SPRITE_W = COLS * PX, SPRITE_H = ROWS * PX;

    var SKIN = { S: '#E9B48A', h: '#8F5E3A', b: '#B06A3A', K: '#051610' };

    var HEAD_HAIR = [
      '....hhhhhh....',
      '...hhhhhhhh...',
      '...hSSSSSSh...',
      '...SSKSSKSS...',
      '...SSSSSSSS...',
      '...SSSSSSSS...',
      '....SSSSSS....'
    ];
    var HEAD_TAM = [ // Iowa State doctoral tam with gold tassel
      '...TTTTTTTT...',
      '..TTTTTTTTTTg.',
      '...hSSSSSSh.g.',
      '...SSKSSKSS.g.',
      '...SSSSSSSS...',
      '...SSSSSSSS...',
      '....SSSSSS....'
    ];
    var BEARD = {
      none: [],
      short: [[5, 3], [5, 10], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9]],
      full: [[4, 3], [4, 10], [5, 3], [5, 4], [5, 9], [5, 10], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9]]
    };

    function legs(p, o) { // p = pants, o = shoes
      return {
        stand: ['...' + p + p + p + '..' + p + p + p + '...', '...' + p + p + p + '..' + p + p + p + '...', '...' + p + p + p + '..' + p + p + p + '...', '..' + o + o + o + o + '..' + o + o + o + o + '..'],
        jump: ['...' + p + p + p + '..' + p + p + p + '...', '..' + p + p + p + '....' + p + p + p + '..', '..' + o + o + '......' + o + o + '..', '..............']
      };
    }

    var GOWN_LEGS = {
      stand: ['..rrrkrrkrrr..', '..rrrkrrkrrr..', '..rrrrrrrrrr..', '...oo....oo...'],
      jump: ['..rrrkrrkrrr..', '.rrrrkrrkrrrr.', '..oo......oo..', '..............']
    };

    var OUTFITS = [
      { // Rev. 0, undergrad: Texas A&M football jersey, #12
        head: HEAD_HAIR, beard: 'none',
        torso: [
          '..mmmmwwmmmm..',
          '..mmmmmmmmmm..',
          '..mmmmmmmmmm..',
          '..mmmmmmmmmm..',
          '..mmmmmmmmmm..',
          '..mmmmmmmmmm..',
          '...jjjjjjjj...'
        ],
        decal: [
          [8, 5], [9, 4], [9, 5], [10, 5], [11, 5], [12, 5],
          [8, 7], [8, 8], [8, 9], [9, 9], [10, 7], [10, 8], [10, 9], [11, 7], [12, 7], [12, 8], [12, 9]
        ],
        decalColor: '#FFFFFF',
        sleeves: ['w', 'm', 'm', 'm'],
        legs: legs('j', 'o'),
        pal: { m: '#500000', w: '#FFFFFF', j: '#3B5B8C', o: '#2B2B2B' }
      },
      { // Rev. 1, grad school: Iowa State PhD regalia
        head: HEAD_TAM, beard: 'none',
        torso: [
          '..rrdgddgdrr..',
          '..rrrdggdrrr..',
          '..rrrkddkrrr..',
          '..rrrkrrkrrr..',
          '..rrrkrrkrrr..',
          '..rrrkrrkrrr..',
          '..rrrkrrkrrr..'
        ],
        sleeves: ['r', 'k', 'r', 'k'],
        legs: GOWN_LEGS,
        pal: { r: '#A6192E', k: '#151515', d: '#1F2A5C', g: '#F1BE48', T: '#151515', o: '#151515' }
      },
      { // Rev. 2, early career (about 30): flannel, jeans, short beard
        head: HEAD_HAIR, beard: 'short',
        torso: [
          '..ffffSSffff..',
          '..ffFffffFff..',
          '..FFFFFFFFFF..',
          '..ffFffffFff..',
          '..ffFffffFff..',
          '..FFFFFFFFFF..',
          '...jjjjjjjj...'
        ],
        sleeves: ['f', 'F', 'f', 'f'],
        legs: legs('j', 'o'),
        pal: { f: '#3B6EA5', F: '#1E3557', j: '#2F4A73', o: '#2B2B2B' }
      },
      { // Rev. 3, current (mid-to-late 30s): oxford shirt, fleece vest, chinos, full beard
        head: HEAD_HAIR, beard: 'full',
        torso: [
          '..vvllSSllvv..',
          '..vvvllllvvv..',
          '..vvvvllvvvv..',
          '..vvvvllvvvv..',
          '..vvvvllvvvv..',
          '..vvvvllvvvv..',
          '...nnnnnnnn...'
        ],
        sleeves: ['l', 'l', 'l', 'l'],
        legs: legs('c', 'n'),
        pal: { l: '#8DB3D9', v: '#2B3A42', c: '#B79F7A', n: '#5A3A22' }
      }
    ];

    // Build the 14 x 18 character grid for an outfit and pose.
    function spriteMap(outfit, jumping) {
      var rows = outfit.head.concat(outfit.torso, jumping ? outfit.legs.jump : outfit.legs.stand)
        .map(function (r) { return r.split(''); });
      BEARD[outfit.beard].forEach(function (rc) { rows[rc[0]][rc[1]] = 'b'; });
      var sl = outfit.sleeves;
      if (jumping) { // arms up beside the head
        [[6, 'S'], [7, sl[0]], [8, sl[1]]].forEach(function (a) { rows[a[0]][1] = a[1]; rows[a[0]][COLS - 2] = a[1]; });
      } else {       // arms at the sides
        [[8, sl[0]], [9, sl[1]], [10, sl[2]], [11, sl[3]], [12, 'S']].forEach(function (a) { rows[a[0]][1] = a[1]; rows[a[0]][COLS - 2] = a[1]; });
      }
      return rows;
    }

    function drawHero(ctx, x, y, now) {
      var outfit = OUTFITS[Math.min(state.rev, OUTFITS.length - 1)];
      var blink = now % 3200 < 140;
      var map = spriteMap(outfit, !!hero.jump);
      var pal = Object.assign({}, SKIN, outfit.pal);
      if (blink) pal.K = pal.S;
      var squash = !hero.jump && now - hero.landT < 110 ? 0.82 : 1;
      ctx.save();
      ctx.translate(x + SPRITE_W / 2, y);
      ctx.scale(1, squash);
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var ch = map[r][c];
          if (ch === '.') continue;
          var col = hero.face === 1 ? c : COLS - 1 - c;
          ctx.fillStyle = pal[ch];
          ctx.fillRect(-SPRITE_W / 2 + col * PX, -SPRITE_H + r * PX, PX, PX);
        }
      }
      (outfit.decal || []).forEach(function (rc) {
        ctx.fillStyle = outfit.decalColor;
        ctx.fillRect(-SPRITE_W / 2 + rc[1] * PX, -SPRITE_H + rc[0] * PX, PX, PX);
      });
      ctx.restore();
    }

    // A puff of dust when the author changes clothes.
    function changePuff() {
      if (!hero) return;
      var now = performance.now();
      for (var i = 0; i < 14; i++) {
        bits.push({ x: hero.x + SPRITE_W / 2 + (Math.random() - 0.5) * SPRITE_W, y: hero.y - Math.random() * SPRITE_H, vx: (Math.random() - 0.5) * 2.5, vy: -Math.random() * 2.5, t: now, c: '#9DB5AB', s: 3 });
      }
    }

    function frame() {
      var cv = el.canvas;
      var now = performance.now();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var vw = window.innerWidth, vh = window.innerHeight;
      if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) {
        cv.width = Math.round(vw * dpr);
        cv.height = Math.round(vh * dpr);
      }
      var ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      var o = origin();
      updateHero(now, o, vh);
      if (hero) drawHero(ctx, hero.x + o.x, hero.y + o.y, now);
      bits = bits.filter(function (b) { return now - b.t < 900; });
      bits.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.vy += 0.18;
        ctx.globalAlpha = Math.max(0, 1 - (now - b.t) / 900);
        ctx.fillStyle = b.c;
        ctx.fillRect(b.x + o.x, b.y + o.y, b.s, b.s);
      });
      ctx.globalAlpha = 1;
    }

    /* ---------- start ---------- */

    // Preload every revision's photo so switching revisions is instant.
    REVS.forEach(function (r) { if (r.photo) new Image().src = r.photo; });

    state.clk = 0;
    renderRev();
    startTyping();

    sampleDepth();
    setInterval(sampleDepth, 1000);

    if (el.canvas && OPTIONS.author && !reduce) {
      window.addEventListener('scroll', function () { lastScroll = performance.now(); }, { passive: true });
      (function tick() {
        frame();
        requestAnimationFrame(tick);
      })();
    } else if (el.canvas) {
      el.canvas.hidden = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
