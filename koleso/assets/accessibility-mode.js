(function () {
  const STORAGE_KEY = "dh-accessibility-mode";
  const MODE_CLASS = "is-accessibility-mode";
  const enabledText = "Обычная версия";
  const disabledText = "Версия для слабовидящих";
  const enabledLabel = "Отключить версию для слабовидящих";
  const disabledLabel = "Включить версию для слабовидящих";
  const root = document.documentElement;

  function saveMode(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch (error) {
      // localStorage can be unavailable in private or restricted browser modes.
    }
  }

  function updateButtons(enabled) {
    document.querySelectorAll("[data-accessibility-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
      button.setAttribute("aria-label", enabled ? enabledLabel : disabledLabel);
      button.textContent = enabled ? enabledText : disabledText;
    });
  }

  function setMode(enabled, persist) {
    root.classList.toggle(MODE_CLASS, enabled);

    if (persist) {
      saveMode(enabled);
    }

    updateButtons(enabled);
  }

  function init() {
    let storedMode = null;

    try {
      storedMode = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      storedMode = null;
    }

    if (storedMode === "on") {
      root.classList.add(MODE_CLASS);
    } else if (storedMode === "off") {
      root.classList.remove(MODE_CLASS);
    }

    updateButtons(root.classList.contains(MODE_CLASS));
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-accessibility-toggle]");

    if (!button) {
      return;
    }

    event.preventDefault();
    setMode(!root.classList.contains(MODE_CLASS), true);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
