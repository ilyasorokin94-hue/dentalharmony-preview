(function () {
  "use strict";

  // Быстрая запись «Зубная Гармония» — один экран вместо многошагового помощника.
  // Стили — в отдельном файле dh-quick.css (новое имя, чтобы не смешиваться с кэшем старой версии).
  if (window.__DH_ASSISTANT_LOADED__) {
    return;
  }
  window.__DH_ASSISTANT_LOADED__ = true;

  const VERSION = "2026.10.03-quick";
  const CSS_URL = "assets/dh-quick.css?v=20261003-quick1";
  const PHONE_HREF = "tel:+79168629494";
  const PHONE_LABEL = "+7 (916) 862-94-94";
  const LOGO_URL = "_astro/logo-mark.Cj3kxIPp.svg";
  const INVITE_SESSION_KEY = "dhq-invite-shown-v1";
  const INVITE_DISMISS_KEY = "dhq-invite-dismissed-until-v1";
  const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
  const MOBILE_QUERY = "(max-width: 760px)";

  const HIDDEN_PATHS = [
    /^\/thanks\/?$/,
    /^\/privacy\/?$/,
    /^\/personal-data-consent\/?$/,
    /^\/user-agreement\/?$/,
    /^\/legal\/?$/,
    /^\/documents(?:\/|$)/,
    /^\/404(?:\.html)?\/?$/,
  ];

  const currentPath = window.location.pathname || "/";
  if (HIDDEN_PATHS.some((pattern) => pattern.test(currentPath))) {
    return;
  }

  // Направления — необязательный выбор одним нажатием, уходит в заявку как метка источника.
  const INTENTS = {
    caries: { label: "Лечение зубов", invite: "Записаться на лечение зубов?" },
    implant: { label: "Имплантация", invite: "Записаться на консультацию по имплантации?" },
    prosthetics: { label: "Коронки и протезы", invite: "Записаться на консультацию по протезированию?" },
    orthodontics: { label: "Брекеты и элайнеры", invite: "Записаться на консультацию ортодонта?" },
    hygiene: { label: "Чистка зубов", invite: "Записаться на профессиональную чистку?" },
    children: { label: "Детский приём", invite: "Записать ребёнка к стоматологу?" },
    surgeon: { label: "Удаление зуба", invite: "Записаться к хирургу?" },
    aesthetic: { label: "Отбеливание, виниры", invite: "Записаться на консультацию по эстетике?" },
  };
  const BASE_CHIPS = ["caries", "implant", "prosthetics", "orthodontics", "hygiene", "children"];

  const pageIntent = (() => {
    const path = currentPath.toLowerCase();
    if (path.includes("/lechenie-zubov")) return "caries";
    if (path.includes("/implantatsiya")) return "implant";
    if (path.includes("/protezirovanie")) return "prosthetics";
    if (path.includes("/ortodontiya")) return "orthodontics";
    if (path.includes("/professionalnaya-gigiena")) return "hygiene";
    if (path.includes("/detskaya-stomatologiya")) return "children";
    if (path.includes("/hirurgiya")) return "surgeon";
    if (path.includes("/esteticheskaya-stomatologiya")) return "aesthetic";
    return "";
  })();

  const chipIds = pageIntent && !BASE_CHIPS.includes(pageIntent) ? [pageIntent].concat(BASE_CHIPS) : BASE_CHIPS.slice();

  const state = {
    intent: pageIntent,
    urgent: false,
    openedFrom: "launcher",
    inputTracked: false,
    lastFocused: null,
  };

  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const storageGet = (storage, key) => {
    try {
      return storage.getItem(key);
    } catch (error) {
      return null;
    }
  };

  const storageSet = (storage, key, value) => {
    try {
      storage.setItem(key, value);
    } catch (error) {
      // Хранилище недоступно (приватный режим) — просто не запоминаем.
    }
  };

  const moscowHour = () => {
    try {
      const parts = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", hour12: false }).formatToParts(new Date());
      return Number(parts.find((part) => part.type === "hour").value) % 24;
    } catch (error) {
      return new Date().getHours();
    }
  };

  const statusText = () => {
    const hour = moscowHour();
    if (hour >= 9 && hour < 21) {
      return { open: true, text: "Работаем сегодня до 21:00" };
    }
    return { open: false, text: hour < 9 ? "Перезвоним сегодня после 9:00" : "Перезвоним завтра после 9:00" };
  };

  const track = (goal, params) => {
    if (typeof window.dhTrackMetrikaGoal !== "function") {
      return;
    }
    window.dhTrackMetrikaGoal(goal, Object.assign({ page: currentPath, assistant_version: VERSION }, params || {}));
  };

  const buildSource = () => {
    if (state.urgent) return "assistant-urgent";
    if (state.intent && INTENTS[state.intent]) return `assistant-${state.intent}`;
    return "assistant";
  };

  const status = statusText();
  const inviteTitle = pageIntent ? INTENTS[pageIntent].invite : "Записаться на приём?";

  const chipsHtml = chipIds.map((id) => `
        <button class="dhq__chip" type="button" data-dhq-intent="${escapeHtml(id)}" aria-pressed="${id === state.intent ? "true" : "false"}">${escapeHtml(INTENTS[id].label)}</button>`).join("")
    + `
        <button class="dhq__chip dhq__chip--urgent" type="button" data-dhq-intent="urgent" aria-pressed="false">Болит — срочно</button>`;

  const root = document.createElement("div");
  root.className = "dhq";
  root.hidden = true;
  root.dataset.version = VERSION;
  root.innerHTML = `
    <div class="dhq__backdrop" data-dhq-action="close" aria-hidden="true"></div>
    <div class="dhq__invite" data-dhq-invite aria-hidden="true">
      <button class="dhq__invite-main" type="button" data-dhq-action="open-invite">
        <strong>${escapeHtml(inviteTitle)}</strong>
        <span>Оставьте телефон — администратор перезвонит и подберёт время.</span>
      </button>
      <button class="dhq__invite-close" type="button" data-dhq-action="dismiss-invite" aria-label="Скрыть приглашение">×</button>
    </div>
    <section class="dhq__panel" id="dhq-panel" role="dialog" aria-labelledby="dhq-title" aria-hidden="true" inert>
      <header class="dhq__header">
        <span class="dhq__mark" aria-hidden="true"><img src="${LOGO_URL}" alt="" width="27" height="33"></span>
        <span class="dhq__header-copy">
          <strong>Зубная Гармония</strong>
          <span class="dhq__hours${status.open ? " is-open" : ""}">${escapeHtml(status.text)}</span>
        </span>
        <button class="dhq__close" type="button" data-dhq-action="close" aria-label="Закрыть">×</button>
      </header>
      <div class="dhq__body">
        <h2 class="dhq__title" id="dhq-title">Запишитесь на приём</h2>
        <p class="dhq__lead">Оставьте имя и телефон — администратор перезвонит, ответит на вопросы и подберёт удобное время.</p>

        <form class="dhq__form" name="booking-request" action="/api/lead.php" method="post" data-booking-inline-form novalidate autocomplete="off" data-lpignore="true" data-form-type="other">
          <input type="hidden" name="source" value="${escapeHtml(buildSource())}" data-dhq-source>
          <input type="hidden" name="form_started_at" value="" data-booking-started-at>
          <div class="booking-antispam" aria-hidden="true">
            <label>Компания <input type="text" name="booking_company_field" tabindex="-1" autocomplete="off" data-booking-honeypot></label>
          </div>

          <fieldset class="dhq__chips-wrap">
            <legend class="dhq__label">Что беспокоит? <span>— можно не выбирать</span></legend>
            <div class="dhq__chips">${chipsHtml}
            </div>
          </fieldset>

          <div class="dhq__urgent" data-dhq-urgent hidden>
            <p><strong>При сильной боли или отёке лучше позвонить</strong> — постараемся принять как можно скорее.</p>
            <a class="dhq__urgent-call" href="${PHONE_HREF}" data-action="call">Позвонить ${PHONE_LABEL}</a>
            <small>Если состояние резко ухудшается, затруднено дыхание или глотание — звоните 112.</small>
          </div>

          <label class="dhq__field">
            <span class="dhq__label">Имя</span>
            <input type="text" name="booking_client_field" minlength="2" maxlength="80" placeholder="Как к вам обращаться" required data-booking-field="name" autocomplete="new-password" autocapitalize="words" spellcheck="false" aria-describedby="dhq-error-name" data-lpignore="true" data-form-type="other">
            <small class="dhq__error" id="dhq-error-name" data-inline-error-for="name" aria-live="polite"></small>
          </label>
          <label class="dhq__field">
            <span class="dhq__label">Телефон</span>
            <input type="tel" name="booking_contact_field" maxlength="18" placeholder="7 (___) ___-__-__" inputmode="tel" required data-booking-field="phone" autocomplete="new-password" spellcheck="false" aria-describedby="dhq-error-phone" data-lpignore="true" data-form-type="other">
            <small class="dhq__error" id="dhq-error-phone" data-inline-error-for="phone" aria-live="polite"></small>
          </label>

          <label class="dhq__consent">
            <input type="checkbox" name="privacyConsent" required data-booking-field="consent" aria-describedby="dhq-error-consent">
            <span>Даю <a href="/personal-data-consent/" target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</a> и ознакомлен(а) с <a href="/privacy/" target="_blank" rel="noopener noreferrer">политикой конфиденциальности</a>.</span>
          </label>
          <small class="dhq__error" id="dhq-error-consent" data-inline-error-for="consent" aria-live="polite"></small>

          <button class="dhq__submit" type="submit"><span data-dhq-submit-label>Записаться</span><span aria-hidden="true">→</span></button>
          <p class="dhq__status" data-inline-booking-status role="status" aria-live="polite"></p>
        </form>

        <div class="dhq__divider">или</div>
        <a class="dhq__phone" href="${PHONE_HREF}" data-action="call">Позвонить ${PHONE_LABEL}</a>
        <p class="dhq__note">Ежедневно 9:00–21:00 · Балашиха, ул. Реутовская, 14</p>
      </div>
    </section>
    <button class="dhq__launcher" type="button" data-dhq-action="open" aria-expanded="false" aria-controls="dhq-panel">
      <span class="dhq__launcher-mark" aria-hidden="true"><img src="${LOGO_URL}" alt="" width="26" height="31"></span>
      <span class="dhq__launcher-copy"><strong>Записаться</strong><small>перезвоним и подберём время</small></span>
    </button>
  `;

  const panel = root.querySelector(".dhq__panel");
  const launcher = root.querySelector(".dhq__launcher");
  const invite = root.querySelector("[data-dhq-invite]");
  const sourceInput = root.querySelector("[data-dhq-source]");
  const urgentBox = root.querySelector("[data-dhq-urgent]");
  const submitLabel = root.querySelector("[data-dhq-submit-label]");
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

  const syncChoice = () => {
    root.querySelectorAll("[data-dhq-intent]").forEach((chip) => {
      const id = chip.getAttribute("data-dhq-intent");
      const pressed = id === "urgent" ? state.urgent : !state.urgent && id === state.intent;
      chip.setAttribute("aria-pressed", pressed ? "true" : "false");
    });
    urgentBox.hidden = !state.urgent;
    root.classList.toggle("is-urgent", state.urgent);
    submitLabel.textContent = state.urgent ? "Жду срочного звонка" : "Записаться";
    sourceInput.value = buildSource();
  };

  const openPanel = (from) => {
    if (root.classList.contains("is-suppressed")) {
      return;
    }
    state.openedFrom = from || "launcher";
    state.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.classList.add("is-open");
    hideInvite();
    panel.removeAttribute("inert");
    panel.setAttribute("aria-hidden", "false");
    panel.setAttribute("aria-modal", isMobile() ? "true" : "false");
    launcher.setAttribute("aria-expanded", "true");
    storageSet(window.sessionStorage, INVITE_SESSION_KEY, "1");
    if (isMobile()) {
      document.documentElement.classList.add("dhq-lock");
    }
    window.requestAnimationFrame(() => {
      const target = panel.querySelector('input[name="booking_client_field"]');
      if (target instanceof HTMLElement && !isMobile()) {
        target.focus({ preventScroll: true });
      } else {
        const close = panel.querySelector(".dhq__close");
        if (close instanceof HTMLElement) close.focus({ preventScroll: true });
      }
    });
    track("assistant_open", { intent: state.intent || "none", opened_from: state.openedFrom });
  };

  const closePanel = (restoreFocus) => {
    root.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("inert", "");
    launcher.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("dhq-lock");
    if (restoreFocus !== false && state.lastFocused && state.lastFocused.isConnected) {
      state.lastFocused.focus({ preventScroll: true });
    }
  };

  const hideInvite = () => {
    invite.classList.remove("is-visible");
    invite.setAttribute("aria-hidden", "true");
  };

  const cookieNoticeVisible = () => {
    const cookie = document.querySelector("[data-cookie-notice]");
    return cookie instanceof HTMLElement && !cookie.hidden;
  };

  const showInvite = () => {
    if (
      root.classList.contains("is-open") ||
      root.classList.contains("is-suppressed") ||
      cookieNoticeVisible() ||
      storageGet(window.sessionStorage, INVITE_SESSION_KEY) === "1"
    ) {
      return;
    }
    const dismissedUntil = Number(storageGet(window.localStorage, INVITE_DISMISS_KEY) || 0);
    if (dismissedUntil > Date.now()) {
      return;
    }
    storageSet(window.sessionStorage, INVITE_SESSION_KEY, "1");
    invite.classList.add("is-visible");
    invite.setAttribute("aria-hidden", "false");
    track("assistant_show", { context: pageIntent || "general" });
  };

  // Пока открыто собственное окно записи сайта — помощник не мешает.
  const updateSuppression = () => {
    const blocked = document.querySelector("[data-booking-modal].is-open") !== null;
    root.classList.toggle("is-suppressed", blocked);
    if (blocked && root.classList.contains("is-open")) {
      closePanel(false);
    }
  };

  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const chip = target.closest("[data-dhq-intent]");
    if (chip) {
      const id = chip.getAttribute("data-dhq-intent");
      if (id === "urgent") {
        state.urgent = !state.urgent;
      } else {
        const wasSelected = !state.urgent && state.intent === id;
        state.urgent = false;
        state.intent = wasSelected ? "" : id;
      }
      syncChoice();
      track("assistant_intent", { intent: state.urgent ? "urgent" : state.intent || "none" });
      return;
    }

    const control = target.closest("[data-dhq-action]");
    if (!control) return;
    const action = control.getAttribute("data-dhq-action");
    if (action === "open") openPanel("launcher");
    else if (action === "open-invite") openPanel("invite");
    else if (action === "close") closePanel(true);
    else if (action === "dismiss-invite") {
      hideInvite();
      storageSet(window.localStorage, INVITE_DISMISS_KEY, String(Date.now() + DISMISS_MS));
    }
  });

  root.addEventListener("focusin", (event) => {
    if (state.inputTracked || !(event.target instanceof HTMLInputElement) || event.target.type === "hidden") {
      return;
    }
    if (event.target.closest(".dhq__form")) {
      state.inputTracked = true;
      track("assistant_contact_input", { intent: state.urgent ? "urgent" : state.intent || "none" });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!root.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel(true);
      return;
    }
    if (event.key !== "Tab" || !isMobile()) return;
    const focusable = [...panel.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), [tabindex]:not([tabindex='-1'])")]
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null && !element.closest(".booking-antispam"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Нажали кнопку записи сайта — закрываем панель, чтобы не было двух форм сразу.
  document.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-action="booking"]') : null;
    if (trigger && !trigger.closest(".dhq")) {
      closePanel(false);
    }
  }, true);

  const observe = (element, attributeFilter) => {
    if (element instanceof HTMLElement) {
      new MutationObserver(updateSuppression).observe(element, { attributes: true, attributeFilter });
    }
  };

  const start = () => {
    document.body.appendChild(root);
    syncChoice();
    observe(document.querySelector("[data-booking-modal]"), ["class", "aria-hidden"]);
    updateSuppression();
    root.hidden = false;
    window.setTimeout(() => root.classList.add("is-ready"), 600);

    // Приглашение: после короткой паузы и прокрутки, один раз за визит, не поверх плашки cookie.
    const servicePage = Boolean(pageIntent);
    const delay = isMobile() ? (servicePage ? 12000 : 16000) : (servicePage ? 9000 : 12000);
    const threshold = isMobile() ? 0.3 : 0.2;
    let timeReady = false;
    let scrollReady = false;

    const scrollProgress = () => {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return max < 240 ? 1 : Math.min(1, Math.max(0, window.scrollY / max));
    };
    const contactsVisible = () => {
      if (window.location.hash === "#contacts") return true;
      const contacts = document.querySelector("#contacts");
      if (!(contacts instanceof HTMLElement)) return false;
      const rect = contacts.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.72 && rect.bottom > 0;
    };
    const tryInvite = () => {
      if (timeReady && scrollReady && !contactsVisible()) showInvite();
    };
    const onScroll = () => {
      if (scrollProgress() >= threshold) {
        scrollReady = true;
        tryInvite();
        if (storageGet(window.sessionStorage, INVITE_SESSION_KEY) === "1") {
          window.removeEventListener("scroll", onScroll);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    window.setTimeout(() => {
      timeReady = true;
      if (scrollProgress() >= threshold) scrollReady = true;
      tryInvite();
    }, delay);
  };

  // Показываем виджет только после загрузки его стилей (без «голой» вёрстки).
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_URL;
  let started = false;
  const startOnce = () => {
    if (started) return;
    started = true;
    start();
  };
  link.addEventListener("load", startOnce);
  link.addEventListener("error", () => {
    // Без стилей виджет не показываем — на странице остаются обычные формы записи.
    started = true;
  });
  document.head.appendChild(link);
  window.setTimeout(() => {
    if (!started && link.sheet) startOnce();
  }, 4000);
})();
