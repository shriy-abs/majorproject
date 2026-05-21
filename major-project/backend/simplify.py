"""
Simplification module: rules + optional OpenAI + optional local Ollama.
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
        "Enter your home address exactly as on official documents. "
        "Example: House no., street, city, PIN code.",
    ),
    (
        r"(?i)\b(full\s+name|applicant'?s?\s+name)\b",
        "Enter your full legal name as printed on your ID. Example: Priya Sharma.",
    ),
    (
        r"(?i)\bdate\s+of\s+birth\b",
        "Pick the calendar day you were born. Example: 15 March 1998.",
    ),
    (
        r"(?i)\bannual\s+household\s+income\b",
        "Enter your household's total yearly income before tax, in numbers. Example: 450000.",
    ),
    (
        r"(?i)\baadhaar\b",
        "Enter your 12-digit Aadhaar with no spaces. Example: 123456789012.",
    ),
    (
        r"(?i)\bemail\b",
        "Enter an email you check regularly. Example: name@gmail.com.",
    ),
    (
        r"(?i)\bphone|mobile|contact\s+number\b",
        "Enter a phone number you can be reached on. Example: +91 98765 43210.",
    ),
    (
        r"(?i)\bid\s+proof|upload\s+id\b",
        "Upload a clear scan or photo of a government ID. Example: Aadhaar PDF or JPEG.",
    ),
    (
        r"(?i)\bapplication\s+category\b|\bcategory\b",
        "Choose the category that matches you best. Example: Student.",
    ),
    (
        r"(?i)\bpan\b",
        "Enter your 10-character PAN as on the card. Example: ABCDE1234F.",
    ),
    (
        r"(?i)\bpin\s*code\b",
        "Enter your 6-digit postal PIN. Example: 560001.",
    ),
]

# After PHRASE_HINTS: simple word/phrase cues for labels that did not match above.
KEYWORD_FALLBACKS = [
    (
        r"(?i)\be[- ]?mail\b|\bemail\b",
        "Enter a valid email address. Example: name@gmail.com.",
    ),
    (
        r"(?i)\bphone\b|\bmobile\b|\bcell\b|\btelephone\b|\btel\.?\b|\bwhatsapp\b|\bcontact\s*(?:number|no\.?)\b|\bmob\.?\b",
        "Enter your phone number. Example: 9876543210.",
    ),
    (
        r"(?i)\bdob\b|\bdate\s+of\s+birth\b|\bbirth\s*date\b|\bbirthdate\b",
        "Enter your date of birth. Example: 15 March 2000.",
    ),
    (
        r"(?i)\bincome\b|\bsalary\b|\bremuneration\b",
        "Enter your yearly income in numbers. Example: 500000.",
    ),
    (
        r"(?i)\b(?:street|locality|pin\s*code|postal|zip|mailing|correspondence|residential|residence|permanent)\b|"
        r"\b(?:current|living)\s+address\b|\bliving\s+area\b|\baddress(?:\s*line)?\b",
        "Enter your complete home address. Example: House No, Street, City, PIN code.",
    ),
    (
        r"(?i)\b(?:full|first|last|given|family|applicant)\s+name\b|\bname\s+of\b|\bfather'?s?\s+name\b|\bmother'?s?\s+name\b|\b(?:guardian|spouse)'?s?\s+name\b|\bsurname\b|\bgiven\s+name\b|\bfamily\s+name\b|\bname\b",
        "Enter your full name as per official records. Example: Priya Sharma.",
    ),
]

# Substring groups (checked after KEYWORD_FALLBACKS regexes).
KEYWORD_SEMANTIC_GROUPS = [
    (
        (
            "city",
            "location",
            "place",
            "town",
            "residence",
            "living",
            "current location",
        ),
        "Enter the city where you currently live. Example: Bangalore.",
    ),
    (
        ("comment", "remarks", "notes", "feedback", "description"),
        "Enter any additional information if required. You can leave this blank if not applicable.",
    ),
]


def _clean(text: str) -> str:
    t = text.strip()
    t = re.sub(r"\s+", " ", t)
    return t


def _try_semantic_keyword_groups(lower: str) -> Optional[str]:
    for keywords, hint in KEYWORD_SEMANTIC_GROUPS:
        if any(kw in lower for kw in keywords):
            return hint
    return None


def _try_rule_hints(text: str) -> Optional[str]:
    """PHRASE_HINTS, then KEYWORD_FALLBACKS, then semantic substring groups."""
    raw = _clean(text)
    if not raw:
        return None
    lower = raw.lower()
    for pattern, hint in PHRASE_HINTS:
        if re.search(pattern, lower):
            return hint
    for pattern, hint in KEYWORD_FALLBACKS:
        if re.search(pattern, lower):
            return hint
    return _try_semantic_keyword_groups(lower)


def _generic_rule_fallback(raw: str) -> str:
    if len(raw) <= 80:
        return f'Enter: "{raw}".'
    snippet = raw[:160] + ("…" if len(raw) > 160 else "")
    return f'Enter what the label describes: "{snippet}".'


def simplify_rules(text: str) -> str:
    """Heuristic simplification without any network call."""
    raw = _clean(text)
    if not raw:
        return "No label was found; ask the site owner for help or skip if optional."

    lower = raw.lower()
    for pattern, hint in PHRASE_HINTS:
        if re.search(pattern, lower):
            return hint

    for pattern, hint in KEYWORD_FALLBACKS:
        if re.search(pattern, lower):
            return hint

    if len(raw) <= 80:
        return f'Enter: “{raw}”.'

    snippet = raw[:160] + ("…" if len(raw) > 160 else "")
    return f'Enter what the label describes: “{snippet}”.'


def simplify_openai(text: str) -> Optional[str]:
    """Optional LLM simplification. Returns None on failure."""
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return None

    prompt = (
        "Explain this form field in very simple, plain English.\n"
        "Format (strict):\n"
        "- First line(s): one or two short sentences saying what the user should type or choose.\n"
        "- Optional second part: only if a tiny example really helps, add exactly one line starting with "
        '"Example: " followed by a brief sample (no extra lines).\n'
        "Rules: do not invent new requirements; do not ask questions; no bullets, headings, or preamble.\n\n"
        f"Field label or instruction:\n{text}"
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
                        "content": (
                            "You explain government and web forms in plain language. "
                            "Keep answers short and friendly."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 150,
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
            "No label was found; ask the site owner for help or skip if optional.",
            "rules",
        )

    llm = simplify_openai(cleaned)
    if llm:
        return llm, "llm"

    return simplify_rules(cleaned), "rules"
