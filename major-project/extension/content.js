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
  const translationCache = new Map();
  const panelReloadRegistry = [];

  const VALID_LANGS = new Set(["EN", "HI", "KN"]);

  function normalizeBackendBase(url) {
    const raw = (url || DEFAULT_BACKEND).trim();
    try {
      const u = new URL(raw);
      return `${u.protocol}//${u.host}`;
    } catch (_) {
      return DEFAULT_BACKEND;
    }
  }

  async function getBackendBase() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get({ backendUrl: DEFAULT_BACKEND }, (items) => {
          resolve(normalizeBackendBase(items.backendUrl || DEFAULT_BACKEND));
        });
      } catch (_) {
        resolve(DEFAULT_BACKEND);
      }
    });
  }

  async function backendPostDirect(path, body) {
    const base = await getBackendBase();
    try {
      const r = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data && data.ok) return { ok: true, data };
      return {
        ok: false,
        error: (data && data.error) || `HTTP ${r.status} from ${base}${path}`,
      };
    } catch (e) {
      return { ok: false, error: `Cannot reach ${base}: ${e.message || e}` };
    }
  }

  function backendPostViaWorker(path, body) {
    return new Promise((resolve) => {
      if (!chrome.runtime?.sendMessage) {
        resolve({ ok: false, error: "extension runtime unavailable" });
        return;
      }
      chrome.runtime.sendMessage({ type: "cfaApi", path, body }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: "empty response from service worker" });
      });
    });
  }

  async function backendPost(path, body) {
    const viaWorker = await backendPostViaWorker(path, body);
    if (viaWorker.ok && viaWorker.data) return viaWorker;
    const viaDirect = await backendPostDirect(path, body);
    if (viaDirect.ok) return viaDirect;
    return {
      ok: false,
      error: viaDirect.error || viaWorker.error || "backend unreachable",
    };
  }

  function normalizeLang(value) {
    const v = (value || "EN").toUpperCase();
    return VALID_LANGS.has(v) ? v : "EN";
  }

  function langToApiCode(lang) {
    if (lang === "HI") return "hi";
    if (lang === "KN") return "kn";
    return "en";
  }

  chrome.storage.local.get({ voiceLanguage: "EN" }, (items) => {
    voiceLanguage = normalizeLang(items.voiceLanguage);
    if (window.CFAMetrics) window.CFAMetrics.recordLanguage(voiceLanguage);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.voiceLanguage) {
      voiceLanguage = normalizeLang(changes.voiceLanguage.newValue);
      translationCache.clear();
      if (window.CFAMetrics) window.CFAMetrics.recordLanguage(voiceLanguage);
      panelReloadRegistry.forEach((reload) => {
        try {
          reload();
        } catch (_) {
          /* ignore */
        }
      });
      if (focusedFieldEl) {
        const api = widgetByField.get(focusedFieldEl);
        const ctx = extractFieldContext(focusedFieldEl);
        const result = api ? api.refreshValidation() : runFieldValidation(focusedFieldEl, ctx);
        applyVisualState(focusedFieldEl, result);
      }
    }
  });

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
    const en = !t
      ? "Enter the value this field is asking for."
      : `This field is asking for: ${t}. Use simple words and double-check before you submit.`;
    if (voiceLanguage === "EN") return en;
    const voiced = translateForVoice(en);
    return voiced !== en ? voiced : en;
  }

  function recordFieldTypeMetric(fieldEl, contextText) {
    const kind = detectFieldKind(fieldEl, contextText);
    const type = (fieldEl.getAttribute("type") || fieldEl.tagName || "text").toLowerCase();
    const key = kind || (type === "textarea" ? "textarea" : type === "select-one" || fieldEl.tagName === "SELECT" ? "select" : type);
    if (window.CFAMetrics) window.CFAMetrics.recordFieldType(key);
  }

  async function fetchTranslated(text) {
    const key = `${voiceLanguage}:${text}`;
    if (translationCache.has(key)) return translationCache.get(key);

    const lang = langToApiCode(voiceLanguage);
    if (lang === "en") return text;

    const res = await backendPost("/api/translate", { text, lang });
    const data = res.ok ? res.data : null;
    if (data && data.ok && data.translated) {
      translationCache.set(key, data.translated);
      return data.translated;
    }

    const voiced = translateForVoice(text);
    if (voiced !== text) {
      translationCache.set(key, voiced);
      return voiced;
    }
    return null;
  }

  async function fetchSimplified(text) {
    const t0 = performance.now();
    const lang = langToApiCode(voiceLanguage);

    const res = await backendPost("/api/simplify", { text, lang });
    const ms = performance.now() - t0;
    if (window.CFAMetrics) window.CFAMetrics.recordLatency(ms);

    const data = res.ok ? res.data : null;
    if (data && data.ok && data.simplified) {
      const source = data.source || "api";
      if (window.CFAMetrics) window.CFAMetrics.recordSimplifySource(source);
      return { text: data.simplified, source };
    }

    const backendError = res.error || (data && data.error) || null;
    const fallback = localFallback(text);
    if (voiceLanguage !== "EN") {
      const translated = await fetchTranslated(fallback);
      if (translated) {
        if (window.CFAMetrics) window.CFAMetrics.recordSimplifySource("local");
        return { text: translated, source: "local", error: backendError };
      }
    }
    if (window.CFAMetrics) window.CFAMetrics.recordSimplifySource("local");
    return { text: fallback, source: "local", error: backendError };
  }

  function translateForVoice(text) {
    if (!text || voiceLanguage === "EN") return text;
    if (voiceLanguage === "HI" && window.CFAVoiceHI) return window.CFAVoiceHI.translate(text);
    if (voiceLanguage === "KN" && window.CFAVoiceKN) return window.CFAVoiceKN.translate(text);
    return text;
  }

  async function translateForDisplay(text) {
    if (!text || voiceLanguage === "EN") return text;
    const voice = translateForVoice(text);
    if (voice !== text) return voice;
    const api = await fetchTranslated(text);
    return api || text;
  }

  function pickVoiceForLang(langCode) {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const prefix = langCode.split("-")[0].toLowerCase();
    return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix)) || null;
  }

  function ttsLangCode() {
    if (voiceLanguage === "HI") return "hi-IN";
    if (voiceLanguage === "KN") return "kn-IN";
    return "en-US";
  }

  function hasIndicScript(text) {
    return /[\u0900-\u097F\u0C80-\u0CFF]/.test(text || "");
  }

  /** Strip punctuation that English TTS reads as isolated "dot" sounds. */
  function prepareTextForTts(text) {
    return (text || "")
      .replace(/\u0964/g, ", ")
      .replace(/[।]/g, ", ")
      .replace(/^•\s*/gm, "")
      .replace(/\s*[.:]\s*/g, ", ")
      .replace(/,(\s*,)+/g, ",")
      .replace(/\s+/g, " ")
      .trim();
  }

  function englishVoiceFallback(contextText) {
    const ctx = (contextText || "").trim();
    if (!ctx) return "";
    const first = ctx.split(/[.;]/)[0].trim();
    return translateForVoice(first) !== first ? translateForVoice(first) : first;
  }

  function speakMultilingual(text, contextText) {
    const line = (text || "").trim();
    if (!line) return;

    const runSpeak = () => {
      try {
        window.speechSynthesis.cancel();

        let langCode = ttsLangCode();
        let voice = pickVoiceForLang(langCode);
        let spoken = line;

        // Kannada/Hindi script with no native voice: English TTS only reads dots — use label context.
        if (voiceLanguage !== "EN" && hasIndicScript(line) && !voice) {
          const fallback = englishVoiceFallback(contextText) || translateForVoice(line);
          if (fallback && !hasIndicScript(fallback)) {
            spoken = prepareTextForTts(fallback);
            langCode = "en-IN";
            voice = pickVoiceForLang(langCode) || pickVoiceForLang("en-US");
          } else {
            spoken = prepareTextForTts(line);
          }
        } else if (voiceLanguage !== "EN") {
          spoken = line.replace(/\u0964/g, ", ").replace(/[।]/g, ", ");
          const voiced = translateForVoice(line);
          if (voiced !== line && !hasIndicScript(voiced)) {
            spoken = prepareTextForTts(voiced);
            langCode = "en-IN";
            voice = pickVoiceForLang(langCode) || pickVoiceForLang("en-US");
          }
        } else {
          spoken = prepareTextForTts(line);
        }

        if (!spoken) return;

        const u = new SpeechSynthesisUtterance(spoken);
        u.lang = langCode;
        u.rate = 0.9;
        if (voice) u.voice = voice;
        window.speechSynthesis.speak(u);
      } catch (_) {
        /* no TTS */
      }
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      runSpeak();
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      runSpeak();
    };
    window.speechSynthesis.getVoices();
    setTimeout(runSpeak, 250);
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
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
    const line = text.replace(/^•\s*/gm, "").split("\n")[0].slice(0, 120);
    tip.textContent = line;
    positionMicroTooltip(fieldEl);
    tip.hidden = false;
    if (voiceLanguage !== "EN") {
      translateForDisplay(line).then((translated) => {
        if (translated && translated !== line && fieldEl === focusedFieldEl) {
          tip.textContent = translated.slice(0, 120);
        }
      });
    }
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

  function labelVoiceHint(contextText) {
    const blob = (contextText || "").toLowerCase();
    if (/\bfather\b|\bpaternal\b|\bdad\b/.test(blob) && /\bname\b/.test(blob)) {
      if (voiceLanguage === "HI") return "अपने पिता का पूरा नाम लिखें।";
      if (voiceLanguage === "KN") return "ನಿಮ್ಮ ತಂದೆಯ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.";
      return "Enter your father's full name.";
    }
    if (/\bmother\b|\bmaternal\b/.test(blob) && /\bname\b/.test(blob)) {
      if (voiceLanguage === "HI") return "अपनी माता का पूरा नाम लिखें।";
      if (voiceLanguage === "KN") return "ನಿಮ್ಮ ತಾಯಿಯ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.";
      return "Enter your mother's full name.";
    }
    return null;
  }

  function pickFocusVoiceMessage(api, result, contextText, fieldEl) {
    if (result.typo) return result.typo;
    if (result.messages && result.messages.length) return result.messages[0];
    if (api) {
      const custom = api.getSpeakText();
      if (custom && custom !== "Loading…") return custom.replace(/^•\s*/gm, "").split("\n")[0];
    }
    const labelHint = labelVoiceHint(contextText);
    if (labelHint) return labelHint;
    if (voiceLanguage !== "EN" && fieldEl) {
      const kind = detectFieldKind(fieldEl, contextText);
      const voiceMod = voiceLanguage === "KN" ? window.CFAVoiceKN : window.CFAVoiceHI;
      if (voiceMod) {
        const hint = voiceMod.fieldKindHint(kind);
        if (hint) return hint;
      }
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
    let loadedForLang = "";
    let lastSimplified = "";
    let lastValidationText = "";

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) btn.classList.toggle("cfa-help-btn--alert", validation.hidden === false);
    }

    async function applyValidationToPanel(result) {
      const text = formatValidationHtml(result.messages, result.typo);
      lastValidationText = text;
      if (text) {
        validation.textContent = text;
        validation.hidden = false;
        btn.classList.add("cfa-help-btn--alert");
        if (voiceLanguage !== "EN") {
          const lines = text.split("\n").filter(Boolean);
          const translated = await Promise.all(
            lines.map(async (line) => {
              const plain = line.replace(/^•\s*/, "");
              const t = await translateForDisplay(plain);
              return `• ${t}`;
            })
          );
          validation.textContent = translated.join("\n");
          lastValidationText = validation.textContent;
        }
      } else {
        validation.textContent = "";
        validation.hidden = true;
        btn.classList.remove("cfa-help-btn--alert");
      }
    }

    function refreshValidation() {
      const result = runFieldValidation(fieldEl, contextText);
      void applyValidationToPanel(result);
      if (fieldEl === focusedFieldEl) applyVisualState(fieldEl, result);
      return result;
    }

    async function loadPanel() {
      const langAtStart = voiceLanguage;
      orig.textContent = contextText
        ? `Original: ${contextText}`
        : "Original: (no label found — using field name or placeholder.)";

      refreshValidation();

      simple.textContent = "Loading…";
      meta.textContent = "";
      const result = await fetchSimplified(contextText || fieldEl.name || "form field");
      if (langAtStart !== voiceLanguage) return;

      lastSimplified = result.text;
      simple.textContent = result.text;
      if (result.source === "local") {
        meta.textContent = result.error
          ? `Source: offline — ${result.error}. Reload the extension, then check Settings → Backend URL is http://127.0.0.1:5000`
          : "Source: offline fallback (could not reach backend API).";
      } else {
        meta.textContent = `Source: ${result.source}`;
      }
      loaded = true;
      loadedForLang = voiceLanguage;
      recordFieldTypeMetric(fieldEl, contextText);
      if (window.CFAMetrics) window.CFAMetrics.bump("fieldsExplained");
    }

    async function reloadForLanguage() {
      loaded = false;
      loadedForLang = "";
      lastSimplified = "";
      refreshValidation();
      if (!panel.hidden) {
        await loadPanel();
      } else {
        simple.textContent = "";
        meta.textContent = "";
      }
    }

    panelReloadRegistry.push(reloadForLanguage);

    btn.addEventListener("click", async () => {
      const willOpen = panel.hidden;
      if (willOpen) {
        refreshValidation();
        const needsLoad = !loaded || loadedForLang !== voiceLanguage;
        if (needsLoad) await loadPanel();
      }
      setOpen(willOpen);
      if (willOpen) (validation.hidden ? simple : validation).focus();
    });

    closeBtn.addEventListener("click", () => setOpen(false));

    speakBtn.addEventListener("click", () => {
      const msg = lastValidationText || lastSimplified || simple.textContent || contextText;
      speakMultilingual(msg, contextText);
      if (window.CFAMetrics) window.CFAMetrics.bump("voiceAssistsTriggered");
    });

    fieldStateByEl.set(fieldEl, { lastValue: fieldEl.value != null ? String(fieldEl.value) : "" });

    const api = {
      root,
      contextText,
      refreshValidation,
      getSpeakText: () => lastValidationText || lastSimplified,
      preloadIfNeeded: async () => {
        if (!loaded || loadedForLang !== voiceLanguage) await loadPanel();
      },
      reloadForLanguage,
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

    const speakLine = pickFocusVoiceMessage(api, result, ctx, el);
    if (speakLine) {
      speakMultilingual(speakLine, ctx);
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
    if (window.CFAMetrics) window.CFAMetrics.syncToBackend();

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
