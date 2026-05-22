"""
Robust English → Hindi / Kannada translation for form assistance text.
Uses OpenAI when available; falls back to returning the source text.
"""
from __future__ import annotations

import os
import re
from typing import Optional

import requests

_LANG_META = {
    "hi": {
        "name": "Hindi",
        "script_hint": "Devanagari",
        "empty": "कोई पाठ नहीं।",
    },
    "kn": {
        "name": "Kannada",
        "script_hint": "Kannada",
        "empty": "ಪಠ್ಯವಿಲ್ಲ.",
    },
}


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _looks_translated(text: str, lang: str) -> bool:
    """Heuristic: text already contains target-script characters."""
    if lang == "hi":
        return bool(re.search(r"[\u0900-\u097F]", text))
    if lang == "kn":
        return bool(re.search(r"[\u0C80-\u0CFF]", text))
    return False


def translate_openai(text: str, lang: str = "hi") -> Optional[str]:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return None

    meta = _LANG_META.get(lang)
    if not meta:
        return None

    cleaned = _clean(text)
    if not cleaned:
        return meta["empty"]

    if _looks_translated(cleaned, lang):
        return cleaned

    lang_name = meta["name"]
    system = (
        f"You translate English web-form help text into natural, simple {lang_name} "
        f"using {meta['script_hint']} script. "
        "Preserve the full meaning (what the user must enter, validation rules, examples). "
        f"Do not transliterate English words unnecessarily — use common {lang_name} words. "
        "Keep numbers, emails, URLs, and PAN/Aadhaar examples as-is. "
        "Output ONLY the translation, no quotes or preamble."
    )

    user = (
        f"Translate this form-assistance sentence to {meta['name']}:\n\n{cleaned}"
    )

    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": 200,
                "temperature": 0.2,
            },
            timeout=30,
        )
        r.raise_for_status()
        out = _clean(r.json()["choices"][0]["message"]["content"])
        return out or None
    except Exception:
        return None


def translate_text(text: str, lang: str = "hi") -> tuple[str, str]:
    """
    Returns (translated_text, source) where source is 'llm' or 'passthrough'.
    """
    cleaned = _clean(text)
    lang = (lang or "hi").lower()[:2]
    if lang not in _LANG_META:
        return cleaned, "passthrough"
    if not cleaned:
        return _LANG_META[lang]["empty"], "passthrough"

    llm = translate_openai(cleaned, lang=lang)
    if llm:
        return llm, "llm"
    return cleaned, "passthrough"
