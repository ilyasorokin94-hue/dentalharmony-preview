(() => {
    const header = document.querySelector(".site-header");
    const toggle = header?.querySelector("[data-mobile-menu-toggle]");
    const panel = header?.querySelector("[data-mobile-menu]");
    const mobileHeaderQuery = window.matchMedia("(max-width: 760px)");
    const hiddenClass = "site-header--hidden";
    const scrolledClass = "site-header--scrolled";
    const revealTopOffset = 88;
    const directionThreshold = 10;
    const scrolledOffset = 28;
    const mobileScrolledOffset = 12;
    let lastScrollY = Math.max(window.scrollY || document.documentElement.scrollTop || 0, 0);
    let scrollAnchorY = lastScrollY;
    let ticking = false;

    if (!header || !toggle || !panel) {
      return;
    }

    const setActiveNavigation = () => {
      const path = window.location.pathname;
      let activeHref = "";

      if (path.startsWith("/services/")) {
        activeHref = "/services/";
      } else if (path.startsWith("/doctors/") || path.startsWith("/doctor/")) {
        activeHref = "/#doctors";
      } else if (path.startsWith("/prices/")) {
        activeHref = "/prices/";
      }

      if (!activeHref) {
        return;
      }

      header.querySelectorAll(".site-header__nav a, [data-mobile-menu] a").forEach((link) => {
        if (!(link instanceof HTMLAnchorElement)) {
          return;
        }

        const isActive = link.getAttribute("href") === activeHref;
        link.classList.toggle("is-active", isActive);

        if (isActive) {
          link.setAttribute("aria-current", "page");
        } else if (link.getAttribute("aria-current") === "page") {
          link.removeAttribute("aria-current");
        }
      });
    };

    const setOpen = (isOpen, options = {}) => {
      const wasOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e" : "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e");
      panel.hidden = !isOpen;
      header.classList.toggle("is-mobile-menu-open", isOpen);

      if (isOpen) {
        header.classList.remove(hiddenClass);
      } else if (wasOpen && options.restoreFocus) {
        toggle.focus({ preventScroll: true });
      }
    };

    const getScrollY = () =>
      Math.max(window.scrollY || document.documentElement.scrollTop || document.body?.scrollTop || 0, 0);

    const syncHeaderHeight = () => {
      const inner = header.querySelector(".site-header__inner");
      const height = Math.ceil((inner || header).getBoundingClientRect().height);

      document.documentElement.style.setProperty("--site-header-height", `${height}px`);
    };

    const updateScrolledState = (scrollY = getScrollY()) => {
      const offset = mobileHeaderQuery.matches ? mobileScrolledOffset : scrolledOffset;
      header.classList.toggle(scrolledClass, scrollY > offset);
    };

    const updateSmartHeader = () => {
      const currentY = getScrollY();
      const delta = currentY - scrollAnchorY;
      const isMenuOpen = toggle.getAttribute("aria-expanded") === "true" || !panel.hidden;
      const isModalOpen = document.querySelector("[data-booking-modal].is-open") !== null;

      updateScrolledState(currentY);

      if (!mobileHeaderQuery.matches || isMenuOpen || isModalOpen || currentY < revealTopOffset) {
        header.classList.remove(hiddenClass);
        scrollAnchorY = currentY;
      } else if (delta > directionThreshold) {
        header.classList.add(hiddenClass);
        scrollAnchorY = currentY;
      } else if (delta < -directionThreshold) {
        header.classList.remove(hiddenClass);
        scrollAnchorY = currentY;
      }

      lastScrollY = currentY;
      ticking = false;
    };

    const scheduleSmartHeaderUpdate = () => {
      if (!mobileHeaderQuery.matches) {
        header.classList.remove(hiddenClass);
        lastScrollY = getScrollY();
        updateScrolledState(lastScrollY);
        scrollAnchorY = lastScrollY;
        return;
      }

      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateSmartHeader);
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    panel.querySelectorAll("a, button").forEach((item) => {
      item.addEventListener("click", () => {
        if (item instanceof HTMLAnchorElement) {
          window.setTimeout(() => setOpen(false), 0);
          return;
        }

        setOpen(false);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        setOpen(false, { restoreFocus: true });
      }
    });

    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) {
        setOpen(false);
      }
    });

    window.addEventListener("scroll", scheduleSmartHeaderUpdate, { passive: true });

    const handleMobileHeaderQueryChange = () => {
      header.classList.remove(hiddenClass);
      syncHeaderHeight();
      lastScrollY = getScrollY();
      updateScrolledState(lastScrollY);
      scrollAnchorY = lastScrollY;
      ticking = false;
    };

    if (typeof mobileHeaderQuery.addEventListener === "function") {
      mobileHeaderQuery.addEventListener("change", handleMobileHeaderQueryChange);
    } else if (typeof mobileHeaderQuery.addListener === "function") {
      mobileHeaderQuery.addListener(handleMobileHeaderQueryChange);
    }

    window.addEventListener("resize", handleMobileHeaderQueryChange);

    setActiveNavigation();
    syncHeaderHeight();
    updateScrolledState(lastScrollY);
  })();

