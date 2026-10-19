/* Alez Tech: le demo interattive.
   1. Tour automatico: all'apertura la pagina scorre da sola fino al fondo.
      Al primo tocco, rotella, tasto o scorrimento a mano il tour si ferma e la demo e' tua.
   2. Comandi veri: schede, filtri, scelte, contatori, carrello con totale e spedizione.
   Nessun dato esce dalla pagina: messaggi, richieste e ordini sono simulati e la pagina lo dice. */
(() => {
  'use strict';

  const d = document;
  const root = d.documentElement;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  // 1.170,00 €: il punto delle migliaia lo mettiamo noi, perche' toLocaleString in italiano lo salta sotto i 10.000
  const euro = (n) => {
    const [int, dec] = n.toFixed(2).split('.');
    return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`;
  };
  const upFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const fill = (tpl, data) => tpl.replace(/\{(\w+)\}/g, (m, k) => (data[k] == null ? '' : String(data[k])));
  const jumpTo = (y) => { try { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); } };

  /* ---------- Avviso in basso ---------- */
  const toastEl = d.querySelector('.d-toast');
  let toastTimer = 0;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-on');
      setTimeout(() => { toastEl.hidden = true; }, 300);
    }, 3400);
  };
  d.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toast]');
    if (!t) return;
    e.preventDefault();
    toast(t.dataset.toast);
  });

  /* ---------- Schede (menu, trattamenti, corsi): clic e frecce della tastiera ---------- */
  d.querySelectorAll('[data-tabs]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        d.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    });
  });

  /* ---------- Filtri del catalogo ---------- */
  d.querySelectorAll('[data-filters]').forEach((bar) => {
    const items = [...d.querySelectorAll(bar.dataset.filters)];
    const count = d.querySelector('[data-filter-count]');
    const buttons = [...bar.querySelectorAll('[data-filter]')];
    buttons.forEach((b) => b.addEventListener('click', () => {
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const f = b.dataset.filter;
      let shown = 0;
      items.forEach((it) => {
        it.hidden = f !== 'tutti' && it.dataset.cat !== f;
        if (!it.hidden) shown += 1;
      });
      if (count) count.textContent = shown === 1 ? '1 prodotto' : `${shown} prodotti`;
    }));
  });

  /* ---------- Prenotazioni: scelte, contatori, campi, riepilogo e messaggio ----------
     data-required: le scelte senza cui non si invia. data-price-key e data-qty-key: il totale
     (prezzo della scelta per quantita'). Il riepilogo e il messaggio usano {chiave} dello stato. */
  d.querySelectorAll('[data-booking]').forEach((form) => {
    const state = {};
    const required = (form.dataset.required || '').split(',').filter(Boolean);
    const summary = form.querySelector('[data-summary]');
    const totalEl = form.querySelector('[data-total]');
    const submit = form.querySelector('[data-submit]');
    const result = form.querySelector('[data-result]');
    const render = () => {
      const missing = required.filter((k) => !state[k]);
      if (form.dataset.priceKey) {
        const total = (state[`${form.dataset.priceKey}Price`] || 0) * (state[form.dataset.qtyKey] || 0);
        state.totale = euro(total);
        if (totalEl) totalEl.textContent = total ? euro(total) : '—';
      }
      if (summary) {
        summary.textContent = missing.length ? summary.dataset.empty : upFirst(fill(summary.dataset.template, state));
        summary.classList.toggle('is-empty', missing.length > 0);
      }
      if (submit) submit.disabled = missing.length > 0;
      if (result && !result.hidden && missing.length) result.hidden = true;
    };
    form.querySelectorAll('[data-choice]').forEach((group) => {
      const key = group.dataset.choice;
      const buttons = [...group.querySelectorAll('button')];
      const pick = (b) => {
        buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        state[key] = b.dataset.value || b.textContent.trim();
        if (b.dataset.price) state[`${key}Price`] = Number(b.dataset.price);
        if (result) result.hidden = true;
        render();
      };
      buttons.forEach((b) => {
        if (!b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => pick(b));
      });
      const pre = buttons.find((b) => b.getAttribute('aria-pressed') === 'true');
      if (pre) pick(pre);
    });
    form.querySelectorAll('[data-stepper]').forEach((st) => {
      const key = st.dataset.stepper;
      const min = Number(st.dataset.min || 1);
      const max = Number(st.dataset.max || 10);
      const [one, many] = (st.dataset.unit || '|').split('|');
      const out = st.querySelector('output');
      const minus = st.querySelector('[data-step="-1"]');
      const plus = st.querySelector('[data-step="1"]');
      const set = (v) => {
        const n = clamp(v, min, max);
        state[key] = n;
        state[`${key}Testo`] = `${n} ${n === 1 ? one : many}`.trim();
        out.textContent = String(n);
        minus.disabled = n <= min;
        plus.disabled = n >= max;
        if (result) result.hidden = true;
        render();
      };
      minus.addEventListener('click', () => set(state[key] - 1));
      plus.addEventListener('click', () => set(state[key] + 1));
      set(Number(st.dataset.value || min));
    });
    form.querySelectorAll('[data-field]').forEach((input) => {
      const key = input.dataset.field;
      const phrase = input.dataset.phrase || '{v}';
      const update = () => {
        const v = input.value.trim();
        state[key] = v;
        state[`${key}Frase`] = v ? ` ${phrase.replace('{v}', v)}` : '';
        render();
      };
      input.addEventListener('input', update);
      update();
    });
    if (submit && result) {
      submit.addEventListener('click', () => {
        result.querySelectorAll('[data-template]').forEach((el) => { el.textContent = fill(el.dataset.template, state); });
        result.hidden = false;
        if (submit.dataset.toast) toast(submit.dataset.toast);
      });
    }
    render();
  });

  /* ---------- Carrello (Rossobrace) ---------- */
  (function cart() {
    const box = d.querySelector('[data-cart]');
    if (!box) return;
    const freeOver = Number(box.dataset.freeOver || 0);
    const shipCost = Number(box.dataset.ship || 0);
    const lines = new Map();
    const list = box.querySelector('[data-cart-list]');
    const sub = box.querySelector('[data-subtotal]');
    const ship = box.querySelector('[data-shipping]');
    const total = box.querySelector('[data-cart-total]');
    const shipText = box.querySelector('[data-ship-text]');
    const shipBar = box.querySelector('[data-ship-bar]');
    const checkout = box.querySelector('[data-checkout]');
    const result = box.querySelector('[data-cart-result]');
    const counts = d.querySelectorAll('[data-cart-count]');

    const render = () => {
      list.textContent = '';
      let subtotal = 0;
      let pieces = 0;
      lines.forEach((line, id) => {
        subtotal += line.price * line.qty;
        pieces += line.qty;
        const row = d.createElement('li');
        row.className = 'd-cart-line';
        row.innerHTML = `<span><b></b><br><small></small></span>
          <span class="d-stepper"><button class="d-step" type="button" aria-label="Togli uno">−</button><output></output><button class="d-step" type="button" aria-label="Aggiungi uno">+</button></span>
          <b class="d-price"></b>`;
        row.querySelector('b').textContent = line.name;
        row.querySelector('small').textContent = `${euro(line.price)} l'uno`;
        row.querySelector('output').textContent = String(line.qty);
        row.querySelector('.d-price').textContent = euro(line.price * line.qty);
        const [minus, plus] = row.querySelectorAll('.d-step');
        minus.addEventListener('click', () => change(id, -1));
        plus.addEventListener('click', () => change(id, 1));
        list.appendChild(row);
      });
      if (!lines.size) {
        const empty = d.createElement('li');
        empty.className = 'd-cart-empty';
        empty.textContent = 'Il carrello è vuoto: aggiungi un prodotto dal catalogo.';
        list.appendChild(empty);
      }
      const free = subtotal >= freeOver;
      const shipping = !subtotal || free ? 0 : shipCost;
      sub.textContent = euro(subtotal);
      ship.textContent = !subtotal ? '—' : free ? 'gratis' : euro(shipCost);
      total.textContent = euro(subtotal + shipping);
      shipText.textContent = !subtotal ? `Spedizione gratis da ${euro(freeOver)}` : free
        ? 'Spedizione gratis: ci pensiamo noi'
        : `Ti mancano ${euro(freeOver - subtotal)} per la spedizione gratis`;
      shipBar.style.transform = `scaleX(${clamp(subtotal / freeOver, 0, 1)})`;
      counts.forEach((c) => { c.textContent = String(pieces); });
      checkout.disabled = !lines.size;
      box.dataset.pieces = String(pieces);
      box.dataset.total = euro(subtotal + shipping);
    };
    const change = (id, delta, product) => {
      const line = lines.get(id) || (product && { ...product, qty: 0 });
      if (!line) return;
      line.qty += delta;
      if (line.qty <= 0) lines.delete(id);
      else lines.set(id, line);
      if (result) result.hidden = true;
      render();
    };
    d.querySelectorAll('[data-product]').forEach((card) => {
      const product = { name: card.dataset.name, price: Number(card.dataset.price) };
      const add = card.querySelector('[data-add]');
      add.addEventListener('click', () => {
        change(card.dataset.product, 1, product);
        add.textContent = 'Aggiunto';
        toast(`${product.name} nel carrello`);
        setTimeout(() => { add.textContent = 'Aggiungi'; }, 1200);
      });
      const start = Number(card.dataset.start || 0);
      if (start) change(card.dataset.product, start, product);
    });
    checkout.addEventListener('click', () => {
      const pieces = Number(box.dataset.pieces);
      result.querySelector('[data-cart-summary]').textContent = `${pieces === 1 ? '1 prodotto' : `${pieces} prodotti`}, totale ${box.dataset.total}.`;
      result.hidden = false;
    });
    render();
  })();

  /* ---------- Tour automatico: la pagina scorre da sola ----------
     Dopo 0,4 secondi la pagina scorre davvero, con lo scroll nativo della finestra: niente transform sul
     contenuto. A ogni fotogramma tourScrollPos cresce di 0,115 px per millisecondo trascorso (115 px al secondo)
     e la finestra va li', con i decimali (il browser la posa sul pixel fisico dello schermo).
     Al primo tocco, clic, rotella, tasto o "Ferma" si cancella soltanto il fotogramma in attesa: nessuno
     scrollTo, nessun transform, nessun padding toccato. La pagina resta nel punto esatto in cui la vedi. */
  (function tour() {
    const ui = d.querySelector('[data-tour-ui]');
    if (!ui) return;
    const text = ui.querySelector('.tour-text');
    const btn = ui.querySelector('.tour-btn');
    const bar = ui.querySelector('.tour-bar i');
    const SPEED = 115; // px al secondo
    const LABELS = {
      waiting: ['Tour automatico in corso · Tocca la pagina per interagire', 'Ferma'],
      running: ['Tour automatico in corso · Tocca la pagina per interagire', 'Ferma'],
      paused: ['Tour in pausa: ora scorri e prova la demo', 'Riprendi il tour'],
      done: ['Tour finito: prova i pulsanti della demo', 'Rivedi il tour'],
    };
    let mode = 'idle';
    let tourRafId = 0;
    let timer = 0;
    let tourScrollPos = 0;
    let last = 0;

    const setMode = (m) => {
      mode = m;
      ui.dataset.state = m;
      ui.hidden = false;
      [text.textContent, btn.textContent] = LABELS[m];
    };
    const maxY = () => Math.max(0, root.scrollHeight - window.innerHeight);
    const step = (now) => {
      if (mode !== 'running') return;
      // la pagina non e' dove l'abbiamo messa: l'ha spostata chi guarda (barra di scorrimento, tastiera)
      if (Math.abs(window.scrollY - tourScrollPos) > 3) { pause(); return; }
      tourScrollPos = Math.min(maxY(), tourScrollPos + (SPEED / 1000) * Math.min(64, now - last));
      last = now;
      jumpTo(tourScrollPos);
      bar.style.transform = `scaleX(${(maxY() ? tourScrollPos / maxY() : 1).toFixed(4)})`;
      if (tourScrollPos >= maxY() - 0.5) { finish(); return; }
      tourRafId = requestAnimationFrame(step);
    };
    const run = () => {
      tourScrollPos = window.scrollY;
      setMode('running');
      tourRafId = requestAnimationFrame((now) => { last = now; tourRafId = requestAnimationFrame(step); });
    };
    // alla pausa solo questo: niente scrollTo, niente transform
    const stop = () => { cancelAnimationFrame(tourRafId); clearTimeout(timer); };
    const pause = () => {
      if (mode !== 'running' && mode !== 'waiting') return;
      stop();
      setMode('paused');
    };
    const finish = () => {
      stop();
      bar.style.transform = 'scaleX(1)';
      setMode('done');
    };

    // tocco, clic, rotella e tasti fuori dalla pillola del tour lo fermano all'istante
    ['touchstart', 'mousedown', 'pointerdown', 'wheel', 'keydown'].forEach((type) => {
      window.addEventListener(type, (e) => {
        if (e.target instanceof Node && ui.contains(e.target)) return;
        pause();
      }, { passive: true, capture: true });
    });
    d.addEventListener('visibilitychange', () => { if (d.hidden) pause(); });
    btn.addEventListener('click', () => {
      if (mode === 'running' || mode === 'waiting') pause();
      else if (mode === 'paused') run();
      else { jumpTo(0); setMode('waiting'); timer = setTimeout(run, 400); }
    });

    // parte da solo, ma non per chi arriva su un'ancora o torna indietro col browser
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    if (window.location.hash || (nav && nav.type === 'back_forward')) { setMode('paused'); return; }
    setMode('waiting');
    bar.style.transform = 'scaleX(0)';
    // 0,4 secondi fermo in cima, contati da quando la pagina e' pronta
    const go = () => { timer = setTimeout(() => { if (mode === 'waiting') run(); }, 400); };
    if (d.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  })();
})();
