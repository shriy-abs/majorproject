/**
 * Session analytics — local storage + sync to backend dashboard.
 */
(function () {
  const METRIC_DEFAULTS = {
    fieldsExplained: 0,
    validationErrorsPrevented: 0,
    voiceAssistsTriggered: 0,
    pagesSummarized: 0,
    totalLatency: 0,
    responseCount: 0,
    fieldTypesProcessed: {},
    languageBreakdown: { EN: 0, HI: 0, KN: 0 },
    simplifySourceBreakdown: { llm: 0, rules: 0, local: 0 },
    events: [],
  };

  const DEFAULT_BACKEND = "http://127.0.0.1:5000";
  let syncTimer = null;

  function safeGet(cb) {
    try {
      chrome.storage.local.get(METRIC_DEFAULTS, cb);
    } catch (_) {
      cb(METRIC_DEFAULTS);
    }
  }

  function getBackendBase(cb) {
    try {
      chrome.storage.local.get({ backendUrl: DEFAULT_BACKEND }, (items) => {
        cb((items.backendUrl || DEFAULT_BACKEND).replace(/\/+$/, ""));
      });
    } catch (_) {
      cb(DEFAULT_BACKEND);
    }
  }

  function appendEvent(type, detail) {
    safeGet((items) => {
      const events = Array.isArray(items.events) ? [...items.events] : [];
      events.push({ t: Date.now() / 1000, type, detail: detail || "" });
      if (events.length > 200) events.splice(0, events.length - 200);
      chrome.storage.local.set({ events });
    });
  }

  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncToBackend, 800);
  }

  function syncToBackend() {
    safeGet((items) => {
      getBackendBase((base) => {
        const payload = {
          fieldsExplained: items.fieldsExplained || 0,
          validationErrorsPrevented: items.validationErrorsPrevented || 0,
          voiceAssistsTriggered: items.voiceAssistsTriggered || 0,
          pagesSummarized: items.pagesSummarized || 0,
          totalLatency: items.totalLatency || 0,
          responseCount: items.responseCount || 0,
          fieldTypesProcessed: items.fieldTypesProcessed || {},
          languageBreakdown: items.languageBreakdown || { EN: 0, HI: 0, KN: 0 },
          simplifySourceBreakdown: items.simplifySourceBreakdown || { llm: 0, rules: 0, local: 0 },
          events: items.events || [],
        };
        fetch(`${base}/api/metrics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      });
    });
  }

  function bump(key, delta = 1) {
    safeGet((items) => {
      const next = { [key]: (items[key] || 0) + delta };
      chrome.storage.local.set(next, scheduleSync);
      appendEvent(key);
    });
  }

  function recordLatency(ms) {
    if (!Number.isFinite(ms) || ms < 0) return;
    safeGet((items) => {
      chrome.storage.local.set(
        {
          totalLatency: (items.totalLatency || 0) + ms,
          responseCount: (items.responseCount || 0) + 1,
        },
        scheduleSync
      );
    });
  }

  function recordFieldType(kind) {
    const key = kind || "other";
    safeGet((items) => {
      const map = { ...(items.fieldTypesProcessed || {}) };
      map[key] = (map[key] || 0) + 1;
      chrome.storage.local.set({ fieldTypesProcessed: map }, scheduleSync);
      appendEvent("fieldType", key);
    });
  }

  function recordLanguage(langCode) {
    const key = langCode === "HI" ? "HI" : langCode === "KN" ? "KN" : "EN";
    safeGet((items) => {
      const map = { ...(items.languageBreakdown || { EN: 0, HI: 0, KN: 0 }) };
      map[key] = (map[key] || 0) + 1;
      chrome.storage.local.set({ languageBreakdown: map }, scheduleSync);
    });
  }

  function recordSimplifySource(source) {
    const key = source === "llm" ? "llm" : source === "local" ? "local" : "rules";
    safeGet((items) => {
      const map = { ...(items.simplifySourceBreakdown || { llm: 0, rules: 0, local: 0 }) };
      map[key] = (map[key] || 0) + 1;
      chrome.storage.local.set({ simplifySourceBreakdown: map }, scheduleSync);
    });
  }

  window.CFAMetrics = {
    defaults: METRIC_DEFAULTS,
    bump,
    recordLatency,
    recordFieldType,
    recordLanguage,
    recordSimplifySource,
    syncToBackend,
  };
})();
