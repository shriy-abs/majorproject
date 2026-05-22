/**
 * Standalone analytics dashboard — reads metrics from Flask backend.
 */
const API_BASE = window.location.origin;
const METRIC_KEYS = [
  "fieldsExplained",
  "validationErrorsPrevented",
  "voiceAssistsTriggered",
  "pagesSummarized",
];

const charts = {};

function formatAvgLatency(total, count) {
  if (!count) return "—";
  const avg = total / count;
  return avg < 1000 ? `${Math.round(avg)} ms` : `${(avg / 1000).toFixed(2)} s`;
}

function setConnectionStatus(ok, msg) {
  const el = document.getElementById("connectionStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = `status-pill ${ok ? "status-pill--ok" : "status-pill--bad"}`;
}

function updateCounters(m) {
  METRIC_KEYS.forEach((key) => {
    const el = document.getElementById(`val-${key}`);
    if (el) el.textContent = String(m[key] || 0);
  });
  const lat = document.getElementById("avgLatency");
  if (lat) lat.textContent = formatAvgLatency(m.totalLatency || 0, m.responseCount || 0);
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function renderFieldsChart(map) {
  const canvas = document.getElementById("fieldsChart");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("fields");

  const labels = Object.keys(map || {});
  const values = labels.map((k) => map[k]);
  const displayLabels = labels.length
    ? labels.map((k) => k.charAt(0).toUpperCase() + k.slice(1))
    : ["No data yet"];
  const displayValues = labels.length ? values : [0];

  charts.fields = new Chart(canvas, {
    type: "bar",
    data: {
      labels: displayLabels,
      datasets: [{
        label: "Fields",
        data: displayValues,
        backgroundColor: "rgba(56, 189, 248, 0.85)",
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { color: "#94a3b8", precision: 0 } },
        y: { ticks: { color: "#e2e8f0" } },
      },
    },
  });
}

function renderActivityChart(m) {
  const canvas = document.getElementById("activityChart");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("activity");

  const data = METRIC_KEYS.map((k) => m[k] || 0);
  const labels = [
    "Fields Explained",
    "Errors Prevented",
    "Voice Assists",
    "Pages Summarized",
  ];

  charts.activity = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          "rgba(56, 189, 248, 0.9)",
          "rgba(34, 197, 94, 0.9)",
          "rgba(129, 140, 248, 0.9)",
          "rgba(245, 158, 11, 0.9)",
        ],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: "#cbd5e1" } } },
    },
  });
}

function renderLanguageChart(breakdown) {
  const canvas = document.getElementById("languageChart");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("language");

  const map = breakdown || { EN: 0, HI: 0, KN: 0 };
  charts.language = new Chart(canvas, {
    type: "pie",
    data: {
      labels: ["English", "Hindi", "Kannada"],
      datasets: [{
        data: [map.EN || 0, map.HI || 0, map.KN || 0],
        backgroundColor: [
          "rgba(148, 163, 184, 0.9)",
          "rgba(244, 114, 182, 0.9)",
          "rgba(52, 211, 153, 0.9)",
        ],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: "#cbd5e1" } } },
    },
  });
}

function renderSourceChart(breakdown) {
  const canvas = document.getElementById("sourceChart");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("source");

  const map = breakdown || { llm: 0, rules: 0, local: 0 };
  charts.source = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["AI (LLM)", "Rule-based", "Offline"],
      datasets: [{
        data: [map.llm || 0, map.rules || 0, map.local || 0],
        backgroundColor: [
          "rgba(129, 140, 248, 0.9)",
          "rgba(56, 189, 248, 0.9)",
          "rgba(148, 163, 184, 0.9)",
        ],
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#94a3b8", precision: 0 } },
        x: { ticks: { color: "#e2e8f0" } },
      },
    },
  });
}

function bucketEvents(events) {
  const buckets = {};
  const now = Date.now() / 1000;
  const windowSec = 30 * 60;
  const start = now - windowSec;

  (events || []).forEach((ev) => {
    const t = ev.t || 0;
    if (t < start) return;
    const minute = Math.floor(t / 60) * 60;
    buckets[minute] = (buckets[minute] || 0) + 1;
  });

  const keys = Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b);
  if (!keys.length) {
    return { labels: ["No events yet"], values: [0] };
  }
  return {
    labels: keys.map((k) => {
      const d = new Date(k * 1000);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }),
    values: keys.map((k) => buckets[k]),
  };
}

function renderTimelineChart(events) {
  const canvas = document.getElementById("timelineChart");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("timeline");

  const { labels, values } = bucketEvents(events);
  charts.timeline = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Events",
        data: values,
        borderColor: "rgba(56, 189, 248, 1)",
        backgroundColor: "rgba(56, 189, 248, 0.15)",
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#94a3b8", precision: 0 } },
        x: { ticks: { color: "#94a3b8", maxRotation: 45 } },
      },
    },
  });
}

function renderAll(m) {
  updateCounters(m);
  renderFieldsChart(m.fieldTypesProcessed);
  renderActivityChart(m);
  renderLanguageChart(m.languageBreakdown);
  renderSourceChart(m.simplifySourceBreakdown);
  renderTimelineChart(m.events);
}

async function fetchMetrics() {
  const r = await fetch(`${API_BASE}/api/metrics`);
  if (!r.ok) throw new Error("metrics fetch failed");
  const data = await r.json();
  return data.metrics;
}

function showEmptyHint(m) {
  const total =
    (m.fieldsExplained || 0) +
    (m.voiceAssistsTriggered || 0) +
    (m.validationErrorsPrevented || 0) +
    (m.pagesSummarized || 0);
  const hint = document.getElementById("emptyHint");
  if (!hint) return;
  if (total === 0 && !m.lastUpdated) {
    hint.hidden = false;
    hint.textContent =
      "No metrics yet. Reload the extension, start the backend, use form help on a page, then click Refresh.";
  } else if (total === 0) {
    hint.hidden = false;
    hint.textContent = "Counters are zero — use the ? button on a form field, then Refresh.";
  } else {
    hint.hidden = true;
  }
}

async function loadDashboard() {
  try {
    const m = await fetchMetrics();
    renderAll(m);
    showEmptyHint(m);
    const updated = m.lastUpdated
      ? `Updated ${new Date(m.lastUpdated * 1000).toLocaleTimeString()}`
      : "Connected — waiting for extension sync";
    setConnectionStatus(true, updated);
  } catch (_) {
    setConnectionStatus(false, "Backend offline — run python app.py");
  }
}

async function resetMetrics() {
  await fetch(`${API_BASE}/api/metrics/reset`, { method: "POST" });
  loadDashboard();
}

document.addEventListener("DOMContentLoaded", () => {
  const urlEl = document.getElementById("dashboardUrl");
  if (urlEl) urlEl.textContent = `${API_BASE}/dashboard`;

  loadDashboard();
  document.getElementById("refreshBtn")?.addEventListener("click", loadDashboard);
  document.getElementById("resetBtn")?.addEventListener("click", resetMetrics);

  setInterval(loadDashboard, 5000);
});
