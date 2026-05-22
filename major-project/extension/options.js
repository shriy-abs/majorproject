const DEFAULT_URL = "http://127.0.0.1:5000";

function normalizeBackendBase(url) {
  const raw = (url || DEFAULT_URL).trim();
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch (_) {
    return DEFAULT_URL;
  }
}

function show(msg, isError) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "#b91c1c" : "#166534";
}

async function pingBackend(base) {
  try {
    const r = await fetch(`${base}/api/health`);
    const data = await r.json().catch(() => ({}));
    return r.ok && data.ok;
  } catch (_) {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("backendUrl");
  chrome.storage.local.get({ backendUrl: DEFAULT_URL }, async (items) => {
    const base = normalizeBackendBase(items.backendUrl || DEFAULT_URL);
    input.value = base;
    const dash = document.getElementById("dashboardLink");
    if (dash) dash.href = `${base}/dashboard`;

    const ok = await pingBackend(base);
    show(
      ok
        ? `Backend reachable at ${base}`
        : `Cannot reach ${base} — start with: cd major-project/backend && python app.py`,
      !ok
    );
  });

  document.getElementById("save").addEventListener("click", async () => {
    const base = normalizeBackendBase(input.value || DEFAULT_URL);
    input.value = base;

    chrome.storage.local.set({ backendUrl: base }, async () => {
      const dash = document.getElementById("dashboardLink");
      if (dash) dash.href = `${base}/dashboard`;

      const ok = await pingBackend(base);
      if (ok) {
        show(`Saved ${base}. Reload form tabs, then try the ? button again.`, false);
      } else {
        show(
          `Saved ${base}, but health check failed. Run: python app.py in major-project/backend`,
          true
        );
      }
    });
  });
});
