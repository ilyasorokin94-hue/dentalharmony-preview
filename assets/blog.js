(function () {
  "use strict";
  if (window.__dhBlogInitialized || !document.querySelector(".blog-page")) return;
  window.__dhBlogInitialized = true;

  const filters = document.querySelector(".blog-filters");
  const listing = document.querySelector("[data-blog-listing]");
  if (filters && listing) {
    const cards = [...listing.querySelectorAll("[data-blog-category]")];
    filters.hidden = false;
    filters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-blog-filter]");
      if (!button || !filters.contains(button)) return;
      const category = button.dataset.blogFilter;
      filters.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      cards.forEach((card) => { card.hidden = Boolean(category && card.dataset.blogCategory !== category); });
      document.querySelector("[data-blog-filter-status]").textContent = `Статей: ${cards.filter((card) => !card.hidden).length}`;
    });
  }

  const article = document.querySelector("[data-blog-article]");
  if (!article) return; // The catalogue never sends article analytics.
  const start = article.querySelector("[data-blog-reading-start]");
  const finish = article.querySelector("[data-blog-reading-finish]");
  const readingMinutes = Number(article.dataset.blogReadingMinutes) || 1;
  const minimumActiveMs = Math.min(60, Math.max(15, readingMinutes * 15)) * 1000;
  const sent = new Set();
  let loaded = document.readyState === "complete";
  let activeMs = 0;
  let lastTick = performance.now();
  let wasVisible = !document.hidden;
  let maximumProgress = 0;
  let framePending = false;
  let timer = 0;

  const canTrack = () => {
    try {
      return localStorage.getItem("dh-cookie-consent") === "accepted" && typeof window.dhTrackMetrikaGoal === "function";
    } catch (_) { return false; }
  };
  const emitOnce = (goal, source = "article", target = "") => {
    const key = `${goal}|${source}|${target}`;
    if (sent.has(key) || !canTrack()) return false;
    sent.add(key);
    // Reuse consent, sanitization and the existing counter; never modify dataLayer or ym.
    window.dhTrackMetrikaGoal(goal, {
      article: article.dataset.blogArticle,
      category: article.dataset.blogArticleCategory,
      page: location.pathname,
      reading_minutes: readingMinutes,
      source,
      target,
    });
    return true;
  };
  const updateClock = () => {
    const now = performance.now();
    if (wasVisible) activeMs += now - lastTick;
    lastTick = now;
    wasVisible = !document.hidden;
  };
  const evaluateReading = () => {
    updateClock();
    if (!loaded || document.hidden) return;
    emitOnce("blog_article_view");
    const from = start.getBoundingClientRect().top + scrollY;
    const to = finish.getBoundingClientRect().top + scrollY;
    const progress = Math.max(0, Math.min(1, (scrollY + innerHeight - from) / Math.max(1, to - from)));
    maximumProgress = Math.max(maximumProgress, progress);
    if (maximumProgress >= .5) emitOnce("blog_scroll_50");
    if (maximumProgress >= .9 && activeMs >= minimumActiveMs && emitOnce("blog_read_complete")) {
      clearInterval(timer);
    }
  };
  const scheduleReading = () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => { framePending = false; evaluateReading(); });
  };
  window.addEventListener("scroll", scheduleReading, { passive: true });
  window.addEventListener("resize", scheduleReading, { passive: true });
  document.addEventListener("visibilitychange", evaluateReading);
  window.addEventListener("dh-cookie-consent-accepted", evaluateReading);
  if (!loaded) window.addEventListener("load", () => { loaded = true; evaluateReading(); }, { once: true });
  timer = window.setInterval(evaluateReading, 1000);
  evaluateReading();

  // The existing modal stops click propagation during document capture.
  // Its public site-action event is the reliable shared hook for booking conversions.
  const bookingSources = new Map([...article.querySelectorAll('[data-blog-event="blog_book_click"]')]
    .map((button) => [button.dataset.bookingSource, button.dataset.blogSource]));
  window.addEventListener("site-action", (event) => {
    const detail = event.detail || {};
    if (detail.eventName === "click_booking_cta" && bookingSources.has(detail.source)) {
      emitOnce("blog_book_click", bookingSources.get(detail.source), "booking");
    }
  });

  article.addEventListener("click", (event) => {
    const element = event.target.closest("a, button");
    if (!element || !article.contains(element)) return;
    let goal = element.dataset.blogEvent;
    let source = element.dataset.blogSource || "article-text";
    const url = element.hasAttribute("href") ? new URL(element.getAttribute("href"), location.href) : null;
    // Links declare their event explicitly. This covers any service or related
    // article without inferring intent from a particular URL.
    if (goal && goal !== "blog_book_click") emitOnce(goal, source, url ? url.pathname : "booking");
  }, { capture: true });
})();
