/**
 * Cognitive Form Assist — content script
 * Detects fields, extracts labels/hints, fetches simplified text, shows help panel + optional TTS.
 */
(function () {
  const ATTR = "data-cfaAttached";
  const DEFAULT_BACKEND = "http://127.0.0.1:5000";
  const FIELD_SELECTOR =
    'form input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="search"]), form textarea, form select';

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

  /** True if the field has a real label or placeholder (not standalone/name-only). */
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

  /** Collect human-readable context for a form control */
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

  function localFallback(raw) {
    const t = (raw || "").trim();
    if (!t) return "Enter the value this field is asking for.";
    return `This field is asking for: ${t}. Use simple words and double-check before you submit.`;
  }

  async function fetchSimplified(text) {
    const base = await getBackendBase();
    try {
      const r = await fetch(`${base}/api/simplify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await r.json();
      if (data && data.ok && data.simplified) {
        return { text: data.simplified, source: data.source || "api" };
      }
    } catch (_) {
      /* offline / CORS / server down */
    }
    return { text: localFallback(text), source: "local" };
  }

  function speak(text) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch (_) {
      /* no TTS */
    }
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
    panel.appendChild(meta);
    panel.appendChild(row);
    root.appendChild(btn);
    root.appendChild(panel);

    let loaded = false;
    let lastSimplified = "";

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    async function loadPanel() {
      orig.textContent = contextText
        ? `Original: ${contextText}`
        : "Original: (no label found — using field name or placeholder.)";
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
    }

    btn.addEventListener("click", async () => {
      const willOpen = panel.hidden;
      if (willOpen && !loaded) await loadPanel();
      setOpen(willOpen);
      if (willOpen) simple.focus();
    });

    closeBtn.addEventListener("click", () => setOpen(false));

    speakBtn.addEventListener("click", () => {
      const msg = lastSimplified || simple.textContent || contextText;
      speak(msg);
    });

    return root;
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
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeAllPanels();
    });
    const obs = new MutationObserver(scheduleScan);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
