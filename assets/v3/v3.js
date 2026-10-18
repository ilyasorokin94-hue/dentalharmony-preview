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
    G.ticker.add((t) => lenis.raf(t * 1000));
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
    // шаг считаем по раскладке: при «потоке» карточки повёрнуты и уменьшены
    const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : doctors.clientWidth) || 1;
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
      const mid = doctors.scrollLeft + doctors.clientWidth / 2;
      cards.forEach((card) => {
        const d = Math.max(-2, Math.min(2, (card.offsetLeft + card.offsetWidth / 2 - mid) / card.offsetWidth));
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
    let raf = 0;
    doctors.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { update(); paint(); }); }, { passive: true });
    prev?.addEventListener("click", () => go(Math.max(0, index() - 1)));
    next?.addEventListener("click", () => go(Math.min(cards.length - 1, index() + 1)));
    dots.forEach((d, k) => d.addEventListener("click", () => go(k)));
    addEventListener("resize", () => { update(); paint(); });
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
    const rstep = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : reviews.clientWidth) || 1;
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
    reviews.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
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
    const upd = () => {
      const max = sc.scrollWidth - sc.clientWidth;
      const scrollable = max > 8 && /auto|scroll/.test(getComputedStyle(sc).overflowX);
      bar.hidden = !scrollable;
      if (!scrollable) return;
      const w = sc.clientWidth / sc.scrollWidth;
      bar.style.setProperty("--w", (w * 100).toFixed(2) + "%");
      bar.style.setProperty("--x", ((sc.scrollLeft / max) * ((1 - w) / w) * 100).toFixed(2) + "%");
    };
    sc.addEventListener("scroll", () => requestAnimationFrame(upd), { passive: true });
    addEventListener("resize", upd);
    upd();
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

  // ---------- только превью: переключатель вариантов подвала (build.py --preview ставит data-fv-switch) ----------
  const fvFoot = $(".site-footer[data-fv-switch]");
  if (fvFoot) {
    const bar = document.createElement("div");
    bar.className = "fv-switch";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Варианты подвала");
    bar.innerHTML = "<span>Вариант подвала, нажмите, чтобы сравнить</span>" + [["plaque", "Табличка"], ["light", "Светлый"], ["photo", "Фото входа"], ["", "Было"]]
      .map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join("");
    fvFoot.before(bar);
    const setFv = (v) => {
      if (v) fvFoot.dataset.fv = v; else delete fvFoot.dataset.fv;
      $$("button", bar).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
      window.ScrollTrigger?.refresh();
    };
    bar.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setFv(b.dataset.v); });
    setFv(fvFoot.dataset.fv || "");
  }

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
      .from($$("[data-split] .sw > span", h), { yPercent: 115, duration: 1.25, stagger: 0.05, ease: "power4.out" }, 0.1)
      .fromTo($$("[data-hero-fade]", h), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, clearProps: "transform" }, 0.55)
      .from(".site-header__inner", { y: -24, autoAlpha: 0, duration: 0.9, clearProps: "transform,opacity,visibility" }, 0.25);
  };

  const intro = $(".intro");
  if (intro && root.classList.contains("js-intro")) {
    introRunning = true;
    syncLock();
    try { sessionStorage.setItem("dh-v3-intro", "1"); } catch (e) { /* приватный режим */ }
    const hole = $(".intro__hole", intro), rim = $(".intro__rim", intro), slot = $(".intro__mark", intro);
    const chars = [];
    $$(".intro__w", intro).forEach((w) => {
      const text = w.textContent;
      w.textContent = "";
      [...text].forEach((ch) => { const s = document.createElement("span"); s.textContent = ch; w.appendChild(s); chars.push(s); });
    });
    // зуб в координатах 0…54; окно раскрывается из точки внутри коронки
    const OX = 27, OY = 21;
    const W = innerWidth, H = innerHeight;
    // куда летит окно: на телефоне в центр, на широком экране к зубу на фото первого экрана
    const wide = W >= 900 && W / H > 1.2;
    const TX = wide ? W * 0.79 : W / 2, TY = wide ? H * 0.47 : H / 2;
    const st = { h: 0, z: 0 };
    let base = null;
    const kEnd = Math.hypot(Math.max(TX, W - TX), Math.max(TY, H - TY)) / 9;
    const draw = () => {
      if (!base || st.z === 0) {
        const r = slot.getBoundingClientRect();
        const k0 = r.width / 54;
        base = { k: k0, x: r.left + OX * k0, y: r.top + OY * k0 };
      }
      const k = base.k * Math.pow(kEnd / base.k, st.z);
      const p = 1 - Math.pow(1 - st.z, 2.2);
      const x = base.x + (TX - base.x) * p, y = base.y + (TY - base.y) * p;
      const t = (s) => `translate(${x} ${y}) scale(${s}) translate(${-OX} ${-OY})`;
      rim.setAttribute("transform", t(k));
      rim.style.strokeWidth = 1.5 / k;
      hole.setAttribute("transform", t(k * st.h));
    };
    draw();
    intro.classList.add("is-live");
    G.set(".hero__media img", { scale: 1.14 });
    const em = $(".intro__word em", intro);
    const tl = G.timeline({ onComplete: () => { intro.remove(); root.classList.remove("js-intro"); introRunning = false; syncLock(); } })
      .to(".intro__glow", { opacity: 1, duration: 1.4, ease: "power1.out" }, 0)
      .to(rim, { strokeDashoffset: 0, duration: 1.3, ease: "power2.inOut", onUpdate: draw }, 0.1)
      .set(".intro__word", { opacity: 1 }, 0.5)
      .from(chars, { yPercent: 125, duration: 0.95, stagger: 0.035, ease: "power4.out" }, 0.5)
      .fromTo(".intro__tag", { opacity: 0, letterSpacing: "0.5em" }, { opacity: 1, letterSpacing: "0.34em", duration: 1.1, ease: "power3.out" }, 1)
      .fromTo(em, { "--sh": "110%" }, { "--sh": "-10%", duration: 1, ease: "power2.inOut" }, 1.35)
      .addLabel("reveal", 2.25)
      .to(chars, { yPercent: -140, duration: 0.45, stagger: 0.015, ease: "power2.in" }, "reveal-=0.3")
      .to(".intro__tag", { opacity: 0, y: -8, duration: 0.35, ease: "power2.in" }, "reveal-=0.3")
      .to(".intro__glow", { opacity: 0, duration: 0.5 }, "reveal")
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

  // пока кнопка записи первого экрана на виду, плавающая кнопка записи её не дублирует и не перекрывает
  const heroCta = $('[data-booking-source="hero"]');
  if (heroCta && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => root.classList.toggle("v3-hero-cta", e.isIntersecting)).observe(heroCta);
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
    addEventListener("resize", size);
  }

  // герой: фон уходит медленнее страницы, текст тает (на телефоне не тает: его ещё читают)
  mm.add("(min-width: 761px)", () => {
    G.to(".hero__media", { yPercent: 16, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    G.to(".hero__in", { y: -70, autoAlpha: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "42% top", end: "92% top", scrub: true } });
  });

  // 02 · диагностика: на широком экране закреплённая горизонтальная лента
  mm.add("(min-width: 1100px)", () => {
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
    const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: stage, start: "top top", end: () => "+=" + innerHeight * 3, pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true } });
    if (img) tl.fromTo(img, { scale: 1.32 }, { scale: 1, duration: 4 }, 0);
    if (line) tl.fromTo(line, { y: 0 }, { y: () => fig.clientHeight - 2, duration: 1, repeat: 3, yoyo: true, ease: "sine.inOut" }, 0);
    $$("b", bars).forEach((b, i) => tl.fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 1 }, i));
    steps.forEach((st, i) => {
      if (!i) return;
      tl.to(steps[i - 1], { autoAlpha: 0, y: -26, duration: 0.2, ease: "power2.in" }, i - 0.2)
        .fromTo(st, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.24, ease: "power2.out" }, i - 0.02);
    });
    return () => { stage.classList.remove("is-story"); bars.remove(); G.set(steps, { clearProps: "all" }); };
  });

  // 01 · на телефоне карточки собираются в колоду: следующая наезжает, предыдущая уходит вглубь
  mm.add("(max-width: 760px)", () => {
    const cards = $$(".tcard");
    cards.forEach((c) => c.removeAttribute("data-reveal"));
    cards.forEach((c, i) => {
      const next = cards[i + 1];
      if (!next) return;
      G.fromTo(c, { scale: 1, "--dim": 0 }, { scale: 0.9, "--dim": 0.5, ease: "none", scrollTrigger: { trigger: next, start: "top 94%", end: () => "top " + (parseFloat(getComputedStyle(next).top) || 90) + "px", scrub: true, invalidateOnRefresh: true } });
    });
  });

  // высота пробега сканирующей линии = высота кадра
  const scanFig = $(".diag__scan");
  if (scanFig && "ResizeObserver" in window) new ResizeObserver(() => scanFig.style.setProperty("--scan-h", scanFig.clientHeight + "px")).observe(scanFig);

  // заголовки разделов
  $$("[data-split]").forEach((el) => {
    if (el.closest(".hero")) return;
    G.from($$(".sw > span", el), { yPercent: 115, duration: 1.1, stagger: 0.035, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });

  // появление блоков по порядку; уже проскоченное показываем сразу
  const revealed = (el) => { el.removeAttribute("data-reveal"); G.set(el, { clearProps: "opacity,transform" }); };
  ST.batch("[data-reveal]", {
    start: "top 92%",
    once: true,
    interval: 0.1,
    onEnter: (els) => {
      const live = els.filter((el) => el.getBoundingClientRect().bottom > 0);
      els.filter((el) => !live.includes(el)).forEach(revealed);
      if (live.length) G.to(live, { opacity: 1, y: 0, duration: 0.95, stagger: Math.min(0.08, 0.36 / live.length), overwrite: true, onComplete: () => live.forEach(revealed) });
    },
  });

  // картинки раскрываются шторкой
  $$("[data-clip]").forEach((el) => {
    const img = $("img", el);
    const st = { trigger: el, start: "top 90%", once: true };
    G.to(el, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "power3.inOut", scrollTrigger: st, onComplete: () => { el.removeAttribute("data-clip"); G.set(el, { clearProps: "clipPath" }); } });
    if (img) G.from(img, { scale: 1.16, duration: 1.8, ease: "power2.out", scrollTrigger: st });
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
  const orthoImg = $(".ortho__frame img");
  if (orthoImg) G.to(orthoImg, { y: -10, duration: 3.4, ease: "sine.inOut", yoyo: true, repeat: -1 });


  // фото команды: кадр раскрывается шторкой от центра, снимок отъезжает, карточка поднимается
  const teamPhoto = $(".faq__photo");
  if (teamPhoto) {
    const zone = { trigger: teamPhoto, start: "top 92%", end: "top 30%", scrub: true };
    G.fromTo(teamPhoto, { clipPath: "inset(0% 16% 0% 16%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: zone });
    const tImg = $("img", teamPhoto);
    if (tImg) G.fromTo(tImg, { scale: 1.24 }, { scale: 1, ease: "none", scrollTrigger: { ...zone, end: "bottom 35%" } });
    const sc = $(".smile-card");
    if (sc) {
      sc.removeAttribute("data-reveal");
      G.fromTo(sc, { y: 70, opacity: 0 }, { y: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: teamPhoto, start: "top 70%", end: "bottom 60%", scrub: true } });
    }
  }

  // 08 · клиника: кадр раскрывается из окна на весь экран
  const tour = $(".tour__pin");
  if (tour) {
    const frame = $(".tour__frame", tour), img = $("img", tour);
    mm.add({ wide: "(min-width: 761px)", narrow: "(max-width: 760px)" }, (ctx) => {
      const from = ctx.conditions.wide ? "inset(14% 22% 14% 22%)" : "inset(18% 8% 18% 8%)";
      G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: tour, start: "top top", end: "+=100%", pin: true, anticipatePin: 1, scrub: true } })
        .fromTo(frame, { clipPath: from }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, 0)
        .fromTo(img, { scale: 1.24 }, { scale: 1, duration: 1 }, 0)
        .to({}, { duration: 0.2 });
    });
  }

  // лента фото едет вслед за прокруткой
  mm.add("(min-width: 761px)", () => {
    $$("[data-drift]").forEach((row) => {
      const dir = parseFloat(row.dataset.drift) || -1;
      const dist = () => Math.max(0, row.scrollWidth - row.parentElement.clientWidth);
      G.fromTo(row, { x: () => (dir < 0 ? 0 : -dist()) }, { x: () => (dir < 0 ? -dist() : 0), ease: "none", scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
    });
  });

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

  // пересчёт позиций, когда догрузились шрифты и картинки
  const refresh = () => ST.refresh();
  document.fonts?.ready.then(refresh);
  addEventListener("load", () => {
    refresh();
    if (hashTarget) requestAnimationFrame(() => scrollToEl(hashTarget, true));
  }, { once: true });
  let rt = 0;
  $$(".diag__track img, .tour img, .photorail img, .tcards img").forEach((im) => {
    if (!im.complete) im.addEventListener("load", () => { clearTimeout(rt); rt = setTimeout(refresh, 200); }, { once: true });
  });

  // включили версию для слабовидящих: останавливаем всё движение и возвращаем обычную вёрстку
  new MutationObserver(() => {
    if (!isA11y() || !root.classList.contains("js-anim")) return;
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
