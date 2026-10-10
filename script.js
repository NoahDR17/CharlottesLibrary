(function () {
  var FAM = {
    red: [356, 47, 52], orange: [24, 62, 57], yellow: [42, 68, 61], green: [112, 22, 52],
    blue: [214, 33, 51], purple: [268, 27, 53], pink: [338, 63, 71]
  };
  var NAMES = { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple', pink: 'Pink' };
  var KEYS = Object.keys(FAM);
  /* How often each colour turns up: lots of pink (her favourite), fewer yellows */
  var WEIGHTS = { red: 1, orange: 1, yellow: 0.5, green: 0, blue: 1, purple: 1, pink: 3 };
  var WEIGHT_SUM = KEYS.reduce(function (s, k) { return s + WEIGHTS[k]; }, 0);
  function pickKey() {
    var r = Math.random() * WEIGHT_SUM;
    for (var i = 0; i < KEYS.length; i++) { r -= WEIGHTS[KEYS[i]]; if (r < 0) return KEYS[i]; }
    return KEYS[KEYS.length - 1];
  }
  var SHELVES = 3, AREA = 84, PAD = 8, PLANK = 10, FRAME = 10, GAP = 1, MAXW = 640;
  var STORE = 'charlottes-library-v1';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var app = document.getElementById('app');
  var wrap = document.getElementById('caseWrap');
  var caseEl = document.getElementById('case');
  var rows = Array.prototype.slice.call(caseEl.querySelectorAll('.shelf'));
  var shuffleBtn = document.getElementById('reshuffle');
  var rug = document.getElementById('rug');
  var countEl = document.getElementById('count');

  var state = { shelves: [], moves: 0, nextId: 1 };
  var shuffling = false;
  var byId = new Map();
  var u = 1, innerW = 300;
  var drag = null;

  function rand(n) { return Math.floor(Math.random() * n); }

  function makeBook(k) {
    var tome = Math.random() < 0.08;
    return {
      id: state.nextId++, k: k, dl: rand(13) - 6,
      w: tome ? 25 + rand(5) : 17 + rand(6),
      h: tome ? 70 + rand(11) : 56 + rand(25),
      v: rand(4)
    };
  }

  function metrics() {
    var cs = getComputedStyle(wrap);
    var W = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var H = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var caseW = Math.min(W, MAXW);
    return {
      inner: caseW - 2 * FRAME - 2 * PAD,
      uH: (H - 2 * FRAME - SHELVES * (PLANK + PAD)) / (SHELVES * AREA)
    };
  }

  function clampU(x) { return Math.max(0.6, Math.min(2.2, x)); }
  function widthOf(list, uu) { return list.reduce(function (s, b) { return s + b.w * uu + GAP; }, 0); }

  /* Every colour on the bookcase gets at least three books, so a glowing run is always possible */
  function balanceColours(books) {
    for (var pass = 0; pass < 20; pass++) {
      var cnt = {};
      books.forEach(function (b) { cnt[b.k] = (cnt[b.k] || 0) + 1; });
      var keys = Object.keys(cnt);
      var short = keys.filter(function (k) { return cnt[k] < 3; });
      if (!short.length) return;
      var k = short[0], need = 3 - cnt[k];
      var donor = keys.filter(function (d) { return d !== k; })
        .sort(function (x, y) { return cnt[y] - cnt[x]; })[0];
      if (donor && cnt[donor] - need >= 3) {
        /* top this colour up to three, borrowing from the most common colour */
        var moved = 0;
        books.forEach(function (b) { if (moved < need && b.k === donor) { b.k = k; moved++; } });
      } else if (donor) {
        /* too few to top up: fold this colour into the most common one */
        books.forEach(function (b) { if (b.k === k) b.k = donor; });
      } else {
        return;
      }
    }
  }

  function newShelves() {
    var m = metrics();
    var uu = clampU(m.uH);
    var per = m.inner * 0.84;
    var cap = per * SHELVES;
    var books = [], total = 0;
    for (var guard = 0; guard < 400; guard++) {
      var bk = makeBook(pickKey());
      var w = bk.w * uu + GAP;
      if (total + w > cap) break;
      books.push(bk);
      total += w;
    }
    balanceColours(books);
    var order = shuffledNoTriples(books, function (b) { return b.k; });
    var shelves = [], i = 0, used = 0;
    for (var sh = 0; sh < SHELVES; sh++) {
      var list = [], left = (total - used) / (SHELVES - sh);
      while (i < order.length && (sh === SHELVES - 1 || widthOf(list, uu) + (order[i].w * uu + GAP) / 2 <= left)) {
        list.push(order[i++]);
      }
      used += widthOf(list, uu);
      shelves.push(list);
    }
    return shelves;
  }

  function layout() {
    var m = metrics();
    var uu = clampU(m.uH);
    state.shelves.forEach(function (l) {
      var sw = l.reduce(function (s, b) { return s + b.w; }, 0);
      if (sw > 0) {
        var fitU = (m.inner - l.length * GAP - 2) / sw;
        if (fitU < uu) uu = fitU;
      }
    });
    u = Math.max(0.3, uu);
    innerW = m.inner;
    caseEl.style.setProperty('--u', u.toFixed(4));
  }

  function bookEl(b) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'book v' + b.v;
    el.dataset.id = b.id;
    var f = FAM[b.k], L = f[2] + b.dl;
    el.style.setProperty('--c', 'hsl(' + f[0] + ' ' + f[1] + '% ' + L + '%)');
    el.style.setProperty('--cd', 'hsl(' + f[0] + ' ' + f[1] + '% ' + (L - 14) + '%)');
    el.style.setProperty('--cl', 'hsl(' + f[0] + ' ' + Math.max(f[1] - 10, 10) + '% ' + Math.min(L + 16, 92) + '%)');
    el.style.width = 'calc(var(--u) * ' + b.w + 'px)';
    el.style.height = 'calc(var(--u) * ' + b.h + 'px)';
    el.setAttribute('aria-label', NAMES[b.k] + ' book');
    return el;
  }

  function render(entering) {
    byId.clear();
    rows.forEach(function (row, i) {
      row.textContent = '';
      (state.shelves[i] || []).forEach(function (b, j) {
        byId.set(b.id, b);
        var el = bookEl(b);
        row.appendChild(el);
        if (entering && !reduce && el.animate) {
          el.animate(
            [{ transform: 'translateY(-16px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 460, delay: i * 110 + j * 22, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }
          );
        }
      });
    });
    updateGlow();
  }

  function bookOf(el) { return byId.get(+el.dataset.id); }
  function booksIn(row) { return Array.prototype.slice.call(row.querySelectorAll('.book')); }

  function sync() {
    state.shelves = rows.map(function (r) { return booksIn(r).map(bookOf); });
  }

  function updateGlow() {
    rows.forEach(function (r) {
      var els = booksIn(r), i = 0;
      while (i < els.length) {
        var k = bookOf(els[i]).k, j = i;
        while (j < els.length && bookOf(els[j]).k === k) j++;
        for (var x = i; x < j; x++) els[x].classList.toggle('glow', j - i >= 3);
        i = j;
      }
    });
  }

  /* Width of one item on a shelf: a book, or the gap where the dragged book will land */
  function itemW(e) {
    var w = e.classList.contains('gap') ? (drag ? drag.b.w : 20) : bookOf(e).w;
    return w * u + GAP;
  }
  function rowW(arr) { return arr.reduce(function (s, e) { return s + itemW(e); }, 0); }

  /* When a shelf overflows, nudge books at its edge onto the nearest shelf with room.
     The item just placed (keep) never gets pushed. */
  function cascade(arrs, keep) {
    var cap = innerW - 2;
    for (var guard = 0; guard < 300; guard++) {
      var over = -1;
      for (var i = 0; i < arrs.length; i++) {
        if (arrs[i].length > 1 && rowW(arrs[i]) > cap) { over = i; break; }
      }
      if (over < 0) return;
      var down = -1, up = -1;
      for (var j = over + 1; j < arrs.length; j++) { if (rowW(arrs[j]) < cap) { down = j; break; } }
      for (var k = over - 1; k >= 0; k--) { if (rowW(arrs[k]) < cap) { up = k; break; } }
      if (down < 0 && up < 0) return;
      var a = arrs[over], item, idx;
      if (down >= 0 && (up < 0 || down - over <= over - up)) {
        idx = a[a.length - 1] === keep ? a.length - 2 : a.length - 1;
        item = a.splice(idx, 1)[0];
        arrs[over + 1].unshift(item);
      } else {
        idx = a[0] === keep ? 1 : 0;
        item = a.splice(idx, 1)[0];
        arrs[over - 1].push(item);
      }
    }
  }

  function applyArr(arrs) {
    arrs.forEach(function (arr, i) {
      arr.forEach(function (e) { rows[i].appendChild(e); });
    });
  }

  function currentArr(exclude) {
    return rows.map(function (r) {
      return booksIn(r).filter(function (e) { return e !== exclude; });
    });
  }

  function indexAt(row, list, x) {
    var left = row.getBoundingClientRect().left;
    for (var i = 0; i < list.length; i++) {
      if (list[i].parentNode !== row) continue;
      if (x < left + list[i].offsetLeft + list[i].offsetWidth / 2) return i;
    }
    return list.length;
  }

  function flip(mutate) {
    var els = Array.prototype.slice.call(caseEl.querySelectorAll('.book, .gap'));
    var first = new Map();
    els.forEach(function (n) { first.set(n, n.getBoundingClientRect()); });
    mutate();
    if (reduce || !Element.prototype.animate) return;
    var now = Array.prototype.slice.call(caseEl.querySelectorAll('.book, .gap'));
    now.forEach(function (n) { n.getAnimations().forEach(function (a) { a.cancel(); }); });
    now.forEach(function (n) {
      var f = first.get(n);
      if (!f) return;
      var l = n.getBoundingClientRect();
      var dx = f.left - l.left, dy = f.top - l.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        n.animate(
          [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
          { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
      }
    });
  }

  /* ---------- A little buzz when a book is placed ---------- */
  /* Android: the Vibration API. iPhone (iOS 18+): Safari has no vibration API, but tapping a
     hidden switch-style checkbox gives a light haptic tick, so we quietly click one. */
  var hapticLabel = null;
  function haptic() {
    try {
      if (navigator.vibrate) { navigator.vibrate(12); return; }
      if (!hapticLabel) {
        hapticLabel = document.createElement('label');
        hapticLabel.setAttribute('aria-hidden', 'true');
        hapticLabel.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.tabIndex = -1;
        hapticLabel.appendChild(input);
        document.body.appendChild(hapticLabel);
      }
      var active = document.activeElement;
      hapticLabel.click();
      if (active && active.focus) active.focus({ preventScroll: true });
    } catch (_) {}
  }

  /* ---------- Dragging ---------- */
  /* Keep the screen still: no scrolling, rubber-banding or pinch-zoom from a stray finger */
  document.addEventListener('touchmove', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
  caseEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  caseEl.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.book');
    if (!el || drag || shuffling || e.button > 0) return;
    drag = { el: el, b: bookOf(el), sx: e.clientX, sy: e.clientY, lx: e.clientX, started: false, tilt: 0 };
  });

  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      begin();
    }
    moveTo(e.clientX, e.clientY);
  });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('blur', end);

  function begin() {
    var el = drag.el;
    var r = el.getBoundingClientRect();
    drag.started = true;
    drag.ox = drag.sx - r.left;
    drag.oy = drag.sy - r.top;
    var g = el.cloneNode(true);
    g.classList.add('floating');
    g.classList.remove('glow');
    g.removeAttribute('data-id');
    g.setAttribute('aria-hidden', 'true');
    g.tabIndex = -1;
    g.style.width = r.width + 'px';
    g.style.height = r.height + 'px';
    g.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px)';
    app.appendChild(g);
    drag.ghost = g;
    var gap = document.createElement('div');
    gap.className = 'gap';
    gap.style.width = r.width + 'px';
    gap.style.height = r.height + 'px';
    drag.gap = gap;
    var homeRow = el.parentNode;
    drag.key = rows.indexOf(homeRow) + ':' + booksIn(homeRow).indexOf(el);
    flip(function () { el.replaceWith(gap); });
    drag.base = currentArr(null);
    app.classList.add('dragging');
  }

  function moveTo(x, y) {
    var vx = x - drag.lx;
    drag.lx = x;
    var target = Math.max(-12, Math.min(12, vx * 0.8));
    drag.tilt += (target - drag.tilt) * 0.25;
    drag.ghost.style.transform = 'translate(' + (x - drag.ox) + 'px,' + (y - drag.oy) + 'px) rotate(' + drag.tilt.toFixed(2) + 'deg) scale(1.08)';
    place(x, y);
  }

  function place(x, y) {
    var best = null, bd = Infinity;
    rows.forEach(function (r) {
      var rr = r.getBoundingClientRect();
      var top = rr.top - PLANK, bot = rr.bottom + PLANK;
      var d = y < top ? top - y : (y > bot ? y - bot : 0);
      if (d < bd) { bd = d; best = r; }
    });
    if (!best || bd > 160) return;
    var ri = rows.indexOf(best);
    var idx = indexAt(best, drag.base[ri], x);
    var key = ri + ':' + idx;
    if (key === drag.key) return;
    drag.key = key;
    var arrs = drag.base.map(function (a) { return a.slice(); });
    arrs[ri].splice(idx, 0, drag.gap);
    cascade(arrs, drag.gap);
    flip(function () { applyArr(arrs); });
  }

  function end() {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (!d.started) {
      if (!reduce && d.el.animate) {
        d.el.animate(
          [{ transform: 'none' }, { transform: 'translateY(-6px) rotate(-2deg)' }, { transform: 'none' }],
          { duration: 280, easing: 'ease-out' }
        );
      }
      return;
    }
    haptic();
    if (d.gap.getAnimations) d.gap.getAnimations().forEach(function (a) { a.finish(); });
    var r = d.gap.getBoundingClientRect();
    var g = d.ghost, done = false;
    function finish() {
      if (done) return;
      done = true;
      d.gap.replaceWith(d.el);
      g.remove();
      app.classList.remove('dragging');
      if (!reduce && d.el.animate) {
        d.el.animate([{ transform: 'translateY(-3px)' }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
      }
      sync();
      updateGlow();
      changed();
    }
    if (reduce) { finish(); return; }
    g.style.transition = 'transform 200ms cubic-bezier(.2,.8,.2,1)';
    g.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px) rotate(0deg) scale(1)';
    g.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 260);
  }

  /* ---------- Keyboard ---------- */
  caseEl.addEventListener('keydown', function (e) {
    var el = e.target.closest('.book');
    if (!el || drag || shuffling) return;
    var row = el.parentNode, ri = rows.indexOf(row), did = false;
    if (e.key === 'ArrowLeft' && el.previousElementSibling) {
      flip(function () { row.insertBefore(el, el.previousElementSibling); }); did = true;
    } else if (e.key === 'ArrowRight' && el.nextElementSibling) {
      flip(function () { row.insertBefore(el.nextElementSibling, el); }); did = true;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      var t = rows[ri + (e.key === 'ArrowUp' ? -1 : 1)];
      if (t) {
        var ti = rows.indexOf(t);
        var arrs = currentArr(el);
        var x = el.getBoundingClientRect().left + el.offsetWidth / 2;
        arrs[ti].splice(indexAt(t, arrs[ti], x), 0, el);
        cascade(arrs, el);
        flip(function () { applyArr(arrs); }); did = true;
      }
    }
    if (did) {
      e.preventDefault();
      el.focus({ preventScroll: true });
      sync();
      updateGlow();
      changed();
      haptic();
    }
  });

  /* ---------- Counting and saving ---------- */
  function updateCount() {
    var n = state.moves || 0;
    countEl.textContent = n.toLocaleString('en-GB') + ' ' + (n === 1 ? 'book' : 'books') + ' moved';
  }

  function changed() {
    state.moves = (state.moves || 0) + 1;
    updateCount();
    save();
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (_) {}
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && Array.isArray(s.shelves)) {
        /* An older save with a different number of shelves: keep her count, start a fresh bookcase */
        if (s.shelves.length !== SHELVES) s.shelves = [];
        /* A save that still holds a colour we no longer use (like green): start a fresh bookcase */
        var retired = s.shelves.some(function (l) { return (l || []).some(function (b) { return !WEIGHTS[b.k]; }); });
        if (retired) s.shelves = [];
        var cnt = {};
        s.shelves.forEach(function (l) { (l || []).forEach(function (b) { cnt[b.k] = (cnt[b.k] || 0) + 1; }); });
        if (Object.keys(cnt).some(function (k) { return cnt[k] < 3; })) s.shelves = [];
        return s;
      }
    } catch (_) {}
    return null;
  }

  /* ---------- Reshuffle ---------- */
  function shuffled(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* A random order where no colour appears three times in a row */
  function shuffledNoTriples(list, kf) {
    kf = kf || function (e) { return bookOf(e).k; };
    for (var attempt = 0; attempt < 60; attempt++) {
      var pool = shuffled(list), out = [], stuck = false;
      while (pool.length) {
        var n = out.length;
        var ban = n >= 2 && kf(out[n - 1]) === kf(out[n - 2]) ? kf(out[n - 1]) : null;
        /* If one colour dominates what's left, place it now or it won't fit later */
        var counts = {}, top = null;
        pool.forEach(function (e) { var c = kf(e); counts[c] = (counts[c] || 0) + 1; if (!top || counts[c] > counts[top]) top = c; });
        var must = top !== ban && counts[top] > 2 * (pool.length - counts[top]) ? top : null;
        var idx = -1;
        for (var i = 0; i < pool.length; i++) {
          var c = kf(pool[i]);
          if (c !== ban && (!must || c === must)) { idx = i; break; }
        }
        if (idx < 0) { stuck = true; break; }
        out.push(pool.splice(idx, 1)[0]);
      }
      if (!stuck) return out;
    }
    return shuffled(list);
  }

  /* Safety net: break up any run of three on a single shelf by swapping with a book further along */
  function breakTriples(arrs) {
    arrs.forEach(function (a) {
      for (var i = 2; i < a.length; i++) {
        var k = bookOf(a[i]).k;
        if (bookOf(a[i - 1]).k !== k || bookOf(a[i - 2]).k !== k) continue;
        for (var j = i + 1; j < a.length; j++) {
          if (bookOf(a[j]).k === k) continue;
          var t = a[i]; a[i] = a[j]; a[j] = t;
          if (!hasTriple(a)) break;
          t = a[i]; a[i] = a[j]; a[j] = t;
        }
      }
    });
  }

  function hasTriple(a) {
    for (var i = 2; i < a.length; i++) {
      var k = bookOf(a[i]).k;
      if (bookOf(a[i - 1]).k === k && bookOf(a[i - 2]).k === k) return true;
    }
    return false;
  }

  function reshuffle() {
    if (shuffling || drag) return;
    var all = [];
    rows.forEach(function (r) { all = all.concat(booksIn(r)); });
    if (!all.length) return;

    /* A new random order, spread evenly across the shelves, with no three same-coloured books side by side */
    var order = shuffledNoTriples(all);
    var total = rowW(order);
    var arrs = [], i = 0;
    for (var s = 0; s < SHELVES; s++) {
      var shelf = [], left = (total - rowW(arrs.reduce(function (x, y) { return x.concat(y); }, []))) / (SHELVES - s);
      while (i < order.length && (s === SHELVES - 1 || rowW(shelf) + itemW(order[i]) / 2 <= left)) {
        shelf.push(order[i++]);
      }
      arrs.push(shelf);
    }
    cascade(arrs, null);
    breakTriples(arrs);

    shuffling = true;
    app.classList.add('shuffling');
    shuffleBtn.disabled = true;

    var first = new Map();
    all.forEach(function (n) { first.set(n, n.getBoundingClientRect()); });
    all.forEach(function (n) { n.getAnimations && n.getAnimations().forEach(function (a) { a.cancel(); }); n.classList.remove('glow'); });
    applyArr(arrs);

    var longest = 0;
    if (!reduce && Element.prototype.animate) {
      all.forEach(function (n) {
        var f = first.get(n), l = n.getBoundingClientRect();
        var dx = f.left - l.left, dy = f.top - l.top;
        var lift = 40 + Math.random() * 70;
        var spin = (Math.random() * 2 - 1) * 200;
        var delay = Math.random() * 260;
        var dur = 820 + Math.random() * 360;
        longest = Math.max(longest, delay + dur);
        n.style.zIndex = String(2 + Math.floor(Math.random() * 20));
        n.animate([
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg) scale(1)' },
          { transform: 'translate(' + dx + 'px,' + (dy - 18) + 'px) rotate(' + (spin * 0.05) + 'deg) scale(1.04)', offset: 0.12 },
          { transform: 'translate(' + (dx * 0.5) + 'px,' + (dy * 0.5 - lift) + 'px) rotate(' + spin + 'deg) scale(1.15)', offset: 0.55 },
          { transform: 'translate(0px,-6px) rotate(' + (spin > 0 ? 4 : -4) + 'deg) scale(1.02)', offset: 0.88 },
          { transform: 'none' }
        ], { duration: dur, delay: delay, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'backwards' });
      });
      caseEl.style.overflow = 'visible';
      rows.forEach(function (r) { r.style.overflow = 'visible'; });
    }

    setTimeout(function () {
      all.forEach(function (n) { n.style.zIndex = ''; });
      rows.forEach(function (r) { r.style.overflow = ''; });
      caseEl.style.overflow = '';
      sync();
      updateGlow();
      save();
      shuffling = false;
      app.classList.remove('shuffling');
      shuffleBtn.disabled = false;
    }, longest + 40);
  }

  shuffleBtn.addEventListener('click', reshuffle);

  /* Reset the books-moved count: first tap asks, second tap within a few seconds resets */
  var resetBtn = document.getElementById('resetCount');
  var resetLabel = resetBtn.querySelector('span');
  var resetTimer = null;
  function resetIdle() {
    clearTimeout(resetTimer);
    resetBtn.classList.remove('confirm', 'done');
    resetLabel.textContent = 'Reset count';
  }
  resetBtn.addEventListener('click', function () {
    if (!resetBtn.classList.contains('confirm')) {
      resetBtn.classList.remove('done');
      resetBtn.classList.add('confirm');
      resetLabel.textContent = 'Tap again to reset';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(resetIdle, 3000);
      return;
    }
    state.moves = 0;
    updateCount();
    save();
    clearTimeout(resetTimer);
    resetBtn.classList.remove('confirm');
    resetBtn.classList.add('done');
    resetLabel.textContent = 'Count reset';
    resetTimer = setTimeout(resetIdle, 1800);
  });
  resetBtn.addEventListener('blur', function () { if (resetBtn.classList.contains('confirm')) resetIdle(); });

  /* ---------- The dogs ---------- */
  var audio = null;
  function woof(dog) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio) audio = new AC();
      if (audio.state === 'suspended') audio.resume();
      var small = dog.classList.contains('jack');
      var base = small ? 1.25 : 1;
      var t0 = audio.currentTime + 0.01;
      var master = audio.createGain();
      master.gain.value = 0.55;
      master.connect(audio.destination);
      /* Two quick barks: "wuh-woof" */
      [[0, 0.16, 0.7], [0.19, 0.24, 1]].forEach(function (p) {
        var t = t0 + p[0], len = p[1], vol = p[2];
        var osc = audio.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260 * base, t);
        osc.frequency.linearRampToValueAtTime(520 * base, t + len * 0.25);
        osc.frequency.exponentialRampToValueAtTime(170 * base, t + len);
        var filt = audio.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(1600 * base, t);
        filt.frequency.exponentialRampToValueAtTime(500, t + len);
        filt.Q.value = 6;
        var g = audio.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        osc.connect(filt); filt.connect(g); g.connect(master);
        osc.start(t); osc.stop(t + len + 0.02);
        /* a puff of breath noise */
        var n = Math.floor(audio.sampleRate * len);
        var buf = audio.createBuffer(1, n, audio.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        var src = audio.createBufferSource();
        src.buffer = buf;
        var nf = audio.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.value = 900 * base;
        var ng = audio.createGain();
        ng.gain.value = 0.25 * vol;
        src.connect(nf); nf.connect(ng); ng.connect(master);
        src.start(t);
      });
    } catch (_) {}
  }

  var HEART_COLOURS = ['#E487A6', '#F2A7BF', '#D9667F', '#F7C2D2'];
  function heartAt(x, y, dx, dy, size, delay) {
    var h = document.createElement('span');
    h.className = 'heart';
    h.style.width = h.style.height = size + 'px';
    h.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="' + HEART_COLOURS[rand(HEART_COLOURS.length)] + '" d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z"></path></svg>';
    h.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    rug.appendChild(h);
    if (reduce || !h.animate) { setTimeout(function () { h.remove(); }, 800); return; }
    var sway = (Math.random() * 2 - 1) * 14;
    h.animate([
      { transform: 'translate(' + x + 'px,' + y + 'px) scale(.3)', opacity: 0 },
      { transform: 'translate(' + (x + dx * 0.3) + 'px,' + (y + dy * 0.25) + 'px) scale(1)', opacity: 1, offset: 0.2 },
      { transform: 'translate(' + (x + dx * 0.65 + sway) + 'px,' + (y + dy * 0.6) + 'px) scale(1) rotate(' + sway + 'deg)', opacity: 0.9, offset: 0.6 },
      { transform: 'translate(' + (x + dx) + 'px,' + (y + dy) + 'px) scale(.85)', opacity: 0 }
    ], { duration: 1500 + Math.random() * 700, delay: delay || 0, easing: 'ease-out', fill: 'backwards' }).onfinish = function () { h.remove(); };
  }

  function dogPoint(dog) {
    var dr = dog.getBoundingClientRect(), pr = rug.getBoundingClientRect();
    var headX = dog.classList.contains('jack') ? 0.22 : 0.78;
    return { x: dr.left - pr.left + dr.width * headX, y: dr.top - pr.top + dr.height * 0.2, w: dr.width };
  }

  function sayWoof(dog) {
    var p = dogPoint(dog);
    var b = document.createElement('span');
    b.className = 'woof';
    b.textContent = 'Woof!';
    rug.appendChild(b);
    var x = p.x - b.offsetWidth / 2, y = p.y - 34;
    b.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    if (reduce || !b.animate) { setTimeout(function () { b.remove(); }, 900); return; }
    b.animate([
      { transform: 'translate(' + x + 'px,' + (y + 10) + 'px) scale(.5) rotate(-8deg)', opacity: 0 },
      { transform: 'translate(' + x + 'px,' + (y - 4) + 'px) scale(1.12) rotate(4deg)', opacity: 1, offset: 0.18 },
      { transform: 'translate(' + x + 'px,' + (y - 8) + 'px) scale(1) rotate(0deg)', opacity: 1, offset: 0.6 },
      { transform: 'translate(' + x + 'px,' + (y - 22) + 'px) scale(.95)', opacity: 0 }
    ], { duration: 1100, easing: 'ease-out' }).onfinish = function () { b.remove(); };
  }

  Array.prototype.forEach.call(document.querySelectorAll('.dog'), function (dog) {
    var petTimer = null, petTimeout = null;

    /* Hovering is petting: a slow trickle of hearts while the mouse rests on them */
    dog.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      clearInterval(petTimer);
      petTimer = setInterval(function () {
        var p = dogPoint(dog);
        heartAt(p.x + (Math.random() * 2 - 1) * p.w * 0.25, p.y + 6, (Math.random() * 2 - 1) * 20, -50, 14, 0);
      }, 650);
    });
    dog.addEventListener('pointerleave', function () { clearInterval(petTimer); });

    dog.addEventListener('click', function () {
      woof(dog);
      sayWoof(dog);
      var p = dogPoint(dog);
      for (var i = 0; i < 7; i++) {
        var ang = -Math.PI / 2 + (Math.random() * 2 - 1) * 1.1;
        var dist = 60 + Math.random() * 60;
        heartAt(p.x - 10, p.y, Math.cos(ang) * dist, Math.sin(ang) * dist, 14 + rand(12), i * 70);
      }
      /* On touch screens there's no hover, so a tap also sets the tail going for a bit */
      dog.classList.add('petted');
      clearTimeout(petTimeout);
      petTimeout = setTimeout(function () { dog.classList.remove('petted'); }, 2200);
    });
  });

  /* ---------- Burger menu ---------- */
  var menu = document.getElementById('menu');
  var burger = document.getElementById('burger');
  var panel = document.getElementById('menuPanel');
  function setMenu(open) {
    panel.hidden = !open;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) { menu.classList.add('seen'); try { localStorage.setItem('charlottes-library-menu-seen', '1'); } catch (_) {} }
  }
  try { if (localStorage.getItem('charlottes-library-menu-seen')) menu.classList.add('seen'); } catch (_) {}
  burger.addEventListener('click', function () { setMenu(panel.hidden); });
  document.addEventListener('pointerdown', function (e) { if (!panel.hidden && !menu.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { setMenu(false); burger.focus(); } });

  /* ---------- Start ---------- */
  var resizeQueued = false;
  window.addEventListener('resize', function () {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () { resizeQueued = false; layout(); });
  });

  function start(data) {
    var s = (data && data.state) || load();
    if (s) state = s;
    if (!state.nextId) state.nextId = 1;
    layout();
    var fresh = !state.shelves.some(function (l) { return l && l.length; });
    if (fresh) state.shelves = newShelves();
    render(fresh);
    layout();
    updateCount();
    save();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  }

  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) { try { hot.snapshot(function () { return { state: state }; }); } catch (_) {} }
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})();
