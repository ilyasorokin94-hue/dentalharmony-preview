(function () {
  const FORM_ENDPOINT = window.DH_FORM_ENDPOINT || "/api/lead.php";
  const THANKS_URL = "/thanks/";
  const ERROR_MESSAGES = {
    name: "Укажите, как к вам обращаться",
    phone: "Введите корректный номер телефона",
    consent: "Подтвердите согласие на обработку персональных данных",
    submit: "Не удалось отправить заявку. Пожалуйста, попробуйте ещё раз или позвоните нам.",
    pending: "Отправляем заявку...",
  };

  const TECHNICAL_FIELD_NAMES = {
    name: "booking_client_field",
    phone: "booking_contact_field",
    honeypot: "booking_company_field",
    startedAt: "form_started_at",
  };

  const getPhoneDigits = (value) => String(value || "").replace(/\D/g, "");

  const normalizeRussianPhone = (value) => {
    const digits = getPhoneDigits(value);

    if (digits.length === 10 && digits.startsWith("9")) {
      return `7${digits}`;
    }

    if (digits.length === 11 && digits.startsWith("8")) {
      return `7${digits.slice(1)}`;
    }

    if (digits.length === 11 && digits.startsWith("7")) {
      return digits;
    }

    return "";
  };

  const formatRussianPhone = (value) => {
    let digits = getPhoneDigits(value);

    if (!digits) {
      return "";
    }

    if (digits.startsWith("8")) {
      digits = `7${digits.slice(1)}`;
    } else if (!digits.startsWith("7")) {
      digits = `7${digits}`;
    }

    digits = digits.slice(0, 11);
    let result = "7";

    if (digits.length > 1) {
      result += ` (${digits.slice(1, 4)}`;
    }
    if (digits.length >= 4) {
      result += ")";
    }
    if (digits.length > 4) {
      result += ` ${digits.slice(4, 7)}`;
    }
    if (digits.length > 7) {
      result += `-${digits.slice(7, 9)}`;
    }
    if (digits.length > 9) {
      result += `-${digits.slice(9, 11)}`;
    }

    return result;
  };

  const countDigitsBefore = (value, position) =>
    getPhoneDigits(String(value || "").slice(0, Math.max(0, position || 0))).length;

  const getCaretPositionAfterDigits = (value, digitCount, preferEnd = false) => {
    if (!value || digitCount <= 0) {
      return 0;
    }

    const totalDigits = getPhoneDigits(value).length;

    if (preferEnd || digitCount >= totalDigits) {
      return value.length;
    }

    let seenDigits = 0;

    for (let index = 0; index < value.length; index += 1) {
      if (/\d/.test(value[index])) {
        seenDigits += 1;

        if (seenDigits === digitCount) {
          return index + 1;
        }
      }
    }

    return value.length;
  };

  const formatPhoneField = (field) => {
    const rawValue = field.value;
    const rawDigits = getPhoneDigits(rawValue);
    const selectionStart = field.selectionStart ?? rawValue.length;
    const wasAtEnd = selectionStart >= rawValue.length;
    const countryCodeWasInserted =
      rawDigits.length > 0 && !rawDigits.startsWith("7") && !rawDigits.startsWith("8");
    const digitsBeforeCaret =
      countDigitsBefore(rawValue, selectionStart) + (countryCodeWasInserted ? 1 : 0);
    const formattedValue = formatRussianPhone(rawValue);

    field.value = formattedValue;

    const caretPosition = getCaretPositionAfterDigits(
      formattedValue,
      Math.min(digitsBeforeCaret, getPhoneDigits(formattedValue).length),
      wasAtEnd,
    );

    try {
      field.setSelectionRange(caretPosition, caretPosition);
    } catch {
      // Some mobile browsers can reject selection changes while the field is not active.
    }
  };

  const handlePhoneDeletion = (event, field) => {
    if (event.inputType !== "deleteContentBackward" && event.inputType !== "deleteContentForward") {
      return false;
    }

    const value = field.value;
    const selectionStart = field.selectionStart ?? value.length;
    const selectionEnd = field.selectionEnd ?? selectionStart;
    const digits = getPhoneDigits(value).split("");
    const startDigitIndex = countDigitsBefore(value, selectionStart);
    const endDigitIndex = countDigitsBefore(value, selectionEnd);
    const hasSelectedDigits = endDigitIndex > startDigitIndex;
    let deleteFrom = startDigitIndex;
    let deleteCount = endDigitIndex - startDigitIndex;

    if (!hasSelectedDigits) {
      if (event.inputType === "deleteContentBackward") {
        deleteFrom = startDigitIndex - 1;
      }

      deleteCount = 1;
    }

    if (deleteFrom < 0 || deleteFrom >= digits.length || deleteCount <= 0) {
      return false;
    }

    event.preventDefault();
    digits.splice(deleteFrom, deleteCount);

    const formattedValue = formatRussianPhone(digits.join(""));
    field.value = formattedValue;

    const remainingDigits = getPhoneDigits(formattedValue).length;
    const caretDigitIndex = Math.min(Math.max(deleteFrom, 0), remainingDigits);
    const caretPosition = getCaretPositionAfterDigits(
      formattedValue,
      caretDigitIndex,
      caretDigitIndex >= remainingDigits,
    );

    try {
      field.setSelectionRange(caretPosition, caretPosition);
    } catch {
      // Keep deletion functional even if a browser does not allow caret positioning.
    }

    field.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };

  const isBookingForm = (form) =>
    form instanceof HTMLFormElement &&
    (form.matches("[data-booking-form]") || form.matches("[data-booking-inline-form]"));

  const getErrorAttribute = (form) =>
    form.matches("[data-booking-inline-form]") ? "data-inline-error-for" : "data-error-for";

  const getStatusElement = (form) =>
    form.querySelector("[data-inline-booking-status]") ||
    form.querySelector("[data-booking-status]");

  const getNamedField = (form, name) =>
    form.elements?.namedItem?.(name) || form.querySelector(`[name="${name}"]`);

  const getField = (form, name) => {
    const dataFieldName = name === "privacyConsent" ? "consent" : name;

    return form.querySelector(`[data-booking-field="${dataFieldName}"]`) ||
      getNamedField(form, name) ||
      (TECHNICAL_FIELD_NAMES[name] ? getNamedField(form, TECHNICAL_FIELD_NAMES[name]) : null);
  };

  const getFieldName = (field) =>
    field instanceof HTMLElement
      ? field.dataset.bookingField || field.getAttribute("name") || ""
      : "";

  const getErrorElement = (form, fieldName) =>
    form.querySelector(`[${getErrorAttribute(form)}="${fieldName}"]`) ||
    (fieldName === "privacyConsent"
      ? form.querySelector(`[${getErrorAttribute(form)}="consent"]`)
      : null);

  const getCanonicalFieldName = (fieldName) =>
    fieldName === "consent" ? "privacyConsent" : fieldName;

  const ensureDescribedBy = (field, id) => {
    if (!(field instanceof HTMLElement) || !id) {
      return;
    }

    const current = field.getAttribute("aria-describedby") || "";
    const ids = current.split(/\s+/).filter(Boolean);

    if (!ids.includes(id)) {
      ids.push(id);
      field.setAttribute("aria-describedby", ids.join(" "));
    }
  };

  const initFormAccessibility = (form) => {
    ["name", "phone", "privacyConsent"].forEach((fieldName) => {
      const field = getField(form, fieldName);
      const error = getErrorElement(form, fieldName);

      if (!(field instanceof HTMLElement) || !(error instanceof HTMLElement)) {
        return;
      }

      const canonicalFieldName = getCanonicalFieldName(fieldName);

      if (!error.id) {
        const formIndex = [...document.querySelectorAll("form")].indexOf(form) + 1;
        error.id = `booking-${formIndex}-${canonicalFieldName}-error`;
      }

      error.setAttribute("aria-live", "polite");
      ensureDescribedBy(field, error.id);
    });

    const status = getStatusElement(form);

    if (status instanceof HTMLElement) {
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
    }
  };

  const clearFieldError = (form, fieldName) => {
    const field = getField(form, fieldName);
    const error = getErrorElement(form, fieldName);

    if (field instanceof HTMLElement) {
      field.removeAttribute("aria-invalid");
    }

    if (error) {
      error.textContent = "";
    }
  };

  const clearFormState = (form) => {
    ["name", "phone", "privacyConsent"].forEach((fieldName) => clearFieldError(form, fieldName));

    const status = getStatusElement(form);

    if (status) {
      status.textContent = "";
      status.dataset.state = "";
    }
  };

  const setFieldError = (form, fieldName, message) => {
    const field = getField(form, fieldName);
    const error = getErrorElement(form, fieldName);

    if (field instanceof HTMLElement) {
      field.setAttribute("aria-invalid", "true");
    }

    if (error) {
      error.textContent = message;
    }
  };

  const focusInvalidField = (field) => {
    if (!(field instanceof HTMLElement) || typeof field.focus !== "function") {
      return;
    }

    if (window.matchMedia("(max-width: 768px)").matches && typeof field.scrollIntoView === "function") {
      field.scrollIntoView({ block: "center", behavior: "smooth" });
      window.setTimeout(() => field.focus({ preventScroll: true }), 120);
      return;
    }

    field.focus();
  };

  const validateForm = (form) => {
    clearFormState(form);

    const name = getField(form, "name");
    const phone = getField(form, "phone");
    const consent = getField(form, "privacyConsent");
    const nameValue = String(name?.value || "").trim();
    const normalizedPhone = normalizeRussianPhone(phone?.value || "");
    let firstInvalidField = null;

    if (nameValue.length < 2) {
      setFieldError(form, "name", ERROR_MESSAGES.name);
      firstInvalidField = firstInvalidField || name;
    }

    if (!normalizedPhone) {
      setFieldError(form, "phone", ERROR_MESSAGES.phone);
      firstInvalidField = firstInvalidField || phone;
    }

    if (!consent?.checked) {
      setFieldError(form, "privacyConsent", ERROR_MESSAGES.consent);
      firstInvalidField = firstInvalidField || consent;
    }

    if (firstInvalidField) {
      focusInvalidField(firstInvalidField);
      return false;
    }

    return true;
  };

  const setPending = (form, isPending) => {
    const submitButton = form.querySelector('button[type="submit"]');
    const status = getStatusElement(form);

    if (submitButton) {
      submitButton.disabled = isPending;
      submitButton.setAttribute("aria-busy", isPending ? "true" : "false");
    }

    if (status && isPending) {
      status.dataset.state = "pending";
      status.textContent = ERROR_MESSAGES.pending;
    }
  };

  const markFormStarted = (form, force = false) => {
    if (!isBookingForm(form)) {
      return;
    }

    const field = getNamedField(form, TECHNICAL_FIELD_NAMES.startedAt);

    if (field instanceof HTMLInputElement && (force || !field.value)) {
      field.value = String(Date.now());
    }
  };

  const buildPayload = (form) => {
    const getValue = (fieldName) => String(getField(form, fieldName)?.value || "").trim();
    const phone = normalizeRussianPhone(getValue("phone"));

    return {
      name: getValue("name"),
      phone: phone ? `+${phone}` : getValue("phone"),
      consent: true,
      source: getValue("source") || String(form.dataset.bookingSource || "").trim(),
      url: window.location.href,
      booking_company_field: String(
        getNamedField(form, TECHNICAL_FIELD_NAMES.honeypot)?.value || "",
      ).trim(),
      form_started_at: String(
        getNamedField(form, TECHNICAL_FIELD_NAMES.startedAt)?.value || "",
      ).trim(),
      ...getEntryFields(),
    };
  };

  // Страница входа и сайт, с которого пришли (сохраняет yandex-metrika.js), чтобы в заявке
  // было видно источник: реклама, поиск, Карты или прямой заход.
  const getEntryFields = () => {
    const entry = typeof window.dhGetEntry === "function" ? window.dhGetEntry() : null;

    return entry && entry.url
      ? { entry_url: entry.url.slice(0, 1000), entry_referrer: entry.ref.slice(0, 500) }
      : {};
  };

  const unlockAutocompleteGuard = (target) => {
    const field = target instanceof HTMLElement
      ? target.closest("[data-booking-autocomplete-guard]")
      : null;

    if (field instanceof HTMLInputElement) {
      field.removeAttribute("readonly");
    }
  };

  const applyAutocompleteGuard = (form) => {
    ["name", "phone"].forEach((fieldName) => {
      const field = getField(form, fieldName);

      if (!(field instanceof HTMLInputElement)) {
        return;
      }

      field.setAttribute("autocomplete", "new-password");
      field.setAttribute("aria-autocomplete", "none");
      field.setAttribute("data-lpignore", "true");
      field.setAttribute("data-form-type", "other");
      field.setAttribute("data-booking-autocomplete-guard", "");

      if (!field.value) {
        field.setAttribute("readonly", "readonly");
      }
    });
  };

  const submitPayload = async (payload) => {
    const response = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Lead endpoint responded with ${response.status}`);
    }
  };

  document.addEventListener("input", (event) => {
    const field = event.target;
    const form = field instanceof HTMLElement ? field.closest("form") : null;
    const fieldName = getFieldName(field);

    if (!isBookingForm(form)) {
      return;
    }

    markFormStarted(form);

    if (fieldName === "name" && String(field.value || "").trim().length >= 2) {
      clearFieldError(form, "name");
    }

    if (fieldName === "phone" && field instanceof HTMLInputElement) {
      formatPhoneField(field);

      if (normalizeRussianPhone(field.value)) {
        clearFieldError(form, "phone");
      }
    }
  }, true);

  document.addEventListener("beforeinput", (event) => {
    const field = event.target;
    const form = field instanceof HTMLElement ? field.closest("form") : null;

    if (
      !isBookingForm(form) ||
      getFieldName(field) !== "phone" ||
      !(field instanceof HTMLInputElement)
    ) {
      return;
    }

    handlePhoneDeletion(event, field);
  }, true);

  document.addEventListener("focusout", (event) => {
    const field = event.target;
    const form = field instanceof HTMLElement ? field.closest("form") : null;

    if (!isBookingForm(form) || getFieldName(field) !== "phone" || !(field instanceof HTMLInputElement)) {
      return;
    }

    if (getPhoneDigits(field.value).length <= 1) {
      field.value = "";
    }
  }, true);

  document.addEventListener("change", (event) => {
    const field = event.target;
    const form = field instanceof HTMLElement ? field.closest("form") : null;
    const fieldName = getFieldName(field);

    if (
      isBookingForm(form) &&
      (fieldName === "privacyConsent" || fieldName === "consent") &&
      field.checked
    ) {
      markFormStarted(form);
      clearFieldError(form, "privacyConsent");
    }
  }, true);

  ["pointerdown", "touchstart", "focusin", "keydown"].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      unlockAutocompleteGuard(event.target);

      const form = event.target instanceof HTMLElement ? event.target.closest("form") : null;
      if (isBookingForm(form)) {
        markFormStarted(form);
      }
    }, true);
  });

  document.querySelectorAll("form").forEach((form) => {
    if (isBookingForm(form)) {
      initFormAccessibility(form);
      applyAutocompleteGuard(form);
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;

    if (!isBookingForm(form)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (!validateForm(form)) {
      return;
    }

    const payload = buildPayload(form);
    setPending(form, true);

    submitPayload(payload)
      .then(() => {
        // DH_METRIKA_LEAD_SUCCESS: count only a server-accepted lead, never a mere click.
        const redirectToThanks = () => {
          const s = getStatusElement(form); setPending(form, false); if (s) { s.textContent = "Это превью: заявка никуда не ушла. На сайте здесь откроется страница «Спасибо»."; }
        };
        const formType = form.matches("[data-booking-inline-form]") ? "inline" : "modal";

        if (typeof window.dhTrackMetrikaGoal === "function") {
          window.dhTrackMetrikaGoal(
            "lead_success",
            {
              page: window.location.pathname,
              source: payload.source || formType,
              form_type: formType,
            },
            redirectToThanks,
          );
          return;
        }

        redirectToThanks();
      })
      .catch(() => {
        const status = getStatusElement(form);

        if (status) {
          status.dataset.state = "error";
          status.textContent = ERROR_MESSAGES.submit;
        }

        setPending(form, false);
      });
  }, true);
})();
