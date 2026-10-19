// Главная v3: плавная прокрутка, анимации и карусели. GSAP + ScrollTrigger + Lenis лежат в assets/v3/vendor.
// Общие скрипты сайта (меню, окно записи, формы, cookie) не трогаем, работаем рядом с ними.
// Без скриптов, при «уменьшить движение» и в версии для слабовидящих весь контент виден сразу.
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
  if (!anim) {
    root.classList.remove("js-anim", "js-intro");
    $(".intro")?.remove();
  }

  const header = $(".site-header");
  const modal = $("[data-booking-modal]");
  const headerOffset = () => ($(".site-header__inner")?.getBoundingClientRect().height || 64) + 28;

  // ---------- плавная прокрутка ----------
  let lenis = null;
  if (anim && window.Lenis) {
    lenis = new window.Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      // внутри окон и меню прокрутка своя
      prevent: (node) => node.matches(".dhq, .dh-assistant, .booking-modal, .site-header__mobile-panel, .cookie-notice"),
    });
    lenis.on("scroll", ST.update);
    G.ticker.add((t) => lenis?.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }

  const scrollToEl = (el, immediate = false) => {
    if (lenis) {
      lenis.scrollTo(el, { offset: -headerOffset(), duration: 1.3, immediate });
      return;
    }
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset();
    window.scrollTo({ top, behavior: immediate || reduce ? "auto" : "smooth" });
  };

  // якоря на этой же странице: /#doctors, #faq и кнопки с data-scroll-target
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("[data-scroll-target], a[href*='#']");
    if (!a) return;
    let id = a.dataset.scrollTarget;
    let setHash = false;
    if (a.tagName === "A" && a.hash) {
      const url = new URL(a.href, location.href);
      if (!id && url.pathname !== location.pathname) return;
      id = id || decodeURIComponent(url.hash.slice(1));
      setHash = true;
    }
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    // из мобильного меню: site-ui.js закрывает меню, Lenis запускается кадром позже
    if (lenis?.isStopped) requestAnimationFrame(() => requestAnimationFrame(() => scrollToEl(target)));
    else scrollToEl(target);
    if (setHash) history.replaceState(null, "", "#" + id);
  });

  // пока открыто окно записи, меню или быстрая запись, страница стоит
  let introRunning = false;
  const setRootClass = (name, on) => { if (root.classList.contains(name) !== on) root.classList.toggle(name, on); };
  const syncLock = () => {
    const booking = !!modal?.classList.contains("is-open");
    const menu = !!header?.classList.contains("is-mobile-menu-open");
    setRootClass("is-booking-open", booking);
    setRootClass("has-mobile-menu", menu);
    if (!lenis) return;
    const stop = booking || menu || introRunning || root.classList.contains("dhq-lock");
    if (stop && !lenis.isStopped) lenis.stop();
    else if (!stop && lenis.isStopped) lenis.start();
  };
  const lockObserver = new MutationObserver(syncLock);
  if (modal) lockObserver.observe(modal, { attributes: true, attributeFilter: ["class"] });
  if (header) lockObserver.observe(header, { attributes: true, attributeFilter: ["class"] });
  lockObserver.observe(root, { attributes: true, attributeFilter: ["class"] });

  // ---------- врачи: карусель ----------
  const doctors = $("[data-doctors-carousel]");
  if (doctors) {
    const cards = $$("[data-doctors-card]", doctors);
    const dots = $$("[data-doctors-dot]");
    const count = $("[data-doctors-count]");
    const prev = $("[data-doctors-prev]");
    const next = $("[data-doctors-next]");
    // геометрию ленты меряем при изменении размеров, а не на каждом кадре прокрутки:
    // чтение offsetLeft после записи стилей заставляло браузер пересчитывать раскладку
    let geo = null;
    const measure = () => {
      const w = doctors.clientWidth;
      geo = { w, step: (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : w) || 1, mids: cards.map((c) => c.offsetLeft + c.offsetWidth / 2), cw: cards[0]?.offsetWidth || w };
    };
    const step = () => { if (!geo) measure(); return geo.step; };
    const index = () => Math.max(0, Math.min(cards.length - 1, Math.round(doctors.scrollLeft / step())));
    const update = () => {
      const i = index();
      if (count) count.textContent = `${i + 1} / ${cards.length}`;
      dots.forEach((d, k) => {
        d.classList.toggle("is-active", k === i);
        if (k === i) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
      if (prev) prev.disabled = doctors.scrollLeft <= 4;
      if (next) next.disabled = doctors.scrollLeft >= doctors.scrollWidth - doctors.clientWidth - 4;
    };
    const go = (i) => doctors.scrollTo({ left: i * step(), behavior: reduce ? "auto" : "smooth" });
    // «поток»: центральный портрет крупно, соседние повёрнуты вглубь; над ним крупная фамилия
    const frame = doctors.closest(".doctors__frame");
    const surnames = cards.map((c) => $(".dcard__name span", c)?.textContent.trim() || "");
    let ghostIdx = -1, ghost = null;
    // буквы фамилии поднимаются по одной, прежняя фамилия уходит вверх
    const showGhost = (name) => {
      if (!ghost) return;
      $$(".gw", ghost).forEach((w) => { w.classList.remove("is-in"); w.classList.add("is-out"); setTimeout(() => w.remove(), 700); });
      const w = document.createElement("span");
      w.className = "gw";
      w.style.setProperty("--n", String(name.length));
      [...name].forEach((ch, k) => {
        const l = document.createElement("i");
        l.textContent = ch;
        l.style.setProperty("--i", String(k));
        w.append(l);
      });
      ghost.append(w);
      requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add("is-in")));
    };
    const paint = () => {
      if (!doctors.classList.contains("is-flow")) return;
      if (!geo) measure();
      const mid = doctors.scrollLeft + geo.w / 2;
      cards.forEach((card, k) => {
        const d = Math.max(-2, Math.min(2, (geo.mids[k] - mid) / geo.cw));
        card.style.setProperty("--d", d.toFixed(3));
        card.style.setProperty("--ad", Math.min(1, Math.abs(d)).toFixed(3));
        card.classList.toggle("is-current", Math.abs(d) < 0.5);
      });
      const i = index();
      if (i !== ghostIdx) {
        ghostIdx = i;
        showGhost(surnames[i]);
      }
    };
    if (anim) {
      doctors.classList.add("is-flow");
      if (frame) {
        ghost = document.createElement("div");
        ghost.className = "doctors__ghost";
        ghost.setAttribute("aria-hidden", "true");
        frame.prepend(ghost);
        frame.classList.add("has-ghost");
      }
      // нажатие на боковую карточку сначала выводит её в центр
      cards.forEach((card, i) => card.addEventListener("click", (e) => {
        if (card.classList.contains("is-current") || e.target.closest("[data-action='booking']")) return;
        e.preventDefault();
        e.stopPropagation();
        go(i);
      }, true));
    }
    // вдали от экрана (дальше экрана от края) карусель не держит повёрнутые 3D-карточки:
    // они отдельные слои, и на телефоне компоновщик пересчитывал их на всей странице
    if (anim && "IntersectionObserver" in window) {
      new IntersectionObserver((es) => doctors.classList.toggle("is-idle", !es[es.length - 1].isIntersecting), { rootMargin: "100% 0px" }).observe(doctors);
    }
    let raf = 0;
    doctors.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); paint(); }); }, { passive: true });
    prev?.addEventListener("click", () => go(Math.max(0, index() - 1)));
    next?.addEventListener("click", () => go(Math.min(cards.length - 1, index() + 1)));
    dots.forEach((d, k) => d.addEventListener("click", () => go(k)));
    const remeasure = () => { measure(); update(); paint(); };
    if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(doctors);
    else addEventListener("resize", remeasure);
    update();
    paint();
  }

  // ---------- цены: на телефоне вкладки «Стоимость / Оплата» ----------
  const prices = $(".prices");
  if (prices) {
    const tabs = $$("[data-price-tab]", prices);
    const panels = $$("[data-price-panel]", prices);
    panels.forEach((p) => p.removeAttribute("data-reveal"));
    prices.classList.add("prices--tabs");
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      const key = tab.dataset.priceTab;
      tabs.forEach((t) => {
        t.classList.toggle("is-active", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      });
      panels.forEach((p) => p.classList.toggle("is-active", p.dataset.pricePanel === key));
      if (anim) G.fromTo(panels.filter((p) => p.classList.contains("is-active")), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out", clearProps: "transform,opacity" });
      ST?.refresh();
    }));
  }

  // ---------- отзывы: на телефоне лента со счётчиком ----------
  const reviews = $("[data-review-carousel]");
  if (reviews) {
    const cards = $$("[data-review-card]", reviews);
    const dots = $$("[data-review-dot]");
    const counter = $("[data-review-counter]");
    let rStepV = 0;
    const measureR = () => { rStepV = (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : reviews.clientWidth) || 1; };
    const rstep = () => { if (!rStepV) measureR(); return rStepV; };
    const current = () => Math.max(0, Math.min(cards.length - 1, Math.round(reviews.scrollLeft / rstep())));
    // лента: карточки листаются родным прилипанием, соседние приглушены, текст чуть отстаёт
    const deck = () => {
      if (!reviews.classList.contains("is-rail")) return;
      const st = rstep();
      cards.forEach((c, i) => {
        const d = Math.max(-1.5, Math.min(1.5, i - reviews.scrollLeft / st));
        c.style.setProperty("--d", d.toFixed(3));
        c.style.setProperty("--ad", Math.min(1, Math.abs(d)).toFixed(3));
      });
    };
    const update = () => {
      const i = current();
      if (counter) counter.textContent = `${i + 1} / ${cards.length}`;
      dots.forEach((d, k) => d.classList.toggle("is-active", k === i));
      deck();
    };
    let rRaf = 0;
    reviews.addEventListener("scroll", () => { if (!rRaf) rRaf = requestAnimationFrame(() => { rRaf = 0; update(); }); }, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(() => { measureR(); update(); }).observe(reviews);
    dots.forEach((d, k) => d.addEventListener("click", () => reviews.scrollTo({ left: k * rstep(), behavior: reduce ? "auto" : "smooth" })));
    if (anim) {
      const narrow = matchMedia("(max-width: 999px)");
      const setDeck = () => {
        reviews.classList.toggle("is-rail", narrow.matches);
        if (!narrow.matches) cards.forEach((c) => { c.style.removeProperty("--d"); c.style.removeProperty("--ad"); });
        update();
      };
      narrow.addEventListener?.("change", setDeck);
      setDeck();
    }
  }

  // ---------- ленты на телефоне: тонкая полоса показывает, сколько ещё листать ----------
  $$(".resto__cases, .therapy__grid, .photorail").forEach((sc) => {
    const bar = document.createElement("div");
    bar.className = "rail";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = "<i></i>";
    sc.after(bar);
    const g = { max: 0, w: 1, on: false };
    const pos = () => { if (g.on) bar.style.setProperty("--x", ((sc.scrollLeft / g.max) * ((1 - g.w) / g.w) * 100).toFixed(2) + "%"); };
    const measure = () => {
      g.max = sc.scrollWidth - sc.clientWidth;
      g.on = g.max > 8 && /auto|scroll/.test(getComputedStyle(sc).overflowX);
      bar.hidden = !g.on;
      if (!g.on) return;
      g.w = sc.clientWidth / sc.scrollWidth;
      bar.style.setProperty("--w", (g.w * 100).toFixed(2) + "%");
      pos();
    };
    let raf = 0;
    sc.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; pos(); }); }, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(sc);
    else addEventListener("resize", measure);
    measure();
  });

  // ---------- нижняя панель: латунная нить показывает, сколько страницы прочитано ----------
  const dock = $(".dock");
  if (dock) {
    const upd = () => {
      const max = root.scrollHeight - innerHeight;
      dock.style.setProperty("--p", max > 0 ? Math.min(1, scrollY / max).toFixed(4) : "0");
    };
    addEventListener("scroll", upd, { passive: true });
    upd();
  }

  // ---------- вопросы: открыт один, плавно ----------
  const faqItems = $$("[data-faq-item]");
  const faqOpen = (d) => {
    const a = $(".faq-item__answer", d);
    d.open = true;
    if (anim && a) G.fromTo(a, { height: 0 }, { height: a.scrollHeight, duration: 0.55, ease: "expo.out", onComplete: () => { a.style.height = ""; ST.refresh(); } });
  };
  const faqClose = (d) => {
    const a = $(".faq-item__answer", d);
    if (anim && a) G.to(a, { height: 0, duration: 0.4, ease: "power3.inOut", onComplete: () => { d.open = false; a.style.height = ""; ST.refresh(); } });
    else d.open = false;
  };
  faqItems.forEach((d) => {
    $("summary", d)?.addEventListener("click", (e) => {
      e.preventDefault();
      if (d.open) faqClose(d);
      else {
        faqItems.forEach((o) => { if (o !== d && o.open) faqClose(o); });
        faqOpen(d);
      }
    });
  });

  // ---------- карта: управление включается по нажатию ----------
  $$(".map").forEach((m) => {
    $(".map__shield", m)?.addEventListener("click", () => m.classList.add("is-active"));
    m.addEventListener("mouseleave", () => m.classList.remove("is-active"));
  });

  // ---------- значок ПроДокторов: если картинка с их сайта не загрузилась, остаётся текстовая плашка ----------
  $$(".dh-prodoctorov-widget__image").forEach((img) => {
    const fail = () => img.closest(".dh-prodoctorov-widget")?.classList.add("is-failed");
    if (img.complete && !img.naturalWidth) fail();
    else img.addEventListener("error", fail, { once: true });
  });

  // ---------- варианты секций ----------
  // Десктоп (от 1100 px): секция получает data-dv="N", подвал — data-fv. Телефон (до 760 px): data-mv="N".
  // Без атрибута — нынешний вид; планшет не меняется. Переключатели есть только в превью:
  // build.py --preview ставит на <main> data-dv-switch со списком секций, у которых есть десктопные варианты.
  const DV = [
    ["hero", ".hero", "Первый экран", ["Сейчас", "Витрина", "Манифест", "Окно"]],
    ["treatment-start", ".treatment-start", "С чего начать", ["Сейчас", "Панорама", "Колода", "Указатель"]],
    ["diagnosis", ".diagnosis", "Диагностика", ["Сейчас", "Сюжет", "Линия этапов", "Бенто"]],
    ["restoration", ".restoration", "Восстановление", ["Сейчас", "Вкладки", "Три колонки", "Разворот"]],
    ["ortho", ".ortho", "Ортодонтия", ["Сейчас", "Полотно", "Сравнение", "Витрина"]],
    ["therapy", ".therapy", "Лечение зубов", ["Сейчас", "Ряд", "Созвездие", "Список"]],
    ["directions", ".directions", "Направления", ["Сейчас", "Плитки", "Оглавление", "Облако", "Табло", "Бегущая строка"]],
    ["doctors", ".doctors", "Врачи", ["Сейчас", "Сетка", "Шахматка", "Портрет"]],
    ["clinic", ".clinic", "Клиника", ["Сейчас", "Мозаика", "Тур", "Полоса"]],
    ["prices", ".prices", "Цены", ["Сейчас", "Меню", "Светлый", "Две панели"]],
    ["reviews", ".reviews", "Отзывы", ["Сейчас", "Стена", "Цитата", "Рейтинг"]],
    ["faq", ".faq", "Вопросы", ["Сейчас", "Две колонки", "Заголовок слева", "Фото сверху"]],
    ["contacts", ".contacts", "Контакты", ["Сейчас", "Карта", "Форма", "Три колонки"]],
    ["footer", ".site-footer", "Подвал", ["Было", "Табличка", "Светлый", "Знак"], ["", "plaque", "light", "photo"]],
  ];
  // телефон: Илья выбрал варианты (2026-10-18), data-mv стоит прямо в разметке, панели для телефона больше нет;
  // список нужен эффектам вариантов (mvFx)
  const MV = [
    ["restoration", ".restoration", "Восстановление", ["Сейчас"]],
    ["therapy", ".therapy", "Лечение зубов", ["Сейчас", "Список"]],
    ["directions", ".directions", "Направления", ["Сейчас", "Плитки", "Оглавление"]],
    ["doctors", ".doctors", "Врачи", ["Сейчас", "В экран"]],
    ["clinic-benefits", ".cbenefits", "Клиника: преимущества", ["Сейчас", "Строки"]],
    ["clinic-photos", ".photorail", "Клиника: фото", ["Сейчас", "Журнал", "Мозаика"]],
    ["faq", ".faq", "Вопросы", ["Сейчас", "Плакат", "Открытка"]],
  ];
  const mkVariants = (list, attr, store) => {
    const find = (key) => list.find((d) => d[0] === key);
    const el = (key) => $(find(key)?.[1] || "#none");
    const get = (key) => {
      const d = find(key), e = el(key);
      if (!d || !e) return 0;
      if (d[4]) return Math.max(0, d[4].indexOf(e.dataset.fv || ""));
      return Number(e.dataset[attr]) || 0;
    };
    const hooks = [];
    // keep: экран не прыгает, когда секция под ним меняет высоту
    const set = (key, v, keep) => {
      const d = find(key), e = el(key);
      if (!d || !e) return;
      const top0 = e.getBoundingClientRect().top;
      if (d[4]) { if (d[4][v]) e.dataset.fv = d[4][v]; else delete e.dataset.fv; }
      else if (v) e.dataset[attr] = String(v); else delete e.dataset[attr];
      hooks.forEach((fn) => fn(key, e, v));
      if (keep) {
        const dy = e.getBoundingClientRect().top - top0;
        if (Math.abs(dy) > 1) window.scrollBy(0, dy);
      }
    };
    return { list, store, el, get, set, hooks };
  };
  const VD = mkVariants(DV, "dv", "dh-v3-dv"), VM = mkVariants(MV, "mv", "dh-v3-mv");
  // для проверок из консоли и автотестов: __dv.set("diagnosis", 2), __mv.set("therapy", 1)
  window.__dv = { set: (key, v) => VD.set(key, v, true), get: VD.get, list: () => DV.map((d) => d[0]) };
  window.__mv = { set: (key, v) => VM.set(key, v, true), get: VM.get, list: () => MV.map((d) => d[0]) };

  // панель выбора: название секции под серединой экрана, кнопки вариантов, «Мой выбор» со списком
  const vPanel = (V, switchAttr, mod, device) => {
    const host = $(`main[${switchAttr}]`);
    if (!host) return;
    const keys = (host.getAttribute(switchAttr) || "").split(" ").filter(Boolean);
    const on = (key) => !!V.el(key) && (!keys.length || keys.includes(key));
    if (!V.list.some(([k]) => on(k))) return;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(V.store) || "{}"); } catch (e) { /* приватный режим */ }
    V.list.forEach(([key]) => { if (Number.isInteger(saved[key])) V.set(key, saved[key]); });
    const save = () => { try { localStorage.setItem(V.store, JSON.stringify(Object.fromEntries(V.list.map(([k]) => [k, V.get(k)])))); } catch (e) { /* приватный режим */ } };
    const panel = document.createElement("div");
    panel.className = "dv-panel dv-panel--" + mod;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Варианты секций");
    panel.innerHTML = '<div class="dv-panel__bar"><span class="dv-panel__name"></span><span class="dv-panel__opts" role="group"></span><button type="button" class="dv-panel__all" aria-expanded="false">Мой выбор</button></div>'
      + '<div class="dv-panel__list" hidden><ul></ul><div class="dv-panel__acts"><button type="button" data-dv-copy>Скопировать выбор</button><button type="button" data-dv-reset>Всё как сейчас</button><button type="button" data-dv-hide>Скрыть панель</button></div></div>';
    document.body.appendChild(panel);
    const nameEl = $(".dv-panel__name", panel), opts = $(".dv-panel__opts", panel), list = $(".dv-panel__list", panel), allBtn = $(".dv-panel__all", panel);
    let cur = "";
    const label = (key) => V.list.find((x) => x[0] === key)[3][V.get(key)];
    const drawList = () => {
      $("ul", list).innerHTML = V.list.filter(([k]) => on(k)).map(([k, , t]) => `<li><button type="button" data-go="${k}"><span>${t}</span><b>${label(k)}</b></button></li>`).join("");
    };
    const drawBar = () => {
      const d = V.list.find((x) => x[0] === cur);
      if (!d) return;
      nameEl.textContent = d[2];
      const v = V.get(cur);
      opts.innerHTML = d[3].map((t, i) => `<button type="button" data-v="${i}" aria-pressed="${i === v}">${t}</button>`).join("");
    };
    const pick = () => {
      const y = innerHeight * 0.42;
      let best = "";
      V.list.forEach(([k]) => { if (!on(k)) return; const r = V.el(k).getBoundingClientRect(); if (r.top <= y && r.bottom > y) best = k; });
      // на телефоне панель видна только у секций с вариантами
      panel.classList.toggle("is-away", !best);
      if (!best) best = cur || V.list.find(([k]) => on(k))?.[0] || "";
      if (best !== cur) { cur = best; drawBar(); }
    };
    let praf = 0;
    addEventListener("scroll", () => { if (!praf) praf = requestAnimationFrame(() => { praf = 0; pick(); }); }, { passive: true });
    const change = (key, v) => { V.set(key, v, true); save(); drawBar(); drawList(); };
    opts.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) change(cur, Number(b.dataset.v)); });
    allBtn.addEventListener("click", () => { const open = list.hidden; list.hidden = !open; allBtn.setAttribute("aria-expanded", String(open)); if (open) drawList(); });
    list.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) { const el = V.el(go.dataset.go); if (el) scrollToEl(el); return; }
      if (e.target.closest("[data-dv-reset]")) { V.list.forEach(([k, , , , vals]) => V.set(k, vals ? 3 : 0)); save(); drawBar(); drawList(); }
      if (e.target.closest("[data-dv-hide]")) panel.remove();
      if (e.target.closest("[data-dv-copy]")) {
        const text = `Выбор вариантов главной (${device}):\n` + V.list.filter(([k]) => on(k)).map(([k, , t]) => `${t}: ${label(k)}`).join("\n");
        const done = () => { const b = $("[data-dv-copy]", list); b.textContent = "Скопировано"; setTimeout(() => (b.textContent = "Скопировать выбор"), 1600); };
        (navigator.clipboard?.writeText(text) || Promise.reject()).then(done, () => { prompt("Скопируйте выбор:", text); });
      }
    });
    // цифры переключают вариант секции под серединой экрана (только у видимой панели)
    addEventListener("keydown", (e) => {
      if (e.target.closest?.("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!panel.isConnected || getComputedStyle(panel).display === "none") return;
      const d = V.list.find((x) => x[0] === cur);
      if (/^[0-9]$/.test(e.key) && d && Number(e.key) < d[3].length) change(cur, Number(e.key));
    });
    pick();
  };
  vPanel(VD, "data-dv-switch", "dv", "десктоп");

  // ---------- наверх ----------
  $$("[data-totop]").forEach((b) => b.addEventListener("click", () => {
    if (lenis) lenis.scrollTo(0, { duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    $("#main-content")?.focus({ preventScroll: true });
  }));

  // переход по ссылке вида /#doctors с другой страницы: после раскладки закреплённых блоков
  const hashTarget = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));

  // =====================================================================
  // АНИМАЦИИ. Прокрутку сглаживает только Lenis, поэтому scrub = true.
  // =====================================================================
  if (!anim) {
    if (hashTarget) addEventListener("load", () => scrollToEl(hashTarget, true), { once: true });
    return;
  }
  G.registerPlugin(ST);
  G.defaults({ ease: "power3.out" });
  ST.config({ ignoreMobileResize: true });
  const mm = G.matchMedia();

  // «окно»: рамка с overflow: hidden масштабируется, картинка внутри получает обратный масштаб,
  // поэтому снимок не искажается, а видимая область растёт. Только transform: на телефоне это
  // не перерисовывает картинку на каждом кадре, в отличие от clip-path.
  const windowFx = (frame, img, from) => {
    const sx0 = from.sx ?? 1, sy0 = from.sy ?? 1, z0 = from.z ?? 1;
    G.set(frame, { willChange: "transform" });
    if (img) G.set(img, { willChange: "transform" });
    return (p) => {
      const sx = sx0 + (1 - sx0) * p, sy = sy0 + (1 - sy0) * p, z = z0 + (1 - z0) * p;
      G.set(frame, { scaleX: sx, scaleY: sy });
      if (img) G.set(img, { scaleX: z / sx, scaleY: z / sy });
    };
  };

  // эффекты вариантов: десктоп от 1100 px, телефон до 760 px; у каждого варианта свои (0 — нынешний вид).
  // Всё, что создано внутри, живёт в своём gsap.context и снимается при смене варианта;
  // функция варианта может вернуть уборку для того, что она добавила в разметку
  const mkFx = (V, mq) => {
    const map = {}, ctx = {};
    let live = false;
    const run = (key) => {
      ctx[key]?.revert();
      ctx[key] = null;
      const el = V.el(key);
      if (!live || !el) return;
      const fn = map[key]?.[V.get(key)];
      if (fn) ctx[key] = G.context(() => fn(el));
    };
    V.hooks.push((key) => { if (!live) return; run(key); ST.sort(); ST.refresh(); });
    const start = () => mm.add(mq, () => {
      live = true;
      V.list.forEach(([key]) => run(key));
      // закрепления вариантов созданы позже триггеров ниже по странице: пересчитываем по порядку на странице
      ST.sort();
      return () => { live = false; V.list.forEach(([key]) => { ctx[key]?.revert(); ctx[key] = null; }); };
    });
    return { add: (key, fns) => { map[key] = Object.assign(map[key] || {}, fns); }, start };
  };
  const FXD = mkFx(VD, "(min-width: 1100px)"), FXM = mkFx(VM, "(max-width: 760px)");
  const dvFx = FXD.add, mvFx = FXM.add;

  // слова заголовков поднимаются из-под строки; разметка внутри (em, br, span) сохраняется
  const splitWords = (el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          if (!n.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const outer = document.createElement("span");
            const inner = document.createElement("span");
            outer.className = "sw";
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          walk(n);
        }
      });
    };
    walk(el);
    el.classList.add("is-split");
  };
  $$("[data-split]").forEach(splitWords);

  const heroIn = () => {
    const h = $(".hero");
    if (!h) return;
    G.timeline()
      .fromTo($(".hero__media img", h), { scale: 1.14 }, { scale: 1, duration: 2.6, ease: "power2.out" }, 0)
      .from($$("[data-split] .sw > span", h), { yPercent: 115, duration: 1.25, stagger: 0.05, ease: "power4.out", clearProps: "transform" }, 0.1)
      .fromTo($$("[data-hero-fade]", h), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, clearProps: "transform" }, 0.55)
      .from(".site-header__inner", { y: -24, autoAlpha: 0, duration: 0.9, clearProps: "transform,opacity,visibility" }, 0.25);
  };

  // ---------- заставка «Росчерк» (выбор Ильи 2026-10-18) ----------
  // Знак клиники (двухцветный, латунь) прорисовывается тонкой линией и заливается, по нему проходит блик.
  // Затем знак уходит, а на его месте раскрывается окно в форме силуэта знака и летит в первый экран
  const intro = $(".intro");
  if (intro && root.classList.contains("js-intro")) {
    introRunning = true;
    syncLock();
    try { sessionStorage.setItem("dh-v3-intro", "1"); } catch (e) { /* приватный режим */ }
    const hole = $(".intro__hole", intro), rim = $(".intro__rim", intro), slot = $(".intro__mark", intro), logo = $(".intro__logo", intro);
    const q = (sel) => $$(sel, intro);
    // силуэт в единицах знака (464 по ширине): окно растёт из точки внутри коронки;
    // r — радиус вписанного круга, по нему считается, когда окно накрыло экран
    const S = { units: 464, ox: 232, oy: 250, r: 130 };
    const chars = [];
    q(".intro__w").forEach((w) => {
      const text = w.textContent;
      w.textContent = "";
      [...text].forEach((ch) => { const s = document.createElement("span"); s.textContent = ch; w.appendChild(s); chars.push(s); });
    });
    const W = innerWidth, H = innerHeight;
    // куда летит окно: на телефоне в центр, на широком экране к зубу на фото первого экрана
    // (точка зуба на снимке 1600×900; считаем по месту снимка, у вариантов первого экрана оно своё)
    const wide = W >= 900 && W / H > 1.2;
    const toothAt = () => {
      const img = $(".hero__media img");
      if (!wide || !img || !img.offsetWidth) return [W / 2, H / 2];
      const r = img.getBoundingClientRect(), w = img.offsetWidth, h = img.offsetHeight;
      const s = Math.max(w / 1600, h / 900), iw = 1600 * s, ih = 900 * s;
      const [px, py] = getComputedStyle(img).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
      return [r.left + r.width / 2 - w / 2 + (w - iw) * px + 0.783 * iw, r.top + r.height / 2 - h / 2 + (h - ih) * py + 0.47 * ih];
    };
    let TX = W / 2, TY = H / 2, kEnd = 1;
    const st = { h: 0, z: 0 };
    let base = null;
    const draw = () => {
      if (!base || st.z === 0) {
        const r = slot.getBoundingClientRect();
        const k0 = r.width / S.units;
        base = { k: k0, x: r.left + S.ox * k0, y: r.top + S.oy * k0 };
        [TX, TY] = toothAt();
        kEnd = Math.hypot(Math.max(TX, W - TX), Math.max(TY, H - TY)) / S.r;
      }
      const k = base.k * Math.pow(kEnd / base.k, st.z);
      const p = 1 - Math.pow(1 - st.z, 2.2);
      const x = base.x + (TX - base.x) * p, y = base.y + (TY - base.y) * p;
      const t = (s) => `translate(${x} ${y}) scale(${s}) translate(${-S.ox} ${-S.oy})`;
      rim.setAttribute("transform", t(k));
      rim.style.strokeWidth = 1.5 / k;
      hole.setAttribute("transform", t(k * st.h));
    };
    draw();
    intro.classList.add("is-live");
    G.set(".hero__media img", { scale: 1.14 });
    const lines = q(".intro__logo path");
    const tl = G.timeline({ onComplete: () => { intro.remove(); root.classList.remove("js-intro"); introRunning = false; syncLock(); } })
      .to(q(".intro__glow"), { opacity: 1, duration: 1.4, ease: "power1.out" }, 0)
      // знак: линия, заливка, блик
      .to(lines, { strokeDashoffset: 0, duration: 1.15, ease: "power2.inOut", stagger: 0.025 }, 0.05)
      .to(q(".intro__logo-d path"), { fillOpacity: 1, duration: 0.6, ease: "power1.inOut" }, 0.85)
      .to(q(".intro__logo-l path"), { fillOpacity: 1, duration: 0.6, ease: "power1.inOut" }, 1.0)
      .to(lines, { strokeOpacity: 0, duration: 0.5 }, 1.2)
      .fromTo(q("#ilogo-shine"), { attr: { x1: -464, x2: 0 } }, { attr: { x1: 464, x2: 928 }, duration: 1.1, ease: "power2.inOut" }, 1.35)
      // название и подпись
      .set(q(".intro__word"), { opacity: 1 }, 0.5)
      .from(chars, { yPercent: 125, duration: 0.95, stagger: 0.035, ease: "power4.out" }, 0.5)
      .fromTo(q(".intro__tag"), { opacity: 0, letterSpacing: "0.5em" }, { opacity: 1, letterSpacing: "0.34em", duration: 1.1, ease: "power3.out" }, 1)
      .fromTo($(".intro__word em", intro), { "--sh": "110%" }, { "--sh": "-10%", duration: 1, ease: "power2.inOut" }, 1.35)
      .addLabel("reveal", 2.45)
      .to(chars, { yPercent: -140, duration: 0.45, stagger: 0.015, ease: "power2.in" }, "reveal-=0.3")
      .to(q(".intro__tag"), { opacity: 0, y: -8, duration: 0.35, ease: "power2.in" }, "reveal-=0.3")
      .to(q(".intro__glow"), { opacity: 0, duration: 0.5 }, "reveal")
      // знак уходит, на его месте раскрывается окно с латунным контуром
      .to(rim, { opacity: 1, duration: 0.3 }, "reveal-=0.1")
      .to(logo, { scale: 1.08, autoAlpha: 0, duration: 0.45, ease: "power2.in" }, "reveal-=0.2")
      .to(st, { h: 1, duration: 0.45, ease: "power2.out", onUpdate: draw }, "reveal")
      .add(heroIn, "reveal")
      .to(st, { z: 1, duration: 1.05, ease: "power1.in", onUpdate: draw }, "reveal+=0.3")
      .to(rim, { opacity: 0, duration: 0.3 }, "reveal+=1.05");
    // нетерпеливым: касание, клик или клавиша ускоряют заставку
    const hurry = () => tl.timeScale(4);
    intro.addEventListener("pointerdown", hurry, { once: true });
    addEventListener("keydown", hurry, { once: true });
  } else {
    intro?.remove();
    root.classList.remove("js-intro");
    heroIn();
  }

  // в подписи окна быстрой записи точка-разделитель меняется на запятую (на главной без «·»)
  const fixDhqNote = () => {
    const n = $(".dhq__note");
    if (!n) return false;
    n.textContent = n.textContent.replace(/\s+·\s+/g, ", ");
    return true;
  };
  if (!fixDhqNote()) {
    const mo = new MutationObserver(() => { if (fixDhqNote()) mo.disconnect(); });
    mo.observe(document.body, { childList: true });
  }

  // приглашение «Записаться на приём?» на телефоне закрывает треть экрана: показываем его один раз и убираем через 8 секунд
  const inviteBox = () => $(".dhq__invite");
  // (или раньше, если человек пролистал больше экрана: значит, читает страницу, и подсказка ему мешает)
  const watchInvite = (inv) => {
    let t = 0, y0 = 0;
    const hide = () => { clearTimeout(t); removeEventListener("scroll", onScroll); inv.classList.remove("is-visible"); inv.setAttribute("aria-hidden", "true"); };
    const onScroll = () => { if (Math.abs(scrollY - y0) > innerHeight) hide(); };
    new MutationObserver(() => {
      clearTimeout(t);
      removeEventListener("scroll", onScroll);
      if (!inv.classList.contains("is-visible") || innerWidth > 760) return;
      y0 = scrollY;
      t = setTimeout(hide, 8000);
      addEventListener("scroll", onScroll, { passive: true });
    }).observe(inv, { attributes: true, attributeFilter: ["class"] });
  };
  if (inviteBox()) watchInvite(inviteBox());
  else {
    const mo2 = new MutationObserver(() => { const inv = inviteBox(); if (inv) { mo2.disconnect(); watchInvite(inv); } });
    mo2.observe(document.body, { childList: true });
  }

  // пока кнопка записи первого экрана на виду, плавающая кнопка записи её не дублирует и не перекрывает
  // (на телефоне первый экран держится под наезжающим разделом: закрытая кнопка тоже не считается видимой)
  const heroCta = $('[data-booking-source="hero"]');
  let ctaInView = false, heroCovered = false;
  const syncCta = () => root.classList.toggle("v3-hero-cta", ctaInView && !heroCovered);
  const setHeroCovered = (v) => { if (v !== heroCovered) { heroCovered = v; syncCta(); } };
  if (heroCta && "IntersectionObserver" in window) {
    // (в одной пачке может прийти несколько записей, например при переносе героя в обёртку: верна последняя)
    new IntersectionObserver((es) => { ctaInView = es[es.length - 1].isIntersecting; syncCta(); }).observe(heroCta);
  }

  // первый экран: золотая пыль медленно поднимается в луче света
  const dustHost = $(".hero__media");
  if (dustHost) {
    const cv = document.createElement("canvas");
    cv.className = "hero__dust";
    cv.setAttribute("aria-hidden", "true");
    dustHost.appendChild(cv);
    const ctx = cv.getContext("2d");
    const narrowScreen = innerWidth <= 760;
    const parts = [];
    let W = 0, H = 0, live = true;
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (q, anywhere) => {
      q.x = W * (narrowScreen ? Math.random() : 0.42 + Math.random() * 0.58);
      q.y = anywhere ? Math.random() * H : H + 8;
      q.r = 0.5 + Math.random() * 1.7;
      q.vy = 0.1 + Math.random() * 0.32;
      q.vx = (Math.random() - 0.5) * 0.12;
      q.a = 0.18 + Math.random() * 0.5;
      q.t = Math.random() * 6.3;
      return q;
    };
    size();
    for (let i = 0; i < (narrowScreen ? 26 : 52); i++) parts.push(spawn({}, true));
    G.ticker.add(() => {
      if (!live || !W) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#E2CC9C";
      for (const q of parts) {
        q.t += 0.012;
        q.y -= q.vy;
        q.x += q.vx + Math.sin(q.t) * 0.1;
        if (q.y < -8) spawn(q, false);
        ctx.globalAlpha = q.a * (0.55 + 0.45 * Math.sin(q.t * 2.3));
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, 6.2832);
        ctx.fill();
      }
    });
    ST.create({ trigger: ".hero", start: "top top", end: "bottom top", onToggle: (self) => { live = self.isActive; } });
    // размер холста меняется и при смене варианта первого экрана, не только окна
    if ("ResizeObserver" in window) new ResizeObserver(size).observe(cv); else addEventListener("resize", size);
  }

  // герой: фон уходит медленнее страницы, текст тает (на телефоне не тает: его ещё читают)
  const heroDrift = () => {
    G.to(".hero__media", { yPercent: 16, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    G.to(".hero__in", { y: -70, autoAlpha: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "42% top", end: "92% top", scrub: true } });
  };
  mm.add("(min-width: 761px) and (max-width: 1099px)", heroDrift);
  dvFx("hero", { 0: heroDrift });
  // герой на телефоне: дочитали до низа, и экран остаётся на месте, а раздел «С чего начать» наезжает
  // на него листом, фон под листом темнеет. Родной sticky внутри обёртки, без закрепления скриптом
  mm.add("(max-width: 760px)", () => {
    const hero = $(".hero"), next = hero?.nextElementSibling;
    if (!hero || !next?.classList.contains("sec")) return;
    const wrap = document.createElement("div");
    wrap.className = "opening";
    hero.before(wrap);
    wrap.append(hero, next);
    const veil = document.createElement("i");
    veil.className = "hero__veil";
    veil.setAttribute("aria-hidden", "true");
    hero.appendChild(veil);
    const ro = new ResizeObserver(() => wrap.style.setProperty("--hero-h", hero.offsetHeight + "px"));
    ro.observe(hero);
    const cover = (self) => setHeroCovered(self.progress > 0.5);
    // триггер — сам раздел-лист: он не липкий, его позиция не зависит от того, где сейчас экран
    const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: next, start: "top bottom", end: "top top", scrub: true, onUpdate: cover, onRefresh: cover, onLeave: cover, onLeaveBack: cover, onEnterBack: cover } })
      .fromTo(veil, { opacity: 0 }, { opacity: 0.78 }, 0)
      .fromTo($(".hero__in", hero), { y: 0 }, { y: -56 }, 0);
    return () => { ro.disconnect(); tl.scrollTrigger?.kill(); tl.kill(); veil.remove(); wrap.before(hero, next); wrap.remove(); G.set(".hero__in", { clearProps: "transform" }); setHeroCovered(false); };
  });

  // 02 · диагностика: на широком экране закреплённая горизонтальная лента
  dvFx("diagnosis", { 0: () => {
    const pin = $(".diag__pin"), track = $(".diag__track");
    if (!pin || !track) return;
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const st = { trigger: pin, start: "top top", end: () => "+=" + dist(), scrub: true, invalidateOnRefresh: true };
    const tw = G.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { ...st, pin: true, anticipatePin: 1 } });
    const bar = $(".diag__progress i");
    if (bar) G.to(bar, { scaleX: 1, ease: "none", scrollTrigger: st });
    $$(".dstep", track).forEach((s) => {
      s.removeAttribute("data-reveal");
      G.fromTo(s, { opacity: 0, y: 60 }, { opacity: 1, y: 0, ease: "power2.out", scrollTrigger: { trigger: s, containerAnimation: tw, start: "left 96%", end: "left 62%", scrub: true } });
    });
    const scan = $(".diag__scan img");
    if (scan) G.fromTo(scan, { scale: 1.18 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".diag__scan", containerAnimation: tw, start: "left right", end: "right left", scrub: true } });
    const introPanel = $(".diag__intro");
    if (introPanel) G.to(introPanel, { autoAlpha: 0.25, ease: "none", scrollTrigger: { trigger: introPanel, containerAnimation: tw, start: "right 55%", end: "right 5%", scrub: true } });
  } });
  // 02 · на телефоне: кадр сканера закреплён, этапы сменяют друг друга, линия сканирует на каждом этапе
  mm.add("(max-width: 760px)", () => {
    const stage = $(".diag__stage");
    const stepsBox = $(".diag__steps", stage || document);
    if (!stage || !stepsBox) return;
    const steps = $$(".dstep", stage), fig = $(".diag__scan", stage), img = $("img", fig), line = $(".diag__scanline", fig);
    stage.classList.add("is-story");
    const bars = document.createElement("div");
    bars.className = "diag__bars";
    bars.setAttribute("aria-hidden", "true");
    bars.innerHTML = steps.map(() => "<i><b></b></i>").join("");
    stepsBox.before(bars);
    steps.forEach((st) => st.removeAttribute("data-reveal"));
    G.set(steps, { autoAlpha: 0, y: 26 });
    G.set(steps[0], { autoAlpha: 1, y: 0 });
    // кадр держится родным position: sticky внутри высокой «дорожки»: на телефоне это не дёргается
    // на входе и выходе, как закрепление скриптом, и не спорит с адресной строкой
    const runway = document.createElement("div");
    runway.className = "diag__runway";
    stage.before(runway);
    runway.appendChild(stage);
    // кадр «камеры» следует за этапами: консультация — снимок ещё в тени; диагностика — линия сканирует,
    // снимок проявляется; план — камера подъезжает к зоне лечения, её отмечает кольцо; лечение и контроль —
    // снова вся картина целиком. Только transform и opacity
    const veil = document.createElement("i"), focus = document.createElement("i");
    veil.className = "diag__veil"; focus.className = "diag__focus";
    [veil, focus].forEach((n) => { n.setAttribute("aria-hidden", "true"); fig.appendChild(n); });
    const tags = $$(".diag__tag", fig);
    const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: runway, start: "top top", end: "bottom bottom", scrub: 0.35, invalidateOnRefresh: true } });
    if (img) {
      G.set(img, { transformOrigin: "40% 62%" });
      tl.fromTo(img, { scale: 1.18 }, { scale: 1.08, duration: 1 }, 0)
        .to(img, { scale: 1, duration: 0.9, ease: "power1.out" }, 1.05)
        .to(img, { scale: 1.6, duration: 0.75, ease: "power2.inOut" }, 2.05)
        .to(img, { scale: 1, duration: 0.8, ease: "power2.inOut" }, 3.05);
    }
    tl.fromTo(veil, { opacity: 0.6 }, { opacity: 0.45, duration: 1 }, 0)
      .to(veil, { opacity: 0, duration: 0.6 }, 1.05);
    tags.forEach((t, k) => tl.fromTo(t, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out" }, 1.25 + k * 0.12));
    if (line) tl.fromTo(line, { autoAlpha: 0, y: 0 }, { autoAlpha: 1, duration: 0.08 }, 1.05)
      .to(line, { y: () => fig.clientHeight - 2, duration: 0.42, ease: "sine.inOut", yoyo: true, repeat: 1 }, 1.1)
      .to(line, { autoAlpha: 0, duration: 0.1 }, 1.94);
    tl.fromTo(focus, { autoAlpha: 0, scale: 0.55 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "power2.out" }, 2.5)
      .to(focus, { autoAlpha: 0, scale: 1.3, duration: 0.3, ease: "power1.in" }, 3.05);
    $$("b", bars).forEach((b, i) => tl.fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 1 }, i));
    // этап сменяется каскадом: значок, заголовок, текст
    const parts = (st) => [...st.children];
    steps.forEach((st, i) => {
      if (!i) return;
      tl.to(steps[i - 1], { autoAlpha: 0, y: -22, duration: 0.18, ease: "power2.in" }, i - 0.2)
        .set(st, { autoAlpha: 1, y: 0 }, i - 0.02);
      parts(st).forEach((el, k) => tl.fromTo(el, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out" }, i - 0.02 + k * 0.05));
    });
    tl.to({}, { duration: 0.01 }, 4);
    return () => { runway.before(stage); runway.remove(); stage.classList.remove("is-story"); bars.remove(); veil.remove(); focus.remove(); G.set([...steps, ...steps.flatMap(parts), ...tags, img, line].filter(Boolean), { clearProps: "all" }); };
  });

  // 01 · на телефоне карточки собираются в колоду: следующая наезжает, предыдущая уходит вглубь
  mm.add("(max-width: 760px)", () => {
    const cards = $$(".tcard");
    cards.forEach((c) => c.removeAttribute("data-reveal"));
    const shades = cards.map((c) => { const sh = document.createElement("i"); sh.className = "tcard__shade"; sh.setAttribute("aria-hidden", "true"); c.appendChild(sh); return sh; });
    cards.forEach((c, i) => {
      const next = cards[i + 1];
      if (!next) return;
      const pic = $(".tcard__media picture", next);
      const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: next, start: "top 94%", end: () => "top " + (parseFloat(getComputedStyle(next).top) || 90) + "px", scrub: true, invalidateOnRefresh: true } })
        .fromTo(c, { scale: 1 }, { scale: 0.92 }, 0)
        .fromTo(shades[i], { opacity: 0 }, { opacity: 0.55 }, 0);
      // снимок новой карточки «садится» на место, пока она наезжает (масштаб на picture: img занят шторкой)
      if (pic) tl.fromTo(pic, { scale: 1.16 }, { scale: 1 }, 0);
    });
    return () => { shades.forEach((sh) => sh.remove()); G.set($$(".tcard__media picture"), { clearProps: "transform" }); };
  });

  // высота пробега сканирующей линии = высота кадра
  const scanFig = $(".diag__scan");
  if (scanFig && "ResizeObserver" in window) new ResizeObserver(() => scanFig.style.setProperty("--scan-h", scanFig.clientHeight + "px")).observe(scanFig);

  // заголовки разделов
  $$("[data-split]").forEach((el) => {
    if (el.closest(".hero")) return;
    G.from($$(".sw > span", el), { yPercent: 115, duration: 1.1, stagger: 0.035, ease: "power4.out", clearProps: "transform", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });

  // появление блоков по порядку; уже проскоченное показываем сразу
  const revealed = (el) => { el.removeAttribute("data-reveal"); G.set(el, { clearProps: "opacity,transform" }); };
  ST.batch("[data-reveal]", {
    start: "top 92%",
    once: true,
    interval: 0.1,
    onEnter: (els) => {
      // элемент, с которого сняли data-reveal, уже ведёт своя анимация (диагностика, варианты секций)
      els = els.filter((el) => el.hasAttribute("data-reveal"));
      const live = els.filter((el) => el.getBoundingClientRect().bottom > 0);
      els.filter((el) => !live.includes(el)).forEach(revealed);
      if (live.length) G.to(live, { opacity: 1, y: 0, duration: 0.95, stagger: Math.min(0.08, 0.36 / live.length), overwrite: true, onComplete: () => live.forEach(revealed) });
    },
  });

  // картинки раскрываются шторкой: рамка вырастает по высоте, снимок внутри не искажается
  $$("[data-clip]").forEach((el) => {
    const img = $("img", el);
    const set = windowFx(el, img, { sy: 0.76, z: 1.16 });
    el.removeAttribute("data-clip");
    set(0);
    const o = { p: 0 };
    G.to(o, { p: 1, duration: 1.4, ease: "power3.inOut", scrollTrigger: { trigger: el, start: "top 90%", once: true }, onUpdate: () => set(o.p), onComplete: () => G.set([el, img], { clearProps: "transform,willChange" }) });
  });

  // параллакс картинки внутри рамки
  $$("[data-parallax]").forEach((fig) => {
    const img = $("img", fig);
    if (img) G.fromTo(img, { yPercent: -4, scale: 1.08 }, { yPercent: 4, scale: 1.08, ease: "none", scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: true } });
  });
  $$("[data-speed]").forEach((el) => {
    const k = parseFloat(el.dataset.speed) || 0;
    const amp = () => k * innerHeight * (innerWidth <= 760 ? 0.04 : 0.1);
    G.fromTo(el, { y: () => amp() }, { y: () => -amp(), ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
  });

  // 03 · «Как мы работаем»: линия прорисовывается вслед за прокруткой
  const wline = $(".workflow__line i");
  if (wline) {
    mm.add({ wide: "(min-width: 900px)", narrow: "(max-width: 899px)" }, (ctx) => {
      const prop = ctx.conditions.wide ? "scaleX" : "scaleY";
      G.fromTo(wline, { [prop]: 0 }, { [prop]: 1, ease: "none", scrollTrigger: { trigger: ".workflow__track", start: "top 80%", end: "bottom 55%", scrub: true } });
    });
  }

  // этапы «Как мы работаем» загораются, когда до них доходит линия
  $$(".wstep").forEach((w) => ST.create({ trigger: w, start: "top 74%", onEnter: () => w.classList.add("is-on"), onLeaveBack: () => w.classList.remove("is-on") }));

  // ортодонтия: элайнер и модель чуть покачиваются, как в витрине
  // (на телефоне снимок и так двигается параллаксом: второй источник движения на той же картинке давал лишние кадры)
  const orthoImg = $(".ortho__frame img");
  if (orthoImg) mm.add("(min-width: 761px)", () => {
    const sway = G.to(orthoImg, { y: -10, duration: 3.4, ease: "sine.inOut", yoyo: true, repeat: -1, paused: true });
    ST.create({ trigger: orthoImg, start: "top bottom", end: "bottom top", onToggle: (self) => (self.isActive ? sway.play() : sway.pause()) });
  });


  // фото команды: кадр раскрывается шторкой от центра, снимок отъезжает, карточка поднимается
  const teamPhoto = $(".faq__photo");
  if (teamPhoto) {
    const tImg = $("img", teamPhoto);
    const set = windowFx(teamPhoto, tImg, { sx: 0.68, z: 1.24 });
    set(0);
    ST.create({ trigger: teamPhoto, start: "top 92%", end: "top 30%", scrub: true, onUpdate: (self) => set(self.progress) });
    const sc = $(".smile-card");
    if (sc) {
      sc.removeAttribute("data-reveal");
      G.fromTo(sc, { y: 70, opacity: 0 }, { y: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: teamPhoto, start: "top 70%", end: "bottom 60%", scrub: true } });
    }
  }

  // лента фото едет вслед за прокруткой
  const photoDrift = () => {
    $$("[data-drift]").forEach((row) => {
      const dir = parseFloat(row.dataset.drift) || -1;
      const dist = () => Math.max(0, row.scrollWidth - row.parentElement.clientWidth);
      G.fromTo(row, { x: () => (dir < 0 ? 0 : -dist()) }, { x: () => (dir < 0 ? -dist() : 0), ease: "none", scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
    });
  };
  mm.add("(min-width: 761px) and (max-width: 1099px)", photoDrift);

  // 08 · клиника: кадр раскрывается из окна на весь экран
  const tour = $(".tour__pin");
  if (tour) {
    const frame = $(".tour__frame", tour), img = $("img", tour);
    const tourOpen = () => {
      G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: tour, start: "top top", end: "+=100%", pin: true, anticipatePin: 1, scrub: true } })
        .fromTo(frame, { clipPath: "inset(14% 22% 14% 22%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, 0)
        .fromTo(img, { scale: 1.24 }, { scale: 1, duration: 1 }, 0)
        .to({}, { duration: 0.2 });
    };
    mm.add("(min-width: 761px) and (max-width: 1099px)", tourOpen);
    dvFx("clinic", { 0: () => { tourOpen(); photoDrift(); } });
    // на телефоне кадр держится родным sticky, окно раскрывается через transform
    mm.add("(max-width: 760px)", () => {
      const wrap = tour.parentElement;
      wrap.classList.add("is-sticky");
      const set = windowFx(frame, img, { sx: 0.84, sy: 0.64, z: 1.24 });
      set(0);
      const o = { p: 0 };
      const tw = G.to(o, { p: 1, ease: "none", scrollTrigger: { trigger: wrap, start: "top top", end: "85% bottom", scrub: 0.3 }, onUpdate: () => set(o.p) });
      return () => { tw.scrollTrigger?.kill(); tw.kill(); wrap.classList.remove("is-sticky"); G.set([frame, img], { clearProps: "transform,willChange" }); };
    });
  }

  // эффекты вариантов секций (design-src/v3/variants/*.js, их вставляет build.py)
  // ----- варианты: clinic -----
  // Клиника: эффекты вариантов 1–3 (0 — окно и лента фото, они в v3.js)
  dvFx("clinic", {
    // 1 · Мозаика: снимки проявляются, садясь в свои плитки (масштаб у picture, рамка плитки неподвижна)
    1: (sec) => {
      [$(".tour__pin", sec), ...$$(".photo", sec)].filter(Boolean).forEach((tile) => {
        const pic = $("picture", tile);
        if (pic) G.fromTo(pic, { scale: 1.16 }, { scale: 1, ease: "none", scrollTrigger: { trigger: tile, start: "top bottom", end: "top 30%", scrub: true } });
      });
      const frame = $(".tour__frame", sec);
      if (frame) G.fromTo(frame, { opacity: 0 }, { opacity: 1, duration: 1.3, ease: "power2.out", scrollTrigger: { trigger: frame, start: "top 88%", once: true } });
    },

    // 2 · Тур: ресепшен, преимущества и кадры клиники в одной ленте; лента закреплена и едет вбок
    2: (sec) => {
      const tour = $(".tour", sec), rail = $(".photorail", sec);
      if (!tour || !rail) return;
      const parts = [tour, $(".cbenefits", sec)?.closest(".container"), rail].filter(Boolean);
      const stage = document.createElement("div");
      const track = document.createElement("div");
      const bar = document.createElement("div");
      stage.className = "dv-tour";
      track.className = "dv-tour__track";
      bar.className = "dv-tour__bar";
      bar.setAttribute("aria-hidden", "true");
      bar.innerHTML = "<i></i>";
      tour.before(stage);
      stage.append(track, bar);
      track.append(...parts);
      const dist = () => Math.max(0, track.scrollWidth - stage.clientWidth);
      const st = { trigger: stage, start: "top top", end: () => "+=" + dist(), scrub: true, invalidateOnRefresh: true };
      const tw = G.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { ...st, pin: true, anticipatePin: 1 } });
      G.fromTo($("i", bar), { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: st });
      // снимок в кадре отстаёт от рамки: лента читается как проход по клинике
      [$(".tour__frame", tour), ...$$(".photo picture", rail)].forEach((box) => {
        const img = box && $("img", box);
        if (img) G.fromTo(img, { xPercent: -5, scale: 1.12 }, { xPercent: 5, scale: 1.12, ease: "none", scrollTrigger: { trigger: box, containerAnimation: tw, start: "left right", end: "right left", scrub: true } });
      });
      // подпись кадра появляется, когда кадр выходит на середину
      $$(".photo__copy", rail).forEach((c) => G.fromTo(c, { opacity: 0, y: 14 }, { opacity: 1, y: 0, ease: "power2.out", scrollTrigger: { trigger: c, containerAnimation: tw, start: "left 92%", end: "left 64%", scrub: true } }));
      return () => {
        stage.before(...parts);
        stage.remove();
      };
    },

    // 3 · Полоса: снимок медленно плывёт в полосе, карточка поднимается поверх него
    3: (sec) => {
      const pin = $(".tour__pin", sec), img = $(".tour__frame img", sec), card = $(".clinic__intro", sec);
      if (pin && img) G.fromTo(img, { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12, ease: "none", scrollTrigger: { trigger: pin, start: "top bottom", end: "bottom top", scrub: true } });
      if (pin && card) G.fromTo(card, { y: 90 }, { y: 0, ease: "none", scrollTrigger: { trigger: pin, start: "top 85%", end: "top 10%", scrub: true } });
    },
  });

  // ----- варианты: diagnosis -----
  // 02 · «Диагностика»: эффекты вариантов (блок — чтобы имена не пересекались с другими файлами вариантов).
  // Ленту варианта 0 снимает сама смена варианта; здесь только своё.
  {
    // общее появление [data-reveal] снимаем с элементов, которыми дальше управляет вариант
    const takeReveal = (els) => {
      els = els.filter(Boolean);
      ST.getAll().forEach((t) => { if (els.includes(t.trigger)) t.kill(); });
      els.forEach((el) => el.removeAttribute("data-reveal"));
      G.killTweensOf(els, "opacity,y");
      G.set(els, { clearProps: "opacity,transform" });
    };
    const sizesFor = (els, val) => {
      const nodes = els.filter(Boolean).flatMap((el) => $$("source, img", el));
      const old = nodes.map((n) => n.getAttribute("sizes"));
      nodes.forEach((n) => n.setAttribute("sizes", val));
      return () => nodes.forEach((n, i) => (old[i] == null ? n.removeAttribute("sizes") : n.setAttribute("sizes", old[i])));
    };
    const mk = (cls, parent, html = "") => {
      const n = document.createElement("i");
      n.className = cls;
      n.setAttribute("aria-hidden", "true");
      n.innerHTML = html;
      parent.appendChild(n);
      return n;
    };

    dvFx("diagnosis", {
      // Сюжет: снимок стоит (sticky), этапы проходят справа; «камера» следует за ними:
      // консультация — снимок в тени; диагностика — линия сканирует, снимок проявляется;
      // план — камера подъезжает к зоне лечения, её отмечает кольцо; лечение и контроль — снова вся картина
      1: (sec) => {
        const fig = $(".diag__scan", sec), box = $(".diag__steps", sec);
        if (!fig || !box) return;
        const img = $("img", fig), line = $(".diag__scanline", fig), tags = $$(".diag__tag", fig), steps = $$(".dstep", box);
        takeReveal(steps);
        const unsize = sizesFor([fig], "54vw");
        const veil = mk("dv-veil", fig), ring = mk("dv-ring", fig), bars = mk("dv-bars", fig, steps.map(() => "<i><b></b></i>").join(""));
        // этап в фокусе ярче, соседние приглушены
        steps.forEach((st) => {
          G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: st, start: "top 88%", end: "bottom 12%", scrub: true } })
            .fromTo(st, { opacity: 0.22 }, { opacity: 1, duration: 0.36 })
            .to(st, { opacity: 1, duration: 0.28 })
            .to(st, { opacity: 0.22, duration: 0.36 });
        });
        // триггер — колонка этапов (она не липкая): этап k в фокусе на отрезке [k, k + 1]
        const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: box, start: "top 62%", end: "bottom 62%", scrub: true, invalidateOnRefresh: true } });
        if (img) {
          tl.fromTo(img, { scale: 1.18 }, { scale: 1.08, duration: 1 }, 0)
            .to(img, { scale: 1, duration: 0.85, ease: "power1.out" }, 1.05)
            .to(img, { scale: 1.65, duration: 0.75, ease: "power2.inOut" }, 2.05)
            .to(img, { scale: 1, duration: 0.8, ease: "power2.inOut" }, 3.05);
        }
        tl.fromTo(veil, { opacity: 0.62 }, { opacity: 0.46, duration: 1 }, 0)
          .to(veil, { opacity: 0, duration: 0.55 }, 1.05);
        tags.forEach((t, k) => tl.fromTo(t, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out" }, 1.3 + k * 0.1));
        if (line) {
          tl.fromTo(line, { autoAlpha: 0, y: 0 }, { autoAlpha: 1, duration: 0.06 }, 1.05)
            .to(line, { y: () => fig.clientHeight - 2, duration: 0.8, ease: "sine.inOut" }, 1.08)
            .to(line, { autoAlpha: 0, duration: 0.08 }, 1.88);
        }
        tl.fromTo(ring, { autoAlpha: 0, scale: 0.55 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "power2.out" }, 2.45)
          .to(ring, { autoAlpha: 0, scale: 1.3, duration: 0.3, ease: "power1.in" }, 3.05);
        $$("b", bars).forEach((b, i) => tl.fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 1 }, i));
        tl.to({}, { duration: 0.01 }, 4);
        return () => { unsize(); veil.remove(); ring.remove(); bars.remove(); };
      },

      // Линия этапов: латунная линия прорисовывается, узлы загораются, этапы проявляются по мере её прихода
      2: (sec) => {
        const fig = $(".diag__scan", sec), box = $(".diag__steps", sec);
        if (!fig || !box) return;
        const img = $("img", fig), line = $(".diag__scanline", fig), tags = $$(".diag__tag", fig), steps = $$(".dstep", box);
        takeReveal(steps);
        const unsize = sizesFor([fig], "62vw");
        const draw = mk("dv-draw", box);
        if (img) G.fromTo(img, { scale: 1.14 }, { scale: 1, ease: "none", scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom 30%", scrub: true } });
        // кадр сканируется поперёк, метка «3D» появляется, когда линия до неё дошла
        if (line) {
          const span = () => fig.clientWidth - 26;
          const sweep = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: fig, start: "top 72%", end: "bottom 42%", scrub: true, invalidateOnRefresh: true } })
            .fromTo(line, { autoAlpha: 0, x: 0 }, { autoAlpha: 1, duration: 0.06 }, 0)
            .to(line, { x: span, duration: 1 }, 0)
            .to(line, { autoAlpha: 0, duration: 0.06 }, 0.94);
          tags.forEach((t) => sweep.fromTo(t, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, Math.max(0, (t.offsetLeft - 12) / Math.max(1, span()))));
        }
        const at = (st) => st.offsetLeft / Math.max(1, box.clientWidth);
        const parts = steps.map((st) => [...st.children]);
        const lit = (p) => steps.forEach((st) => st.classList.toggle("is-dim", p < at(st) + 0.005));
        const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: box, start: "top 84%", end: "top 38%", scrub: true, invalidateOnRefresh: true, onUpdate: (self) => lit(self.progress), onRefresh: (self) => lit(self.progress) } });
        tl.fromTo(draw, { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
        steps.forEach((st, i) => parts[i].forEach((el, k) => tl.fromTo(el, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.16, ease: "power2.out" }, Math.min(0.84, at(st) + 0.02 + k * 0.04))));
        return () => { unsize(); draw.remove(); steps.forEach((st) => st.classList.remove("is-dim")); };
      },

      // Бенто: плитки мягко проявляются по колонкам, снимок «садится», линия проходит по нему один раз
      3: (sec) => {
        const track = $(".diag__track", sec), fig = $(".diag__scan", sec);
        if (!track || !fig) return;
        const img = $("img", fig), line = $(".diag__scanline", fig);
        const lead = $(".diag__lead", sec), equip = $(".diag__equipment", sec), steps = $$(".dstep", sec), cta = $(".diag__bottom", sec);
        takeReveal([lead, equip, ...steps]);
        const unsize = sizesFor([fig], "48vw");
        const tiles = [fig, equip, lead, ...steps, cta].filter(Boolean);
        const r0 = track.getBoundingClientRect(), w = r0.width || 1;
        tiles.forEach((t) => {
          const col = Math.round(((t.getBoundingClientRect().left - r0.left) / w) * 4);
          G.fromTo(t, { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: 1.15, delay: col * 0.09, ease: "expo.out", scrollTrigger: { trigger: t, start: "top 90%", once: true } });
        });
        if (img) G.fromTo(img, { scale: 1.16 }, { scale: 1, duration: 2.2, ease: "power2.out", scrollTrigger: { trigger: fig, start: "top 85%", once: true } });
        if (line) G.timeline({ scrollTrigger: { trigger: fig, start: "top 70%", once: true } })
          .fromTo(line, { autoAlpha: 0, y: 0 }, { autoAlpha: 1, duration: 0.2 }, 0.4)
          .to(line, { y: () => fig.clientHeight - 2, duration: 2.2, ease: "sine.inOut" }, 0.4)
          .to(line, { autoAlpha: 0, duration: 0.3 }, 2.4);
        return () => { unsize(); };
      },
    });
  }

  // ----- варианты: directions -----
  // все направления: общие эффекты вариантов (ими пользуется и directions.m.js — телефон)
  const directionsFx = (() => {
    // кнопка «Смотреть все услуги» стала плиткой или строкой оглавления: не тянется за курсором
    // (магнит общий для всех кнопок, его движение до кнопки просто не доходит, пока вариант включён)
    const calmMagnet = (sec) => {
      const box = $(".sec-actions", sec), btn = box && $("[data-magnet]", box);
      if (!btn) return () => {};
      const stop = (e) => e.stopPropagation();
      box.addEventListener("pointermove", stop, true);
      G.set(btn, { x: 0, y: 0 });
      return () => box.removeEventListener("pointermove", stop, true);
    };

    // две ленты навстречу друг другу: первые направления в верхней, остальные в нижней.
    // Едут, только пока секция на экране; прокрутка разгоняет и разворачивает их, курсор замедляет,
    // фокус с клавиатуры останавливает ленту и подвигает её так, чтобы ссылка была видна
    const tapes = (sec, speed) => {
      const list = $(".dlist", sec), rows = list ? $$(".drow", list) : [];
      if (rows.length < 2) return () => {};
      const cut = Math.ceil(rows.length / 2);
      list.classList.add("dv-tapes");
      const lanes = [rows.slice(0, cut), rows.slice(cut)].map((set, k) => {
        const tape = document.createElement("div"), track = document.createElement("div");
        tape.className = "dv-tape dv-tape--" + (k ? "b" : "a");
        track.className = "dv-tape__track";
        tape.appendChild(track);
        list.appendChild(tape);
        set.forEach((r) => track.appendChild(r));
        const clone = (r) => {
          const c = r.cloneNode(true);
          c.removeAttribute("data-reveal");
          c.setAttribute("aria-hidden", "true");
          c.tabIndex = -1;
          track.appendChild(c);
        };
        const need = Math.max(innerWidth, screen.width || 0) * 1.6 + 200;
        let guard = 0;
        while (track.scrollWidth < need && guard++ < 10) set.forEach(clone);
        [...track.children].forEach(clone);
        const lane = { tape, track, dir: k ? 1 : -1, pos: k ? 0.37 : 0, half: track.scrollWidth / 2, slow: 1, hover: false, hold: false, focus: false, t: 0, setX: G.quickSetter(track, "x", "px") };
        const enter = (e) => { if (e.pointerType === "mouse") lane.hover = true; };
        const leave = (e) => { if (e.pointerType === "mouse") lane.hover = false; };
        const down = (e) => { if (e.pointerType !== "mouse") { clearTimeout(lane.t); lane.hold = true; } };
        const up = () => { clearTimeout(lane.t); lane.t = setTimeout(() => (lane.hold = false), 900); };
        const fin = (e) => {
          const a = e.target.closest(".drow");
          if (!a) return;
          lane.focus = true;
          const r = a.getBoundingClientRect(), tr = tape.getBoundingClientRect(), pad = Math.max(16, tr.width * 0.06);
          if (r.left < tr.left + pad || r.right > tr.right - pad) lane.pos = (((lane.pos + (r.left - tr.left - pad) / lane.half) % 1) + 1) % 1;
        };
        const fout = () => { lane.focus = false; };
        const on = [["pointerenter", enter], ["pointerleave", leave], ["pointerdown", down], ["pointerup", up], ["pointercancel", up], ["focusin", fin], ["focusout", fout]];
        on.forEach(([t, f]) => tape.addEventListener(t, f));
        lane.off = () => { clearTimeout(lane.t); on.forEach(([t, f]) => tape.removeEventListener(t, f)); };
        lane.setX(-lane.pos * lane.half);
        return lane;
      });
      let live = false, way = 1, kick = 0;
      const measure = () => lanes.forEach((l) => { l.half = l.track.scrollWidth / 2 || 1; });
      ST.create({
        trigger: sec, start: "top bottom", end: "bottom top",
        onToggle: (self) => { live = self.isActive; },
        onUpdate: (self) => { way = self.direction; kick = Math.max(kick, Math.min(Math.abs(self.getVelocity()) / 380, 4)); },
        onRefresh: measure,
      });
      const tick = (time, dt) => {
        if (!live) return;
        const s = Math.min(dt, 64) / 1000;
        kick *= 0.94;
        lanes.forEach((l) => {
          const goal = l.focus ? 0 : l.hover || l.hold ? 0.12 : 1;
          l.slow += (goal - l.slow) * 0.1;
          l.pos = (((l.pos - l.dir * way * (1 + kick) * l.slow * speed * s / l.half) % 1) + 1) % 1;
          l.setX(-l.pos * l.half);
        });
      };
      G.ticker.add(tick);
      return () => {
        G.ticker.remove(tick);
        lanes.forEach((l) => { l.off(); l.tape.remove(); });
        rows.forEach((r) => list.appendChild(r));
        list.classList.remove("dv-tapes");
      };
    };

    // Табло: слова загораются по очереди вслед за прокруткой; латунью то, что загорелось последним
    // (с трети своего проявления до трети следующего), в конце пути все слова светлые
    const board = (sec, start, end) => {
      const list = $(".dlist", sec), labels = $$(".drow__label", sec);
      if (!list || !labels.length) return;
      let cur = -1;
      const mark = (i) => {
        if (i === cur) return;
        labels[cur]?.classList.remove("is-cur");
        cur = i;
        labels[cur]?.classList.add("is-cur");
      };
      const tl = G.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: list, start, end, scrub: true,
          onUpdate: (self) => mark(self.progress >= 0.999 ? -1 : Math.min(labels.length - 1, Math.floor(self.progress * labels.length - 0.35))),
        },
      });
      labels.forEach((l, i) => tl.fromTo(l, { opacity: 0.2 }, { opacity: 1, duration: 1 }, i));
      return () => mark(-1);
    };

    return { calmMagnet, tapes, board };
  })();

  // все направления, десктоп
  dvFx("directions", {
    // Плитки: восьмая плитка — кнопка, она не двигается за курсором
    1: (sec) => directionsFx.calmMagnet(sec),
    // Оглавление: сгиб разворота прорисовывается сверху вниз, пока появляются строки
    2: (sec) => {
      const off = directionsFx.calmMagnet(sec);
      G.fromTo(sec, { "--fold": 0 }, { "--fold": 1, ease: "none", scrollTrigger: { trigger: $(".directions__header", sec), start: "bottom 92%", endTrigger: $(".sec-actions", sec), end: "bottom 92%", scrub: true } });
      return () => { off(); sec.style.removeProperty("--fold"); };
    },
    // Табло: слова загораются по очереди, пока набор входит в экран
    4: (sec) => directionsFx.board(sec, "top 88%", "bottom 74%"),
    // Бегущая строка: около 54 px в секунду, при прокрутке до пяти раз быстрее
    5: (sec) => directionsFx.tapes(sec, 54),
  });

  // ----- варианты: doctors -----
  // Врачи: в вариантах 1–3 карусели нет. Снимаем с ленты «поток» (повороты карточек) и отмечаем
  // все карточки текущими: тогда обработчик карусели не перехватывает нажатия, ссылки «О враче»
  // и кнопки записи работают на любой карточке. Уборка возвращает ленту карусели как была.
  const dvDocFlat = (sec) => {
    const grid = $("[data-doctors-carousel]", sec);
    if (!grid) return () => {};
    const cards = $$("[data-doctors-card]", grid);
    const hadFlow = grid.classList.contains("is-flow");
    grid.classList.remove("is-flow");
    grid.scrollLeft = 0;
    cards.forEach((c) => {
      c.classList.add("is-current");
      c.style.removeProperty("--d");
      c.style.removeProperty("--ad");
    });
    return () => {
      cards.forEach((c) => c.classList.remove("is-current"));
      if (hadFlow) grid.classList.add("is-flow");
      grid.scrollLeft = 0;
      // карусель сама перемерит ленту (ResizeObserver) и расставит повороты по событию прокрутки
      requestAnimationFrame(() => grid.dispatchEvent(new Event("scroll")));
    };
  };

  dvFx("doctors", {
    // 1 · Сетка: только раскладка и наведение (css)
    1: (sec) => dvDocFlat(sec),

    // 2 · Шахматка: колонки едут с разной скоростью, чётные стоят ниже (тот же сдвиг, что в css)
    2: (sec) => {
      const undo = dvDocFlat(sec);
      const grid = $("[data-doctors-carousel]", sec);
      const off = () => Math.min(150, innerWidth * 0.09);
      const amp = [34, 70, 48, 86];
      $$("[data-doctors-card]", sec).forEach((card, i) => {
        const col = i % 4, a = amp[col], base = () => (col % 2 ? off() : 0);
        G.fromTo(card, { y: () => base() + a }, { y: () => base() - a, ease: "none", scrollTrigger: { trigger: grid, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
      });
      return undo;
    },

    // 3 · Портрет: главный врач крупно, миниатюры (кнопки «Показать врача …») переключают его
    3: (sec) => {
      const undo = dvDocFlat(sec);
      const cards = $$("[data-doctors-card]", sec);
      const dots = $$("[data-doctors-dot]", sec);
      const box = $(".doctors__dots", sec);
      if (!cards.length || !box) return undo;
      sec.classList.add("dv-portrait");
      let cur = -1;
      const show = (i) => {
        if (i === cur || !cards[i]) return;
        cur = i;
        cards.forEach((c, k) => c.classList.toggle("dv-main", k === i));
        dots.forEach((d, k) => {
          d.classList.toggle("dv-on", k === i);
          d.setAttribute("aria-pressed", String(k === i));
        });
      };
      show(0);
      const pick = (e) => {
        const d = e.target.closest("[data-doctors-dot]");
        if (d) show(dots.indexOf(d));
      };
      box.addEventListener("click", pick);
      box.addEventListener("focusin", pick);
      return () => {
        box.removeEventListener("click", pick);
        box.removeEventListener("focusin", pick);
        sec.classList.remove("dv-portrait");
        cards.forEach((c) => c.classList.remove("dv-main"));
        dots.forEach((d) => { d.classList.remove("dv-on"); d.removeAttribute("aria-pressed"); });
        undo();
      };
    },
  });

  // ----- варианты: faq -----
  // Вопросы, «Две колонки»: вопросы раскладываются в две независимые колонки (открытый вопрос
  // раздвигает только свою колонку); уборка возвращает их в общий список в прежнем порядке
  dvFx("faq", {
    1: (sec) => {
      const list = $(".faq-list", sec);
      const items = list ? $$(":scope > .faq-item", list) : [];
      if (items.length < 2) return;
      const half = Math.ceil(items.length / 2);
      const cols = [document.createElement("div"), document.createElement("div")];
      cols.forEach((c) => { c.className = "faq-col"; list.appendChild(c); });
      items.forEach((it, i) => cols[i < half ? 0 : 1].appendChild(it));
      return () => {
        items.forEach((it) => list.appendChild(it));
        cols.forEach((c) => c.remove());
      };
    },
  });

  // ----- варианты: hero -----
  // первый экран: у каждого варианта своё движение при прокрутке
  {
    const heroOut = (sec, tween, start = "top top", end = "bottom top") =>
      G.to(tween.targets, { ...tween.vars, ease: "none", scrollTrigger: { trigger: sec, start, end, scrub: true } });
    dvFx("hero", {
      // Витрина: камера в раме чуть подъезжает, текст уходит вверх и тает
      1: (sec) => {
        heroOut(sec, { targets: $(".hero__media picture", sec), vars: { scale: 1.08, yPercent: 4 } });
        heroOut(sec, { targets: $(".hero__media", sec), vars: { y: -60 } });
        heroOut(sec, { targets: $(".hero__in", sec), vars: { y: -80, autoAlpha: 0 } }, "40% top", "95% top");
      },
      // Манифест: строки заголовка расходятся в стороны, открывая снимок, снимок приближается
      // (подзаголовок, кнопки и ряд фактов не трогаем: их проявляет первый показ экрана)
      2: (sec) => {
        const [l1, l2] = $$(".hero__title-main", sec);
        heroOut(sec, { targets: l1, vars: { xPercent: -14 } });
        heroOut(sec, { targets: l2, vars: { xPercent: 22 } });
        $$(".hero__title-sub", sec).forEach((s) => heroOut(sec, { targets: s, vars: { y: -30, autoAlpha: 0 } }, "10% top", "60% top"));
        heroOut(sec, { targets: $(".hero__media picture", sec), vars: { scale: 1.12 } });
        heroOut(sec, { targets: $(".hero__media", sec), vars: { y: -40 } });
      },
      // Окно: экран держится, створки вокруг окна разъезжаются, снимок встаёт на своё место
      3: (sec) => {
        const media = $(".hero__media", sec), pic = $("picture", media);
        const shut = ["t", "b", "l", "r"].map((k) => {
          const i = document.createElement("i");
          i.className = "hero__shut hero__shut--" + k;
          i.setAttribute("aria-hidden", "true");
          media.appendChild(i);
          return i;
        });
        const [t, b, l, r] = shut;
        const tl = G.timeline({
          defaults: { ease: "power2.inOut", duration: 1 },
          scrollTrigger: { trigger: sec, start: "top top", end: "+=85%", pin: true, scrub: true, anticipatePin: 1 },
        });
        G.set(pic, { xPercent: -29 });
        tl.to($(".hero__copy", sec), { autoAlpha: 0, y: -50, duration: 0.35, ease: "power1.in" }, 0)
          .fromTo(sec, { "--p": 0 }, { "--p": 1 }, 0.08)
          .to(pic, { xPercent: 0 }, 0.08)
          .to(t, { yPercent: -100 }, 0.08)
          .to(b, { yPercent: 100 }, 0.08)
          .to(l, { xPercent: -100 }, 0.08)
          .to(r, { xPercent: 100 }, 0.08);
        return () => { shut.forEach((i) => i.remove()); sec.style.removeProperty("--p"); };
      },
    });
  }

  // ----- варианты: ortho -----
  // 04 · ортодонтия: эффекты вариантов (блок, чтобы имена не пересекались с другими секциями)
  {
    const NS = "http://www.w3.org/2000/svg";
    const svgEl = (tag, cls, parent) => { const n = document.createElementNS(NS, tag); if (cls) n.setAttribute("class", cls); parent?.appendChild(n); return n; };
    // положение элемента внутри host без учёта transform (появление и параллакс не сбивают выноски)
    const offIn = (el, host) => {
      let x = 0, y = 0, n = el;
      while (n && n !== host) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    };
    // широкой полосе нужен крупный снимок: sizes на время варианта «во всю ширину»
    const wideSizes = (pic) => {
      const nodes = $$("source, img", pic);
      const old = nodes.map((n) => n.getAttribute("sizes"));
      nodes.forEach((n) => n.setAttribute("sizes", "100vw"));
      return () => nodes.forEach((n, i) => (old[i] == null ? n.removeAttribute("sizes") : n.setAttribute("sizes", old[i])));
    };

    dvFx("ortho", {
      // «Полотно»: снимок медленно отъезжает, карточка поднимается на полосу.
      // Масштаб на picture: у img уже свои параллакс и покачивание
      1: (sec) => {
        const vis = $(".ortho__visual", sec), pic = $(".ortho__frame picture", sec), body = $(".ortho__body", sec);
        if (!vis || !pic || !body) return;
        const restoreSizes = wideSizes(pic);
        G.fromTo(pic, { scale: 1.14 }, { scale: 1, ease: "none", scrollTrigger: { trigger: vis, start: "top bottom", end: "bottom top", scrub: true } });
        G.fromTo(body, { y: 110 }, { y: 0, ease: "none", scrollTrigger: { trigger: vis, start: "center bottom", end: "bottom 45%", scrub: true } });
        return () => { restoreSizes(); G.set([pic, body], { clearProps: "transform" }); };
      },

      // «Витрина»: латунные выноски от пунктов к предметам на снимке прорисовываются при входе
      3: (sec) => {
        const grid = $(".ortho__grid", sec), pic = $(".ortho__frame picture", sec), rows = $$(".orow", sec);
        if (!grid || !pic || rows.length < 3) return;
        // куда указывают выноски (доли снимка): брекеты на нижней модели, элайнер, верхняя модель (диагностика и план)
        const targets = [[0.27, 0.665], [0.79, 0.27], [0.79, 0.47]];
        const svg = svgEl("svg", "dv-leads");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        grid.appendChild(svg);
        const leads = rows.slice(0, 3).map((row, i) => {
          const g = svgEl("g", "dv-lead dv-lead--" + (i + 1), svg);
          const path = svgEl("g", "dv-lead__path", g);
          return { row, g, path, under: svgEl("line", "dv-lead__under", path), line: svgEl("line", "dv-lead__line", path), halo: svgEl("circle", "dv-lead__halo", g), ring: svgEl("circle", "dv-lead__ring", g), dot: svgEl("circle", "dv-lead__dot", g) };
        });
        const pts = [];
        const layout = () => {
          const W = grid.offsetWidth, H = grid.offsetHeight;
          svg.setAttribute("width", W);
          svg.setAttribute("height", H);
          svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
          const p = offIn(pic, grid);
          leads.forEach((l, i) => {
            const r = offIn(l.row, grid), h = offIn($("h3", l.row) || l.row, grid);
            const left = r.x + r.w / 2 < p.x;
            const x1 = left ? r.x + r.w + 22 : r.x - 22, y1 = h.y + h.h / 2;
            const x2 = p.x + p.w * targets[i][0], y2 = p.y + p.h * targets[i][1];
            // линия кончается у края кольца вокруг точки
            const len = Math.hypot(x2 - x1, y2 - y1) || 1, k = (len - 10) / len;
            [l.under, l.line].forEach((ln) => { ln.setAttribute("x1", x1); ln.setAttribute("y1", y1); ln.setAttribute("x2", x1 + (x2 - x1) * k); ln.setAttribute("y2", y1 + (y2 - y1) * k); });
            [[l.halo, 22], [l.ring, 10], [l.dot, 4]].forEach(([c, rad]) => { c.setAttribute("cx", x2); c.setAttribute("cy", y2); c.setAttribute("r", rad); });
            pts[i] = { x1, y1, x2, y2 };
          });
        };
        // до входа выносок не видно; на входе меряем раскладку и прорисовываем от пункта к предмету
        svg.style.visibility = "hidden";
        let tl = null;
        const draw = () => {
          layout();
          svg.style.visibility = "";
          tl = G.timeline();
          leads.forEach((l, i) => {
            const { x1, y1, x2, y2 } = pts[i];
            const at = 0.1 + i * 0.22;
            tl.fromTo(l.path, { scale: 0, svgOrigin: `${x1} ${y1}` }, { scale: 1, svgOrigin: `${x1} ${y1}`, duration: 0.9, ease: "power2.inOut" }, at)
              .fromTo(l.dot, { scale: 0, svgOrigin: `${x2} ${y2}` }, { scale: 1, svgOrigin: `${x2} ${y2}`, duration: 0.45, ease: "back.out(2.4)" }, at + 0.62)
              .fromTo(l.ring, { scale: 0, opacity: 0, svgOrigin: `${x2} ${y2}` }, { scale: 1, opacity: 0.9, svgOrigin: `${x2} ${y2}`, duration: 0.6, ease: "back.out(2)" }, at + 0.7);
          });
          tl.eventCallback("onComplete", () => G.set(leads.flatMap((l) => [l.path, l.ring, l.dot]), { clearProps: "transform" }));
        };
        ST.create({ trigger: grid, start: "top 45%", end: "max", once: true, onEnter: draw });
        // раскладка поменялась (шрифты, размер окна): выноски встают на новые места
        const onRefresh = () => { if (tl && !tl.isActive()) layout(); };
        ST.addEventListener("refresh", onRefresh);
        return () => { ST.removeEventListener("refresh", onRefresh); svg.remove(); };
      },
    });
  }

  // ----- варианты: restoration -----
  // 03 · «Восстановление»: эффекты вариантов для десктопа (блок — чтобы имена не пересекались с другими файлами)
  {
    // общее появление [data-reveal] снимаем с элементов, которыми дальше управляет вариант
    const takeReveal = (els) => {
      els = els.filter(Boolean);
      ST.getAll().forEach((t) => { if (els.includes(t.trigger)) t.kill(); });
      els.forEach((el) => el.removeAttribute("data-reveal"));
      G.killTweensOf(els, "opacity,y");
      G.set(els, { clearProps: "opacity,transform" });
    };

    dvFx("restoration", {
      // Вкладки: касание, щелчок или фокус на вкладке сменяет случай на сцене (кроссфейд — переходы в CSS)
      1: (sec) => {
        const box = $(".resto__cases", sec), cases = $$(".rcase", box);
        if (!box || !cases.length) return;
        // вкладка не должна получать transform: снимки сцены позиционированы от ленты, а не от вкладки
        takeReveal(cases);
        sec.classList.add("dv-tabs");
        const set = (c) => cases.forEach((x) => x.classList.toggle("is-active", x === c));
        set(cases[0]);
        const offs = cases.map((c, i) => {
          c.setAttribute("tabindex", "0");
          const on = () => set(c);
          const key = (e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            cases[(i + (e.key === "ArrowRight" ? 1 : cases.length - 1)) % cases.length].focus();
          };
          c.addEventListener("click", on);
          c.addEventListener("focusin", on);
          c.addEventListener("keydown", key);
          return () => { c.removeEventListener("click", on); c.removeEventListener("focusin", on); c.removeEventListener("keydown", key); c.removeAttribute("tabindex"); c.classList.remove("is-active"); };
        });
        // заголовки вкладок поднимаются по очереди
        cases.forEach((c, i) => {
          const h = $("h3", c);
          if (h) G.fromTo(h, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1, delay: i * 0.1, ease: "expo.out", scrollTrigger: { trigger: box, start: "top 86%", once: true } });
        });
        return () => { offs.forEach((off) => off()); sec.classList.remove("dv-tabs"); };
      },

      // Три колонки: латунные линии между колонками прорисовываются, когда колонки показались
      2: (sec) => {
        const cases = $$(".rcase", sec);
        if (!cases.length) return;
        sec.classList.add("dv-rules");
        ST.create({ trigger: cases[0], start: "top 78%", once: true, onEnter: () => sec.classList.add("is-drawn") });
        return () => sec.classList.remove("dv-rules", "is-drawn");
      },

      // Разворот: запись переезжает на левую страницу, вертикальная линия этапов прорисовывается
      3: (sec) => {
        const aside = $(".resto__aside", sec), actions = $(".resto__actions", sec), track = $(".workflow__track", sec), wl = $(".workflow__line", sec);
        if (!aside) return;
        // элементы внутри липкой страницы: положение для общего появления считалось бы неверно, показываем сразу
        takeReveal([$(".sec-lead", aside), $(".resto__visual", aside), actions]);
        const home = actions?.previousElementSibling;
        if (actions) aside.appendChild(actions);
        let line = null;
        if (wl && track) {
          line = document.createElement("b");
          line.className = "dv-wline";
          line.setAttribute("aria-hidden", "true");
          wl.appendChild(line);
          // этап загорается, когда его верх доходит до 74 % экрана; передний край линии идёт так же
          G.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: track, start: "top 74%", end: "bottom 74%", scrub: true } });
        }
        $$(".rcase__media", sec).forEach((pic) => G.fromTo(pic, { scale: 1.1 }, { scale: 1, ease: "none", scrollTrigger: { trigger: pic, start: "top bottom", end: "top 45%", scrub: true } }));
        return () => {
          if (actions && home) home.after(actions);
          line?.remove();
        };
      },
    });
  }

  // ----- варианты: restoration.m -----
  // 03 · «Восстановление» на телефоне: вид «Сейчас» (выбор Ильи 2026-10-18) с подсказкой листания.
  mvFx("restoration", {
    // Сейчас: когда лента показалась, она один раз сама подаётся влево и возвращается — видно, что её листают.
    // Двигаем саму прокрутку (полоса под лентой едет вместе с ней); если ленту уже трогали, ничего не делаем
    0: (sec) => {
      const box = $(".resto__cases", sec);
      if (!box || box.scrollWidth - box.clientWidth < 8) return;
      const o = { x: 0 };
      let tl = null, touched = false;
      const free = () => box.style.removeProperty("scroll-snap-type");
      const stop = () => { touched = true; if (tl) { tl.kill(); tl = null; free(); } };
      box.addEventListener("pointerdown", stop, { passive: true });
      box.addEventListener("touchstart", stop, { passive: true });
      const play = () => {
        if (touched || box.scrollLeft > 4) return;
        box.style.scrollSnapType = "none";
        const set = () => (box.scrollLeft = o.x);
        tl = G.timeline({ onComplete: () => { tl = null; free(); } })
          .to(o, { x: 84, duration: 0.75, ease: "power2.inOut", onUpdate: set })
          .to(o, { x: 0, duration: 0.95, ease: "power3.out", onUpdate: set }, "+=0.2");
      };
      // карточки сначала проявляются (общее появление), поэтому ждём немного после входа ленты в экран
      ST.create({ trigger: box, start: "top 70%", once: true, onEnter: () => G.delayedCall(1.1, play) });
      return () => {
        stop();
        box.removeEventListener("pointerdown", stop);
        box.removeEventListener("touchstart", stop);
      };
    },
  });

  // ----- варианты: reviews -----
  // Отзывы: 1 — карточки кладки ложатся по очереди; 2 — один отзыв крупно, «назад/вперёд» и точки
  // сменяют его кроссфейдом; 3 — оценка отсчитывается при входе, лента карточек листается кнопками и точками
  {
    const rvArrow = (dir) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rv-nav rv-nav--" + dir;
      b.setAttribute("aria-label", dir === "prev" ? "Предыдущий отзыв" : "Следующий отзыв");
      b.innerHTML = `<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="${dir === "prev" ? "M14.5 6 8.5 12l6 6" : "m9.5 6 6 6-6 6"}"/></svg>`;
      return b;
    };
    dvFx("reviews", {
      1: (sec) => {
        // кирпичи поднимаются на место по мере прокрутки; у колонок разный отступ сверху, поэтому и очередь разная
        $$(".review", sec).forEach((card) => {
          G.fromTo(card, { y: 64, opacity: 0 }, { y: 0, opacity: 1, ease: "power2.out", scrollTrigger: { trigger: card, start: "top 98%", end: "top 70%", scrub: true } });
        });
      },
      2: (sec) => {
        const list = $(".reviews-feed__list", sec), feed = $(".reviews-feed", sec), dotsBox = $(".reviews-feed__dots", sec);
        const cards = $$(".review", list || sec), dots = $$("[data-review-dot]", sec);
        if (!list || !dotsBox || cards.length < 2) return;
        let cur = 0;
        const prev = rvArrow("prev"), next = rvArrow("next");
        dotsBox.before(prev);
        dotsBox.after(next);
        list.classList.add("is-quote");
        const show = (i) => {
          cur = (i + cards.length) % cards.length;
          cards.forEach((c, k) => c.classList.toggle("is-q", k === cur));
          dots.forEach((d, k) => {
            d.classList.toggle("is-q", k === cur);
            if (k === cur) d.setAttribute("aria-current", "true");
            else d.removeAttribute("aria-current");
          });
        };
        const onPrev = () => show(cur - 1);
        const onNext = () => show(cur + 1);
        const onDot = (e) => show(dots.indexOf(e.currentTarget));
        prev.addEventListener("click", onPrev);
        next.addEventListener("click", onNext);
        dots.forEach((d) => d.addEventListener("click", onDot));
        show(0);
        // сцена цитаты выходит навстречу, когда до неё доходит прокрутка
        if (feed) G.fromTo(feed, { y: 48, opacity: 0 }, { y: 0, opacity: 1, ease: "power2.out", scrollTrigger: { trigger: feed, start: "top 94%", end: "top 62%", scrub: true } });
        return () => {
          prev.removeEventListener("click", onPrev);
          next.removeEventListener("click", onNext);
          dots.forEach((d) => { d.removeEventListener("click", onDot); d.classList.remove("is-q"); d.removeAttribute("aria-current"); });
          cards.forEach((c) => c.classList.remove("is-q"));
          list.classList.remove("is-quote");
          prev.remove();
          next.remove();
        };
      },
      3: (sec) => {
        const undo = [];
        // лента: кнопки листают по карточке (точки и счётчик ведёт общая логика ленты)
        const list = $(".reviews-feed__list", sec), status = $(".reviews-feed__status", sec);
        const cards = $$(".review", list || sec);
        if (list && status && cards.length > 1) {
          const prev = rvArrow("prev"), next = rvArrow("next");
          status.append(prev, next);
          const step = () => (cards[1].offsetLeft - cards[0].offsetLeft) || list.clientWidth;
          const sync = () => {
            prev.disabled = list.scrollLeft <= 4;
            next.disabled = list.scrollLeft >= list.scrollWidth - list.clientWidth - 4;
          };
          const onPrev = () => list.scrollBy({ left: -step(), behavior: "smooth" });
          const onNext = () => list.scrollBy({ left: step(), behavior: "smooth" });
          let raf = 0;
          const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; sync(); }); };
          prev.addEventListener("click", onPrev);
          next.addEventListener("click", onNext);
          list.addEventListener("scroll", onScroll, { passive: true });
          const ro = "ResizeObserver" in window ? new ResizeObserver(sync) : null;
          ro?.observe(list);
          sync();
          // карточки выходят из-под нижнего края ленты одна за другой, вслед за оценкой
          cards.forEach((c, i) => {
            G.fromTo(c, { y: 90, opacity: 0 }, { y: 0, opacity: 1, ease: "power2.out", scrollTrigger: { trigger: list, start: `top ${92 - i * 7}%`, end: `top ${62 - i * 7}%`, scrub: true } });
          });
          undo.push(() => {
            prev.removeEventListener("click", onPrev);
            next.removeEventListener("click", onNext);
            list.removeEventListener("scroll", onScroll);
            ro?.disconnect();
            cancelAnimationFrame(raf);
            prev.remove();
            next.remove();
            list.scrollLeft = 0;
          });
        }
        return () => undo.forEach((fn) => fn());
      },
    });
  }

  // ----- варианты: therapy -----
  // 05 · лечение зубов: эффекты вариантов (блок, чтобы имена не пересекались с другими секциями)
  {
    const NS = "http://www.w3.org/2000/svg";
    const svgEl = (tag, cls, parent) => { const n = document.createElementNS(NS, tag); if (cls) n.setAttribute("class", cls); parent?.appendChild(n); return n; };
    // положение элемента внутри host без учёта transform (появление карточек не сбивает линии)
    const offIn = (el, host) => {
      let x = 0, y = 0, n = el;
      while (n && n !== host) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    };
    // карточки в порядке разметки: кариес, каналы, гигиена, осмотры — как круги на схеме
    const cardsOf = (sec) => [...$$(".therapy__cards--top .thcard", sec), ...$$(".therapy__cards--bottom .thcard", sec)];

    dvFx("therapy", {
      // «Созвездие»: от каждой карточки к её кругу на схеме прорисовывается латунная линия
      2: (sec) => {
        const grid = $(".therapy__grid", sec), pic = $(".therapy__visual picture", sec), cards = cardsOf(sec);
        if (!grid || !pic || cards.length < 4) return;
        // центры и радиусы кругов на схеме (доли снимка)
        const circles = [[0.2, 0.197, 0.137], [0.803, 0.197, 0.137], [0.142, 0.52, 0.13], [0.858, 0.52, 0.13]];
        const svg = svgEl("svg", "dv-stars");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.style.visibility = "hidden";
        grid.appendChild(svg);
        const stars = cards.map((card, i) => {
          const g = svgEl("g", "dv-star dv-star--" + (i + 1), svg);
          return { card, line: svgEl("line", "dv-star__line", g), ring: svgEl("circle", "dv-star__ring", g), dot: svgEl("circle", "dv-star__dot", g) };
        });
        const pts = [];
        const layout = () => {
          const W = grid.offsetWidth, H = grid.offsetHeight;
          svg.setAttribute("width", W);
          svg.setAttribute("height", H);
          svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
          const p = offIn(pic, grid);
          stars.forEach((s, i) => {
            const r = offIn(s.card, grid), h = offIn($("h3", s.card) || s.card, grid);
            const left = r.x + r.w / 2 < p.x + p.w / 2;
            const x1 = left ? r.x + r.w + 18 : r.x - 18, y1 = h.y + h.h / 2;
            const [fx, fy, fr] = circles[i];
            const cx = p.x + p.w * fx, cy = p.y + p.h * fy, rad = p.w * fr;
            // линия кончается на латунном ободке круга
            const d = Math.hypot(cx - x1, cy - y1) || 1, k = Math.max(0, d - rad) / d;
            const x2 = x1 + (cx - x1) * k, y2 = y1 + (cy - y1) * k;
            s.line.setAttribute("x1", x1); s.line.setAttribute("y1", y1);
            s.line.setAttribute("x2", x2); s.line.setAttribute("y2", y2);
            s.dot.setAttribute("cx", x2); s.dot.setAttribute("cy", y2); s.dot.setAttribute("r", 3);
            s.ring.setAttribute("cx", cx); s.ring.setAttribute("cy", cy); s.ring.setAttribute("r", rad + 6);
            pts[i] = { x1, y1, x2, y2 };
          });
        };
        let tl = null;
        const draw = () => {
          layout();
          svg.style.visibility = "";
          tl = G.timeline();
          stars.forEach((s, i) => {
            const { x1, y1, x2, y2 } = pts[i];
            const at = 0.1 + i * 0.16;
            tl.fromTo(s.line, { scale: 0, svgOrigin: `${x1} ${y1}` }, { scale: 1, svgOrigin: `${x1} ${y1}`, duration: 0.85, ease: "power2.inOut" }, at)
              .fromTo(s.dot, { scale: 0, svgOrigin: `${x2} ${y2}` }, { scale: 1, svgOrigin: `${x2} ${y2}`, duration: 0.4, ease: "back.out(2.6)" }, at + 0.68);
          });
          tl.eventCallback("onComplete", () => G.set(stars.flatMap((s) => [s.line, s.dot]), { clearProps: "transform" }));
        };
        ST.create({ trigger: grid, start: "top 55%", end: "max", once: true, onEnter: draw });
        const onRefresh = () => { if (tl && !tl.isActive()) layout(); };
        ST.addEventListener("refresh", onRefresh);
        return () => { ST.removeEventListener("refresh", onRefresh); svg.remove(); };
      },

      // «Список»: строка, которую сейчас читают (середина экрана), подсвечена, схема приближает её круг
      3: (sec) => {
        const cards = cardsOf(sec);
        const set = (i) => {
          cards.forEach((c, k) => c.classList.toggle("is-focus", k === i));
          if (i >= 0) sec.dataset.dvFocus = String(i + 1);
          else delete sec.dataset.dvFocus;
        };
        let cur = -1;
        cards.forEach((card, i) => ST.create({
          trigger: card, start: "top 58%", end: "bottom 58%",
          onToggle: (self) => {
            if (self.isActive) { cur = i; set(i); }
            else if (cur === i) { cur = -1; set(-1); }
          },
        }));
        return () => { cards.forEach((c) => c.classList.remove("is-focus")); delete sec.dataset.dvFocus; };
      },
    });
  }

  // ----- варианты: treatment-start -----
  // 01 · «С чего начать»: эффекты вариантов (блок — чтобы имена не пересекались с другими файлами вариантов)
  {
    // общее появление [data-reveal] снимаем с элементов, которыми дальше управляет вариант:
    // иначе его твин с overwrite погасил бы наши твины на тех же элементах
    const takeReveal = (els) => {
      els = els.filter(Boolean);
      ST.getAll().forEach((t) => { if (els.includes(t.trigger)) t.kill(); });
      els.forEach((el) => el.removeAttribute("data-reveal"));
      G.killTweensOf(els, "opacity,y");
      G.set(els, { clearProps: "opacity,transform" });
    };
    // снимок крупнее, чем задумано в разметке: подсказываем браузеру взять файл побольше, при уборке возвращаем
    const sizesFor = (els, val) => {
      const nodes = els.flatMap((el) => $$("source, img", el));
      const old = nodes.map((n) => n.getAttribute("sizes"));
      nodes.forEach((n) => n.setAttribute("sizes", val));
      return () => nodes.forEach((n, i) => (old[i] == null ? n.removeAttribute("sizes") : n.setAttribute("sizes", old[i])));
    };

    dvFx("treatment-start", {
      // Панорама: панели поднимаются по очереди, снимок внутри «садится» на место
      1: (sec) => {
        const deck = $(".tcards", sec), cards = $$(".tcard", deck);
        if (!deck || !cards.length) return;
        takeReveal(cards);
        const unsize = sizesFor(cards, "62vw");
        cards.forEach((c, i) => {
          G.fromTo(c, { y: 140, autoAlpha: 0 }, { y: 0, autoAlpha: 1, ease: "power2.out", scrollTrigger: { trigger: deck, start: `top ${100 - i * 7}%`, end: `top ${62 - i * 7}%`, scrub: true } });
          const pic = $(".tcard__media picture", c);
          if (pic) G.fromTo(pic, { scale: 1.16 }, { scale: 1, ease: "none", scrollTrigger: { trigger: deck, start: "top bottom", end: "top 25%", scrub: true } });
        });
        return () => { unsize(); };
      },

      // Колода: следующая карточка наезжает, предыдущие уменьшаются и темнеют
      2: (sec) => {
        const deck = $(".tcards", sec), cards = $$(".tcard", deck);
        if (!deck || cards.length < 2) return;
        takeReveal(cards);
        const unsize = sizesFor(cards, "34vw");
        const shades = cards.map((c) => { const sh = document.createElement("i"); sh.className = "dv-shade"; sh.setAttribute("aria-hidden", "true"); c.appendChild(sh); return sh; });
        const n = cards.length;
        // карточки липкие, поэтому триггер — сама колода (она не липкая), а места карточек считаем по высоте
        const step = () => cards[0].offsetHeight + (parseFloat(getComputedStyle(deck).rowGap) || 0);
        const stuck = (i) => parseFloat(getComputedStyle(cards[i]).top) || 0;
        cards.forEach((c, i) => {
          const pic = $(".tcard__media picture", c);
          if (i && pic) G.fromTo(pic, { scale: 1.14 }, { scale: 1, ease: "none", scrollTrigger: { trigger: deck, start: () => `top+=${step() * i} bottom`, end: () => `top+=${step() * i} top+=${stuck(i)}`, scrub: true, invalidateOnRefresh: true } });
          if (i === n - 1) return;
          const depth = n - 1 - i;
          G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: deck, start: () => `top+=${step() * (i + 1)} 88%`, end: () => `top+=${step() * (n - 1)} top+=${stuck(n - 1)}`, scrub: true, invalidateOnRefresh: true } })
            .fromTo(c, { scale: 1 }, { scale: 1 - 0.045 * depth }, 0)
            .fromTo(shades[i], { opacity: 0 }, { opacity: 0.1 + 0.13 * depth }, 0);
        });
        return () => { unsize(); shades.forEach((sh) => sh.remove()); };
      },

      // Указатель: пункт под курсором или в фокусе становится активным и остаётся им, кадр сменяется
      3: (sec) => {
        const deck = $(".tcards", sec), cards = $$(".tcard", deck);
        if (!deck || !cards.length) return;
        // карточка не должна получать transform: иначе общий кадр (он позиционирован от списка) прыгнул бы в неё
        takeReveal(cards);
        const unsize = sizesFor(cards, "58vw");
        sec.classList.add("dv-ix");
        cards.forEach((c, i) => {
          const body = $(".tcard__content", c);
          if (body) G.fromTo(body, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.1, delay: i * 0.12, ease: "expo.out", scrollTrigger: { trigger: deck, start: "top 82%", once: true } });
        });
        const set = (card) => cards.forEach((c) => c.classList.toggle("is-active", c === card));
        set(cards[0]);
        const offs = cards.map((c) => {
          const on = () => set(c);
          c.addEventListener("pointerenter", on);
          c.addEventListener("focusin", on);
          c.addEventListener("click", on);
          return () => { c.removeEventListener("pointerenter", on); c.removeEventListener("focusin", on); c.removeEventListener("click", on); };
        });
        return () => { offs.forEach((off) => off()); cards.forEach((c) => c.classList.remove("is-active")); sec.classList.remove("dv-ix"); unsize(); };
      },
    });
  }


  // запускаем эффекты выбранных вариантов всех секций: десктоп от 1100 px, телефон до 760 px
  FXD.start();
  FXM.start();

  // бегущие строки: скорость следует за скоростью прокрутки, направление за её направлением
  $$("[data-marquee]").forEach((mq) => {
    const track = $(".marquee__track", mq);
    if (!track || !track.children.length) return;
    const base = [...track.children];
    const clone = (el) => { const c = el.cloneNode(true); c.setAttribute("aria-hidden", "true"); track.appendChild(c); };
    let guard = 0;
    while (track.scrollWidth < innerWidth + 200 && guard++ < 12) base.forEach(clone);
    [...track.children].forEach(clone);
    const speed = mq.hasAttribute("data-velocity") ? 70 : 45;
    const loop = G.to(track, { xPercent: -50, duration: track.scrollWidth / 2 / speed, ease: "none", repeat: -1 });
    let dir = 1, cur = 1, target = 1;
    ST.create({ trigger: mq, start: "top bottom", end: "bottom top", onToggle: (self) => (self.isActive ? loop.play() : loop.pause()), onUpdate: (self) => { dir = self.direction; target = dir * (1 + Math.min(Math.abs(self.getVelocity()) / 400, 4)); } });
    G.ticker.add(() => { target += (dir - target) * 0.04; cur += (target - cur) * 0.12; loop.timeScale(cur); });
  });

  // кольцо медальона ПроДокторов заполняется латунью по кругу: на телефоне — пока плашка поднимается по экрану,
  // на компьютере колонка с оценкой стоит на месте, поэтому кольцо замыкается, пока листаются отзывы справа
  $$(".pdplate .dh-prodoctorov-widget").forEach((w) => {
    const grid = w.closest(".reviews__grid") || w;
    mm.add({ wide: "(min-width: 1000px)", narrow: "(max-width: 999px)" }, (c) => {
      const st = c.conditions.wide
        ? { trigger: w, start: "top bottom", endTrigger: grid, end: "bottom bottom", scrub: true }
        : { trigger: w, start: "top bottom", end: "center 45%", scrub: true };
      G.fromTo(w, { "--ring": 0 }, { "--ring": 1, ease: "none", scrollTrigger: st });
    });
  });

  // телефон: пока карточка врача проходит низ экрана, плавающая «Записаться» прячется,
  // чтобы не закрывать кнопку записи на самой карточке (у каждой карточки она своя)
  const docRail = $("[data-doctors-carousel]");
  if (docRail) mm.add("(max-width: 760px)", () => {
    ST.create({ trigger: docRail, start: "top 70%", end: "bottom 70%", onToggle: (self) => root.classList.toggle("dh-in-doctors", self.isActive) });
    return () => root.classList.remove("dh-in-doctors");
  });

  // колонка с оценкой выше экрана (ноутбук 1440×900): липнет нижним краем, чтобы плашка ПроДокторов не обрезалась
  const rsum = $(".rsum");
  if (rsum && "ResizeObserver" in window) {
    const fit = () => rsum.style.setProperty("--rsum-fit", innerHeight - rsum.offsetHeight - 24 + "px");
    new ResizeObserver(fit).observe(rsum);
    addEventListener("resize", fit, { passive: true });
  }

  // 10 · счётчик оценки
  $$("[data-count]").forEach((el) => {
    const raw = el.dataset.count;
    const target = parseFloat(raw.replace(",", "."));
    const dec = (raw.split(/[.,]/)[1] || "").length;
    const o = { v: 0 };
    G.to(o, { v: target, duration: 1.8, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 92%", once: true }, onUpdate: () => (el.textContent = o.v.toFixed(dec)) });
  });

  // подвал: крупное название поднимается один раз, когда показалось
  const big = $(".site-footer__big");
  if (big) G.from(big.children, { yPercent: 40, autoAlpha: 0, stagger: 0.1, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: big, start: "top 95%", once: true } });

  // «магнитные» кнопки
  if (fine) {
    $$("[data-magnet]").forEach((b) => {
      const xTo = G.quickTo(b, "x", { duration: 0.6, ease: "elastic.out(1, .45)" });
      const yTo = G.quickTo(b, "y", { duration: 0.6, ease: "elastic.out(1, .45)" });
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.22);
        yTo((e.clientY - r.top - r.height / 2) * 0.32);
      });
      b.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }

  // пересчёт позиций, когда догрузились шрифты и картинки: не посреди прокрутки
  // (на телефоне пересчёт во время свайпа давал рывок до 0,1 с), а когда она остановилась
  const refresh = () => ST.refresh();
  let refreshPending = false;
  const refreshIdle = () => {
    refreshPending = true;
    if (!ST.isScrolling()) { refreshPending = false; refresh(); }
  };
  ST.addEventListener("scrollEnd", () => { if (refreshPending) { refreshPending = false; refresh(); } });
  document.fonts?.ready.then(refreshIdle);
  addEventListener("load", () => {
    refresh();
    if (hashTarget) requestAnimationFrame(() => scrollToEl(hashTarget, true));
  }, { once: true });
  // снимки декодируем заранее, за полтора экрана до показа: большая картинка, декодируемая
  // прямо во время свайпа, давала на телефоне пропуск кадра
  if ("IntersectionObserver" in window) {
    const pre = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const im = e.target;
      pre.unobserve(im);
      im.loading = "eager";
      im.decode?.().catch(() => {});
    }), { rootMargin: "150% 100%" });
    $$("main img[loading='lazy']").forEach((im) => pre.observe(im));
  }
  // у всех картинок заданы размеры, их загрузка вёрстку не сдвигает; если высота страницы всё же
  // поменялась (раскрылся блок, догрузился виджет), пересчитываем, когда прокрутка остановилась
  const mainEl = $("main");
  if (mainEl && "ResizeObserver" in window) {
    let lastH = 0, rt = 0;
    new ResizeObserver(([e]) => {
      const h = Math.round(e.contentRect.height);
      if (!lastH) { lastH = h; return; }
      if (Math.abs(h - lastH) < 2) return;
      lastH = h;
      clearTimeout(rt);
      rt = setTimeout(refreshIdle, 200);
    }).observe(mainEl);
  }

  // включили версию для слабовидящих: останавливаем всё движение и возвращаем обычную вёрстку
  new MutationObserver(() => {
    if (!isA11y() || !root.classList.contains("js-anim")) return;
    $$("[data-dv], [data-mv]").forEach((el) => { delete el.dataset.dv; delete el.dataset.mv; });
    mm.revert();
    ST.getAll().forEach((t) => t.kill(true));
    G.globalTimeline.clear();
    G.set(".faq__photo, .faq__photo img, .smile-card, [data-reveal], [data-clip], [data-hero-fade], .sw > span, .hero__media, .hero__media img, .hero__in, .site-header__inner, .tour__frame, .tour__frame img, .diag__track, .marquee__track, [data-drift], [data-magnet]", { clearProps: "all" });
    lenis?.destroy();
    lenis = null;
    $(".hero__dust")?.remove();
    $$(".is-flow, .is-rail").forEach((el) => el.classList.remove("is-flow", "is-rail"));
    $$(".dcard, .dcard__in, .review").forEach((el) => { el.style.transform = el.style.opacity = el.style.zIndex = ""; });
    $(".doctors__ghost")?.remove();
    $(".doctors__frame")?.classList.remove("has-ghost");
    root.classList.remove("js-anim");
  }).observe(root, { attributes: true, attributeFilter: ["class"] });
})();
