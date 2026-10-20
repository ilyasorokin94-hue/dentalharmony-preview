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
    root.classList.remove("js-anim");
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
  const setRootClass = (name, on) => { if (root.classList.contains(name) !== on) root.classList.toggle(name, on); };
  const syncLock = () => {
    const booking = !!modal?.classList.contains("is-open");
    const menu = !!header?.classList.contains("is-mobile-menu-open");
    setRootClass("is-booking-open", booking);
    setRootClass("has-mobile-menu", menu);
    if (!lenis) return;
    const stop = booking || menu || root.classList.contains("dhq-lock");
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
  // Илья выбрал варианты: десктоп (от 1100 px) 2026-10-19, телефон (до 760 px) 2026-10-18. Выбор стоит прямо
  // в разметке (data-dv="N" и data-mv="N"), без атрибута — прежний вид; планшет не меняется. Панелей больше нет,
  // списки нужны эффектам вариантов (dvFx и mvFx): у каждой секции выполняется эффект её варианта
  const DV = [
    ["hero", ".hero", "Первый экран", ["Сейчас"]],
    ["treatment-start", ".treatment-start", "С чего начать", ["Сейчас", "Панорама"]],
    ["diagnosis", ".diagnosis", "Диагностика", ["Сейчас", "Сюжет"]],
    ["restoration", ".restoration", "Восстановление", ["Сейчас", "Вкладки", "Три колонки"]],
    ["ortho", ".ortho", "Ортодонтия", ["Сейчас", "Полотно", "Сравнение", "Витрина"]],
    ["clinic", ".clinic", "Клиника", ["Сейчас"]],
    ["reviews", ".reviews", "Отзывы", ["Сейчас", "Стена", "Цитата"]],
    ["faq", ".faq", "Вопросы", ["Сейчас", "Две колонки"]],
  ];
  const MV = [
    ["restoration", ".restoration", "Восстановление", ["Сейчас"]],
    ["therapy", ".therapy", "Лечение зубов", ["Сейчас", "Список"]],
    ["directions", ".directions", "Направления", ["Сейчас", "Плитки", "Оглавление"]],
    ["doctors", ".doctors", "Врачи", ["Сейчас", "В экран"]],
    ["clinic-benefits", ".cbenefits", "Клиника: преимущества", ["Сейчас", "Строки"]],
    ["clinic-photos", ".photorail", "Клиника: фото", ["Сейчас", "Журнал", "Мозаика"]],
    ["faq", ".faq", "Вопросы", ["Сейчас", "Плакат", "Открытка"]],
  ];
  const mkVariants = (list, attr) => {
    const find = (key) => list.find((d) => d[0] === key);
    const el = (key) => $(find(key)?.[1] || "#none");
    const get = (key) => {
      const d = find(key), e = el(key);
      if (!d || !e) return 0;
      return Number(e.dataset[attr]) || 0;
    };
    const hooks = [];
    // keep: экран не прыгает, когда секция под ним меняет высоту
    const set = (key, v, keep) => {
      const d = find(key), e = el(key);
      if (!d || !e) return;
      const top0 = e.getBoundingClientRect().top;
      if (v) e.dataset[attr] = String(v); else delete e.dataset[attr];
      hooks.forEach((fn) => fn(key, e, v));
      if (keep) {
        const dy = e.getBoundingClientRect().top - top0;
        if (Math.abs(dy) > 1) window.scrollBy(0, dy);
      }
    };
    return { list, el, get, set, hooks };
  };
  const VD = mkVariants(DV, "dv"), VM = mkVariants(MV, "mv");
  // для проверок из консоли и автотестов: __dv.set("diagnosis", 2), __mv.set("therapy", 1)
  window.__dv = { set: (key, v) => VD.set(key, v, true), get: VD.get, list: () => DV.map((d) => d[0]) };
  window.__mv = { set: (key, v) => VM.set(key, v, true), get: VM.get, list: () => MV.map((d) => d[0]) };

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

  heroIn();

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
    });
  }

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
    dvFx("ortho", {
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
    dvFx("restoration", {
      // Три колонки: латунные линии между колонками прорисовываются, когда колонки показались
      2: (sec) => {
        const cases = $$(".rcase", sec);
        if (!cases.length) return;
        sec.classList.add("dv-rules");
        ST.create({ trigger: cases[0], start: "top 78%", once: true, onEnter: () => sec.classList.add("is-drawn") });
        return () => sec.classList.remove("dv-rules", "is-drawn");
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
