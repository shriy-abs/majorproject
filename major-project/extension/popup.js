/**
 * Extension popup — language picker and link to analytics dashboard.
 */
const DEFAULT_BACKEND = "http://127.0.0.1:5000";
const VALID_LANGS = new Set(["EN", "HI", "KN"]);

function normalizeLang(value) {
  const v = (value || "EN").toUpperCase();
  return VALID_LANGS.has(v) ? v : "EN";
}

document.addEventListener("DOMContentLoaded", () => {
  const langSelect = document.getElementById("voiceLanguage");
  const dashboardLink = document.getElementById("openDashboard");

  chrome.storage.local.get({ voiceLanguage: "EN", backendUrl: DEFAULT_BACKEND }, (items) => {
    if (langSelect) langSelect.value = normalizeLang(items.voiceLanguage);
    const base = (items.backendUrl || DEFAULT_BACKEND).replace(/\/+$/, "");
    if (dashboardLink) {
      dashboardLink.href = `${base}/dashboard`;
    }
  });

  langSelect?.addEventListener("change", () => {
    chrome.storage.local.set({ voiceLanguage: normalizeLang(langSelect.value) });
  });
});
