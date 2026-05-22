/**
 * Session analytics — local storage + sync to backend dashboard.
 */
(function () {
  const STORAGE_KEYS = [
    "fieldsExplained",
    "validationErrorsPrevented",
    "voiceAssistsTriggered",
    "pagesSummarized",
    "totalLatency",
    "responseCount",
    "fieldTypesProcessed",
    "languageBreakdown",
    "simplifySourceBreakdown",
    "events",
  ];

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

  let syncTimer = null;

  function safeGet(cb) {
    try {
      chrome.storage.local.get(STORAGE_KEYS, (items) => {
        cb({ ...METRIC_DEFAULTS, ...items });
      });
    } catch (_) {
      cb({ ...METRIC_DEFAULTS });
    }
  }

  function safeSet(partial, done) {
    try {
      chrome.storage.local.set(partial, done);
    } catch (_) {
      if (done) done();
    }
  }

  function appendEvent(items, type, detail) {
    const events = Array.isArray(items.events) ? [...items.events] : [];
    events.push({ t: Date.now() / 1000, type, detail: detail || "" });
    if (events.length > 200) events.splice(0, events.length - 200);
    return events;
  }

  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncToBackend, 800);
  }

  function syncToBackend() {
    if (!chrome.runtime?.sendMessage) return;

    safeGet((items) => {
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
      chrome.runtime.sendMessage({ type: "cfaMetricsSync", payload }, () => {
        void chrome.runtime.lastError;
      });
    });
  }

  function bump(key, delta = 1) {
    safeGet((items) => {
      safeSet(
        {
          [key]: (items[key] || 0) + delta,
          events: appendEvent(items, key),
        },
        scheduleSync
      );
    });
  }

  function recordLatency(ms) {
    if (!Number.isFinite(ms) || ms < 0) return;
    safeGet((items) => {
      safeSet(
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
      safeSet(
        {
          fieldTypesProcessed: map,
          events: appendEvent(items, "fieldType", key),
        },
        scheduleSync
      );
    });
  }

  function recordLanguage(langCode) {
    const key = langCode === "HI" ? "HI" : langCode === "KN" ? "KN" : "EN";
    safeGet((items) => {
      const map = { ...(items.languageBreakdown || { EN: 0, HI: 0, KN: 0 }) };
      map[key] = (map[key] || 0) + 1;
      safeSet({ languageBreakdown: map }, scheduleSync);
    });
  }

  function recordSimplifySource(source) {
    const key = source === "llm" ? "llm" : source === "local" ? "local" : "rules";
    safeGet((items) => {
      const map = { ...(items.simplifySourceBreakdown || { llm: 0, rules: 0, local: 0 }) };
      map[key] = (map[key] || 0) + 1;
      safeSet({ simplifySourceBreakdown: map }, scheduleSync);
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
