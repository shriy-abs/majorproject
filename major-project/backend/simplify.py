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
        r"(?i)\bfather'?s?\s+name\b|\bfather\s+name\b|\bname\s+of\s+(?:the\s+)?father\b|\bpaternal\s+name\b",
        "Enter your father's full name as on official records.",
    ),
    (
        r"(?i)\bmother'?s?\s+name\b|\bmother\s+name\b|\bname\s+of\s+(?:the\s+)?mother\b|\bmaternal\s+name\b",
        "Enter your mother's full name as on official records.",
    ),
    (
        r"(?i)\b(?:guardian|spouse)'?s?\s+name\b|\bname\s+of\s+(?:the\s+)?guardian\b",
        "Enter the guardian or spouse's full name as on official records.",
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
        r"(?i)\b(?:full|first|last|given|family|applicant)\s+name\b|\bsurname\b|\bgiven\s+name\b|\bfamily\s+name\b|\bname\b",
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


def _lang_code(lang: str) -> str:
    l = (lang or "en").lower()[:2]
    return l if l in ("en", "hi", "kn") else "en"


def simplify_openai(text: str, lang: str = "en") -> Optional[str]:
    """Optional LLM simplification. Returns None on failure."""
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return None

    lang = _lang_code(lang)

    if lang == "hi":
        prompt = (
            "नीचे दिया गया अंग्रेज़ी फॉर्म फ़ील्ड लेबल है। इसका अर्थ सरल हिंदी में समझाएँ।\n"
            "नियम:\n"
            "- अंग्रेज़ी शब्दों को केवल तभी रखें जब वे आम हों (जैसे email, PAN)।\n"
            "- उपयोगकर्ता को स्पष्ट बताएँ कि क्या भरना है; एक या दो छोटे वाक्य।\n"
            "- ज़रूरत हो तो 'उदाहरण: ' से एक उदाहरण दें।\n"
            "- केवल हिंदी में जवाब दें, कोई सवाल न पूछें।\n\n"
            f"फ़ील्ड लेबल:\n{text}"
        )
        system = (
            "आप भारतीय सरकारी और वेब फॉर्म के लेबल को सरल, प्राकृतिक हिंदी में समझाते हैं। "
            "अंग्रेज़ी लेबल का पूरा अर्थ हिंदी में दें, केवल लिप्यंतरण न करें। "
            "Father's name = पिता का नाम (not applicant's own name). Mother's name = माता का नाम."
        )
    elif lang == "kn":
        prompt = (
            "ಕೆಳಗಿನ ಇಂಗ್ಲಿಷ್ ಫಾರ್ಮ್ ಫೀಲ್ಡ್ ಲೇಬಲ್ ಅರ್ಥವನ್ನು ಸರಳ ಕನ್ನಡದಲ್ಲಿ ವಿವರಿಸಿ.\n"
            "ನಿಯಮಗಳು:\n"
            "- ಬಳಕೆದಾರ ಏನು ನಮೂದಿಸಬೇಕು ಎಂದು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ; ಒಂದು ಅಥವಾ ಎರಡು ಚಿಕ್ಕ ವಾಕ್ಯಗಳು.\n"
            "- ಅಗತ್ಯವಿದ್ದರೆ 'ಉದಾಹರಣೆ: ' ನೊಂದಿಗೆ ಉದಾಹರಣೆ ನೀಡಿ.\n"
            "- ಉತ್ತರ ಕನ್ನಡದಲ್ಲೇ ಇರಲಿ, ಪ್ರಶ್ನೆ ಕೇಳಬೇಡಿ.\n\n"
            f"ಫೀಲ್ಡ್ ಲೇಬಲ್:\n{text}"
        )
        system = (
            "ನೀವು ಭಾರತೀಯ ಸರ್ಕಾರಿ ಮತ್ತು ವೆಬ್ ಫಾರ್ಮ್ ಲೇಬಲ್ಗಳನ್ನು ಸರಳ, ನೈಸರ್ಗಿಕ ಕನ್ನಡದಲ್ಲಿ ವಿವರಿಸುತ್ತೀರಿ. "
            "ಇಂಗ್ಲಿಷ್ ಲೇಬಲ್ನ ಸಂಪೂರ್ಣ ಅರ್ಥವನ್ನು ಕನ್ನಡದಲ್ಲಿ ನೀಡಿ, ಕೇವಲ ಲಿಪ್ಯಂತರಣ ಮಾಡಬೇಡಿ. "
            "Father's name = ತಂದೆಯ ಹೆಸರು (not your own name). Mother's name = ತಾಯಿಯ ಹೆಸರು."
        )
    else:
        prompt = (
            "Explain this form field in very simple, plain English.\n"
            "Format (strict):\n"
            "- First line(s): one or two short sentences saying what the user should type or choose.\n"
            "- Optional second part: only if a tiny example really helps, add exactly one line starting with "
            '"Example: " followed by a brief sample (no extra lines).\n'
            "Rules: do not invent new requirements; do not ask questions; no bullets, headings, or preamble.\n\n"
            f"Field label or instruction:\n{text}"
        )
        system = (
            "You explain government and web forms in plain language. "
            "Keep answers short and friendly."
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


def _maybe_translate_fallback(english_hint: str, lang: str) -> str:
    """When rules only echo English, try LLM translation for meaning."""
    from translate import translate_openai

    translated = translate_openai(english_hint, lang=lang)
    return translated if translated else english_hint


def simplify_text(text: str, lang: str = "en") -> Tuple[str, str]:
    """
    Returns (simplified_text, source) where source is 'llm', 'rules', or 'fallback'.
    lang: 'en', 'hi', or 'kn'
    """
    cleaned = _clean(text)
    lang = _lang_code(lang)
    use_hi = lang == "hi"
    use_kn = lang == "kn"

    if not cleaned:
        if use_hi:
            empty = "कोई लेबल नहीं मिला। मदद के लिए साइट से पूछें या खाली छोड़ें।"
        elif use_kn:
            empty = "ಯಾವುದೇ ಲೇಬಲ್ ಕಂಡುಬಂದಿಲ್ಲ. ಸಹಾಯಕ್ಕಾಗಿ ಸೈಟ್ ಮಾಲೀಕರನ್ನು ಕೇಳಿ ಅಥವಾ ಖಾಲಿ ಬಿಡಿ."
        else:
            empty = "No label was found; ask the site owner for help or skip if optional."
        return empty, "rules"

    llm = simplify_openai(cleaned, lang=lang)
    if llm:
        return llm, "llm"

    if use_hi:
        from simplify_hi import simplify_rules_hi

        result = simplify_rules_hi(cleaned)
        if result.startswith("यहाँ भरें:") or result.startswith("लेबल के अनुसार"):
            improved = _maybe_translate_fallback(
                _generic_rule_fallback(cleaned), "hi"
            )
            if improved != _generic_rule_fallback(cleaned):
                return improved, "llm"
        return result, "rules"

    if use_kn:
        from simplify_kn import simplify_rules_kn

        result = simplify_rules_kn(cleaned)
        if result.startswith("ಇಲ್ಲಿ ನಮೂದಿಸಿ:") or result.startswith("ಲೇಬಲ್ ಪ್ರಕಾರ"):
            improved = _maybe_translate_fallback(
                _generic_rule_fallback(cleaned), "kn"
            )
            if improved != _generic_rule_fallback(cleaned):
                return improved, "llm"
        return result, "rules"

    return simplify_rules(cleaned), "rules"
