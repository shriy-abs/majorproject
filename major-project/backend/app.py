"""
Flask API for the Cognitive Form Assist extension.
"""
import os

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from metrics_store import get_metrics, merge_metrics, reset_metrics
from simplify import simplify_text
from translate import translate_text

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "dashboard")


@app.get("/")
def index():
    html = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Cognitive Form Assist API</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem;">
<h1>Cognitive Form Assist — API</h1>
<p>Server is running.</p>
<ul>
  <li><a href="/api/health"><code>GET /api/health</code></a></li>
  <li><a href="/dashboard"><code>GET /dashboard</code></a> — analytics dashboard</li>
  <li><code>POST /api/simplify</code> — JSON <code>{"text":"label","lang":"en|hi|kn"}</code></li>
  <li><code>POST /api/translate</code> — JSON <code>{"text":"sentence","lang":"hi|kn"}</code></li>
  <li><code>GET /api/metrics</code> — session analytics</li>
</ul>
</body></html>"""
    return html, 200, {"Content-Type": "text/html; charset=utf-8"}


@app.get("/dashboard")
@app.get("/dashboard/")
def dashboard_page():
    return send_from_directory(DASHBOARD_DIR, "index.html")


@app.get("/dashboard/<path:filename>")
def dashboard_assets(filename):
    return send_from_directory(DASHBOARD_DIR, filename)


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.post("/api/simplify")
def simplify():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "missing or empty 'text'"}), 400

    lang = (data.get("lang") or "en").strip().lower()
    simplified, source = simplify_text(text, lang=lang)
    return jsonify({"ok": True, "simplified": simplified, "source": source, "lang": lang})


@app.post("/api/translate")
def translate():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "missing or empty 'text'"}), 400

    lang = (data.get("lang") or "hi").strip().lower()
    if lang not in ("hi", "kn"):
        return jsonify({"ok": False, "error": "lang must be 'hi' or 'kn'"}), 400

    translated, source = translate_text(text, lang=lang)
    return jsonify({"ok": True, "translated": translated, "source": source, "lang": lang})


@app.get("/api/metrics")
def metrics_get():
    return jsonify({"ok": True, "metrics": get_metrics()})


@app.post("/api/metrics")
def metrics_post():
    data = request.get_json(silent=True) or {}
    merged = merge_metrics(data)
    return jsonify({"ok": True, "metrics": merged})


@app.post("/api/metrics/reset")
def metrics_reset():
    reset_metrics()
    return jsonify({"ok": True, "metrics": get_metrics()})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
