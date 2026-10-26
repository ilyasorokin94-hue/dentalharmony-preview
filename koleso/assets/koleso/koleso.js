/* =========================================================================
   Колесо подарков · Зубная Гармония
   Кнопка внизу слева открывает окно с колесом. Посетитель оставляет имя и телефон,
   заявка уходит в /api/lead.php (source=koleso) с той же защитой, что у формы записи,
   а подарок выбирает сервер (api/lib/Koleso.php): один номер — один подарок.
   Колесо останавливается на подарке из ответа сервера.
   ЧЕРНОВИК: подписи сегментов, срок и частоту автопоказа утверждает клиника.
   ========================================================================= */
(function () {
  "use strict";

  // id и title совпадают с dh_koleso_config() в api/lib/Koleso.php (title нужен только демо в превью);
  // порядок — по часовой стрелке от указателя
  const SEGMENTS = [
    { id: "gigiena", value: "Гигиена", note: "в подарок", tone: "brass", title: "Профессиональная гигиена в подарок" },
    { id: "konsultatsiya", value: "Консультация", note: "бесплатно", tone: "moss", title: "Консультация и план лечения бесплатно" },
    { id: "implant-5000", value: "5 000 ₽", note: "на имплантацию", tone: "sand", title: "Сертификат 5 000 ₽ на имплантацию" },
    { id: "snimok", value: "Снимок", note: "бесплатно", tone: "moss", title: "Панорамный снимок зубов бесплатно" },
    { id: "kt-50", value: "−50%", note: "на КТ", tone: "sand", title: "КТ всей полости рта со скидкой 50%" },
    { id: "lechenie-10", value: "−10%", note: "на лечение", tone: "moss", title: "Скидка 10% на лечение зубов" },
    { id: "konsultatsiya", value: "Консультация", note: "бесплатно", tone: "sand", title: "Консультация и план лечения бесплатно" },
    { id: "snimok", value: "Снимок", note: "бесплатно", tone: "moss", title: "Панорамный снимок зубов бесплатно" },
  ];

  // знак клиники (assets/v3/img/logo-mark.svg) встроен в скрипт: отдельной картинкой
  // в превью Artifact он показывался перекрашенным, а так рисуется одинаково везде
  const LOGO_MARK = '<svg viewBox="0 0 464 542" width="36" height="42" focusable="false"><g fill="#085068" fill-rule="evenodd"><path d="M236 532C262 482 260 390 234 377C226 374 220 377 212 388C204 400 196 423 190 446C187 460 186 484 188 494C189 498 190 502 190 502C189 502 165 494 154 489C92 462 44 395 17 301C2 249 -3 194 5 160C19 93 74 52 130 65C142 68 152 72 175 84C214 103 231 106 254 98C258 97 272 90 285 84C325 64 348 58 373 61C414 66 446 94 458 135C468 170 464 222 445 284C417 375 349 474 285 516C269 527 247 537 234 540L231 541L236 532ZM255 526C305 498 361 432 398 356C419 313 427 288 436 241C442 211 443 200 444 177C444 147 443 136 434 118C421 92 399 76 371 73C348 70 326 77 290 98C281 104 269 110 264 113C232 129 214 126 164 100C132 84 119 80 102 81C66 84 36 108 24 145C17 167 15 198 20 228C35 328 72 412 120 455C136 469 176 495 178 493C179 493 178 490 178 488C177 480 177 460 178 448C181 423 189 397 200 381C207 370 215 365 227 363C236 361 242 364 250 372C263 387 268 407 268 444C268 481 262 508 248 526C244 531 245 531 255 526Z"/><path d="M232 350C212 346 194 331 188 313C184 303 191 303 196 313C208 337 240 348 264 336C273 332 282 322 288 311C292 302 295 301 298 305C306 317 283 343 259 350C253 351 239 351 232 350Z"/><path d="M411 306C411 305 413 300 416 293C425 269 433 235 434 218C436 193 426 167 408 154C403 150 394 146 385 143C375 140 343 139 329 142C294 150 256 171 227 198C212 212 222 201 241 182C260 162 271 155 289 145C313 133 330 128 356 128C376 128 383 130 398 138C421 148 434 166 437 188C440 209 430 259 416 296C412 305 411 307 411 306Z"/><path d="M174 284C155 264 134 261 105 273C100 275 95 277 94 277C92 277 87 274 84 272L82 270L88 271C92 271 95 271 98 270C105 267 106 266 100 264C95 262 89 255 87 250L86 246L91 251C96 256 103 259 109 259C113 259 113 258 110 255C106 252 103 246 102 240L102 236L106 242C109 246 112 249 115 251C120 253 120 253 130 252C149 250 159 253 171 264C178 271 182 279 184 287C184 293 183 292 174 284Z"/><path d="M295 281C295 277 300 268 305 263C315 253 328 250 348 253C355 254 357 254 360 253C366 250 372 245 375 240L378 236L378 239C376 246 375 250 370 254L366 259L369 260C376 261 389 255 392 249C394 245 394 248 392 252C390 257 384 263 379 265C377 266 375 267 375 267C375 270 386 272 393 271C395 271 398 270 398 270C398 271 396 272 394 274C388 278 385 278 373 272C347 261 324 263 303 278C296 284 295 284 295 281Z"/><path d="M31 187C32 185 33 179 34 174C39 142 50 125 71 118C79 115 95 114 106 116C122 120 150 132 182 150C190 154 199 159 202 160C211 163 207 164 196 161C192 161 178 156 163 150C117 133 107 130 88 131C78 132 77 132 70 135C53 143 39 161 34 183C32 190 30 192 31 187Z"/><path d="M200 138C176 128 160 121 125 103C119 100 111 96 108 96C102 95 100 93 104 93C125 93 148 101 176 119C191 128 206 135 216 137C222 139 222 139 219 140C214 142 210 141 200 138Z"/><path d="M162 70C151 59 142 54 126 49C105 41 96 34 87 16C81 5 81 0 84 1C88 2 96 3 112 3C126 4 128 4 134 6C153 13 164 27 170 48C173 60 175 79 173 79C173 79 168 75 162 70ZM162 50C155 32 138 17 116 12C111 10 92 7 90 7C88 7 101 23 108 29C115 36 124 41 140 45C146 47 153 50 157 52C164 56 164 56 162 50Z"/><path d="M181 74C181 71 184 62 186 52C189 33 192 25 198 19C202 15 202 15 198 16C193 17 186 22 183 26C179 32 177 36 176 48L175 58L173 54C172 48 172 35 174 30C176 23 182 16 188 13C193 10 194 10 201 10C205 10 210 10 212 10L216 11L213 14C206 18 201 27 199 41C195 57 192 66 185 73C180 79 179 79 181 74Z"/></g><g fill="#4CC0C0" fill-rule="evenodd"><path d="M247 527C249 525 251 522 253 519C254 516 256 514 256 515C262 517 300 482 323 454C332 443 363 399 372 384C381 368 400 331 406 318C407 314 409 311 409 311C410 311 410 310 410 309C409 308 409 308 410 309C411 309 411 308 410 307C410 305 410 305 411 306C412 306 412 306 412 305C411 304 411 303 412 304C413 304 413 304 413 302C412 301 413 300 413 300C414 301 415 298 414 295C414 294 414 294 415 295C416 296 416 296 416 294C417 292 417 290 416 292C415 294 415 293 417 285C423 263 426 239 425 220C424 192 415 174 398 163C386 154 371 151 356 154C352 155 351 154 351 153C351 150 347 150 332 152C319 154 305 158 294 163C272 171 243 188 226 201C223 204 220 205 220 204C220 204 221 203 221 204C221 204 224 201 228 197C250 176 282 157 308 148C329 142 335 140 358 140C376 140 378 141 385 143C408 150 422 163 430 185C438 207 435 233 420 279C418 285 417 290 417 291C418 291 425 268 429 254C435 230 439 203 438 192C437 189 437 187 438 188C438 189 439 189 440 189C441 188 441 144 440 136C439 132 439 132 440 135C445 147 445 186 441 212C436 243 429 278 422 298C410 335 388 380 361 420C329 468 290 507 255 526C246 531 244 531 247 527Z"/><path d="M262 499C263 496 266 481 267 475C267 470 268 469 269 470C272 470 273 450 273 425C272 393 267 377 253 364L247 358L254 358C269 360 274 366 278 388C280 399 280 429 278 445C276 466 271 484 265 496C263 501 260 503 262 499Z"/><path d="M170 490C107 455 73 410 44 326C36 303 33 292 35 293C36 293 36 293 36 289C31 259 31 250 31 226C30 199 31 183 32 186C32 187 33 185 34 182C38 162 53 143 70 135C77 132 78 132 88 131C107 131 117 133 162 150C176 155 191 160 196 161L204 164L198 165C186 167 180 166 146 155C109 143 96 141 85 145C68 151 56 174 51 205C49 219 50 258 52 276C62 350 92 417 134 458C147 471 170 488 173 486C173 485 172 482 171 478C167 464 166 457 166 435C166 392 175 367 193 358C202 354 221 355 231 360L234 362L227 363C219 364 214 367 208 372C194 385 181 417 178 450C177 461 177 488 178 491C180 494 177 493 170 490Z"/><path d="M276 327C280 322 281 322 281 322C281 322 279 325 276 327L272 332L276 327Z"/><path d="M23 247C19 223 18 214 18 193C18 171 19 161 24 145C36 108 66 84 102 81C119 80 132 84 164 100C214 126 232 129 264 113C269 110 281 104 290 98C318 82 334 75 353 73C384 69 418 87 431 114C433 117 432 117 427 111C409 92 387 83 359 84C337 85 327 89 283 113C244 134 229 137 202 128C196 127 193 126 193 127C193 128 189 126 176 119C163 111 144 101 134 98C124 95 103 92 102 94C102 94 100 95 96 94C92 94 88 94 82 96C51 105 32 132 24 179C22 192 22 226 25 244C25 251 26 257 26 258C25 258 24 253 23 247Z"/><path d="M332 251C334 251 336 251 338 251C339 252 338 252 334 252C331 252 330 252 332 251Z"/><path d="M242 180C246 175 251 171 251 171C251 171 247 175 242 180C238 185 233 189 233 189C233 189 237 185 242 180Z"/><path d="M259 187C259 187 266 184 275 179C296 169 312 163 332 158C344 155 347 155 336 159C316 164 288 174 269 183C263 186 259 188 259 187Z"/><path d="M218 143C215 142 212 141 214 141C215 141 217 140 219 140C220 139 226 139 232 139C246 139 256 136 285 125C320 110 333 107 357 107L370 107L357 108C336 109 320 114 291 127C260 142 253 144 237 145C228 145 224 144 218 143Z"/><path d="M353 127C355 127 359 127 361 127C363 128 361 128 356 128C352 128 350 128 353 127Z"/><path d="M88 114C90 114 92 114 93 114C94 114 93 115 90 115C88 115 87 114 88 114Z"/><path d="M172 54C170 52 170 48 171 48C172 48 172 48 172 48C172 48 172 50 173 52C174 55 173 56 172 54Z"/></g></svg>';

  // адреса считаем от самого скрипта: так же работает и в превью, где сайт лежит в подпапке
  const SCRIPT_SRC = document.currentScript?.src || `${window.location.origin}/assets/koleso/koleso.js`;
  const SITE = window.DH_KOLESO_SITE || "";

  const CONFIG = {
    endpoint: window.DH_FORM_ENDPOINT || "/api/lead.php",
    source: "koleso",
    rulesUrl: window.DH_KOLESO_RULES || `${SITE}/koleso-podarkov/`,
    phoneHref: "tel:+79168629494",
    phoneText: "+7 (916) 862-94-94",
    validDays: 7, // как valid_days в api/lib/Koleso.php
    autoOpenAfterMs: 30000, // 0 — окно само не открывается, только по кнопке
    autoOpenEveryDays: 3,
    exitIntent: true, // компьютер: открыть, когда курсор уходит к вкладкам браузера
  };

  // Превью сайта отвечает на /api/ заглушкой { ok: true, preview: true } — тогда подарок
  // выбирается случайно в браузере и нигде не сохраняется.

  const STORE_RESULT = "dh-koleso-result";
  const STORE_SEEN = "dh-koleso-seen";
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const STEP = 360 / SEGMENTS.length;

  const readStore = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const writeStore = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // без хранилища колесо работает, просто не запомнит подарок между визитами
    }
  };

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  // ---------- колесо (SVG) ----------
  const point = (r, deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };

  const wedge = (r, from, to) => `M0 0 L${point(r, from)} A${r} ${r} 0 0 1 ${point(r, to)} Z`;

  const TEXT_R = 120; // середина подписи на радиусе: между ступицей (~50) и ободом (184)
  // длинное слово («Консультация») мельче, чтобы не залезало на ступицу и обод
  const valueSize = (value) => (value.length > 8 ? ` style="font-size:${Math.max(15, Math.floor(196 / value.length))}px"` : "");

  const wheelSvg = (withText) => {
    const r = 184;
    const parts = SEGMENTS.map((seg, i) => {
      const mid = i * STEP;
      // подпись вдоль радиуса: от ступицы к ободу, две строки рядом
      const text = withText
        ? `<g transform="rotate(${mid}) rotate(-90)" class="koleso-seg__text">` +
          `<text x="${TEXT_R}" y="-10" class="koleso-seg__value"${valueSize(seg.value)}>${escapeHtml(seg.value)}</text>` +
          `<text x="${TEXT_R}" y="13" class="koleso-seg__note">${escapeHtml(seg.note)}</text>` +
          "</g>"
        : "";
      return `<g class="koleso-seg koleso-seg--${seg.tone}" data-koleso-seg="${i}"><path d="${wedge(r, mid - STEP / 2, mid + STEP / 2)}"/>${text}</g>`;
    }).join("");
    const lines = SEGMENTS.map((_, i) => `<line x1="0" y1="0" x2="${point(r, i * STEP - STEP / 2).replace(" ", '" y2="')}"/>`).join("");
    return (
      '<svg viewBox="-200 -200 400 400" aria-hidden="true" focusable="false">' +
      '<circle r="198" class="koleso-rim"/>' +
      '<circle r="191" class="koleso-rim-line"/>' +
      `<g class="koleso-segs">${parts}</g>` +
      `<g class="koleso-lines">${lines}</g>` +
      "</svg>"
    );
  };

  // ---------- кнопка ----------
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "koleso-fab";
  fab.setAttribute("aria-haspopup", "dialog");
  fab.setAttribute("aria-label", "Колесо подарков: подарок к первому визиту");
  fab.innerHTML =
    `<span class="koleso-fab__wheel" aria-hidden="true">${wheelSvg(false)}<span class="koleso-fab__hub"></span></span>` +
    '<span class="koleso-fab__text" aria-hidden="true"><b>Колесо подарков</b><small>подарок к первому визиту</small></span>';

  const markFabDone = () => {
    fab.classList.add("is-done");
    fab.querySelector(".koleso-fab__text small").textContent = "ваш подарок закреплён";
  };

  // ---------- окно ----------
  let dialog = null;
  let els = {};
  let lastFocus = null;
  let angle = 0;
  let busy = false;

  const buildDialog = () => {
    dialog = document.createElement("div");
    dialog.className = "koleso";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "koleso-title");
    dialog.setAttribute("data-lenis-prevent", "");
    dialog.hidden = true;
    dialog.innerHTML = `
<div class="koleso__panel" tabindex="-1">
  <button class="koleso__close" type="button" data-koleso-close aria-label="Закрыть колесо подарков"><span aria-hidden="true"></span><span aria-hidden="true"></span></button>
  <div class="koleso__stage">
    <div class="koleso__wheel">
      <div class="koleso__rotor" data-koleso-rotor>${wheelSvg(true)}</div>
      <span class="koleso__hub" aria-hidden="true">${LOGO_MARK}</span>
      <span class="koleso__pointer" aria-hidden="true"></span>
    </div>
  </div>
  <div class="koleso__body">
    <div class="koleso__view" data-koleso-view="form">
      <p class="koleso__eyebrow">Подарок к первому визиту</p>
      <h2 class="koleso__title" id="koleso-title">Колесо подарков</h2>
      <p class="koleso__lead">Крутите колесо и получите подарок на лечение в Зубной Гармонии. Подарок закрепим за вашим номером, администратор позвонит и запишет вас на приём.</p>
      <p class="koleso__terms">Одна попытка на номер телефона. Подарок действует ${CONFIG.validDays} дней и не суммируется с другими акциями. <a href="${CONFIG.rulesUrl}" target="_blank" rel="noopener">Условия акции</a></p>
      <form class="koleso__form" novalidate autocomplete="off" data-koleso-form>
        <div class="koleso__antispam" aria-hidden="true"><label>Компания <input type="text" name="booking_company_field" tabindex="-1" autocomplete="off"></label></div>
        <div class="koleso__fields">
          <label class="koleso-field"><span>Имя</span>
            <input type="text" name="name" maxlength="80" placeholder="Как к вам обращаться" autocomplete="given-name" autocapitalize="words" spellcheck="false" aria-describedby="koleso-error-name">
            <small class="koleso-field__error" id="koleso-error-name" data-koleso-error="name"></small>
          </label>
          <label class="koleso-field"><span>Телефон</span>
            <input type="tel" name="phone" maxlength="18" inputmode="tel" placeholder="+7 (___) ___-__-__" autocomplete="tel" spellcheck="false" aria-describedby="koleso-error-phone">
            <small class="koleso-field__error" id="koleso-error-phone" data-koleso-error="phone"></small>
          </label>
        </div>
        <label class="koleso-consent">
          <input type="checkbox" name="consent" aria-describedby="koleso-error-consent">
          <span class="koleso-consent__box" aria-hidden="true"></span>
          <span class="koleso-consent__text">Я даю <a href="${SITE}/personal-data-consent/" target="_blank" rel="noopener">согласие на обработку персональных данных</a> и ознакомлен(а) с <a href="${SITE}/privacy/" target="_blank" rel="noopener">Политикой конфиденциальности</a> и <a href="${CONFIG.rulesUrl}" target="_blank" rel="noopener">условиями акции</a>.</span>
        </label>
        <small class="koleso-field__error" id="koleso-error-consent" data-koleso-error="consent"></small>
        <button class="koleso__submit" type="submit" data-koleso-submit>Крутить колесо</button>
        <p class="koleso__status" role="status" aria-live="polite" data-koleso-status></p>
      </form>
      <p class="koleso__warning">Имеются противопоказания, необходима консультация специалиста.</p>
    </div>
    <div class="koleso__view" data-koleso-view="result" hidden>
      <p class="koleso__eyebrow" data-koleso-result-eyebrow>Ваш подарок</p>
      <h2 class="koleso__title koleso__title--prize" tabindex="-1" data-koleso-result-title></h2>
      <p class="koleso__lead" data-koleso-result-text></p>
      <p class="koleso__status" data-koleso-result-note></p>
      <div class="koleso__actions">
        <a class="koleso__submit" href="${CONFIG.phoneHref}" data-action="call">Позвонить в клинику</a>
        <button class="koleso__ghost" type="button" data-koleso-close>Закрыть</button>
      </div>
      <p class="koleso__terms"><a href="${CONFIG.rulesUrl}" target="_blank" rel="noopener">Условия акции</a></p>
      <p class="koleso__warning">Имеются противопоказания, необходима консультация специалиста.</p>
    </div>
  </div>
</div>`;
    document.body.appendChild(dialog);

    els = {
      panel: dialog.querySelector(".koleso__panel"),
      rotor: dialog.querySelector("[data-koleso-rotor]"),
      form: dialog.querySelector("[data-koleso-form]"),
      name: dialog.querySelector('input[name="name"]'),
      phone: dialog.querySelector('input[name="phone"]'),
      consent: dialog.querySelector('input[name="consent"]'),
      honeypot: dialog.querySelector('input[name="booking_company_field"]'),
      submit: dialog.querySelector("[data-koleso-submit]"),
      status: dialog.querySelector("[data-koleso-status]"),
      formView: dialog.querySelector('[data-koleso-view="form"]'),
      resultView: dialog.querySelector('[data-koleso-view="result"]'),
    };

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.closest("[data-koleso-close]")) close();
    });
    dialog.addEventListener("keydown", onKeydown);
    els.form.addEventListener("submit", onSubmit);
    els.form.addEventListener("focusin", markStarted);
    els.form.addEventListener("pointerdown", markStarted);
    bindPhoneMask(els.phone);
    els.name.addEventListener("input", () => clearError("name"));
    els.consent.addEventListener("change", () => clearError("consent"));

    const saved = readStore(STORE_RESULT);
    if (saved && saved.title) showResult(saved, false);
  };

  const focusables = () =>
    [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"])')].filter(
      (el) => el.offsetParent !== null,
    );

  const onKeydown = (event) => {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const open = (how) => {
    if (!dialog) buildDialog();
    if (!dialog.hidden) return;
    lastFocus = document.activeElement;
    dialog.hidden = false;
    root.classList.add("koleso-open");
    requestAnimationFrame(() => dialog.classList.add("is-open"));
    writeStore(STORE_SEEN, Date.now());
    const target = els.resultView.hidden ? els.name : dialog.querySelector("[data-koleso-result-title]");
    // на телефоне не вызываем клавиатуру сразу: сначала человек видит колесо
    if (window.matchMedia("(min-width: 900px)").matches) target.focus({ preventScroll: true });
    else els.panel.focus?.();
    if (typeof window.dhTrackMetrikaGoal === "function") {
      window.dhTrackMetrikaGoal("koleso_open", { page: window.location.pathname, how });
    }
  };

  const close = () => {
    if (!dialog || dialog.hidden || busy) return;
    dialog.classList.remove("is-open");
    root.classList.remove("koleso-open");
    window.setTimeout(() => {
      dialog.hidden = true;
    }, reduceMotion.matches ? 0 : 300);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
  };

  // ---------- форма ----------
  const markStarted = () => {
    if (!els.form.dataset.startedAt) els.form.dataset.startedAt = String(Date.now());
  };

  const formatPhone = (local) => {
    let s = "+7";
    if (local.length) s += ` (${local.slice(0, 3)}`;
    if (local.length >= 3) s += ")";
    if (local.length > 3) s += ` ${local.slice(3, 6)}`;
    if (local.length > 6) s += `-${local.slice(6, 8)}`;
    if (local.length > 8) s += `-${local.slice(8, 10)}`;
    return s;
  };

  // 10 цифр номера без кода страны
  const localDigits = (value) => {
    const v = String(value || "").trim();
    let d = v.replace(/\D/g, "");
    if (v.startsWith("+7") || /^[78]/.test(d)) d = d.slice(1);
    return d.slice(0, 10);
  };

  const caretAfterDigits = (value, count) => {
    if (count <= 0) return value.indexOf("(") + 1 || value.length;
    let seen = 0;
    for (let i = 0; i < value.length; i += 1) {
      if (/\d/.test(value[i]) && i > 1) {
        seen += 1;
        if (seen === count) return i + 1;
      }
    }
    return value.length;
  };

  const bindPhoneMask = (input) => {
    input.addEventListener("focus", () => {
      if (!input.value) input.value = "+7 (";
    });
    input.addEventListener("blur", () => {
      if (!localDigits(input.value)) input.value = "";
    });
    input.addEventListener("beforeinput", (event) => {
      if (event.inputType !== "deleteContentBackward" || input.selectionStart !== input.selectionEnd) return;
      const pos = input.selectionStart ?? input.value.length;
      const local = localDigits(input.value);
      const before = localDigits(input.value.slice(0, pos)).length;
      event.preventDefault();
      if (before === 0) return;
      const next = local.slice(0, before - 1) + local.slice(before);
      input.value = formatPhone(next);
      const caret = caretAfterDigits(input.value, before - 1);
      input.setSelectionRange(caret, caret);
      clearError("phone");
    });
    input.addEventListener("input", () => {
      const atEnd = (input.selectionStart ?? 0) >= input.value.length;
      const before = localDigits(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
      input.value = formatPhone(localDigits(input.value));
      const caret = atEnd ? input.value.length : caretAfterDigits(input.value, before);
      try {
        input.setSelectionRange(caret, caret);
      } catch {
        // мобильные браузеры иногда не дают поставить курсор — номер всё равно верный
      }
      if (localDigits(input.value).length === 10) clearError("phone");
    });
  };

  const setError = (field, text) => {
    const box = els.form.querySelector(`[data-koleso-error="${field}"]`);
    if (box) box.textContent = text;
    const input = field === "consent" ? els.consent : els[field];
    input?.setAttribute("aria-invalid", "true");
  };

  const clearError = (field) => {
    const box = els.form.querySelector(`[data-koleso-error="${field}"]`);
    if (box) box.textContent = "";
    const input = field === "consent" ? els.consent : els[field];
    input?.removeAttribute("aria-invalid");
  };

  const validate = () => {
    ["name", "phone", "consent"].forEach(clearError);
    let first = null;
    if (els.name.value.trim().length < 2) {
      setError("name", "Укажите, как к вам обращаться");
      first = first || els.name;
    }
    if (localDigits(els.phone.value).length !== 10) {
      setError("phone", "Введите номер полностью");
      first = first || els.phone;
    }
    if (!els.consent.checked) {
      setError("consent", "Подтвердите согласие на обработку персональных данных");
      first = first || els.consent;
    }
    if (first) first.focus();
    return !first;
  };

  const payload = () => {
    const entry = typeof window.dhGetEntry === "function" ? window.dhGetEntry() : null;
    return {
      name: els.name.value.trim().replace(/\s+/g, " "),
      phone: `+7${localDigits(els.phone.value)}`,
      consent: true,
      source: CONFIG.source,
      url: window.location.href,
      booking_company_field: els.honeypot.value.trim(),
      form_started_at: els.form.dataset.startedAt || "",
      ...(entry && entry.url ? { entry_url: entry.url.slice(0, 1000), entry_referrer: entry.ref.slice(0, 500) } : {}),
    };
  };

  const sendLead = async (data) => {
    const response = await fetch(CONFIG.endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`lead ${response.status}`);
    const json = await response.json().catch(() => ({}));
    if (!json || json.ok !== true) throw new Error("lead not ok");
    return json;
  };

  const demoLead = () =>
    new Promise((resolve) => {
      const seg = SEGMENTS[Math.floor(Math.random() * SEGMENTS.length)];
      const until = new Date(Date.now() + CONFIG.validDays * 86400000).toLocaleDateString("ru-RU");
      window.setTimeout(() => resolve({ ok: true, demo: true, prize: { id: seg.id, title: seg.title, until, repeat: false } }), 900);
    });

  // неразрывные дефисы: номер не переносится посреди строки
  const maskPhone = (local) => `+7\u00a0(${local.slice(0, 3)})\u00a0***\u2011**\u2011${local.slice(8, 10)}`;

  const onSubmit = async (event) => {
    event.preventDefault();
    if (busy || !validate()) return;
    const data = payload();
    const local = localDigits(els.phone.value);
    busy = true;
    els.submit.disabled = true;
    els.form.querySelectorAll("input").forEach((input) => (input.readOnly = true));
    els.status.dataset.state = "pending";
    els.status.textContent = "Колесо крутится…";
    dialog.classList.add("is-spinning");
    // на телефоне кнопка внизу окна: возвращаем колесо в кадр и прячем клавиатуру
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const scrollBehavior = reduceMotion.matches ? "auto" : "smooth";
    els.panel.scrollTo({ top: 0, behavior: scrollBehavior });
    dialog.scrollTo({ top: 0, behavior: scrollBehavior });

    const spin = startSpin();
    let result = null;
    try {
      result = await sendLead(data);
      if (result.preview && !result.prize) result = await demoLead();
    } catch {
      result = null;
    }

    const prize = result && result.prize && result.prize.id ? result.prize : null;
    const indexes = prize ? SEGMENTS.map((s, i) => (s.id === prize.id ? i : -1)).filter((i) => i >= 0) : [];
    const landing = indexes.length ? indexes[Math.floor(Math.random() * indexes.length)] : -1;
    await spin.stopAt(landing);

    busy = false;
    dialog.classList.remove("is-spinning");
    els.form.querySelectorAll("input").forEach((input) => (input.readOnly = false));
    els.submit.disabled = false;

    if (!result) {
      els.status.dataset.state = "error";
      els.status.textContent = `Не получилось отправить. Попробуйте ещё раз или позвоните ${CONFIG.phoneText}.`;
      return;
    }

    const saved = prize
      ? { id: prize.id, title: prize.title, until: prize.until, repeat: !!prize.repeat, phone: maskPhone(local), demo: !!result.demo, segment: landing }
      : { id: "", title: "", until: "", repeat: false, phone: maskPhone(local), demo: !!result.demo, segment: -1 };
    if (!saved.demo && saved.title) writeStore(STORE_RESULT, saved);
    showResult(saved, true);

    if (!saved.demo && typeof window.dhTrackMetrikaGoal === "function") {
      window.dhTrackMetrikaGoal("lead_success", { page: window.location.pathname, source: CONFIG.source, form_type: "koleso" });
    }
  };

  const showResult = (saved, focus) => {
    const title = dialog.querySelector("[data-koleso-result-title]");
    const text = dialog.querySelector("[data-koleso-result-text]");
    const eyebrow = dialog.querySelector("[data-koleso-result-eyebrow]");
    const note = dialog.querySelector("[data-koleso-result-note]");
    if (saved.title) {
      eyebrow.textContent = saved.repeat ? "Вы уже участвовали" : "Ваш подарок";
      title.textContent = saved.title;
      text.textContent =
        (saved.repeat ? "С этого номера колесо уже крутили, подарок за ним прежний. " : "") +
        `Подарок закреплён за номером ${saved.phone}${saved.until ? ` и действует до ${saved.until}` : ""}. ` +
        "Администратор позвонит с 9:00 до 21:00 и запишет вас на удобное время.";
    } else {
      eyebrow.textContent = "Заявка принята";
      title.textContent = "Спасибо!";
      text.textContent = "Администратор позвонит с 9:00 до 21:00, назовёт ваш подарок и запишет вас на удобное время.";
    }
    note.textContent = saved.demo ? "Это превью: заявка никуда не ушла, подарок выбран случайно." : "";
    if (saved.segment >= 0 || saved.id) {
      const index = saved.segment >= 0 ? saved.segment : SEGMENTS.findIndex((s) => s.id === saved.id);
      if (index >= 0) {
        if (!focus) setAngle(-index * STEP);
        dialog.querySelectorAll("[data-koleso-seg]").forEach((el) => {
          const won = Number(el.dataset.kolesoSeg) === index;
          el.classList.toggle("is-won", won);
          if (won) el.parentNode.appendChild(el);
        });
      }
    }
    els.formView.hidden = true;
    els.resultView.hidden = false;
    markFabDone();
    if (focus) title.focus({ preventScroll: true });
  };

  // ---------- вращение ----------
  const setAngle = (deg) => {
    angle = deg;
    els.rotor.style.transform = `rotate(${deg}deg)`;
  };

  const startSpin = () => {
    const maxSpeed = 0.9; // градусов за миллисекунду, ~2,5 оборота в секунду
    const started = performance.now();
    let last = started;
    let speed = 0;
    let stopRequest = null;
    let raf = 0;
    let resolveDone;
    const done = new Promise((resolve) => (resolveDone = resolve));

    const cruise = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      speed = Math.min(maxSpeed, maxSpeed * ((now - started) / 500));
      setAngle(angle + speed * dt);
      if (stopRequest && now - started > 1400) {
        decelerate(now, stopRequest.index);
        return;
      }
      raf = requestAnimationFrame(cruise);
    };

    const decelerate = (now, index) => {
      // index -1: подарка нет (сбой или спам) — колесо просто плавно останавливается
      const jitter = (Math.random() - 0.5) * (STEP - 14);
      const targetMod = index >= 0 ? (((-index * STEP + jitter) % 360) + 360) % 360 : Math.random() * 360;
      const currentMod = ((angle % 360) + 360) % 360;
      const distance = ((targetMod - currentMod + 360) % 360) + 360 * 3;
      const from = angle;
      const duration = (3 * distance) / Math.max(speed, 0.2);
      const t0 = now;
      const step = (time) => {
        const t = Math.min(1, (time - t0) / duration);
        setAngle(from + distance * (1 - Math.pow(1 - t, 3)));
        if (t < 1) raf = requestAnimationFrame(step);
        else resolveDone();
      };
      raf = requestAnimationFrame(step);
    };

    if (reduceMotion.matches) {
      return {
        stopAt: (index) => {
          if (index >= 0) setAngle(-index * STEP);
          return Promise.resolve();
        },
      };
    }

    raf = requestAnimationFrame(cruise);
    return {
      stopAt: (index) => {
        stopRequest = { index };
        return done;
      },
    };
  };

  // ---------- автопоказ ----------
  const otherLayerOpen = () =>
    root.classList.contains("is-booking-open") ||
    root.classList.contains("has-mobile-menu") ||
    root.classList.contains("dhq-lock") ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");

  const mayAutoOpen = () => {
    if (readStore(STORE_RESULT)) return false;
    const seen = Number(readStore(STORE_SEEN)) || 0;
    return Date.now() - seen > CONFIG.autoOpenEveryDays * 86400000;
  };

  const autoOpen = (how) => {
    if (dialog && !dialog.hidden) return;
    if (!mayAutoOpen() || otherLayerOpen()) return;
    open(how);
  };

  const init = () => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = SCRIPT_SRC.replace(/koleso\.js(\?[^#]*)?$/, "koleso.css$1");
    css.addEventListener("load", () => document.body.appendChild(fab), { once: true });
    document.head.appendChild(css);
    fab.addEventListener("click", () => open("button"));
    document.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest("[data-koleso-open]") : null;
      if (link) {
        event.preventDefault();
        open("link");
      }
    });
    if (readStore(STORE_RESULT)) markFabDone();

    if (CONFIG.autoOpenAfterMs > 0 && mayAutoOpen()) {
      window.setTimeout(() => autoOpen("timer"), CONFIG.autoOpenAfterMs);
      if (CONFIG.exitIntent && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        const armedAt = Date.now() + 8000;
        const onLeave = (event) => {
          if (event.relatedTarget || event.clientY > 0 || Date.now() < armedAt) return;
          document.removeEventListener("mouseout", onLeave);
          autoOpen("exit");
        };
        document.addEventListener("mouseout", onLeave);
      }
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
