const DEFAULT_URL = "http://127.0.0.1:5000";

function show(msg) {
  const el = document.getElementById("status");
  el.textContent = msg;
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("backendUrl");
  chrome.storage.local.get({ backendUrl: DEFAULT_URL }, (items) => {
    input.value = items.backendUrl || DEFAULT_URL;
  });

  document.getElementById("save").addEventListener("click", () => {
    let v = (input.value || "").trim().replace(/\/+$/, "");
    if (!v) v = DEFAULT_URL;
    chrome.storage.local.set({ backendUrl: v }, () => {
      show("Saved. Reload open tabs for the change to apply everywhere.");
    });
  });
});
