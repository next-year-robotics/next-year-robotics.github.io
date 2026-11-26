(() => {
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 영상: 화면에 들어오면 소리 없이 반복 재생, 소리 있는 영상은 직접 재생 ── */
  const load = v => { if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src; };
  const near = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { load(e.target); near.unobserve(e.target); }
  }, { rootMargin: '600px 0px' });
  const seen = new IntersectionObserver(es => {
    for (const { target: v, intersectionRatio: r } of es) {
      if (r >= 0.5) {
        load(v);
        if (!reduced && !v.dataset.held) v.play().catch(() => {});
      } else v.pause();
    }
  }, { threshold: [0, 0.5] });
  for (const v of document.querySelectorAll('video.auto')) {
    if (reduced) { v.controls = true; load(v); continue; }
    near.observe(v);
    seen.observe(v);
    v.addEventListener('click', () => {
      if (v.paused) { delete v.dataset.held; v.play().catch(() => {}); }
      else { v.dataset.held = '1'; v.pause(); }
    });
  }
  const loud = [...document.querySelectorAll('video[controls]:not(.auto)')];
  for (const v of loud) v.addEventListener('play', () => { for (const o of loud) if (o !== v) o.pause(); });

  /* ── 실물 시연: 영상 시간에 맞춰 단계 표시 ── */
  for (const ol of document.querySelectorAll('.sync-steps')) {
    const v = document.querySelector(`video[data-sync="${ol.dataset.for}"]`);
    if (!v) continue;
    const items = [...ol.children];
    v.addEventListener('timeupdate', () => {
      const t = v.currentTime;
      for (const li of items) {
        li.classList.toggle('on', t >= +li.dataset.t0 && t < +li.dataset.t1);
        li.classList.toggle('done', t >= +li.dataset.t1);
      }
    });
    for (const li of items) li.addEventListener('click', () => {
      load(v);
      v.currentTime = +li.dataset.t0;
      delete v.dataset.held;
      v.play().catch(() => {});
    });
  }

  /* ── 일력 ── */
  const data = JSON.parse($('rail-data').textContent);
  const days = data.days;
  const entries = [...document.querySelectorAll('.entry[data-d]')];
  const rail = $('rail');
  if (!entries.length || !rail) return;

  const day = s => new Date(s + 'T00:00:00');
  const won = n => Math.round(Math.abs(n)).toLocaleString('ko-KR');
  const signed = n => (n < 0 ? '−' : '') + won(n) + '원';
  const man = n => (n < 0 ? '−' : '') + (Math.abs(n) / 1e4).toFixed(1).replace(/\.0$/, '') + '만 원';
  const WD = ['일', '월', '화', '수', '목', '금', '토'];

  // 그래프: 잔고(먹)와 기능 완성도(주홍)를 계단선으로
  const NS = 'http://www.w3.org/2000/svg';
  const svg = $('rChart');
  const mk = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  };
  const X0 = 2, X1 = 298, YT = 6, YB = 78;
  const t0 = day(data.from), t1 = day(data.to);
  const cx = d => X0 + (day(d) - t0) / (t1 - t0) * (X1 - X0);
  const { min, max } = data.range;
  const yBal = v => YB - (v - min) / (max - min) * (YB - YT);
  const yLv = v => YB - v * (YB - YT);
  const dates = Object.keys(days).sort();
  const step = (f, first) => {
    let d = `M${X0},${first}`;
    let y = first;
    for (const k of dates) { const x = cx(k); d += `H${x.toFixed(1)}V${(y = f(days[k])).toFixed(1)}`; }
    return d + `H${X1}`;
  };
  for (let m = 6; m <= 11; m++) {
    const x = cx(`2026-${String(m).padStart(2, '0')}-01`);
    mk('line', { x1: x, x2: x, y1: YT - 2, y2: YB, stroke: '#EEE8DC' });
    mk('text', { x: x + 2, y: YB + 13 }).textContent = `${m}월`;
  }
  mk('line', { x1: X0, x2: X1, y1: yBal(0), y2: yBal(0), stroke: '#D93A24', 'stroke-dasharray': '2 3', 'stroke-width': 1 });
  mk('text', { x: X1, y: yBal(0) - 3, 'text-anchor': 'end', style: 'fill:#D93A24' }).textContent = '0원';
  const balPath = step(s => yBal(s.bal), yBal(0));
  const lvPath = step(s => yLv(s.level), yLv(0));
  mk('path', { d: balPath, fill: 'none', stroke: '#E2DBCD', 'stroke-width': 1.5 });
  const clipId = 'railclip';
  const defs = mk('defs', {});
  const cp = mk('clipPath', { id: clipId }, defs);
  const clip = mk('rect', { x: 0, y: 0, width: 0, height: 100, class: 'clip' }, cp);
  const g = mk('g', { 'clip-path': `url(#${clipId})` });
  mk('path', { d: balPath, fill: 'none', stroke: '#1F1C19', 'stroke-width': 2 }, g);
  mk('path', { d: lvPath, fill: 'none', stroke: '#D93A24', 'stroke-width': 2 }, g);
  const dot = color => { const e = mk('g', { class: 'dot' }); mk('circle', { r: 3.4, fill: color, stroke: '#fff', 'stroke-width': 1.5 }, e); return e; };
  const dotBal = dot('#1F1C19'), dotLv = dot('#D93A24');

  $('rCaps').innerHTML = data.caps.map((n, i) => `<li>${data.capIcons?.[i] ? `<img src="${data.capIcons[i]}" alt="">` : '<span></span>'}<span>${n}</span><i><b></b></i></li>`).join('');
  const capBars = [...$('rCaps').querySelectorAll('b')];
  const imgs = [$('rImgA'), $('rImgB')];
  let front = 0, shownImg = null;

  let current = null;
  function render(d) {
    if (d === current) return;
    current = d;
    const s = days[d], dt = day(d);
    $('rDay').textContent = dt.getDate();
    $('rDay').className = dt.getDay() === 0 ? 'sun' : dt.getDay() === 6 ? 'sat' : '';
    $('rYm').textContent = `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`;
    $('rWd').textContent = `${WD[dt.getDay()]}요일`;
    $('rDn').textContent = `D+${Math.round((dt - day(data.seedDate)) / 864e5)}`;
    $('rBal').textContent = signed(s.bal);
    $('rBal').classList.toggle('neg', s.bal < 0);
    $('rTx').innerHTML = s.tx.length
      ? s.tx.map(([a, it, k]) => `<li><span class="${a < 0 ? 'm' : 'p'}">${a < 0 ? '−' : '+'}${won(a)}</span> ${it}${k === 'acc' ? ' · 사고' : ''}</li>`).join('')
      : '<li class="none">이날은 쓴 돈이 없다</li>';
    const x = cx(d);
    clip.setAttribute('width', x + 1);
    clip.style.width = `${x + 1}px`;
    dotBal.style.transform = `translate(${x}px,${yBal(s.bal)}px)`;
    dotLv.style.transform = `translate(${x}px,${yLv(s.level)}px)`;
    $('rLv').textContent = `${Math.round(s.level * 100)}%`;
    s.cap.forEach((v, i) => { capBars[i].style.width = `${v * 100}%`; });
    if (s.img !== shownImg && rail.offsetParent) {
      shownImg = s.img;
      const next = imgs[1 - front], cur = imgs[front];
      if (s.img) {
        next.onload = () => { next.classList.add('on'); cur.classList.remove('on'); };
        next.src = s.img;
        front = 1 - front;
      } else imgs.forEach(i => i.classList.remove('on'));
    }
    $('rStage').textContent = s.stage || '아직 아무것도 없음';
    $('rRec').textContent = s.rec;
    $('rNight').textContent = s.night;
    $('rAcc').textContent = s.acc ? man(s.acc) : '0원';
    $('bDate').textContent = `${dt.getMonth() + 1}월 ${dt.getDate()}일`;
    $('bBal').textContent = man(s.bal);
    $('bBal').classList.toggle('neg', s.bal < 0);
    $('bStage').textContent = s.stage;
    $('bLv').style.width = `${s.level * 100}%`;
  }

  const log = $('log');
  const bar = $('logbar');
  let queued = false;
  function update() {
    queued = false;
    const mark = innerHeight * 0.4;
    let hit = entries[0];
    for (const e of entries) { if (e.getBoundingClientRect().top <= mark) hit = e; else break; }
    render(hit.dataset.d);
    const r = log.querySelector('.log-grid').getBoundingClientRect();
    bar.classList.toggle('on', r.top < 40 && r.bottom > 120);
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
})();
