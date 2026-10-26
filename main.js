(function () {
  var root = document.documentElement;
  var hdr = document.getElementById('hdr');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- live clock ----
  var clockEl = document.getElementById('clock');
  function now() { var d = new Date(); return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, '0'); }).join(':'); }
  function tick() { clockEl.textContent = now(); }
  tick(); setInterval(tick, 1000);

  // ---- recognition panel, driven by progress 0..1 ----
  var PLATE = 'А 123 ВС 77';
  var plateEl = document.getElementById('plate');
  var labelEl = document.getElementById('pLabel');
  var progEl = document.getElementById('prog');
  var panel = document.getElementById('panel');
  var attrsEl = document.getElementById('attrs');
  var ATTRS = [
    { k: 'Время', at: 0.44 },
    { k: 'Тип', v: 'Легковой', at: 0.50 },
    { k: 'Цвет', v: 'Белый', at: 0.56 },
    { k: 'Марка', v: 'Toyota', at: 0.62 },
    { k: 'Модель', v: 'Camry', at: 0.67 },
    { k: 'Номер', v: PLATE, at: 0.76 }
  ];
  var dd = {};
  ['Номер', 'Марка', 'Модель', 'Цвет', 'Тип', 'Время'].forEach(function (k) {
    var row = document.createElement('div');
    var dt = document.createElement('dt'); dt.textContent = k;
    var d = document.createElement('dd');
    row.appendChild(dt); row.appendChild(d); attrsEl.appendChild(row); dd[k] = d;
  });
  var chars = PLATE.split('');
  var slots = chars.filter(function (c) { return c !== ' '; }).length;
  var stamp = null, last = -1;

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function render(p) {
    var key = Math.round(p * 400);
    if (key === last) return; last = key;
    var state = p < 0.44 ? 'empty' : p < 0.8 ? 'reading' : 'done';
    panel.setAttribute('data-state', state);
    labelEl.textContent = state === 'empty' ? 'Ожидание' : state === 'reading' ? 'Распознавание' : 'Распознано';
    if (state === 'empty') stamp = null; else if (!stamp) stamp = now();
    var shown = Math.floor(clamp((p - 0.46) / 0.28) * slots + 0.0001);
    var html = '', n = 0;
    chars.forEach(function (c) {
      if (c === ' ') { html += ' '; return; }
      html += n < shown ? '<span class="on">' + c + '</span>' : '<span class="ph">_</span>';
      n++;
    });
    plateEl.innerHTML = html;
    progEl.style.width = (clamp((p - 0.44) / 0.36) * 100) + '%';
    ATTRS.forEach(function (a) {
      var on = p >= a.at;
      dd[a.k].textContent = on ? (a.k === 'Время' ? stamp : a.v) : '···';
      dd[a.k].className = on ? '' : 'wait';
    });
  }

  // ---- header island ----
  function onScroll(y) { hdr.classList.toggle('is-island', y > 48); }

  if (!(window.gsap && window.ScrollTrigger) || reduce) {
    render(1);
    onScroll(window.scrollY);
    window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
    return;
  }

  root.classList.remove('is-static');
  gsap.registerPlugin(ScrollTrigger);
  render(0);

  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', function (e) { ScrollTrigger.update(); onScroll(e.scroll); });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
  }

  // hero sequence: car drives in from the right, frame locks on, plate is read
  function heroTimeline(st) {
    var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: st });
    tl.to('#hint', { autoAlpha: 0, duration: 0.06 }, 0)
      .to('#copy', { y: -24, autoAlpha: 0.55, duration: 0.4, ease: 'power1.inOut' }, 0)
      .fromTo('#car', { x: function () { return window.innerWidth * 0.55; }, autoAlpha: 0.9 }, { x: 0, autoAlpha: 1, duration: 0.34, ease: 'power2.out' }, 0)
      .fromTo('#frame', { scale: 1.08, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.08, ease: 'power3.out' }, 0.34)
      .fromTo('#chip', { y: -6, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.04 }, 0.4)
      .to({}, { duration: 1 }, 0);
    return tl;
  }
  var mm = gsap.matchMedia();
  mm.add('(min-width: 861px)', function () {
    heroTimeline({ trigger: '#top', start: 'top top', end: '+=180%', scrub: 0.6, pin: '#heroPin', anticipatePin: 1, onUpdate: function (s) { render(s.progress); } });
  });
  mm.add('(max-width: 860px)', function () {
    heroTimeline({ trigger: '#stage', start: 'top 75%', end: 'bottom 35%', scrub: 0.6, onUpdate: function (s) { render(s.progress); } });
  });

  // section reveals start from a visible state and only move
  gsap.utils.toArray('[data-reveal]').forEach(function (el) {
    gsap.from(el, { y: 40, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  gsap.utils.toArray('[data-stagger]').forEach(function (grid) {
    gsap.from(grid.children, { y: 48, duration: 0.9, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: grid, start: 'top 85%' } });
  });

  // anchor links through Lenis
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var t = id === '#top' ? 0 : document.querySelector(id);
      if (t === null) return;
      e.preventDefault();
      if (lenis) { lenis.scrollTo(t, { offset: id === '#top' ? 0 : -96, duration: 1.4 }); return; }
      var y = t === 0 ? 0 : t.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
