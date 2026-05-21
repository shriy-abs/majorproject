/**
 * Session analytics — persisted in chrome.storage.local for the popup dashboard.
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
  };

  function safeGet(cb) {
    try {
      chrome.storage.local.get(METRIC_DEFAULTS, cb);
    } catch (_) {
      cb(METRIC_DEFAULTS);
    }
  }

  function bump(key, delta = 1) {
    safeGet((items) => {
      const next = { [key]: (items[key] || 0) + delta };
      chrome.storage.local.set(next);
    });
  }

  function recordLatency(ms) {
    if (!Number.isFinite(ms) || ms < 0) return;
    safeGet((items) => {
      chrome.storage.local.set({
        totalLatency: (items.totalLatency || 0) + ms,
        responseCount: (items.responseCount || 0) + 1,
      });
    });
  }

  function recordFieldType(kind) {
    const key = kind || "other";
    safeGet((items) => {
      const map = { ...(items.fieldTypesProcessed || {}) };
      map[key] = (map[key] || 0) + 1;
      chrome.storage.local.set({ fieldTypesProcessed: map });
    });
  }

  window.CFAMetrics = {
    defaults: METRIC_DEFAULTS,
    bump,
    recordLatency,
    recordFieldType,
  };
})();
