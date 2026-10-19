// Внутренние страницы v3 (врач, услуга): плавная прокрутка, появление блоков, варианты секций.
// GSAP + ScrollTrigger + Lenis из assets/v3/vendor. Общие скрипты сайта (меню, окно записи, формы, cookie)
// работают рядом и не трогаются. Без скриптов, при «уменьшить движение» и в версии для слабовидящих
// всё видно сразу, варианты показываются такими, как записаны в разметке.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const isA11y = () => root.classList.contains("is-accessibility-mode");
  const G = window.gsap, ST = window.ScrollTrigger;
  const anim = !!(G && ST) && !reduce && !isA11y();
  root.classList.add("v3-ready");
  if (!anim) root.classList.remove("js-anim");
  if (G && ST) G.registerPlugin(ST);

  const header = $(".site-header");
  const modal = $("[data-booking-modal]");
  const headerOffset = () => ($(".site-header__inner")?.getBoundingClientRect().height || 64) + 28;
  const desk = matchMedia("(min-width: 1100px)"), wide = matchMedia("(min-width: 900px)");

  // ---------- плавная прокрутка ----------
  let lenis = null;
  if (anim && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, prevent: (node) => node.matches(".dhq, .dh-assistant, .booking-modal, .site-header__mobile-panel, .cookie-notice, .doctor-certificate-lightbox, .pv-panel__list") });
    lenis.on("scroll", ST.update);
    G.ticker.add((t) => lenis?.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  // цель считается от настоящей прокрутки окна: Lenis мог ещё не узнать о прокрутке клавиатурой или полосой
  const scrollToEl = (el, immediate = false) => {
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset();
    if (lenis) { lenis.scrollTo(top, { duration: 1.3, immediate }); return; }
    window.scrollTo({ top, behavior: immediate || reduce ? "auto" : "smooth" });
  };
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("[data-scroll-target], a[href*='#']");
    if (!a) return;
    let id = a.dataset.scrollTarget;
    if (a.tagName === "A" && a.hash) {
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname) return;
      id = decodeURIComponent(url.hash.slice(1));
    }
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (lenis?.isStopped) requestAnimationFrame(() => requestAnimationFrame(() => scrollToEl(target)));
    else scrollToEl(target);
    history.replaceState(null, "", "#" + id);
  });
  // пока открыто окно записи, меню, сертификат или быстрая запись, страница стоит
  const syncLock = () => {
    const booking = !!modal?.classList.contains("is-open");
    const menu = !!header?.classList.contains("is-mobile-menu-open");
    root.classList.toggle("is-booking-open", booking);
    root.classList.toggle("has-mobile-menu", menu);
    if (!lenis) return;
    const stop = booking || menu || root.classList.contains("dhq-lock") || root.classList.contains("is-certificate-lightbox-open");
    if (stop && !lenis.isStopped) lenis.stop();
    else if (!stop && lenis.isStopped) lenis.start();
  };
  const lockObserver = new MutationObserver(syncLock);
  if (modal) lockObserver.observe(modal, { attributes: true, attributeFilter: ["class"] });
  if (header) lockObserver.observe(header, { attributes: true, attributeFilter: ["class"] });
  lockObserver.observe(root, { attributes: true, attributeFilter: ["class"] });

  // ---------- лента вбок: полоска показывает, сколько ещё листать ----------
  const railProgress = (scroller, bar) => {
    if (!scroller || !bar) return () => {};
    const upd = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      const vis = scroller.clientWidth / Math.max(scroller.scrollWidth, 1);
      const p = max > 0 ? vis + (1 - vis) * (scroller.scrollLeft / max) : 1;
      bar.style.setProperty("--p", Math.min(1, p).toFixed(3));
    };
    scroller.addEventListener("scroll", upd, { passive: true });
    addEventListener("resize", upd);
    upd();
    return () => { scroller.removeEventListener("scroll", upd); removeEventListener("resize", upd); bar.style.removeProperty("--p"); };
  };
  // мышью ленту можно тянуть, как пальцем
  const dragScroll = (el) => {
    if (!fine) return () => {};
    let x0 = 0, s0 = 0, down = false, moved = false;
    const dn = (e) => { if (e.button) return; down = true; moved = false; x0 = e.clientX; s0 = el.scrollLeft; };
    const mv = (e) => { if (!down) return; const dx = e.clientX - x0; if (Math.abs(dx) > 4) { moved = true; el.classList.add("is-drag"); } el.scrollLeft = s0 - dx; };
    const up = () => { down = false; el.classList.remove("is-drag"); };
    const click = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };
    el.addEventListener("pointerdown", dn); addEventListener("pointermove", mv); addEventListener("pointerup", up); el.addEventListener("click", click, true);
    el.addEventListener("dragstart", (e) => e.preventDefault());
    return () => { el.removeEventListener("pointerdown", dn); removeEventListener("pointermove", mv); removeEventListener("pointerup", up); el.removeEventListener("click", click, true); };
  };

  // =====================================================================
  // ВАРИАНТЫ СЕКЦИЙ. Секция с data-vkey: data-variants="Имя1|Имя2|Имя3", выбранный — data-v.
  // У варианта может быть эффект fx[ключ][номер](секция) → функция уборки.
  // =====================================================================
  const secs = $$("[data-vkey]");
  const names = (s) => (s.dataset.variants || "").split("|");
  const getV = (s) => Number(s.dataset.v) || 1;
  const fx = {};
  const live = new Map();
  const runFx = (s) => {
    const prev = live.get(s);
    if (prev) { prev.ctx?.revert(); try { prev.clean?.(); } catch (e) { /* уборка не должна ломать страницу */ } }
    live.delete(s);
    const fn = fx[s.dataset.vkey]?.[getV(s)];
    if (!fn) return;
    let clean;
    const ctx = G ? G.context(() => { clean = fn(s); }) : (clean = fn(s), null);
    live.set(s, { ctx, clean });
  };
  const setV = (s, v, keep = true) => {
    const top0 = s.getBoundingClientRect().top;
    s.dataset.v = String(v);
    runFx(s);
    if (ST) { ST.sort(); ST.refresh(); }
    if (keep) {
      const dy = s.getBoundingClientRect().top - top0;
      if (Math.abs(dy) > 1) { if (lenis) lenis.scrollTo(window.scrollY + dy, { immediate: true }); else window.scrollBy(0, dy); }
    }
  };
  window.__pv = { set: (key, v) => { const s = $(`[data-vkey="${key}"]`); if (s) setV(s, v); }, get: (key) => getV($(`[data-vkey="${key}"]`)), list: () => secs.map((s) => s.dataset.vkey) };

  // ---------- 1. С чем помогает врач, «Строки»: справа снимок пункта под мышью или в центре экрана ----------
  fx.help = {
    1: (s) => {
      if (!desk.matches) return;
      const stage = $(".dhelp__stage", s), items = $$(".dhelp__item", s);
      items.forEach((it) => { const p = $(".dhelp__pic", it); if (p) stage.appendChild(p.cloneNode(true)); });
      const pics = $$("picture", stage);
      pics.forEach((p) => { p.classList.remove("dhelp__pic"); const im = $("img", p); if (im) im.loading = "eager"; });
      s.classList.add("has-stage");
      const on = (i) => { items.forEach((it, k) => it.classList.toggle("is-on", k === i)); pics.forEach((p, k) => p.classList.toggle("is-on", k === i)); };
      on(0);
      const enter = (e) => on(items.indexOf(e.currentTarget));
      items.forEach((it) => it.addEventListener("pointerenter", enter));
      if (ST) items.forEach((it, i) => ST.create({ trigger: it, start: "top 55%", end: "bottom 55%", onToggle: (t) => t.isActive && on(i) }));
      return () => { items.forEach((it) => { it.removeEventListener("pointerenter", enter); it.classList.remove("is-on"); }); stage.innerHTML = ""; s.classList.remove("has-stage"); };
    },
  };

  // ---------- 2. Обучение, «Лента»: на компьютере экран стоит, курсы едут вбок; иначе лента листается ----------
  fx.training = {
    2: (s) => {
      const rail = $(".dtrain__rail", s), list = $(".dtrain__list", s), bar = $(".dtrain__progress", s);
      if (anim && desk.matches) {
        s.classList.add("is-pinned");
        rail.scrollLeft = 0;
        const dist = () => Math.max(0, list.scrollWidth - rail.clientWidth + 2 * parseFloat(getComputedStyle(rail).paddingLeft || 0));
        const tw = G.to(list, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: s, start: "top top", end: () => "+=" + dist(), pin: true, scrub: true, invalidateOnRefresh: true, anticipatePin: 1, onUpdate: (t) => bar?.style.setProperty("--p", (0.06 + 0.94 * t.progress).toFixed(3)) } });
        return () => { s.classList.remove("is-pinned"); tw.scrollTrigger?.kill(true); G.set(list, { clearProps: "transform" }); };
      }
      const a = railProgress(rail, bar), b = dragScroll(rail);
      return () => { a(); b(); };
    },
  };

  // ---------- 3. Документы: «Лента» тянется мышью; «Витрина» показывает выбранный документ крупно ----------
  fx.certificates = {
    2: (s) => {
      const grid = $(".dcerts__grid", s);
      const bar = document.createElement("div");
      bar.className = "rail-progress"; bar.setAttribute("aria-hidden", "true"); bar.innerHTML = "<span></span>";
      $(".dcerts__wrap", s).appendChild(bar);
      const a = railProgress(grid, bar), b = dragScroll(grid);
      return () => { a(); b(); bar.remove(); };
    },
    3: (s) => {
      if (!wide.matches) return;
      const wrap = $(".dcerts__wrap", s), figs = $$(".dcert", s);
      const show = document.createElement("button");
      show.type = "button"; show.className = "dcerts__show"; show.setAttribute("aria-label", "Увеличить документ");
      const img = document.createElement("img"); img.alt = ""; show.appendChild(img);
      wrap.prepend(show);
      s.classList.add("has-show");
      let cur = 0;
      const pick = (i) => {
        cur = i;
        const src = $("img", figs[i]);
        img.src = src.currentSrc || src.src; img.width = src.width; img.height = src.height;
        figs.forEach((f, k) => f.classList.toggle("is-on", k === i));
      };
      pick(0);
      const onClick = (e) => {
        const btn = e.target.closest(".dcert__media");
        if (!btn) return;
        e.preventDefault(); e.stopImmediatePropagation();
        pick(figs.indexOf(btn.closest(".dcert")));
      };
      wrap.addEventListener("click", onClick, true);
      // крупный документ открывает то же окно, что и раньше
      show.addEventListener("click", () => { wrap.removeEventListener("click", onClick, true); $(".dcert__media", figs[cur]).click(); wrap.addEventListener("click", onClick, true); });
      return () => { wrap.removeEventListener("click", onClick, true); show.remove(); s.classList.remove("has-show"); figs.forEach((f) => f.classList.remove("is-on")); };
    },
  };
  // лента «Карточки» на телефоне (врач: помощь; ссылки на услуги)
  const mobileRail = (sel) => (s) => {
    if (desk.matches) return;
    const list = $(sel, s);
    if (!list || list.scrollWidth <= list.clientWidth + 4) return;
    const bar = document.createElement("div");
    bar.className = "rail-progress"; bar.setAttribute("aria-hidden", "true"); bar.innerHTML = "<span></span>";
    list.after(bar);
    const a = railProgress(list, bar);
    return () => { a(); bar.remove(); };
  };
  fx.help[2] = mobileRail(".dhelp__list");
  fx.services = { 2: mobileRail(".plinks__list") };
  fx.related = { 2: mobileRail(".plinks__list") };
  fx.doctors = { 1: mobileRail(".steam__list") };
  Object.assign(fx, window.__pvFx || {});

  secs.forEach(runFx);
  // смена ширины экрана через границу: эффекты собираются заново под новую раскладку
  [desk, wide].forEach((m) => m.addEventListener("change", () => { secs.forEach(runFx); if (ST) ST.refresh(); }));

  // ---------- панель выбора вариантов ----------
  const page = $(".pg")?.dataset.pvPage || "Страница";
  const device = () => (innerWidth >= 1100 ? "компьютер" : innerWidth <= 760 ? "телефон" : "планшет");
  const storeKey = () => "dh-pv-" + location.pathname + "-" + device();
  // выбор Ильи для компьютера закреплён в разметке (data-vd): на компьютере секция стоит в нём и в панель не попадает
  secs.forEach((s) => { s.dataset.v0 = s.dataset.v || "1"; });
  const fixedV = (s) => (device() === "компьютер" && s.dataset.vd ? Number(s.dataset.vd) : 0);
  const active = () => secs.filter((s) => !fixedV(s));
  const load = () => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storeKey()) || "{}"); } catch (e) { /* приватный режим */ }
    secs.forEach((s) => {
      let v = fixedV(s) || saved[s.dataset.vkey];
      if (!(Number.isInteger(v) && v >= 1 && v <= names(s).length)) v = Number(s.dataset.v0);
      if (v !== getV(s)) setV(s, v, false);
    });
  };
  const save = () => { try { localStorage.setItem(storeKey(), JSON.stringify(Object.fromEntries(active().map((s) => [s.dataset.vkey, getV(s)])))); } catch (e) { /* приватный режим */ } };
  if (secs.length && !isA11y()) {
    load();
    const panel = document.createElement("div");
    panel.className = "pv-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Варианты секций");
    panel.innerHTML = '<div class="pv-panel__bar"><span class="pv-panel__name"></span><span class="pv-panel__opts" role="group"></span><button type="button" class="pv-panel__all" aria-expanded="false">Мой выбор</button></div>'
      + '<div class="pv-panel__list" hidden><p class="pv-panel__dev"></p><ul></ul><div class="pv-panel__acts"><button type="button" data-pv-copy>Скопировать выбор</button><button type="button" data-pv-reset>Всё первые</button><button type="button" data-pv-hide>Скрыть панель</button></div></div>';
    document.body.appendChild(panel);
    root.classList.add("has-pv-panel");
    const nameEl = $(".pv-panel__name", panel), opts = $(".pv-panel__opts", panel), list = $(".pv-panel__list", panel), allBtn = $(".pv-panel__all", panel);
    let cur = null;
    const drawList = () => {
      $(".pv-panel__dev", list).textContent = "Выбор для устройства: " + device();
      $("ul", list).innerHTML = secs.map((s, i) => fixedV(s) ? "" : `<li><button type="button" data-go="${i}"><span>${s.dataset.vname}</span><b>${names(s)[getV(s) - 1]}</b></button></li>`).join("");
    };
    const drawBar = () => {
      if (!cur) return;
      nameEl.textContent = cur.dataset.vname;
      opts.innerHTML = names(cur).map((t, i) => `<button type="button" data-v="${i + 1}" aria-pressed="${i + 1 === getV(cur)}">${t}</button>`).join("");
    };
    const pick = () => {
      const y = innerHeight * 0.45;
      let best = null;
      active().forEach((s) => { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) best = s; });
      panel.classList.toggle("is-away", !best);
      if (best && best !== cur) { cur = best; drawBar(); }
    };
    let raf = 0;
    addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; pick(); }); }, { passive: true });
    const change = (s, v) => { setV(s, v); save(); drawBar(); drawList(); };
    opts.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && cur) change(cur, Number(b.dataset.v)); });
    allBtn.addEventListener("click", () => { const open = list.hidden; list.hidden = !open; allBtn.setAttribute("aria-expanded", String(open)); if (open) drawList(); });
    list.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) { scrollToEl(secs[Number(go.dataset.go)]); return; }
      if (e.target.closest("[data-pv-reset]")) { active().forEach((s) => setV(s, 1, false)); save(); drawBar(); drawList(); }
      if (e.target.closest("[data-pv-hide]")) { panel.remove(); root.classList.remove("has-pv-panel"); }
      if (e.target.closest("[data-pv-copy]")) {
        const text = `${page} (${device()}):\n` + active().map((s) => `${s.dataset.vname}: ${names(s)[getV(s) - 1]}`).join("\n");
        const done = () => { const b = $("[data-pv-copy]", list); b.textContent = "Скопировано"; setTimeout(() => (b.textContent = "Скопировать выбор"), 1600); };
        (navigator.clipboard?.writeText(text) || Promise.reject()).then(done, () => { prompt("Скопируйте выбор:", text); });
      }
    });
    addEventListener("keydown", (e) => {
      if (e.target.closest?.("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey || !cur || !panel.isConnected) return;
      const n = Number(e.key);
      if (n >= 1 && n <= names(cur).length) change(cur, n);
    });
    // сменилось устройство (повернули планшет, сузили окно): свой сохранённый выбор
    // когда на устройстве всё уже выбрано, панель не нужна
    const sync = () => { if (!panel.isConnected) return; panel.hidden = !active().length; root.classList.toggle("has-pv-panel", !panel.hidden); if (cur && fixedV(cur)) cur = null; };
    let lastDev = device();
    addEventListener("resize", () => { if (device() !== lastDev) { lastDev = device(); load(); sync(); drawBar(); pick(); } });
    sync();
    pick();
  }

  if (!anim) return;

  // =====================================================================
  // АНИМАЦИИ
  // =====================================================================
  G.defaults({ ease: "power3.out" });
  ST.config({ ignoreMobileResize: true });

  // слова заголовков поднимаются из-под строки
  const splitWords = (el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          if (!n.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const outer = document.createElement("span"), inner = document.createElement("span");
            outer.className = "sw"; inner.textContent = part; outer.appendChild(inner); frag.appendChild(outer);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
    el.classList.add("is-split");
  };
  $$("[data-split]").forEach(splitWords);

  // первый экран
  const hero = $(".dhero, .shero");
  if (hero) {
    const photo = $(".dhero__frame, .shero__media", hero);
    const tl = G.timeline({ delay: 0.05 });
    if (photo) {
      const img = $("img", photo);
      tl.fromTo(photo, { clipPath: "inset(12% 8% 12% 8%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.6, ease: "expo.out", clearProps: "clipPath" }, 0);
      // снимок мог быть приближен в стилях (свойство scale): анимация заканчивается на том же масштабе
      const base = img ? parseFloat(getComputedStyle(img).scale) || 1 : 1;
      if (img) tl.fromTo(img, { scale: base * 1.16 }, { scale: base, duration: 2.2, ease: "power2.out", clearProps: "transform,scale" }, 0);
    }
    tl.from($$("[data-split] .sw > span", hero), { yPercent: 115, duration: 1.2, stagger: 0.06, ease: "power4.out", clearProps: "transform" }, 0.15)
      // после появления атрибут снимается, иначе стиль «до анимации» снова прячет текст
      .fromTo($$("[data-hero-fade]", hero), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08, onComplete() { this.targets().forEach((el) => el.removeAttribute("data-hero-fade")); G.set(this.targets(), { clearProps: "transform,opacity" }); } }, 0.45)
      .from(".site-header__inner", { y: -24, autoAlpha: 0, duration: 0.9, clearProps: "transform,opacity,visibility" }, 0.2);
    const ghost = $(".dhero__ghost", hero);
    if (ghost) {
      tl.from(ghost, { yPercent: 30, opacity: 0, duration: 1.8, ease: "expo.out" }, 0.1);
      G.to(ghost, { yPercent: -18, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    }
  }

  // заголовки разделов
  $$("[data-split]").forEach((el) => {
    if (el.closest(".dhero, .shero")) return;
    G.from($$(".sw > span", el), { yPercent: 115, duration: 1.1, stagger: 0.035, ease: "power4.out", clearProps: "transform", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });

  // появление блоков по порядку; уже проскоченное показываем сразу
  const revealed = (el) => { el.removeAttribute("data-reveal"); G.set(el, { clearProps: "opacity,transform" }); };
  ST.batch("[data-reveal]", {
    start: "top 92%",
    once: true,
    interval: 0.1,
    onEnter: (els) => {
      els = els.filter((el) => el.hasAttribute("data-reveal"));
      const vis = els.filter((el) => el.getBoundingClientRect().bottom > 0);
      els.filter((el) => !vis.includes(el)).forEach(revealed);
      if (vis.length) G.to(vis, { opacity: 1, y: 0, duration: 0.95, stagger: Math.min(0.08, 0.36 / vis.length), overwrite: true, onComplete: () => vis.forEach(revealed) });
    },
  });
  // элементы внутри горизонтальных лент показываем сразу: их видимость решает лента
  $$(".dtrain__item, .dcert").forEach((el) => { el.removeAttribute("data-reveal"); });

  // подвал
  const big = $(".site-footer__big");
  if (big) G.from(big.children, { yPercent: 40, autoAlpha: 0, stagger: 0.1, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: big, start: "top 95%", once: true } });

  // «магнитные» кнопки
  if (fine) {
    $$("[data-magnet]").forEach((b) => {
      const xTo = G.quickTo(b, "x", { duration: 0.6, ease: "elastic.out(1, .45)" });
      const yTo = G.quickTo(b, "y", { duration: 0.6, ease: "elastic.out(1, .45)" });
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.22); yTo((e.clientY - r.top - r.height / 2) * 0.32); });
      b.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }

  // пересчёт после шрифтов и картинок, когда прокрутка остановилась
  let refreshPending = false;
  const refreshIdle = () => { refreshPending = true; if (!ST.isScrolling()) { refreshPending = false; ST.refresh(); } };
  ST.addEventListener("scrollEnd", () => { if (refreshPending) { refreshPending = false; ST.refresh(); } });
  document.fonts?.ready.then(refreshIdle);
  addEventListener("load", () => {
    ST.refresh();
    const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t) requestAnimationFrame(() => scrollToEl(t, true));
  }, { once: true });
  const mainEl = $("main");
  if (mainEl && "ResizeObserver" in window) {
    let lastH = 0, rt = 0;
    new ResizeObserver(([e]) => {
      const h = Math.round(e.contentRect.height);
      if (!lastH) { lastH = h; return; }
      if (Math.abs(h - lastH) < 2) return;
      lastH = h; clearTimeout(rt); rt = setTimeout(refreshIdle, 200);
    }).observe(mainEl);
  }

  // включили версию для слабовидящих: всё движение останавливается
  new MutationObserver(() => {
    if (!isA11y() || !root.classList.contains("js-anim")) return;
    secs.forEach((s) => { const l = live.get(s); l?.ctx?.revert(); l?.clean?.(); });
    ST.getAll().forEach((t) => t.kill(true));
    G.globalTimeline.clear();
    G.set("[data-reveal], [data-hero-fade], .sw > span, .site-header__inner, [data-magnet], .dhero__frame, .dhero__frame img, .dhero__ghost, .shero__media, .shero__media img", { clearProps: "all" });
    lenis?.destroy();
    lenis = null;
    $(".pv-panel")?.remove();
    root.classList.remove("js-anim");
  }).observe(root, { attributes: true, attributeFilter: ["class"] });
})();
