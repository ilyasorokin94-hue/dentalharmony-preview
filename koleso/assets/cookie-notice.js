(function () {
  const STORAGE_KEY = "dh-cookie-consent";
  const ACCEPTED_VALUE = "accepted";
  const DECLINED_VALUE = "declined";
  const RESET_PARAM = "reset-cookie-consent";
  const visibleClass = "is-visible";
  const pageVisibleClass = "has-cookie-notice";
  const noticeOffsetProperty = "--cookie-notice-offset";
  const notice = document.querySelector("[data-cookie-notice]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!notice) {
    return;
  }

  notice.setAttribute("role", notice.getAttribute("role") || "region");
  notice.setAttribute("aria-label", notice.getAttribute("aria-label") || "Уведомление о cookie");

  function hasDecided() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === ACCEPTED_VALUE || value === DECLINED_VALUE;
    } catch (error) {
      return false;
    }
  }

  function saveDecision(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      // The banner still closes for the current page if storage is unavailable.
    }
  }

  function updateNoticeOffset() {
    if (notice.hidden || !notice.classList.contains(visibleClass)) {
      document.documentElement.classList.remove(pageVisibleClass);
      document.documentElement.style.removeProperty(noticeOffsetProperty);
      return;
    }

    const offset = Math.ceil(notice.getBoundingClientRect().height + 18);
    document.documentElement.classList.add(pageVisibleClass);
    document.documentElement.style.setProperty(noticeOffsetProperty, `${offset}px`);
  }

  function resetConsentForManualCheck() {
    const url = new URL(window.location.href);

    if (!url.searchParams.has(RESET_PARAM)) {
      return;
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Storage can be unavailable; the banner should still be shown for this page.
    }

    url.searchParams.delete(RESET_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function showNotice() {
    notice.hidden = false;
    requestAnimationFrame(() => {
      notice.classList.add(visibleClass);
      updateNoticeOffset();
    });
  }

  function hideNotice() {
    notice.classList.remove(visibleClass);
    updateNoticeOffset();
    window.setTimeout(() => {
      notice.hidden = true;
      updateNoticeOffset();
    }, reduceMotion.matches ? 0 : 360);
  }

  resetConsentForManualCheck();

  if (hasDecided()) {
    notice.hidden = true;
    return;
  }

  showNotice();

  function onDecision(event, value) {
    const shouldRestoreFocus = document.activeElement === event.currentTarget;
    const focusTarget =
      document.querySelector("#main-content") ||
      document.querySelector(".site-header__brand") ||
      document.body;

    saveDecision(value);
    if (value === ACCEPTED_VALUE) {
      window.dispatchEvent(new CustomEvent("dh-cookie-consent-accepted"));
    }
    hideNotice();

    if (shouldRestoreFocus && focusTarget instanceof HTMLElement) {
      window.setTimeout(() => {
        focusTarget.focus({ preventScroll: true });
      }, reduceMotion.matches ? 0 : 380);
    }
  }

  notice.querySelector("[data-cookie-accept]")?.addEventListener("click", (event) => onDecision(event, ACCEPTED_VALUE));
  notice.querySelector("[data-cookie-decline]")?.addEventListener("click", (event) => onDecision(event, DECLINED_VALUE));

  window.addEventListener("resize", updateNoticeOffset, { passive: true });
})();
