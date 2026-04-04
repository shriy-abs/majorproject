"""
Simplification module: rule-based baseline + optional OpenAI (API key in env).
"""
from __future__ import annotations

import os
import re
from typing import Optional, Tuple

import requests

# Friendly rewrites for common Indian / government-style form wording
PHRASE_HINTS = [
    (
        r"(?i)\b(permanent\s+residential\s+address|permanent\s+address)\b",
        "Enter the address where you normally live (house number, street, city, PIN).",
    ),
    (
        r"(?i)\b(full\s+name|applicant'?s?\s+name)\b",
        "Enter your complete legal name, same as on your ID.",
    ),
    (
        r"(?i)\bdate\s+of\s+birth\b",
        "Choose your birth date using the calendar.",
    ),
    (
        r"(?i)\bannual\s+household\s+income\b",
        "Enter your whole family's total yearly income before tax, in numbers.",
    ),
    (
        r"(?i)\baadhaar\b",
        "Enter your 12-digit Aadhaar number (no spaces).",
    ),
    (
        r"(?i)\bemail\b",
        "Enter an email address you check often (example: name@gmail.com).",
    ),
    (
        r"(?i)\bphone|mobile|contact\s+number\b",
        "Enter your phone number with country/area code if asked.",
    ),
    (
        r"(?i)\bid\s+proof|upload\s+id\b",
        "Upload a clear photo or scan of an official ID (PDF or image).",
    ),
    (
        r"(?i)\bapplication\s+category\b|\bcategory\b",
        "Pick the option that best describes you (student, employee, etc.).",
    ),
    (r"(?i)\bpan\b", "Enter your 10-character PAN as on your card."),
    (r"(?i)\bpin\s*code\b", "Enter your area's 6-digit postal PIN."),
]


def _clean(text: str) -> str:
    t = text.strip()
    t = re.sub(r"\s+", " ", t)
    return t


def simplify_rules(text: str) -> str:
    """Heuristic simplification without any network call."""
    raw = _clean(text)
    if not raw:
        return "No label or hint was found for this field. Enter the value that matches the field name."

    lower = raw.lower()
    for pattern, hint in PHRASE_HINTS:
        if re.search(pattern, lower):
            return hint

    # Short fields: expand slightly
    if len(raw) <= 40:
        return f"This field is asking for: {raw}. Enter the information that matches it."

    # Long blob: first sentence + guidance
    first = raw[:200] + ("…" if len(raw) > 200 else "")
    return (
        f"The instructions mention: “{first}”. "
        "Read slowly, then type the answer the form is asking for in this box."
    )


def simplify_openai(text: str) -> Optional[str]:
    """Optional LLM simplification. Returns None on failure."""
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return None

    prompt = (
        "Rewrite the following form field label or instruction in very simple, plain English. "
        "Use one or two short sentences. Do not add new requirements or ask questions.\n\n"
        f"Text:\n{text}\n\nSimple explanation:"
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
                    {
                        "role": "system",
                        "content": "You help people understand forms. Be concise and kind.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 200,
                "temperature": 0.3,
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        choice = data["choices"][0]["message"]["content"]
        return _clean(choice)
    except Exception:
        return None


def simplify_text(text: str) -> Tuple[str, str]:
    """
    Returns (simplified_text, source) where source is 'llm', 'rules', or 'fallback'.
    """
    cleaned = _clean(text)
    if not cleaned:
        return (
            "No label or hint was found for this field. Enter the value that matches the field name.",
            "rules",
        )

    llm = simplify_openai(cleaned)
    if llm:
        return llm, "llm"

    return simplify_rules(cleaned), "rules"