(() => {
    const floatingHeader = document.querySelector("[data-home-floating-header]");
    const desktopQuery = window.matchMedia("(min-width: 761px)");
    const visibleClass = "is-visible";
    const revealOffset = 140;
    let ticking = false;

    if (!floatingHeader) {
      return;
    }

    const getScrollY = () =>
      Math.max(window.scrollY || document.documentElement.scrollTop || document.body?.scrollTop || 0, 0);

    const updateFloatingHeader = () => {
      const shouldShow = desktopQuery.matches && getScrollY() >= revealOffset;

      floatingHeader.classList.toggle(visibleClass, shouldShow);
      floatingHeader.setAttribute("aria-hidden", String(!shouldShow));
      floatingHeader.toggleAttribute("inert", !shouldShow);
      ticking = false;
    };

    const scheduleFloatingHeaderUpdate = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateFloatingHeader);
    };

    window.addEventListener("scroll", scheduleFloatingHeaderUpdate, { passive: true });
    window.addEventListener("resize", scheduleFloatingHeaderUpdate);

    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", updateFloatingHeader);
    } else if (typeof desktopQuery.addListener === "function") {
      desktopQuery.addListener(updateFloatingHeader);
    }

    updateFloatingHeader();
  })();

(() => {
    const modal = document.querySelector("[data-booking-modal]");

    if (!modal) {
      return;
    }

    const panel = modal.querySelector(".booking-modal__panel");
    const form = modal.querySelector("[data-booking-form]");
    const closeButtons = modal.querySelectorAll("[data-booking-close]");
    const status = modal.querySelector("[data-booking-status]");
    const firstField = form?.querySelector('[data-booking-field="name"]');
    const startedAtField = form?.querySelector('[data-booking-started-at], input[name="form_started_at"]');
    const honeypotField = form?.querySelector('[data-booking-honeypot], input[name="booking_company_field"]');

    let lastActiveElement = null;
    let savedScrollY = 0;
    let previousBodyStyles = {};
    const isMobileViewport = () => window.matchMedia("(max-width: 768px)").matches;

    const clearHashFromUrl = () => {
      if (!window.location.hash) {
        return;
      }

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    };

    const scrollToYInstant = (top) => {
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;

      root.style.scrollBehavior = "auto";
      window.scrollTo({ left: 0, top, behavior: "auto" });
      root.scrollTop = top;

      if (document.body) {
        document.body.scrollTop = top;
      }

      root.style.scrollBehavior = previousBehavior;
    };

    const closeMobileMenu = () => {
      const header = document.querySelector(".site-header");
      const panel = header?.querySelector("[data-mobile-menu]");
      const toggle = header?.querySelector("[data-mobile-menu-toggle]");

      if (panel instanceof HTMLElement) {
        panel.hidden = true;
      }

      toggle?.setAttribute("aria-expanded", "false");
      header?.classList.remove("is-mobile-menu-open");
      header?.classList.remove("site-header--hidden");
    };

    const trackAction = (eventName, detail = {}) => {
      window.dispatchEvent(new CustomEvent("site-action", { detail: { eventName, ...detail } }));

      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: eventName, ...detail });
      }
    };

    const clearErrors = () => {
      form?.querySelectorAll("[data-error-for]").forEach((error) => {
        error.textContent = "";
      });
      form?.querySelectorAll("[aria-invalid='true']").forEach((field) => {
        field.removeAttribute("aria-invalid");
      });
      if (status) {
        status.textContent = "";
        status.dataset.state = "";
      }
    };

    if (panel instanceof HTMLElement && !panel.hasAttribute("tabindex")) {
      panel.setAttribute("tabindex", "-1");
    }

    const getFocusable = () =>
      [...modal.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")]
        .filter((element) => element instanceof HTMLElement && !element.closest("[hidden]") && element.offsetParent !== null);

    const openModal = (source = "unknown", opener = document.activeElement) => {
      // Production safety: never open the form from the removed preview-only hook.
      if (String(source || "") === "preview-check") {
        return;
      }
      lastActiveElement = opener instanceof HTMLElement ? opener : null;
      savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      clearHashFromUrl();
      previousBodyStyles = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        paddingRight: document.body.style.paddingRight,
      };

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      modal.removeAttribute("inert");
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("is-open");
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : previousBodyStyles.paddingRight;
      clearErrors();

      // DH_METRIKA_SOURCE: keep the exact CTA source in analytics and lead delivery.
      const sourceField = form?.querySelector('input[name="source"]');
      if (sourceField instanceof HTMLInputElement) {
        sourceField.value = String(source || "unknown");
      }

      if (startedAtField instanceof HTMLInputElement) {
        startedAtField.value = String(Date.now());
      }

      if (honeypotField instanceof HTMLInputElement) {
        honeypotField.value = "";
      }

      requestAnimationFrame(() => {
        const focusTarget = isMobileViewport()
          ? closeButtons[0] || getFocusable()[0] || panel
          : firstField || getFocusable()[0] || panel;

        focusTarget?.focus({ preventScroll: true });
      });

      trackAction("click_booking_cta", { source });
    };

    const closeModal = (options = {}) => {
      const {
        restoreFocus = true,
        clearHash = true,
        restoreScroll = true,
      } = options;

      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      modal.setAttribute("inert", "");
      document.body.style.overflow = previousBodyStyles.overflow || "";
      document.body.style.position = previousBodyStyles.position || "";
      document.body.style.top = previousBodyStyles.top || "";
      document.body.style.left = previousBodyStyles.left || "";
      document.body.style.right = previousBodyStyles.right || "";
      document.body.style.width = previousBodyStyles.width || "";
      document.body.style.paddingRight = previousBodyStyles.paddingRight || "";
      clearErrors();

      if (restoreFocus && lastActiveElement?.isConnected && !lastActiveElement.closest("[hidden]")) {
        lastActiveElement.focus({ preventScroll: true });
      }

      if (clearHash) {
        clearHashFromUrl();
      }

      if (restoreScroll) {
        const restoreY = savedScrollY;
        scrollToYInstant(restoreY);
        requestAnimationFrame(() => {
          scrollToYInstant(restoreY);
        });
        setTimeout(() => {
          scrollToYInstant(restoreY);
        }, 80);
      }
    };

    const resetModalForPageEntry = () => {
      const wasOpen =
        modal.classList.contains("is-open") ||
        modal.getAttribute("aria-hidden") !== "true" ||
        document.body.style.position === "fixed";

      if (!wasOpen) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        modal.setAttribute("inert", "");
        return;
      }

      if (!savedScrollY) {
        const lockedTop = Number.parseFloat(document.body.style.top || "0");

        if (Number.isFinite(lockedTop) && lockedTop < 0) {
          savedScrollY = Math.abs(lockedTop);
        }
      }

      closeModal({
        restoreFocus: false,
        clearHash: false,
        restoreScroll: true,
      });
    };

    resetModalForPageEntry();
    window.addEventListener("pageshow", resetModalForPageEntry);
    window.addEventListener("pagehide", () => {
      if (modal.classList.contains("is-open")) {
        closeModal({
          restoreFocus: false,
          clearHash: false,
          restoreScroll: true,
        });
      }
    });

    window.openBookingModal = openModal;

    const openFromTrigger = (event, trigger) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const opener = trigger.closest("[data-mobile-menu]")
        ? document.querySelector("[data-mobile-menu-toggle]")
        : trigger;
      closeMobileMenu();
      openModal(trigger.dataset.bookingSource || trigger.textContent.trim() || "booking_cta", opener);
    };

    document.querySelectorAll('[data-action="booking"]').forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        openFromTrigger(event, trigger);
      }, true);
    });

    document.addEventListener("click", (event) => {
      const trigger = event.target instanceof Element
        ? event.target.closest('[data-action="booking"]')
        : null;

      if (!trigger) {
        return;
      }

      openFromTrigger(event, trigger);
    }, true);

    document.addEventListener("click", (event) => {
      const trigger = event.target instanceof Element
        ? event.target.closest("[data-action]")
        : null;

      if (!trigger || trigger.dataset.action === "booking") {
        return;
      }

      const eventMap = {
        call: "click_phone",
        route: "click_route",
        email: "click_email",
        social_telegram: "click_social_telegram",
        social_vk: "click_social_vk",
        social_max: "click_social_max",
        yandex_maps: "click_yandex_maps",
      };

      const eventName = eventMap[trigger.dataset.action];

      if (eventName) {
        trackAction(eventName, {
          href: trigger.getAttribute("href") || "",
          label: trigger.textContent.trim(),
        });
      }
    });

    closeButtons.forEach((button) => {
      button.addEventListener("click", closeModal);
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!modal.classList.contains("is-open")) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

})();

