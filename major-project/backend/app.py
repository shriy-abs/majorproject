"""
Flask API for the Cognitive Form Assist extension.
"""
from flask import Flask, jsonify, request
from flask_cors import CORS

from simplify import simplify_text

app = Flask(__name__)
# Extension runs in page context; origins vary (file://, http://localhost, etc.)
CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.get("/")
def index():
    """So opening http://127.0.0.1:5000/ in a browser is not a 404."""
    html = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Cognitive Form Assist API</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem;">
<h1>Cognitive Form Assist — API</h1>
<p>Server is running. The extension talks to these endpoints (not this home page):</p>
<ul>
  <li><a href="/api/health"><code>GET /api/health</code></a> — quick check</li>
  <li><code>POST /api/simplify</code> — JSON body <code>{"text":"your field label"}</code></li>
</ul>
</body></html>"""
    return html, 200, {"Content-Type": "text/html; charset=utf-8"}


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.post("/api/simplify")
def simplify():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "missing or empty 'text'"}), 400

    simplified, source = simplify_text(text)
    return jsonify({"ok": True, "simplified": simplified, "source": source})


if __name__ == "__main__":
    # Default port matches extension settings
    app.run(host="127.0.0.1", port=5000, debug=True)
