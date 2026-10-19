/* Alez Tech (aleztech.it): interazioni del sito. Senza GSAP, Lenis o WebGL la pagina resta completa e leggibile.
   Le animazioni girano per tutti, anche con "riduci movimento" attivo nel telefono (molti Android lo accendono
   col risparmio energetico): chi vuole fermarle usa il pulsante "Metti in pausa le animazioni" nel footer. */
(() => {
  'use strict';

  const d = document;
  const root = d.documentElement;
  const mq = (q) => window.matchMedia(q).matches;
  const finePointer = mq('(hover: hover) and (pointer: fine)');
  const small = window.innerWidth < 768;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const hasGsap = Boolean(gsap && ScrollTrigger);

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const debounce = (fn, ms) => {
    let id = 0;
    return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
  };
  // misura un elemento fuori dai fotogrammi e tiene il risultato per un po'. Leggere il layout dentro
  // un fotogramma o a ogni movimento del dito costringe il browser a ricalcolarlo da capo e scatta.
  const liveBox = (el, maxAge) => {
    const b = { x: 0, y: 0, w: 0, h: 0, at: -1, queued: false };
    const read = () => {
      b.queued = false;
      const r = el.getBoundingClientRect();
      b.x = r.left + window.scrollX;
      b.y = r.top + window.scrollY;
      b.w = r.width;
      b.h = r.height;
      b.at = performance.now();
    };
    return () => {
      if (b.at < 0) read();
      else if (!b.queued && performance.now() - b.at > maxAge) { b.queued = true; setTimeout(read, 0); }
      return { left: b.x - window.scrollX, top: b.y - window.scrollY, width: b.w, height: b.h };
    };
  };
  const storage = (kind) => ({
    get(k) { try { return window[kind].getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window[kind].setItem(k, v); } catch (e) { /* storage bloccato */ } },
  });
  const local = storage('localStorage');
  // dura finche' la scheda resta aperta: serve a mostrare la scena d'ingresso una volta sola
  const session = storage('sessionStorage');
  const fontsReady = Promise.race([
    d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 1500)),
  ]);

  root.classList.add('js');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Apertura dall'alto ----------
     La home si apre in cima anche nelle anteprime che ricordano lo scorrimento della pagina precedente.
     Chi torna indietro col browser, chi ricarica, chi arriva con un'ancora e chi torna dal logo di una demo
     (az-return, vedi lo script "nav" in testa alla pagina) restano dove devono essere. */
  const instantTo = (y) => { try { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); } };
  (function startAtTop() {
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    if (window.location.hash || (nav && nav.type !== 'navigate') || root.classList.contains('az-return')) return;
    if (window.scrollY > 0) instantTo(0);
  })();

  /* ---------- Pausa delle animazioni automatiche ----------
     Unico interruttore del movimento: la classe .motion-paused ferma ogni animazione CSS (telefono, anteprime,
     pulsante) e la fascia che corre la legge da "paused". La scelta resta salvata per le visite successive. */
  let paused = local.get('az-pausa') === '1';
  const motionButtons = d.querySelectorAll('[data-motion-toggle]');
  const setPaused = (value) => {
    paused = value;
    root.classList.toggle('motion-paused', value);
    local.set('az-pausa', value ? '1' : '0');
    motionButtons.forEach((b) => {
      b.setAttribute('aria-pressed', String(value));
      b.textContent = value ? 'Riprendi le animazioni' : 'Metti in pausa le animazioni';
    });
  };
  motionButtons.forEach((b) => b.addEventListener('click', () => setPaused(!paused)));
  setPaused(paused);

  /* ---------- Scorrimento morbido (solo mouse) e velocità di scroll ---------- */
  let lenis = null;
  let scrollVel = 0;
  if (finePointer && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1 });
    lenis.on('scroll', (l) => { scrollVel = l.velocity || 0; });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }
  let lastY = window.scrollY;

  /* ---------- Un solo giro di calcoli per fotogramma mentre la pagina si muove ----------
     Ascolta la finestra, il documento in fase di cattura (prende anche lo scorrimento di html o body, come in
     certe anteprime dentro un riquadro), il dito sullo schermo, il ridimensionamento e Lenis. */
  const scrollJobs = [];
  let scrollFrame = 0;
  const runScrollJobs = () => { scrollFrame = 0; scrollJobs.forEach((job) => job()); };
  const queueScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(runScrollJobs); };
  const onScrollFrame = (job) => { scrollJobs.push(job); queueScroll(); };
  window.addEventListener('scroll', queueScroll, { passive: true });
  d.addEventListener('scroll', queueScroll, { passive: true, capture: true });
  window.addEventListener('touchmove', queueScroll, { passive: true });
  window.addEventListener('resize', queueScroll);
  window.addEventListener('load', queueScroll);
  if (lenis) lenis.on('scroll', queueScroll);

  /* ---------- Menu mobile ---------- */
  const header = d.querySelector('[data-header]');
  const toggle = d.querySelector('.menu-toggle');
  const menu = d.getElementById('menu-mobile');
  let menuOpen = false;

  // con il menu aperto la pagina sotto non scorre (html.menu-open); "instant" lo chiude senza la tendina che
  // risale, cosi' quando si sceglie una voce non passa sopra i testi mentre la pagina parte
  function setMenu(open, instant) {
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Chiudi' : 'Menu';
    menu.classList.toggle('is-instant', Boolean(instant));
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    root.classList.toggle('menu-open', open);
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
  }
  const closeMenu = () => { if (menuOpen) setMenu(false); };
  toggle.addEventListener('click', () => setMenu(!menuOpen));
  d.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) { setMenu(false); toggle.focus(); }
  });
  window.addEventListener('resize', debounce(() => { if (window.innerWidth > 880) closeMenu(); }, 150));

  /* ---------- Link interni (menu, header, pulsanti della pagina) ----------
     1. si chiude il menu all'istante e la pagina torna a scorrere;
     2. due fotogrammi dopo, a menu chiuso, si misura dove sta davvero la sezione
        (getBoundingClientRect().top + scrollY - 80) e ci si va con window.scrollTo. scrollIntoView no: dentro
        un riquadro, come nell'anteprima, muove anche la pagina che lo contiene e l'arrivo si sposta;
     3. titolo e card della sezione d'arrivo si accendono subito: prima, all'arrivo, erano ancora trasparenti
        e sullo schermo restava solo la fine della sezione sopra;
     4. a scorrimento finito si rimisura e, se qualcosa si e' mosso durante il viaggio, si corregge. */
  const NAV_GAP = 80;
  let navigating = false;
  // arriva a 80 px dal bordo il titolo h2 della sezione (o l'etichetta subito sopra, come in Prezzi), non il
  // bordo della sezione: tra i due ci sono da 96 a 190 px di spazio interno. Dalla misura si toglie lo
  // spostamento dell'animazione d'ingresso, che all'inizio tiene il titolo 24 px piu' in basso.
  // Sul computer la colonna del titolo di alcune sezioni resta ferma a 112 px mentre scorri: li' si usa
  // l'inizio della sezione, e il titolo si ferma comunque a 112.
  const anchorOf = (el) => {
    const h = el.matches('h2') ? el : el.querySelector('h2');
    if (!h) return el;
    const k = h.previousElementSibling;
    return k && /kicker/.test(k.className) ? k : h;
  };
  const layoutTop = (el) => {
    let shift = 0;
    try { shift = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42; } catch (e) { /* trasformazione illeggibile */ }
    return el.getBoundingClientRect().top - shift;
  };
  const targetY = (el) => {
    const a = anchorOf(el);
    const head = a.closest('.split-head');
    const stuck = head && getComputedStyle(head).position === 'sticky';
    if (a !== el && !stuck) return Math.max(0, Math.round(layoutTop(a) + window.scrollY - NAV_GAP));
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY + pad - NAV_GAP));
  };
  const showSection = (el) => {
    el.querySelectorAll('.reveal').forEach((r) => r.classList.add('is-in'));
  };
  const goTo = (target) => {
    navigating = true;
    showSection(target);
    const settle = () => {
      const y = targetY(target);
      if (Math.abs(window.scrollY - y) > 2) {
        if (lenis) lenis.scrollTo(y, { immediate: true });
        else instantTo(y);
      }
      setTimeout(() => { navigating = false; }, 300);
    };
    const y = targetY(target);
    if (lenis) { lenis.scrollTo(y, { duration: 1.2, onComplete: settle }); return; }
    window.scrollTo({ top: y, behavior: 'smooth' });
    // fine dello scorrimento: la posizione resta ferma per 10 fotogrammi (al massimo 4 secondi)
    let last = -1;
    let still = 0;
    let frames = 0;
    const watch = () => {
      frames += 1;
      if (window.scrollY === last) still += 1;
      else { still = 0; last = window.scrollY; }
      if (still >= 10 || frames > 240) settle();
      else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  };
  d.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    // il logo, gia' nella home, riporta in cima con uno scorrimento morbido
    if (link.matches('.logo')) {
      e.preventDefault();
      if (menuOpen) setMenu(false, true);
      if (lenis) lenis.scrollTo(0, { duration: 1.2 });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const id = link.getAttribute('href');
    if (id.length < 2) return;
    const target = d.getElementById(decodeURIComponent(id.slice(1)));
    if (!target) return;
    e.preventDefault();
    if (menuOpen) setMenu(false, true);
    requestAnimationFrame(() => requestAnimationFrame(() => goTo(target)));
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---------- Header che si nasconde scendendo (non durante un salto dal menu: copre l'arrivo) ---------- */
  const onScroll = () => {
    const y = window.scrollY;
    if (!lenis) scrollVel = lerp(scrollVel, y - lastY, 0.5);
    header.classList.toggle('is-scrolled', y > 24);
    header.classList.toggle('is-hidden', y > lastY && y > 480 && !menuOpen && !navigating);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Fascia che corre con lo scroll ---------- */
  (function band() {
    const el = d.querySelector('.band');
    const track = el && el.querySelector('.band-track');
    if (!el || !track) return;
    root.classList.add('band-js');
    let half = track.scrollWidth / 2;
    let x = 0;
    let dir = -1;
    let skew = 0;
    let visible = true;
    window.addEventListener('resize', debounce(() => { half = track.scrollWidth / 2; }, 150));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(el);
    }
    const loop = () => {
      if (!lenis) scrollVel *= 0.9;
      if (visible && !paused) {
        const v = scrollVel;
        if (Math.abs(v) > 0.4) dir = v > 0 ? -1 : 1;
        x += dir * (1.2 + Math.min(Math.abs(v) * 0.6, 42));
        if (x <= -half) x += half;
        if (x > 0) x -= half;
        skew = lerp(skew, clamp(-v * 0.45, -16, 16), 0.12);
        track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
        el.style.transform = `rotate(-3deg) skewX(${skew.toFixed(2)}deg)`;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  })();

  /* ---------- Lavori: casi studio a scene ----------
     Lo scorrimento automatico delle anteprime e' tutto in CSS (demoAutoScroll): parte da solo, senza script. */
  const works = [...d.querySelectorAll('.work')];

  if (finePointer) {
    works.forEach((w) => {
      const b = w.querySelector('.browser');
      const glare = b.querySelector('.glare') || b;
      const box = liveBox(b, 250);
      b.addEventListener('pointermove', (e) => {
        const r = box();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        b.style.transform = `perspective(1400px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
        glare.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
        glare.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  // la "camera" dentro l'anteprima: ogni scena ha un punto da mettere al centro (x e y in percentuale
  // dell'immagine) e un ingrandimento; l'immagine non esce mai dal riquadro
  const focusOf = (w) => (w.dataset.focus || '50 20 1').split('|').map((f) => f.trim().split(/\s+/).map(Number));
  const cameraAt = (w, f) => {
    const screen = w.querySelector('.screen');
    const img = w.querySelector('.page');
    const [fx, fy, s] = f;
    const sw = screen.clientWidth;
    const sh = screen.clientHeight;
    const iw = sw * s;
    const ih = sw * (Number(img.getAttribute('height')) / Number(img.getAttribute('width'))) * s;
    const x = clamp(sw / 2 - (fx / 100) * iw, sw - iw, 0);
    const y = clamp(sh / 2 - (fy / 100) * ih, sh - ih, 0);
    return { x, y, scale: s, px: x + (fx / 100) * iw, py: y + (fy / 100) * ih };
  };
  const section = d.querySelector('.works');
  // il fondo della sezione prende il colore del progetto sullo schermo; prima del primo e dopo l'ultimo torna notte
  const tint = (w) => {
    if (!section) return;
    const c = w ? w.style.getPropertyValue('--case-bg').trim() : '';
    gsap.to(section, { '--works-bg': c || '#0B0F19', duration: 0.8, overwrite: 'auto' });
  };
  const onCase = (w, i) => (self) => {
    if (self.isActive) tint(w);
    else if ((i === works.length - 1 && self.direction > 0) || (i === 0 && self.direction < 0)) tint(null);
  };

  if (hasGsap && works.length) {
    const mm = gsap.matchMedia();

    // computer: ogni progetto resta fermo mentre scorri; problema, soluzione e risultato si danno il cambio
    // e la camera va sul dettaglio di cui parla la scena
    mm.add('(min-width: 1024px) and (min-height: 640px)', () => {
      root.classList.add('has-cases');
      works.forEach((w, i) => {
        const img = w.querySelector('.page');
        const shade = w.querySelector('.case-shade');
        const ping = w.querySelector('.case-ping');
        const scenes = [...w.querySelectorAll('.scene')];
        const steps = [...w.querySelectorAll('.case-steps li')];
        const F = focusOf(w);
        const cam = (k) => cameraAt(w, F[Math.min(k, F.length - 1)]);
        gsap.set(img, { transformOrigin: '0 0' });
        gsap.set(scenes, { autoAlpha: 0 });
        gsap.set(scenes[0], { autoAlpha: 1 });
        const tl = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          scrollTrigger: {
            trigger: w,
            start: 'top top',
            end: '+=220%',
            pin: true,
            pinType: lenis ? 'transform' : 'fixed',
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const k = Math.min(2, Math.floor(self.progress * 3.2));
              steps.forEach((s, i) => s.classList.toggle('is-on', i <= k));
            },
            onToggle: onCase(w, i),
          },
        });
        tl.set(img, { x: () => cam(0).x, y: () => cam(0).y, scale: () => cam(0).scale }, 0)
          .to(shade, { opacity: 1, duration: 0.5 }, 0.15)
          .to(scenes[0], { autoAlpha: 0, y: -24, duration: 0.4 }, 1)
          .to(shade, { opacity: 0, duration: 0.4 }, 1)
          .to(img, { x: () => cam(1).x, y: () => cam(1).y, scale: () => cam(1).scale, duration: 1 }, 1)
          .fromTo(scenes[1], { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 1.3)
          .to(scenes[1], { autoAlpha: 0, y: -24, duration: 0.4 }, 2.2)
          .to(img, { x: () => cam(2).x, y: () => cam(2).y, scale: () => cam(2).scale, duration: 1 }, 2.2)
          .fromTo(scenes[2], { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 2.5)
          .set(ping, { x: () => cam(2).px, y: () => cam(2).py }, 3.2)
          .fromTo(ping, { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 1.9, duration: 0.6, ease: 'power1.out' }, 3.2)
          .to({}, { duration: 0.5 });
      });
      return () => root.classList.remove('has-cases');
    });

    // telefono e tablet: niente scene bloccate; la finestra si alza in prospettiva mentre arriva
    mm.add('(max-width: 1023px), (max-height: 639px)', () => {
      works.forEach((w, i) => {
        gsap.fromTo(w.querySelector('.browser'), { rotateX: 22, scale: 0.9, y: 36, transformPerspective: 1000, transformOrigin: '50% 100%' }, {
          rotateX: 0, scale: 1, y: 0, ease: 'none',
          scrollTrigger: { trigger: w.querySelector('.case-visual'), start: 'top bottom', end: 'top 45%', scrub: 0.5 },
        });
        ScrollTrigger.create({ trigger: w, start: 'top 60%', end: 'bottom 40%', onToggle: onCase(w, i) });
      });
    });
  }

  /* ---------- Anteprime delle demo: pronte prima che ci arrivi ----------
     Le quattro immagini restano fuori dal primo caricamento, cosi' la pagina parte leggera, ma si scaricano e si
     decodificano subito dopo, quando il browser e' libero: scorrendo fino
     alle demo le trovi gia' vive, con lo scorrimento in corso. Il riquadro ha comunque il colore della demo. */
  (function warmPreviews() {
    const imgs = [...d.querySelectorAll('.screen img.page')];
    if (!imgs.length) return;
    const warm = () => imgs.forEach((img) => {
      img.loading = 'eager';
      if (img.decode) img.decode().catch(() => {});
    });
    const later = () => setTimeout(() => {
      if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 1200 });
      else warm();
    }, 600);
    if (d.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
  })();

  /* ---------- Prezzi: luce che segue il puntatore ---------- */
  d.querySelectorAll('.price').forEach((row) => {
    row.addEventListener('pointermove', (e) => {
      const r = row.getBoundingClientRect();
      row.style.setProperty('--mx', `${e.clientX - r.left}px`);
      row.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
  // il bordo che gira della card in evidenza parte solo quando la card e' vicina allo schermo
  const featured = d.querySelector('.price--featured');
  if (featured) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => featured.classList.toggle('is-near', en.isIntersecting), { rootMargin: '120px 0px' }).observe(featured);
    } else featured.classList.add('is-near');
  }

  /* ---------- Prezzi: la cifra scende dal prezzo dopo il lancio a quello di lancio ----------
     Quando la card e' per meta' sullo schermo il numero parte dal prezzo barrato e in 900 ms arriva al prezzo di
     lancio (curva easeOutQuart); poi un battito di luce e la barratura rossa si disegna sul prezzo vecchio.
     Parte 150 ms dopo che la pagina e' pronta e visibile: chi arriva da "Guarda i prezzi" di una demo lo vede
     per intero, anche se la card era gia' sullo schermo all'apertura.
     Una volta sola per card. Chi legge con uno screen reader sente sempre e solo il prezzo di lancio.
     Con la pausa delle animazioni, o senza script, i prezzi restano fermi e barrati. */
  (function priceCountdown() {
    if (paused || !('IntersectionObserver' in window)) return;
    const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const ease = (t) => 1 - (1 - t) ** 4;
    const cards = [...d.querySelectorAll('.price')].map((card) => {
      const num = card.querySelector('.price-num');
      const was = card.querySelector('.price-was s');
      if (!num || !was) return null;
      const to = parseInt(num.textContent.replace(/\D/g, ''), 10);
      const from = parseInt(was.textContent.replace(/\D/g, ''), 10);
      return to && from > to ? { card, num, from, to } : null;
    }).filter(Boolean);
    if (!cards.length) return;
    cards.forEach((c) => {
      const sr = d.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = `${fmt(c.to)} €`;
      c.num.before(sr);
      c.num.setAttribute('aria-hidden', 'true');
      const euroSign = c.num.nextElementSibling;
      if (euroSign) euroSign.setAttribute('aria-hidden', 'true');
      // la cifra mostra gia' il prezzo pieno: quando la card entra non salta, scende
      c.num.textContent = fmt(c.from);
      c.card.classList.add('is-counting');
    });
    const run = (c) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / 900);
        c.num.textContent = fmt(Math.round(c.from + (c.to - c.from) * ease(t)));
        if (t < 1) { requestAnimationFrame(step); return; }
        c.card.classList.remove('is-counting');
        c.num.classList.add('is-pulse');
      };
      requestAnimationFrame(step);
    };
    // dopo il caricamento e con la pagina in vista, piu' 150 ms
    const whenShown = (fn) => {
      const later = () => setTimeout(fn, 150);
      const visible = () => {
        if (!d.hidden) { later(); return; }
        d.addEventListener('visibilitychange', function once() {
          if (d.hidden) return;
          d.removeEventListener('visibilitychange', once);
          later();
        });
      };
      if (d.readyState === 'complete') visible();
      else window.addEventListener('load', visible, { once: true });
    };
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const c = cards.find((x) => x.card === en.target);
      if (c) whenShown(() => run(c));
    }), { threshold: 0.5 });
    cards.forEach((c) => io.observe(c.card));
  })();

  /* ---------- "Hai pochi secondi": tre blocchi che si accendono uno alla volta mentre scorri ----------
     Un solo avanzamento per tutta la sezione: parte quando il primo blocco entra all'85% dello schermo e finisce
     quando l'ultimo arriva al 55%. Il primo terzo accende il primo blocco, il secondo terzo il secondo, e cosi'
     via: mai due che cambiano insieme. Spento = opacita' 0,22 e 8 px piu' in giu'. Tornando su si rispengono.
     Senza script i blocchi restano pieni. */
  (function textReveal() {
    const parts = [...d.querySelectorAll('.manifesto .ph')];
    if (!parts.length) return;
    root.classList.add('has-ph');
    const n = parts.length;
    const shift = new Map();
    onScrollFrame(() => {
      const vh = window.innerHeight || root.clientHeight;
      // lo spostamento gia' applicato si toglie dalla misura, altrimenti il blocco rincorrerebbe se stesso
      const top = parts[0].getBoundingClientRect().top - (shift.get(parts[0]) || 0);
      const bottom = parts[n - 1].getBoundingClientRect().bottom - (shift.get(parts[n - 1]) || 0);
      const all = clamp((vh * 0.85 - top) / (bottom - top + vh * 0.3), 0, 1);
      parts.forEach((el, i) => {
        const p = clamp(all * n - i, 0, 1);
        const y = 8 * (1 - p);
        shift.set(el, y);
        el.style.opacity = (0.22 + 0.78 * p).toFixed(3);
        el.style.transform = y > 0.01 ? `translateY(${y.toFixed(2)}px)` : 'none';
      });
    });
  })();

  /* ---------- Per chi lavoro: anteprima che segue il mouse ---------- */
  (function sectors() {
    const img = d.querySelector('.sector-preview');
    const rows = [...d.querySelectorAll('.sector a[data-preview]')];
    if (!img || !rows.length || !finePointer) return;
    img.hidden = false;
    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    const move = () => {
      cx = lerp(cx, x, 0.2);
      cy = lerp(cy, y, 0.2);
      img.style.transform = `translate3d(${(cx + 28).toFixed(1)}px, ${(cy - 90).toFixed(1)}px, 0)`;
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.5 ? requestAnimationFrame(move) : 0;
    };
    rows.forEach((a) => {
      a.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        if (img.getAttribute('src') !== a.dataset.preview) img.src = a.dataset.preview;
        if (!img.classList.contains('is-on')) { cx = x = e.clientX; cy = y = e.clientY; }
        img.classList.add('is-on');
        if (!raf) raf = requestAnimationFrame(move);
      });
      a.addEventListener('pointermove', (e) => {
        x = e.clientX;
        y = e.clientY;
        if (!raf) raf = requestAnimationFrame(move);
      });
      a.addEventListener('pointerleave', () => img.classList.remove('is-on'));
    });
  })();

  /* ---------- Menu: la voce della sezione in cui ti trovi ---------- */
  (function navCurrent() {
    const links = [...d.querySelectorAll('.nav-list a[href^="#"]')];
    if (!links.length || !('IntersectionObserver' in window)) return;
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const a = byId.get(en.target.id);
        if (!a) return;
        if (en.isIntersecting) {
          links.forEach((l) => l.removeAttribute('aria-current'));
          a.setAttribute('aria-current', 'true');
        } else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((a, id) => { const s = d.getElementById(id); if (s) io.observe(s); });
  })();

  /* ---------- Contatto: la luce segue il puntatore ---------- */
  (function contactGlow() {
    const el = d.querySelector('.contact');
    if (!el || !finePointer) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    el.addEventListener('pointermove', (e) => {
      px = e.clientX;
      py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--gx', `${Math.round(px - r.left)}px`);
        el.style.setProperty('--gy', `${Math.round(py - r.top)}px`);
      });
    }, { passive: true });
  })();

  /* ---------- Cursore e bottoni magnetici ---------- */
  if (finePointer) {
    const cur = d.querySelector('.cursor');
    const label = cur && cur.querySelector('.cursor-label');
    if (cur) {
      root.classList.add('has-cursor');
      let x = -100;
      let y = -100;
      let cx = x;
      let cy = y;
      let following = false;
      window.addEventListener('pointermove', (e) => {
        x = e.clientX;
        y = e.clientY;
        if (!cur.classList.contains('is-on')) { cx = x; cy = y; cur.classList.add('is-on'); }
        if (!following) { following = true; requestAnimationFrame(follow); }
      }, { passive: true });
      d.documentElement.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
      d.addEventListener('pointerover', (e) => {
        const labelled = e.target.closest('[data-cursor]');
        cur.classList.toggle('has-label', Boolean(labelled));
        if (label) label.textContent = labelled ? labelled.dataset.cursor : '';
        cur.classList.toggle('is-link', !labelled && Boolean(e.target.closest('a, button, summary')));
      });
      const follow = () => {
        cx = lerp(cx, x, 0.22);
        cy = lerp(cy, y, 0.22);
        cur.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
        if (Math.abs(x - cx) + Math.abs(y - cy) > 0.3) requestAnimationFrame(follow);
        else following = false;
      };
    }

    d.querySelectorAll('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${(mx * 0.25).toFixed(1)}px, ${(my * 0.35).toFixed(1)}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Barra fissa di WhatsApp (telefono e tablet) ----------
     Non si vede all'apertura: la hero ha gia' il suo pulsante. Entra appena il pulsante della hero esce dallo
     schermo verso l'alto ed esce con il menu aperto e quando compare il pulsante di "Parliamone" (o lo si e'
     superato, verso il footer). Tornando su, ricompare appena quel pulsante esce dal fondo dello schermo.
     La posizione si rimisura a ogni fotogramma di scorrimento (finestra, documento, dito, Lenis) e in piu'
     la avvisano gli IntersectionObserver: se una delle due strade non arriva, arriva l'altra. */
  (function stickyCta() {
    const bar = d.querySelector('[data-sticky-cta]');
    const heroBtn = d.querySelector('.hero-actions .btn') || d.querySelector('.hero-copy');
    const end = d.querySelector('#contatti .btn') || d.getElementById('contatti');
    if (!bar || !heroBtn) return;
    let on = null;
    const check = () => {
      const vh = window.innerHeight || root.clientHeight;
      // fuori dallo schermo verso l'alto, non verso il basso: su uno schermo basso all'apertura non deve comparire
      const past = heroBtn.getBoundingClientRect().bottom < 0;
      const atEnd = Boolean(end) && end.getBoundingClientRect().top < vh;
      const next = past && !atEnd && !root.classList.contains('menu-open');
      if (next === on) return;
      on = next;
      bar.classList.toggle('is-on', on);
      bar.inert = !on;
    };
    onScrollFrame(check);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(queueScroll);
      [heroBtn, end].filter(Boolean).forEach((el) => io.observe(el));
    }
    new MutationObserver(queueScroll).observe(root, { attributes: true, attributeFilter: ['class'] });
    bar.inert = true;
  })();

  /* ---------- Hero: il telefono ----------
     Ogni 3,5 secondi la schermata dopo: Dodici Braccia, Studio Cuspide, Rossobrace e di nuovo da capo, ognuna
     con la sua notifica. Il CSS spegne la vecchia in 150 ms e solo dopo accende la nuova, e a ogni ingresso fa
     ripartire scorrimento, tocco e notifica. Il giro salta i turni con la pausa delle animazioni, con la scheda
     in sottofondo e quando il telefono non si vede; quando torna in vista riparte subito. */
  (function heroReel() {
    const mock = d.querySelector('.mock');
    if (!mock) return;
    const scenes = [...mock.querySelectorAll('.mock-scene')];
    const notes = [...mock.querySelectorAll('.mock-notif')];
    if (scenes.length < 2) return;
    let k = Math.max(0, scenes.findIndex((sc) => sc.classList.contains('is-on')));
    let inView = true;
    const show = (i) => {
      scenes[k].classList.remove('is-on');
      k = i;
      scenes[i].classList.add('is-on');
      notes.forEach((n, j) => n.classList.toggle('is-on', j === i));
    };
    let timer = 0;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        if (paused || !inView || d.hidden) return;
        show((k + 1) % scenes.length);
      }, 3500);
    };
    // tornando sul telefono (scorrendo su o rientrando nella scheda) non si aspetta il giro successivo del timer,
    // che poteva arrivare fino a 3,5 secondi dopo: la schermata dopo parte subito e il conto ricomincia da li'
    const wake = () => {
      if (paused || !inView || d.hidden) return;
      show((k + 1) % scenes.length);
      start();
    };
    start();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => {
        const was = inView;
        inView = en.isIntersecting;
        mock.classList.toggle('is-idle', !inView);
        if (inView && !was) wake();
      }).observe(mock);
    }
    d.addEventListener('visibilitychange', () => { if (!d.hidden) wake(); });
  })();
  // sul computer non si tocca: si clicca
  if (finePointer) d.querySelectorAll('.live-badge').forEach((b) => { b.lastChild.textContent = b.lastChild.textContent.replace('Tocca', 'Clicca'); });

  /* ---------- Comparsa morbida di titoli e card mentre scorri (opacita' e 24 px verso l'alto) ----------
     La classe la mette lo script: senza script tutto resta visibile da subito.
     Tornando nella home da una demo, quello che c'e' sopra e dentro lo schermo e' gia' acceso: si misura prima
     di nascondere, cosi' non parte nessuna dissolvenza e ritrovi la pagina come l'avevi lasciata.
     (La linea di "Come lavoro" la disegna steps.js, lo stesso file delle pagine dei servizi.) */
  (function reveal() {
    if (!('IntersectionObserver' in window)) return;
    const groups = ['.sec-head', '.split-head', '.price-list', '.service-grid', '.steps', '.faq-list', '.about-text', '.sector-list', '.contact-grid'];
    const els = new Map(); // elemento -> ritardo
    groups.forEach((sel) => d.querySelectorAll(sel).forEach((g) => {
      [...g.children].forEach((el, i) => els.set(el, `${Math.min(i, 5) * 70}ms`));
    }));
    // i titoli delle sezioni entrano interi, come un blocco: niente lettere separate
    d.querySelectorAll('.h2, .contact-title').forEach((h) => { if (!els.has(h)) els.set(h, ''); });
    const vh = window.innerHeight || root.clientHeight;
    const seen = root.classList.contains('az-return')
      ? new Set([...els.keys()].filter((el) => el.getBoundingClientRect().top < vh))
      : null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach((delay, el) => {
      el.classList.add('reveal');
      if (delay) el.style.setProperty('--rd', delay);
      if (seen && seen.has(el)) el.classList.add('is-in');
      else io.observe(el);
    });
  })();

  /* ---------- Arrivo sulla home con un'ancora (#lavori dalle demo, #prezzi dai servizi) ----------
     Il salto del browser avviene prima che ScrollTrigger aggiunga gli spazi delle sezioni bloccate:
     a pagina caricata si ricalcola tutto e si va alla sezione giusta, senza animazione. */
  (function arrive() {
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    if (nav && nav.type === 'back_forward') return; // chi torna indietro resta dove era
    const id = window.location.hash;
    if (id.length < 2) return;
    const go = () => {
      const target = d.getElementById(decodeURIComponent(id.slice(1)));
      if (!target) return;
      if (hasGsap) ScrollTrigger.refresh();
      const y = targetY(target);
      if (lenis) lenis.scrollTo(y, { immediate: true });
      else instantTo(y);
    };
    if (d.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  })();

  /* ---------- Copia numero ---------- */
  d.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const label = 'Copia';
      const done = (text) => {
        btn.textContent = text;
        setTimeout(() => { btn.textContent = label; }, 2200);
      };
      const select = () => {
        const target = d.querySelector(btn.dataset.target);
        if (!target) return done('Non copiato');
        const range = d.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        done('Selezionato');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(btn.dataset.copy).then(() => done('Copiato'), select);
      } else {
        select();
      }
    });
  });

  d.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Chi sono: la foto ----------
     Sul sito la foto e' alessandro.webp. Se non arriva, l'immagine prova i nomi della foto originale (ALE.jpg e simili,
     vedi onerror nella pagina) e poi lascia il monogramma <AZ>. Fuori da aleztech.it (anteprima, file aperto dal
     computer) il monogramma diventa un pulsante: tocchi, scegli una foto dalla galleria, la pagina la ritaglia a
     180 x 180 px e la tiene nel browser (localStorage "alez_photo"). Resta solo su quel dispositivo. */
  (function profilePhoto() {
    const pic = d.querySelector('.profile-pic');
    const mark = pic && pic.querySelector('.profile-mark');
    if (!pic || !mark) return;
    const KEY = 'alez_photo';
    const show = (url) => {
      let img = pic.querySelector('.profile-photo');
      if (!img) {
        img = d.createElement('img');
        img.className = 'profile-photo';
        img.width = 88;
        img.height = 88;
        img.alt = 'Alessandro, fondatore di Alez Tech';
        pic.prepend(img);
      }
      img.onerror = null;
      img.src = url;
      pic.classList.remove('is-missing');
    };
    const saved = local.get(KEY);
    if (saved) {
      if (pic.classList.contains('is-missing')) show(saved);
      else {
        new MutationObserver((changes, obs) => {
          if (!pic.classList.contains('is-missing')) return;
          obs.disconnect();
          show(saved);
        }).observe(pic, { attributes: true, attributeFilter: ['class'] });
      }
    }
    if (/(^|\.)aleztech\.it$/.test(window.location.hostname)) return;
    const input = d.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    pic.append(input);
    pic.classList.add('can-pick');
    mark.removeAttribute('aria-hidden');
    mark.setAttribute('role', 'button');
    mark.setAttribute('aria-label', 'Scegli la foto dalla galleria');
    mark.tabIndex = 0;
    // si tocca il monogramma o, per cambiarla, la foto gia' scelta
    const pick = () => input.click();
    pic.addEventListener('click', (e) => { if (e.target !== input) pick(); });
    mark.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        // quadrato al centro, un po' spostato verso l'alto come object-position: center 15%
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) * 0.15;
        const c = d.createElement('canvas');
        c.width = 180;
        c.height = 180;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, sx, sy, side, side, 0, 0, 180, 180);
        URL.revokeObjectURL(url);
        const data = c.toDataURL('image/jpeg', 0.86);
        local.set(KEY, data);
        show(data);
      };
      img.src = url;
    });
  })();

  if (hasGsap) {
    window.addEventListener('load', () => ScrollTrigger.refresh());
    fontsReady.then(() => ScrollTrigger.refresh());
  }

  /* ---------- Ritorno nella home dal logo di una demo o di una pagina dei servizi ----------
     Lo script "nav" ha gia' messo la pagina nel punto lasciato, prima che si vedesse. Font, immagini e, sul
     computer, gli spazi delle demo bloccate cambiano ancora un po' le altezze: dopo ognuno si rimette in cima allo
     schermo lo stesso blocco, finche' non tocchi, scorri o premi un tasto. */
  (function comeBack() {
    if (typeof window.azHomeY !== 'function') return;
    let moved = false;
    ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach((type) => {
      window.addEventListener(type, () => { moved = true; }, { passive: true, capture: true, once: true });
    });
    const settle = () => {
      if (moved) return;
      const y = window.azHomeY();
      if (Math.abs(window.scrollY - y) < 2) return;
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else instantTo(y);
    };
    // sul computer le demo bloccate allungano la pagina sopra il punto salvato: prima si fanno i conti, poi ci si va
    if (hasGsap) ScrollTrigger.refresh();
    settle();
    // dopo i ricalcoli di ScrollTrigger (registrati sopra, quindi eseguiti prima)
    if (d.readyState === 'complete') setTimeout(settle, 0);
    else window.addEventListener('load', () => setTimeout(settle, 0), { once: true });
    fontsReady.then(() => setTimeout(settle, 0));
  })();
})();
