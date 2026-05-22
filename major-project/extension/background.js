/**
 * Service worker — proxies backend API calls so they work on all pages (including HTTPS).
 */
const DEFAULT_BACKEND = "http://127.0.0.1:5000";

/** Keep only scheme + host so /dashboard in settings does not break API paths. */
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
  const items = await chrome.storage.local.get({ backendUrl: DEFAULT_BACKEND });
  return normalizeBackendBase(items.backendUrl || DEFAULT_BACKEND);
}

async function postJson(path, body) {
  const base = await getBackendBase();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === "cfaApi") {
    postJson(message.path, message.body || {})
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true;
  }

  if (message.type === "cfaMetricsSync") {
    postJson("/api/metrics", message.payload || {})
      .then((data) => sendResponse({ ok: true, data }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return false;
});
