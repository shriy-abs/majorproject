/**
 * Exhibition popup — live session metrics + active-tab accessibility scorer.
 */
const METRIC_KEYS = [
  "fieldsExplained",
  "validationErrorsPrevented",
  "voiceAssistsTriggered",
  "pagesSummarized",
];

const METRIC_DEFAULTS = {
  fieldsExplained: 0,
  validationErrorsPrevented: 0,
  voiceAssistsTriggered: 0,
  pagesSummarized: 0,
  totalLatency: 0,
  responseCount: 0,
  fieldTypesProcessed: {},
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
let fieldsChart = null;

function formatAvgLatency(totalLatency, responseCount) {
  if (!responseCount) return "Avg response: —";
  const avg = totalLatency / responseCount;
  return `Avg response: ${avg < 1000 ? `${Math.round(avg)} ms` : `${(avg / 1000).toFixed(2)} s`}`;
}

function animateValue(el, next) {
  const prev = parseInt(el.textContent, 10) || 0;
  if (prev === next) {
    el.textContent = String(next);
    return;
  }
  const steps = 12;
  let i = 0;
  const tick = () => {
    i += 1;
    const v = Math.round(prev + ((next - prev) * i) / steps);
    el.textContent = String(v);
    if (i < steps) requestAnimationFrame(tick);
    else el.textContent = String(next);
  };
  requestAnimationFrame(tick);
}

function updateScorecards(data) {
  METRIC_KEYS.forEach((key) => {
    const el = document.getElementById(`val-${key}`);
    if (el) animateValue(el, data[key] || 0);
  });
  const latEl = document.getElementById("avgLatency");
  if (latEl) latEl.textContent = formatAvgLatency(data.totalLatency || 0, data.responseCount || 0);
}

function buildChartLabels(map) {
  const labels = Object.keys(map);
  if (!labels.length) return { labels: ["No data yet"], values: [1] };
  return {
    labels: labels.map((k) => k.charAt(0).toUpperCase() + k.slice(1)),
    values: labels.map((k) => map[k]),
  };
}

function renderFieldsChart(fieldTypesProcessed) {
  const canvas = document.getElementById("fieldsChart");
  if (!canvas || typeof Chart === "undefined") return;

  const { labels, values } = buildChartLabels(fieldTypesProcessed || {});

  if (fieldsChart) fieldsChart.destroy();

  fieldsChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Fields",
          data: values,
          backgroundColor: [
            "rgba(56, 189, 248, 0.85)",
            "rgba(129, 140, 248, 0.85)",
            "rgba(34, 197, 94, 0.85)",
            "rgba(245, 158, 11, 0.85)",
            "rgba(244, 114, 182, 0.85)",
            "rgba(148, 163, 184, 0.85)",
          ],
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: "#94a3b8", precision: 0 },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
        },
        y: {
          ticks: { color: "#e2e8f0", font: { size: 11, weight: "600" } },
          grid: { display: false },
        },
      },
    },
  });
}

function tierFromScore(score) {
  if (score >= 80) return { tier: "good", label: "Good" };
  if (score >= 50) return { tier: "moderate", label: "Moderate" };
  return { tier: "bad", label: "Needs Improvement" };
}

function setAccessibilityUI(result) {
  const wrap = document.querySelector(".score-ring-wrap");
  const valueEl = document.getElementById("accessScoreValue");
  const tierEl = document.getElementById("accessScoreTier");
  const ringFill = document.getElementById("scoreRingFill");
  const breakdown = document.getElementById("scoreBreakdown");

  if (!result || result.error) {
    wrap.dataset.tier = "unknown";
    valueEl.textContent = "—";
    tierEl.textContent = result?.error || "Unavailable";
    ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    breakdown.innerHTML = "<li>Open a normal webpage with a form to score it.</li>";
    return;
  }

  const score = Math.max(0, Math.min(100, result.score));
  const { tier, label } = tierFromScore(score);

  wrap.dataset.tier = tier;
  valueEl.textContent = String(score);
  tierEl.textContent = label;

  const offset = RING_CIRCUMFERENCE * (1 - score / 100);
  ringFill.style.strokeDashoffset = String(offset);

  breakdown.innerHTML = (result.details || [])
    .map((d) => `<li>${d}</li>`)
    .join("") || "<li>No forms detected on this page.</li>";
}

/**
 * Injected into the active tab — must be self-contained (no closure refs).
 */