(() => {
    const detailsItems = document.querySelectorAll("details");

    detailsItems.forEach((details, index) => {
      const summary = details.querySelector("summary");

      if (!(summary instanceof HTMLElement)) {
        return;
      }

      if (!summary.id) {
        summary.id = `faq-summary-${index + 1}`;
      }

      let panel = details.querySelector(":scope > [data-faq-panel]");

      if (!(panel instanceof HTMLElement)) {
        panel = document.createElement("div");
        panel.setAttribute("data-faq-panel", "");
        panel.style.display = "contents";

        while (summary.nextSibling) {
          panel.appendChild(summary.nextSibling);
        }

        details.appendChild(panel);
      }

      if (!panel.id) {
        panel.id = `faq-panel-${index + 1}`;
      }

      summary.setAttribute("role", "button");
      summary.setAttribute("aria-controls", panel.id);
      summary.setAttribute("aria-expanded", String(details.open));
      panel.setAttribute("aria-labelledby", summary.id);

      details.addEventListener("toggle", () => {
        summary.setAttribute("aria-expanded", String(details.open));
      });
    });
  })();

(() => {
    const storageKey = `scroll-position:${window.location.pathname}`;
    const minRestoreY = 50;
    const restoreDelays = [0, 80, 220, 480];
    const root = document.documentElement;
    let saveFrame = 0;

    const getNavigationType = () => {
      const entries = typeof performance.getEntriesByType === "function"
        ? performance.getEntriesByType("navigation")
        : [];
      const navigationType = entries[0]?.type;

      if (navigationType) {
        return navigationType;
      }

      if (performance.navigation?.type === 1) {
        return "reload";
      }

      if (performance.navigation?.type === 2) {
        return "back_forward";
      }

      return "navigate";
    };

    const readSavedY = () => {
      try {
        const rawValue = window.sessionStorage.getItem(storageKey);
        const savedY = Number.parseInt(rawValue || "", 10);

        return Number.isFinite(savedY) ? savedY : 0;
      } catch {
        return 0;
      }
    };

    const getScrollY = () =>
      window.scrollY || root.scrollTop || document.body?.scrollTop || 0;

    const isBookingModalOpen = () =>
      document.querySelector("[data-booking-modal].is-open") !== null;

    const savePosition = () => {
      if (isBookingModalOpen()) {
        return;
      }

      try {
        window.sessionStorage.setItem(storageKey, String(Math.round(getScrollY())));
      } catch {
        // Storage can be unavailable in private browsing modes; scrolling should stay native.
      }
    };

    const scheduleSave = () => {
      if (saveFrame) {
        return;
      }

      saveFrame = window.requestAnimationFrame(() => {
        saveFrame = 0;
        savePosition();
      });
    };

    const maxScrollY = () =>
      Math.max(0, root.scrollHeight - window.innerHeight);

    const scrollToYInstant = (top) => {
      const previousBehavior = root.style.scrollBehavior;
      const targetY = Math.min(Math.max(top, 0), maxScrollY());

      root.style.scrollBehavior = "auto";
      window.scrollTo({ left: 0, top: targetY, behavior: "auto" });
      root.scrollTop = targetY;

      if (document.body) {
        document.body.scrollTop = targetY;
      }

      root.style.scrollBehavior = previousBehavior;
    };

    const savedY = readSavedY();
    const shouldRestore =
      getNavigationType() === "reload" &&
      !window.location.hash &&
      savedY >= minRestoreY;

    const restorePosition = () => {
      if (!shouldRestore) {
        return;
      }

      scrollToYInstant(savedY);
      savePosition();
    };

    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.addEventListener("pagehide", savePosition);
    window.addEventListener("beforeunload", savePosition);

    if (!shouldRestore) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(restorePosition);
    });

    window.addEventListener("load", () => {
      restoreDelays.forEach((delay) => {
        window.setTimeout(restorePosition, delay);
      });
    }, { once: true });

    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) {
        return;
      }

      restorePosition();
    });
  })();
