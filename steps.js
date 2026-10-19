/* Alez Tech: i passaggi 01-04 ("Come lavoro" in home, "Come lo costruisco" nelle pagine dei servizi).
   I segmenti tra un cerchio e l'altro si riempiono di indaco mentre scorri e accendono i badge raggiunti;
   tornando su si svuotano. Senza questo file i segmenti restano pieni e i badge accesi. */
(() => {
  'use strict';

  const d = document;
  const lists = [...d.querySelectorAll('.steps')];
  if (!lists.length) return;

  const items = lists.map((list) => ({ list, steps: [...list.querySelectorAll('.step')], marks: [], len: 0 }));
  items.forEach((it) => it.list.classList.add('steps--live'));

  // inizio di ogni passaggio nella lista: il cerchio sta in cima al passaggio, alto 52 px
  const measure = () => items.forEach((it) => {
    it.marks = it.steps.map((s) => s.offsetTop);
    it.len = it.marks[it.marks.length - 1] || 0;
  });

  let frame = 0;
  const update = () => {
    frame = 0;
    if (!items[0].len) measure();
    const vh = window.innerHeight || d.documentElement.clientHeight;
    const rects = items.map((it) => it.list.getBoundingClientRect());
    items.forEach((it, i) => {
      const r = rects[i];
      // parte quando la lista arriva al 65% dello schermo, finisce quando il suo fondo passa il 55%
      const p = Math.min(1, Math.max(0, (vh * 0.65 - r.top) / (r.height + vh * 0.1)));
      // la punta avanza dal centro del primo cerchio (26 px) al centro dell'ultimo
      const tip = 26 + p * it.len;
      it.steps.forEach((s, j) => {
        s.classList.toggle('is-reached', p > 0.98 || tip >= it.marks[j] + 20);
        const next = it.marks[j + 1];
        if (next === undefined) return;
        // segmento j: dal bordo sotto il suo cerchio (inizio + 58) a 6 px dal cerchio dopo
        const a = it.marks[j] + 58;
        const b = next - 6;
        s.style.setProperty('--fill', Math.min(1, Math.max(0, (tip - a) / (b - a))).toFixed(3));
      });
    });
  };
  const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
  const remeasure = () => { measure(); queue(); };

  // finestra, documento in cattura (anche html o body che scorrono) e dito: qualunque cosa muova la pagina
  window.addEventListener('scroll', queue, { passive: true });
  d.addEventListener('scroll', queue, { passive: true, capture: true });
  window.addEventListener('touchmove', queue, { passive: true });
  let resizeId = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeId); resizeId = setTimeout(remeasure, 150); });
  // le misure vere arrivano a pagina caricata e con i font al loro posto
  if (d.readyState === 'complete') requestAnimationFrame(remeasure);
  else window.addEventListener('load', () => requestAnimationFrame(remeasure), { once: true });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(remeasure);
  queue();
})();