function scorePageAccessibilityInTab() {
  const INPUT_SEL =
    'form input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])';
  const FIELD_SEL = `${INPUT_SEL}, form textarea, form select`;

  function escapeId(id) {
    return id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function hasLabelOrAria(el) {
    const aria = (el.getAttribute("aria-label") || "").trim();
    if (aria) return true;

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
      if (chunk) return true;
    }

    if (el.id) {
      const lab = document.querySelector(`label[for="${escapeId(el.id)}"]`);
      if (lab && lab.textContent.trim()) return true;
    }

    let walk = el.parentElement;
    for (let i = 0; i < 4 && walk; i += 1) {
      const prev = walk.querySelector(":scope > label");
      if (prev && walk.contains(el) && prev.textContent.trim()) return true;
      walk = walk.parentElement;
    }
    return false;
  }

  function formHasSubmit(form) {
    return !!form.querySelector(
      'button[type="submit"], input[type="submit"], button:not([type="button"]):not([type="reset"])'
    );
  }

  let score = 100;
  const details = [];
  let missingLabel = 0;
  let missingPlaceholder = 0;
  let formsNoSubmit = 0;

  const fields = document.querySelectorAll(FIELD_SEL);
  fields.forEach((el) => {
    if (el.disabled) return;
    const tag = el.tagName;
    if (!hasLabelOrAria(el)) {
      missingLabel += 1;
      score -= 5;
    }
    if (tag === "INPUT" || tag === "TEXTAREA") {
      const ph = (el.getAttribute("placeholder") || "").trim();
      if (!ph) {
        missingPlaceholder += 1;
        score -= 5;
      }
    }
  });

  document.querySelectorAll("form").forEach((form) => {
    const hasFields = form.querySelector(FIELD_SEL);
    if (hasFields && !formHasSubmit(form)) {
      formsNoSubmit += 1;
      score -= 10;
    }
  });

  if (missingLabel) {
    details.push(`<strong>−${missingLabel * 5} pts:</strong> ${missingLabel} field(s) missing label or aria-label`);
  }
  if (missingPlaceholder) {
    details.push(
      `<strong>−${missingPlaceholder * 5} pts:</strong> ${missingPlaceholder} input(s) missing placeholder`
    );
  }
  if (formsNoSubmit) {
    details.push(`<strong>−${formsNoSubmit * 10} pts:</strong> ${formsNoSubmit} form(s) without submit button`);
  }
  if (!fields.length && !document.querySelector("form")) {
    return { score: 0, error: "No forms on page", details: [] };
  }
  if (!details.length) {
    details.push("All checked fields have labels and placeholders; forms include submit actions.");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, details, fieldCount: fields.length };
}

async function runAccessibilityScorer() {
  const tabHint = document.getElementById("tabHint");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setAccessibilityUI({ error: "No active tab" });
      return;
    }
    if (tabHint) {
      const title = (tab.title || "Active tab").slice(0, 40);
      tabHint.textContent = title;
      tabHint.title = tab.url || "";
    }

    if (tab.url && /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
      setAccessibilityUI({ error: "Cannot score browser pages" });
      return;
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scorePageAccessibilityInTab,
    });
    setAccessibilityUI(result);
  } catch (e) {
    setAccessibilityUI({ error: "Reload tab & extension" });
  }
}

function loadDashboard() {
  chrome.storage.local.get(METRIC_DEFAULTS, (data) => {
    updateScorecards(data);
    renderFieldsChart(data.fieldTypesProcessed);
  });
  runAccessibilityScorer();
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();

  const langSelect = document.getElementById("voiceLanguage");
  chrome.storage.local.get({ voiceLanguage: "EN" }, (items) => {
    if (langSelect) langSelect.value = items.voiceLanguage === "HI" ? "HI" : "EN";
  });
  langSelect?.addEventListener("change", () => {
    const voiceLanguage = langSelect.value === "HI" ? "HI" : "EN";
    chrome.storage.local.set({ voiceLanguage });
  });

  document.getElementById("refreshBtn")?.addEventListener("click", loadDashboard);

  document.getElementById("resetMetrics")?.addEventListener("click", () => {
    chrome.storage.local.set(METRIC_DEFAULTS, loadDashboard);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const touched = METRIC_KEYS.some((k) => changes[k]) || changes.fieldTypesProcessed || changes.totalLatency;
    if (touched) loadDashboard();
  });
});
