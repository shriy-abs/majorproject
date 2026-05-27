"""
AI-first simplification module for Cognitive Form Assist.
Gemini-powered contextual simplification with rule-based fallback.
"""

from __future__ import annotations

import os
import re
from typing import Optional, Tuple

from google import genai

# =========================================================
# Gemini Client
# =========================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

client = None

if GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        print("✓ Gemini client initialized")
    except Exception as e:
        print("Gemini initialization failed:", e)


# =========================================================
# Metadata
# =========================================================

HYBRID_SOURCE = "Hybrid Context Engine"
GEMINI_SOURCE = "Gemini AI"


# =========================================================
# Rule-Based Fallback Engine
# =========================================================

PHRASE_HINTS = [
    (
        r"(?i)\bdate\s+of\s+birth\b",
        "Enter your birth date. Example: 15 March 2000.",
    ),
    (
        r"(?i)\bemail\b",
        "Enter a valid email address. Example: name@gmail.com.",
    ),
    (
        r"(?i)\bphone|mobile|contact\s+number\b",
        "Enter a phone number where you can be reached.",
    ),
    (
        r"(?i)\baddress\b",
        "Enter your complete residential address with city and PIN code.",
    ),
    (
        r"(?i)\baadhaar\b",
        "Enter your 12-digit Aadhaar number without spaces.",
    ),
    (
        r"(?i)\bpan\b",
        "Enter your 10-character PAN number.",
    ),
    (
        r"(?i)\bvehicle\s+registration\b|\bregistration\s+no\b",
        "Enter your vehicle registration number exactly as shown on the RC card.",
    ),
    (
        r"(?i)\bchassis\s+no\b",
        "Enter the full chassis number of your vehicle.",
    ),
    (
        r"(?i)\bengine\s+number\b",
        "Enter the engine number exactly as printed in vehicle documents.",
    ),
    (
        r"(?i)\bfitness\b.*\bvalid\b|\bfitness\s+upto\b",
        "Enter the date until the vehicle fitness certificate remains valid.",
    ),
]

KEYWORD_FALLBACKS = [
    (
        r"(?i)\bname\b",
        "Enter your full name as per official records.",
    ),
    (
        r"(?i)\bupload\b|\battach\b",
        "Upload the required document or image file.",
    ),
]


# =========================================================
# Helpers
# =========================================================

def _clean(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _try_rule_hints(text: str) -> Optional[str]:
    raw = _clean(text)

    if not raw:
        return None

    for pattern, hint in PHRASE_HINTS:
        if re.search(pattern, raw):
            return hint

    for pattern, hint in KEYWORD_FALLBACKS:
        if re.search(pattern, raw):
            return hint

    return None


def _generic_rule_fallback(text: str) -> str:
    return "Fill this field with the information requested in the form."


# =========================================================
# Rule-Based Simplifier
# =========================================================

def simplify_rules(text: str) -> str:
    raw = _clean(text)

    if not raw:
        return "No label was found for this field."

    hint = _try_rule_hints(raw)

    if hint:
        return hint

    return _generic_rule_fallback(raw)


# =========================================================
# Gemini AI Simplifier
# =========================================================
def simplify_gemini(
    label: str,
    lang: str = "en",
    placeholder: str = "",
    form_title: str = "",
    section: str = "",
) -> Optional[str]:

    if not client:
        return None

    label = _clean(label)
    placeholder = _clean(placeholder)
    form_title = _clean(form_title)
    section = _clean(section)

    if not label:
        return None

    # =====================================================
    # Language Instructions
    # =====================================================

    lang = (lang or "en").lower()

    if lang == "hi":
        language_instruction = """
Respond ONLY in simple Hindi using Devanagari script.
"""

    elif lang == "kn":
        language_instruction = """
Respond ONLY in simple Kannada.
"""

    else:
        language_instruction = """
Respond ONLY in simple English.
"""

    # =====================================================
    # Prompt
    # =====================================================

    prompt = f"""
You are an accessibility assistant for web forms.

Your task is to explain form fields in very simple language.

{language_instruction}

Rules:
- Keep the response under 25 words
- Explain what the user should enter
- Be practical and human-friendly
- Include an example if useful
- Do NOT repeat the field label unnecessarily
- Avoid technical jargon

Form Title:
{form_title}

Section:
{section}

Field Label:
{label}

Placeholder:
{placeholder}
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        if response.text:
            text = response.text.strip()
            text = re.sub(r"\s+", " ", text)

            if len(text) > 2:
                return text

    except Exception as e:
        print("Gemini generation failed:", e)

    return None


# =========================================================
# Main Public API
# =========================================================

def simplify_text(
    text: str,
    lang: str = "en",
    placeholder: str = "",
    form_title: str = "",
    section: str = "",
) -> Tuple[str, str]:

    """
    Returns:
        (simplified_text, source)

    source:
        - "gemini"
        - "rules"
    """

    raw = _clean(text)

    if not raw:
        return (
            "No label was found; ask the site owner for help or skip if optional.",
            "rules",
        )

    # =====================================================
    # STEP 1 — Gemini AI
    # =====================================================

    gemini_result = simplify_gemini(
        label=raw,
        lang=lang,
        placeholder=placeholder,
        form_title=form_title,
        section=section,
    )

    if gemini_result:
        return gemini_result, "gemini"

    # =====================================================
    # STEP 2 — Rule Fallback
    # =====================================================

    rule_result = simplify_rules(raw)

    return rule_result, "rules"