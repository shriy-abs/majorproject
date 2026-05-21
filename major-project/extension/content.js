/**
 * Cognitive Form Assist — content script
 * Field help, form-only validation, email typo hints, and page summarization.
 */
(function () {
  const ATTR = "data-cfaAttached";
  const DEFAULT_BACKEND = "http://127.0.0.1:5000";
  const FIELD_SELECTOR =
    'form input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="search"]), form textarea, form select';

  /** Common mistyped email domains → correction */
  const EMAIL_DOMAIN_TYPOS = {
    "gmial.com": "gmail.com",
    "gmial.con": "gmail.com",
    "gamil.com": "gmail.com",
    "gmail.con": "gmail.com",
    "gmai.com": "gmail.com",
    "gnail.com": "gmail.com",
    "yahoo.co": "yahoo.com",
    "yaho.com": "yahoo.com",
    "hotmial.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "iclud.com": "icloud.com",
  };

  const widgetByField = new WeakMap();
  const fieldStateByEl = new WeakMap();
  let voiceLanguage = "EN";
  let microTooltipEl = null;
  let focusedFieldEl = null;
  let typoFlashTimer = null;

  const HI_VOICE = {
    "Did you mean": "क्या आपका मतलब है",
    "Email should include an @ symbol": "ईमेल में @ चिह्न होना चाहिए, उदाहरण: name@gmail.com।",
    "Email should include a dot after the @": "ईमेल में @ के बाद बिंदु होना चाहिए, उदाहरण: name@gmail.com।",
    "This does not look like a complete email": "यह पूरा ईमेल नहीं लगता। वर्तनी जाँचें।",
    "Phone numbers should use digits only": "फ़ोन नंबर में केवल अंक होने चाहिए। अक्षर हटाएँ।",
    "Enter at least 10 digits": "कम से कम 10 अंक दर्ज करें।",
    "Use a stronger password": "मज़बूत पासवर्ड बनाएँ",
    "Enter the value this field is asking for": "इस फ़ील्ड में जो माँगा गया है वह भरें।",
    "This field is asking for": "यह फ़ील्ड पूछ रहा है",
  };

  chrome.storage.local.get({ voiceLanguage: "EN" }, (items) => {
    voiceLanguage = items.voiceLanguage === "HI" ? "HI" : "EN";
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.voiceLanguage) {
      voiceLanguage = changes.voiceLanguage.newValue === "HI" ? "HI" : "EN";
    }
  });

  function getBackendBase() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get({ backendUrl: DEFAULT_BACKEND }, (items) => {
          resolve((items.backendUrl || DEFAULT_BACKEND).replace(/\/+$/, ""));
        });
      } catch (_) {
        resolve(DEFAULT_BACKEND);
      }
    });
  }

  function escapeId(id) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(id);
    return id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  /** Form controls only; skip site search bars and chat widgets. */
  function isValidatableFormControl(el) {
    if (!el || !el.closest) return false;
    if (!el.closest("form")) return false;
    const tag = el.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return false;
    if (el.disabled || el.readOnly) return false;

    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "hidden" || type === "submit" || type === "button" || type === "reset" || type === "image" || type === "search") {
      return false;
    }

    if (el.getAttribute("role") === "searchbox") return false;
    if (el.getAttribute("aria-label") && /search/i.test(el.getAttribute("aria-label"))) return false;
    if (el.closest('[role="search"], [role="combobox"][aria-label*="search" i]')) return false;
    if (el.closest('[class*="chat" i], [id*="chat" i], [class*="message-input" i], [data-testid*="chat" i]')) {
      return false;
    }

    return true;
  }

  function hasMeaningfulLabelOrPlaceholder(el) {
    const ph = (el.getAttribute("placeholder") || "").trim();
    if (ph.length > 0) return true;

    const ariaLabel = (el.getAttribute("aria-label") || "").trim();
    if (ariaLabel.length > 0) return true;

    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const chunk = labelledBy
        .split(/\s+/)
        .map((tid) => {
          const node = document.getElementById(tid);
          return node ? node.textContent.trim() : "";
        })
        .filter(Boolean)
        .join(" ");
      if (chunk.length > 0) return true;
    }

    if (el.id) {
      const lab = document.querySelector(`label[for="${escapeId(el.id)}"]`);
      if (lab && lab.textContent.trim().length > 0) return true;
    }

    let walk = el.parentElement;
    for (let i = 0; i < 4 && walk; i += 1) {
      const prev = walk.querySelector(":scope > label");
      if (prev && walk.contains(el)) {
        if (prev.textContent.trim().length > 0) return true;
        break;
      }
      walk = walk.parentElement;
    }

    return false;
  }

  function extractFieldContext(el) {
    const parts = [];

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) parts.push(ariaLabel.trim());

    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const chunk = labelledBy
        .split(/\s+/)
        .map((tid) => {
          const node = document.getElementById(tid);
          return node ? node.textContent.trim() : "";
        })
        .filter(Boolean)
        .join(" ");
      if (chunk) parts.push(chunk);
    }

    const desc = el.getAttribute("aria-describedby");
    if (desc) {
      const chunk = desc
        .split(/\s+/)
        .map((tid) => {
          const node = document.getElementById(tid);
          return node ? node.textContent.trim() : "";
        })
        .filter(Boolean)
        .join(" ");
      if (chunk) parts.push(chunk);
    }

    if (el.id) {
      const lab = document.querySelector(`label[for="${escapeId(el.id)}"]`);
      if (lab) parts.push(lab.textContent.trim());
    }

    let walk = el.parentElement;
    for (let i = 0; i < 4 && walk; i += 1) {
      const prev = walk.querySelector(":scope > label");
      if (prev && walk.contains(el)) {
        const t = prev.textContent.trim();
        if (t && !parts.includes(t)) parts.push(t);
        break;
      }
      walk = walk.parentElement;
    }

    const ph = el.getAttribute("placeholder");
    if (ph) parts.push(`Placeholder: ${ph.trim()}`);

    const title = el.getAttribute("title");
    if (title) parts.push(title.trim());

    const name = el.getAttribute("name");
    if (name && parts.length === 0) parts.push(name.replace(/[_-]+/g, " "));

    const unique = [];
    const seen = new Set();
    for (const p of parts) {
      const key = p.toLowerCase();
      if (!seen.has(key) && p.length) {
        seen.add(key);
        unique.push(p);
      }
    }
    return unique.join(". ");
  }

  function detectFieldKind(el, contextText) {
    const type = (el.getAttribute("type") || "").toLowerCase();
    const blob = `${type} ${contextText} ${el.name || ""} ${el.id || ""} ${el.autocomplete || ""}`.toLowerCase();

    if (type === "email" || /\be[-]?mail\b/.test(blob)) return "email";
    if (type === "tel" || /\b(phone|mobile|cell|contact\s*number|tel)\b/.test(blob)) return "phone";
    if (type === "password" || /\b(password|passphrase|passcode)\b/.test(blob)) return "password";
    return null;
  }

  function getEmailTypoDomain(value) {
    const v = (value || "").trim().toLowerCase();
    const at = v.lastIndexOf("@");
    if (at < 1) return null;
    const domain = v.slice(at + 1);
    return EMAIL_DOMAIN_TYPOS[domain] || null;
  }

  function checkEmailDomainTypo(value) {
    const fix = getEmailTypoDomain(value);
    if (fix) return `Did you mean ${fix}?`;
    return null;
  }

  function detectTypoCorrection(prevValue, nextValue) {
    const expectedFix = getEmailTypoDomain(prevValue);
    if (!expectedFix) return false;
    const next = (nextValue || "").trim().toLowerCase();
    return next.includes(`@${expectedFix}`);
  }

  function validateEmail(value) {
    const v = (value || "").trim();
    const messages = [];
    if (!v) return messages;

    if (!v.includes("@")) {
      messages.push("Email should include an @ symbol, for example name@gmail.com.");
    } else if (!/\./.test(v.split("@").pop() || "")) {
      messages.push("Email should include a dot after the @, for example name@gmail.com.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      messages.push("This does not look like a complete email. Check spelling and try again.");
    }
    return messages;
  }

  function validatePhone(value) {
    const v = (value || "").trim();
    const messages = [];
    if (!v) return messages;

    if (/[a-zA-Z]/.test(v)) {
      messages.push("Phone numbers should use digits only. Remove letters and symbols except + if needed.");
    }
    const digits = v.replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 10) {
      messages.push(`Enter at least 10 digits. You have ${digits.length} so far.`);
    }
    return messages;
  }

  function validatePassword(value) {
    const v = value || "";
    const messages = [];
    if (!v) return messages;

    const issues = [];
    if (v.length < 8) issues.push("at least 8 characters");
    if (!/[a-zA-Z]/.test(v)) issues.push("a letter");
    if (!/\d/.test(v)) issues.push("a number");
    if (issues.length) {
      messages.push(`Use a stronger password with ${issues.join(", ")}.`);
    }
    return messages;
  }

  /** Fast, synchronous checks for input/blur (no network). */
  function runFieldValidation(fieldEl, contextText) {
    const value = fieldEl.value != null ? String(fieldEl.value) : "";
    const trimmed = value.trim();
    const kind = detectFieldKind(fieldEl, contextText);
    const messages = [];
    let typo = null;

    if (kind === "email" || (trimmed.includes("@") && /\.(com|co|in|org|net)\b/i.test(trimmed))) {
      typo = checkEmailDomainTypo(trimmed);
      if (trimmed) messages.push(...validateEmail(trimmed));
    } else if (kind === "phone") {
      if (trimmed) messages.push(...validatePhone(trimmed));
    } else if (kind === "password") {
      if (trimmed) messages.push(...validatePassword(trimmed));
    }

    return { messages, typo, kind };
  }

  function localFallback(raw) {
    const t = (raw || "").trim();
    if (!t) return "Enter the value this field is asking for.";
    return `This field is asking for: ${t}. Use simple words and double-check before you submit.`;
  }

  function recordFieldTypeMetric(fieldEl, contextText) {
    const kind = detectFieldKind(fieldEl, contextText);
    const type = (fieldEl.getAttribute("type") || fieldEl.tagName || "text").toLowerCase();
    const key = kind || (type === "textarea" ? "textarea" : type === "select-one" || fieldEl.tagName === "SELECT" ? "select" : type);
    if (window.CFAMetrics) window.CFAMetrics.recordFieldType(key);
  }

  async function fetchSimplified(text) {
    const t0 = performance.now();
    const base = await getBackendBase();
    try {
      const r = await fetch(`${base}/api/simplify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await r.json();
      const ms = performance.now() - t0;
      if (window.CFAMetrics) window.CFAMetrics.recordLatency(ms);
      if (data && data.ok && data.simplified) {
        return { text: data.simplified, source: data.source || "api" };
      }
    } catch (_) {
      if (window.CFAMetrics) window.CFAMetrics.recordLatency(performance.now() - t0);
    }
    return { text: localFallback(text), source: "local" };
  }

  function translateForVoice(text) {
    if (voiceLanguage !== "HI" || !text) return text;
    let out = text;
    Object.keys(HI_VOICE).forEach((en) => {
      if (out.includes(en)) out = out.replace(en, HI_VOICE[en]);
    });
    if (/Did you mean (\S+)\?/.test(text)) {
      const m = text.match(/Did you mean (\S+)\?/);
      if (m) out = `क्या आपका मतलब ${m[1]} है?`;
    }
    return out;
  }

  function speakMultilingual(text) {
    const line = (text || "").trim();
    if (!line) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(translateForVoice(line));
      u.lang = voiceLanguage === "HI" ? "hi-IN" : "en-US";
      u.rate = 0.92;
      window.speechSynthesis.speak(u);
    } catch (_) {
      /* no TTS */
    }
  }

  function ensureMicroTooltip() {
    if (microTooltipEl) return microTooltipEl;
    microTooltipEl = document.createElement("div");
    microTooltipEl.className = "cfa-micro-tooltip";
    microTooltipEl.setAttribute("role", "alert");
    microTooltipEl.hidden = true;
    document.body.appendChild(microTooltipEl);
    return microTooltipEl;
  }

  function positionMicroTooltip(fieldEl) {
    const tip = ensureMicroTooltip();
    const r = fieldEl.getBoundingClientRect();
    tip.style.left = `${Math.max(8, r.left)}px`;
    tip.style.top = `${r.bottom + 6}px`;
  }

  function showMicroTooltip(fieldEl, text) {
    const tip = ensureMicroTooltip();
    if (!text) {
      tip.hidden = true;
      return;
    }
    tip.textContent = text.replace(/^•\s*/gm, "").split("\n")[0].slice(0, 120);
    positionMicroTooltip(fieldEl);
    tip.hidden = false;
  }

  function hideMicroTooltip() {
    if (microTooltipEl) microTooltipEl.hidden = true;
  }

  function clearFieldHighlightClasses(el) {
    if (!el) return;
    el.classList.remove("cfa-field--focus", "cfa-field--invalid", "cfa-field--typo-fixed");
  }

  function clearAllFieldHighlights() {
    document.querySelectorAll(".cfa-field--focus, .cfa-field--invalid, .cfa-field--typo-fixed").forEach(clearFieldHighlightClasses);
    hideMicroTooltip();
  }

  function flashTypoCorrected(fieldEl) {
    fieldEl.classList.remove("cfa-field--invalid");
    fieldEl.classList.add("cfa-field--typo-fixed");
    hideMicroTooltip();
    if (typoFlashTimer) clearTimeout(typoFlashTimer);
    typoFlashTimer = window.setTimeout(() => {
      fieldEl.classList.remove("cfa-field--typo-fixed");
      typoFlashTimer = null;
    }, 1400);
  }

  function applyVisualState(fieldEl, result) {
    const hasInvalid = (result.messages && result.messages.length > 0) || !!result.typo;
    fieldEl.classList.toggle("cfa-field--invalid", hasInvalid && fieldEl === focusedFieldEl);
    if (hasInvalid && fieldEl === focusedFieldEl) {
      const tipText = result.typo || (result.messages && result.messages[0]) || "";
      showMicroTooltip(fieldEl, tipText);
    } else if (fieldEl !== focusedFieldEl) {
      fieldEl.classList.remove("cfa-field--invalid");
    }
  }

  function pickFocusVoiceMessage(api, result, contextText) {
    if (result.typo) return result.typo;
    if (result.messages && result.messages.length) return result.messages[0];
    if (api) {
      const custom = api.getSpeakText();
      if (custom && custom !== "Loading…") return custom.replace(/^•\s*/gm, "").split("\n")[0];
    }
    if (contextText) return contextText.split(".")[0];
    return "";
  }

  function formatValidationHtml(messages, typo) {
    const parts = [];
    if (typo) parts.push(typo);
    parts.push(...messages);
    if (!parts.length) return "";
    return parts.map((m) => `• ${m}`).join("\n");
  }

  function createWidget(fieldEl, contextText) {
    const root = document.createElement("span");
    root.className = "cfa-root";
    root.setAttribute("data-cfa-for", fieldEl.id || fieldEl.name || "");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cfa-help-btn";
    btn.textContent = "?";
    btn.setAttribute("aria-label", "Explain this field in simple words");
    btn.setAttribute("aria-expanded", "false");

    const panel = document.createElement("div");
    panel.className = "cfa-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Simplified explanation");
    panel.hidden = true;

    const orig = document.createElement("p");
    orig.className = "cfa-original";
    const simple = document.createElement("p");
    simple.className = "cfa-simple";
    simple.setAttribute("tabindex", "-1");
    const validation = document.createElement("p");
    validation.className = "cfa-validation";
    validation.hidden = true;
    const meta = document.createElement("p");
    meta.className = "cfa-meta";

    const row = document.createElement("div");
    row.className = "cfa-actions";

    const speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.className = "cfa-speak-btn";
    speakBtn.textContent = "Read aloud";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "cfa-close-btn";
    closeBtn.textContent = "Close";

    row.appendChild(speakBtn);
    row.appendChild(closeBtn);
    panel.appendChild(orig);
    panel.appendChild(simple);
    panel.appendChild(validation);
    panel.appendChild(meta);
    panel.appendChild(row);
    root.appendChild(btn);
    root.appendChild(panel);

    let loaded = false;
    let lastSimplified = "";
    let lastValidationText = "";

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) btn.classList.toggle("cfa-help-btn--alert", validation.hidden === false);
    }

    function applyValidationToPanel(result) {
      const text = formatValidationHtml(result.messages, result.typo);
      lastValidationText = text;
      if (text) {
        validation.textContent = text;
        validation.hidden = false;
        btn.classList.add("cfa-help-btn--alert");
      } else {
        validation.textContent = "";
        validation.hidden = true;
        btn.classList.remove("cfa-help-btn--alert");
      }
    }

    function refreshValidation() {
      const result = runFieldValidation(fieldEl, contextText);
      applyValidationToPanel(result);
      if (fieldEl === focusedFieldEl) applyVisualState(fieldEl, result);
      return result;
    }

    async function loadPanel() {
      orig.textContent = contextText
        ? `Original: ${contextText}`
        : "Original: (no label found — using field name or placeholder.)";

      refreshValidation();

      simple.textContent = "Loading…";
      meta.textContent = "";
      const result = await fetchSimplified(contextText || fieldEl.name || "form field");
      lastSimplified = result.text;
      simple.textContent = result.text;
      meta.textContent =
        result.source === "local"
          ? "Source: offline fallback (start the backend for smarter text)."
          : `Source: ${result.source}`;
      loaded = true;
      recordFieldTypeMetric(fieldEl, contextText);
      if (window.CFAMetrics) window.CFAMetrics.bump("fieldsExplained");
    }

    btn.addEventListener("click", async () => {
      const willOpen = panel.hidden;
      if (willOpen) {
        refreshValidation();
        if (!loaded) await loadPanel();
      }
      setOpen(willOpen);
      if (willOpen) (validation.hidden ? simple : validation).focus();
    });

    closeBtn.addEventListener("click", () => setOpen(false));

    speakBtn.addEventListener("click", () => {
      const msg = lastValidationText || lastSimplified || simple.textContent || contextText;
      speakMultilingual(msg);
      if (window.CFAMetrics) window.CFAMetrics.bump("voiceAssistsTriggered");
    });

    fieldStateByEl.set(fieldEl, { lastValue: fieldEl.value != null ? String(fieldEl.value) : "" });

    const api = {
      root,
      contextText,
      refreshValidation,
      getSpeakText: () => lastValidationText || lastSimplified,
      preloadIfNeeded: async () => {
        if (!loaded) await loadPanel();
      },
    };
    widgetByField.set(fieldEl, api);

    return root;
  }

  function onFormFieldEvent(ev) {
    const el = ev.target;
    if (!isValidatableFormControl(el)) return;
    const api = widgetByField.get(el);
    if (!api) return;

    const ctx = extractFieldContext(el);
    const state = fieldStateByEl.get(el) || { lastValue: "" };
    const prevValue = state.lastValue;
    const nextValue = el.value != null ? String(el.value) : "";

    if (ev.type === "input" && detectTypoCorrection(prevValue, nextValue)) {
      flashTypoCorrected(el);
      if (window.CFAMetrics) window.CFAMetrics.bump("validationErrorsPrevented");
    }

    state.lastValue = nextValue;
    fieldStateByEl.set(el, state);

    const result = api.refreshValidation();
    if (el === focusedFieldEl) applyVisualState(el, result);

    if (ev.type === "blur") {
      const hasIssue = (result.messages && result.messages.length) || result.typo;
      if (hasIssue && window.CFAMetrics) {
        window.CFAMetrics.bump("validationErrorsPrevented");
      }
      if (hasIssue) recordFieldTypeMetric(el, ctx);
    }
  }

  function onFormFieldFocusIn(ev) {
    const el = ev.target;
    if (!isValidatableFormControl(el)) return;

    window.speechSynthesis.cancel();
    clearAllFieldHighlights();
    focusedFieldEl = el;
    el.classList.add("cfa-field--focus");

    const api = widgetByField.get(el);
    const ctx = extractFieldContext(el);
    const result = api ? api.refreshValidation() : runFieldValidation(el, ctx);
    applyVisualState(el, result);

    const speakLine = pickFocusVoiceMessage(api, result, ctx);
    if (speakLine) {
      speakMultilingual(speakLine);
      if (window.CFAMetrics) window.CFAMetrics.bump("voiceAssistsTriggered");
    }

    if (api) api.preloadIfNeeded();
  }

  function onFormFieldFocusOut(ev) {
    const el = ev.target;
    if (!isValidatableFormControl(el)) return;
    clearFieldHighlightClasses(el);
    if (focusedFieldEl === el) {
      focusedFieldEl = null;
      hideMicroTooltip();
    }
  }

  /**
   * Parses the DOM and returns a concise structural summary of the page.
   */
  function summarizeCurrentPage() {
    const headingCount = document.querySelectorAll("h1, h2, h3, h4, h5, h6").length;
    const forms = Array.from(document.querySelectorAll("form"));

    if (!forms.length) {
      const h = headingCount ? `${headingCount} heading${headingCount === 1 ? "" : "s"}` : "no major headings";
      return `This webpage has ${h} and no forms to fill.`;
    }

    const summaries = forms.map((form, index) => {
      const inputs = form.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])'
      );
      let textInputs = 0;
      let checkboxes = 0;
      let selects = 0;
      let textareas = 0;
      let hasPassword = false;

      inputs.forEach((inp) => {
        const t = (inp.getAttribute("type") || "text").toLowerCase();
        if (t === "checkbox") checkboxes += 1;
        else if (t === "password") hasPassword = true;
        else textInputs += 1;
      });

      textareas = form.querySelectorAll("textarea").length;
      selects = form.querySelectorAll("select").length;
      const actionButtons = form.querySelectorAll(
        'button[type="submit"], input[type="submit"], button:not([type="button"]):not([type="reset"])'
      ).length;

      const nearestHeading = (() => {
        let node = form.parentElement;
        while (node && node !== document.body) {
          const h = node.querySelector("h1, h2, h3, h4, h5, h6");
          if (h) return h.textContent.trim().slice(0, 60);
          node = node.parentElement;
        }
        const pageH1 = document.querySelector("h1");
        return pageH1 ? pageH1.textContent.trim().slice(0, 60) : "";
      })();

      let section = "a form";
      const labelBlob = `${nearestHeading} ${form.getAttribute("aria-label") || ""} ${form.id || ""}`.toLowerCase();
      if (hasPassword && textInputs <= 3) section = "a login section";
      else if (/register|sign\s*up|create\s*account/.test(labelBlob)) section = "a registration section";
      else if (/contact|enquiry|feedback/.test(labelBlob)) section = "a contact section";
      else if (nearestHeading) section = `a "${nearestHeading}" section`;

      const bits = [];
      const fields = textInputs + textareas + selects;
      if (fields) bits.push(`${fields} input field${fields === 1 ? "" : "s"}`);
      if (checkboxes) bits.push(`${checkboxes} checkbox${checkboxes === 1 ? "" : "es"}`);
      if (actionButtons) {
        const submit = form.querySelector('button[type="submit"], input[type="submit"], button');
        const btnLabel = submit && submit.textContent ? submit.textContent.trim().slice(0, 30) : "submit";
        bits.push(`1 ${btnLabel.toLowerCase() || "submit"} button`);
      }

      const formLabel = forms.length > 1 ? `Form ${index + 1}` : "This webpage";
      return `${formLabel} contains ${section} with ${bits.join(", ") || "no visible fields"}.`;
    });

    const headingNote =
      headingCount > 0 ? ` The page has ${headingCount} heading${headingCount === 1 ? "" : "s"}.` : "";

    return summaries.join(" ") + headingNote;
  }

  let pageSummaryUi = null;

  function showPageSummary(summaryText) {
    if (!pageSummaryUi) {
      const wrap = document.createElement("div");
      wrap.className = "cfa-page-summary";
      wrap.setAttribute("role", "status");

      const text = document.createElement("p");
      text.className = "cfa-page-summary-text";

      const close = document.createElement("button");
      close.type = "button";
      close.className = "cfa-page-summary-close";
      close.textContent = "Close";
      close.addEventListener("click", () => {
        wrap.hidden = true;
      });

      wrap.appendChild(text);
      wrap.appendChild(close);
      document.body.appendChild(wrap);
      pageSummaryUi = { wrap, text };
    }
    pageSummaryUi.text.textContent = summaryText;
    pageSummaryUi.wrap.hidden = false;
  }

  function ensurePageSummaryTrigger() {
    if (document.querySelector(".cfa-summarize-trigger")) return;
    if (!document.querySelector("form")) return;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "cfa-summarize-trigger";
    trigger.textContent = "Summarize page";
    trigger.setAttribute("aria-label", "Summarize forms on this page");
    trigger.addEventListener("click", () => {
      showPageSummary(summarizeCurrentPage());
      if (window.CFAMetrics) window.CFAMetrics.bump("pagesSummarized");
    });
    document.body.appendChild(trigger);
  }

  function attachToField(el) {
    if (el.getAttribute(ATTR) === "1") return;
    if (!el.isConnected) return;
    if (!el.closest("form")) return;
    if (!hasMeaningfulLabelOrPlaceholder(el)) return;

    el.setAttribute(ATTR, "1");
    const contextText = extractFieldContext(el);
    const widget = createWidget(el, contextText);

    if (el.parentElement) {
      el.insertAdjacentElement("afterend", widget);
    }
  }

  function scan() {
    document.querySelectorAll(FIELD_SELECTOR).forEach((el) => {
      if (el.disabled) return;
      attachToField(el);
    });
    ensurePageSummaryTrigger();
  }

  let scheduled = null;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = window.setTimeout(() => {
      scheduled = null;
      scan();
    }, 300);
  }

  function closeAllPanels() {
    document.querySelectorAll(".cfa-panel").forEach((p) => {
      if (!p.hidden) {
        p.hidden = true;
        const root = p.closest(".cfa-root");
        const b = root && root.querySelector(".cfa-help-btn");
        if (b) b.setAttribute("aria-expanded", "false");
      }
    });
  }

  function init() {
    scan();

    document.addEventListener("input", onFormFieldEvent, true);
    document.addEventListener("blur", onFormFieldEvent, true);
    document.addEventListener("focusin", onFormFieldFocusIn, true);
    document.addEventListener("focusout", onFormFieldFocusOut, true);

    window.addEventListener(
      "scroll",
      () => {
        if (focusedFieldEl && microTooltipEl && !microTooltipEl.hidden) {
          positionMicroTooltip(focusedFieldEl);
        }
      },
      true
    );

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeAllPanels();
    });

    const obs = new MutationObserver(scheduleScan);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.summarizeCurrentPage = summarizeCurrentPage;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
