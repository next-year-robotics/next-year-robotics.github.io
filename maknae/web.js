let currentVideo;
const userPaused = new WeakSet();

export function startVideo(video, { at, withSound = video.dataset.sound === '1' } = {}) {
  if (currentVideo !== video) currentVideo?.pause();
  currentVideo = video;
  if (!video.hasAttribute('src')) video.src = video.dataset.src;
  video.muted = !withSound;
  userPaused.delete(video);
  if (at !== undefined) video.currentTime = at;
  return video.play().catch(() => {});
}

function setupPlayers() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const posters = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      target.poster = target.dataset.poster;
      posters.unobserve(target);
    }
  }, { rootMargin: '500px 0px' });
  const visibleVideos = new Map();
  const playback = new IntersectionObserver(entries => {
    for (const { target, isIntersecting, intersectionRatio } of entries) {
      if (!isIntersecting) target.pause();
      if (intersectionRatio >= 0.55) visibleVideos.set(target, intersectionRatio);
      else visibleVideos.delete(target);
    }
    if (reducedMotion.matches || (currentVideo && !currentVideo.paused)) return;
    const next = [...visibleVideos].filter(([video]) =>
      !video.hasAttribute('data-manual') && !userPaused.has(video) && !video.ended)
      .sort((a, b) => b[1] - a[1])[0];
    if (next) startVideo(next[0], { withSound: false });
  }, { threshold: [0, 0.55] });

  for (const player of document.querySelectorAll('.web-player')) {
    const video = player.querySelector('video');
    const button = player.querySelector('button');
    const progress = player.parentElement.querySelector('[data-prog]');
    function updateLabel() {
      const start = video.dataset.sound === '1' ? '소리와 함께 재생' : '영상 재생';
      const label = video.ended ? '다시 재생' : (video.paused ? start : '일시정지');
      if (button.textContent !== label) button.textContent = label;
    }
    button.addEventListener('click', () => {
      if (video.paused || video.ended) startVideo(video, { at: video.ended ? 0 : undefined });
      else {
        userPaused.add(video);
        video.pause();
      }
    });
    for (const event of ['play', 'pause', 'ended']) video.addEventListener(event, updateLabel);
    if (progress) video.addEventListener('timeupdate', () => {
      if (video.duration) progress.style.width = `${100 * video.currentTime / video.duration}%`;
    });
    posters.observe(video);
    playback.observe(video);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) currentVideo?.pause();
  });
}

const number = new Intl.NumberFormat('ko-KR');

function articleFor(slide, index, state, layouts, phases, formatDate) {
  const article = document.createElement('article');
  article.id = `slide-${index + 1}`;
  article.className = `entry entry-${slide.lay}`;
  article.dataset.slide = index;
  const date = slide.d ? `<div class="entry-date"><time datetime="${slide.d}">${formatDate(slide.d)}</time><span>${phases[slide.act] || ''}</span></div>` : '';
  const calendar = slide.d ? `<details class="entry-calendar"><summary>이날의 일력</summary><div><span>잔고 <b>${number.format(state.bal)}원</b></span><span>기록 <b>${state.rec}건</b></span>${state.stage ? `<span>조립 상태 <b>${state.stage}</b></span>` : ''}</div></details>` : '';
  article.innerHTML = `${date}${layouts[slide.lay](slide)}${calendar}`;
  const localHeading = article.querySelector('h1,h3');
  if (localHeading) {
    localHeading.id = `${article.id}-title`;
    article.setAttribute('aria-labelledby', localHeading.id);
  }
  for (const table of article.querySelectorAll('table')) {
    const scroller = document.createElement('div');
    scroller.className = 'table-scroll';
    table.before(scroller);
    scroller.append(table);
  }
  return article;
}

export function setupStory({ sections, slides, states, layouts, phases, formatDate, initCalendar, updateCalendar, initDualSync }) {
  const story = document.getElementById('story');
  const chapters = document.getElementById('chapters');
  const timeline = document.createDocumentFragment();
  const bySection = sections.map(() => []);

  for (const [index, slide] of slides.entries()) {
    bySection[slide.sec].push(articleFor(slide, index, states[index], layouts, phases, formatDate));
  }
  for (const [index, section] of sections.entries()) {
    const chapter = document.createElement('section');
    chapter.id = section.id;
    chapter.className = 'chapter';
    if (section.title) {
      const link = document.createElement('a');
      link.href = `#${section.id}`;
      link.textContent = section.title;
      chapters.append(link);
      const heading = document.createElement('h2');
      heading.className = 'chapter-heading';
      heading.id = `${section.id}-title`;
      heading.innerHTML = `<span aria-hidden="true">${section.number}</span>${section.title}`;
      chapter.setAttribute('aria-labelledby', heading.id);
      chapter.append(heading);
    }
    const entries = document.createElement('div');
    entries.className = 'chapter-entries';
    entries.append(...bySection[index]);
    if (section.id === 'timeline') {
      const grid = document.createElement('div');
      grid.className = 'timeline-grid';
      grid.append(entries, document.getElementById('calendar-template').content.cloneNode(true));
      chapter.append(grid);
    } else chapter.append(entries);
    timeline.append(chapter);
  }
  story.replaceChildren(timeline);
  initCalendar();
  for (const slide of slides.keys()) {
    if (slides[slide].lay === 'dual_sync') initDualSync(document.getElementById(`slide-${slide + 1}`), slides[slide]);
  }
  setupPlayers();

  const chapterElements = [...story.querySelectorAll('.chapter')];
  const dates = [...story.querySelectorAll('#timeline .entry:has(time)')];
  const links = [...chapters.querySelectorAll('a')];
  let currentChapter;
  let currentDate;
  let waiting = false;
  function updateProgress() {
    waiting = false;
    const mark = Math.max(120, innerHeight * 0.36);
    const chapter = chapterElements.findLast(element => element.getBoundingClientRect().top <= mark);
    if (chapter !== currentChapter) {
      for (const link of links) {
        if (link.hash === `#${chapter?.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
      currentChapter = chapter;
    }
    const date = dates.findLast(element => element.getBoundingClientRect().top <= mark) ?? dates[0];
    if (date && date !== currentDate) {
      updateCalendar(Number(date.dataset.slide));
      currentDate = date;
    }
  }
  function queueUpdate() {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(updateProgress);
  }
  addEventListener('scroll', queueUpdate, { passive: true });
  addEventListener('resize', queueUpdate);
  updateProgress();
  if (location.hash.length > 1) {
    requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
  }
}
