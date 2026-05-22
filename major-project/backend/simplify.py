"""
Simplification module: hybrid contextual engine + optional OpenAI.
"""
from __future__ import annotations

import os
import re
from typing import Optional, Tuple

import requests

HYBRID_SOURCE = "Hybrid Context Engine"

# Friendly rewrites for common Indian / government-style form wording
# Upload hints must come before aadhaar/address keywords that appear in the same label.
PHRASE_HINTS = [
    (
        r"(?i)\bupload\s+(?:government\s+)?(?:id|identity)\s*proof\b|"
        r"\b(?:government\s+)?id\s*proof\s+upload\b|"
        r"\bupload\s+(?:government\s+)?id\s*proof\s*\([^)]*(?:aadhaar|voter|passport)",
        "Choose a file to upload: a clear photo or PDF of your government ID "
        "(Aadhaar, Voter ID, or Passport). Accepted: JPG, PNG, or PDF. Do not type text here.",
    ),
    (
        r"(?i)\bupload\s+address\s*proof\b|\baddress\s*proof\s+upload\b|"
        r"\bupload\s+address\s*proof\s*\([^)]*(?:utility|rent|bill|agreement)",
        "Choose a file to upload: a photo or PDF of your address proof "
        "(utility bill, rent agreement, etc.). Accepted: JPG, PNG, or PDF. Do not type text here.",
    ),
    (
        r"(?i)\bupload\b.*\b(?:proof|document|certificate|photo|scan|copy|attachment)\b|"
        r"\b(?:proof|document|certificate)\b.*\bupload\b|"
        r"\battach\s+(?:file|document|proof)\b|\bchoose\s+file\b",
        "Use the file upload button to attach a document (image or PDF). Do not enter text in this field.",
    ),
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
        r"(?i)\baadhaar\s*(?:number|no\.?|#)?\b|\b12[- ]?digit\s+aadhaar\b",
        "Enter your 12-digit Aadhaar with no spaces. Example: 123456789012.",
    ),
    (
        r"(?i)\bemail\b",
        "Enter an email you check regularly. Example: name@gmail.com.",
    ),
    (
        r"(?i)\bemergency\s+contact\b|\bice\s+contact\b|\bnext\s+of\s+kin\b|"
        r"\bin\s+case\s+of\s+emergency\b|\balternate\s+contact\b",
        "Name and phone of someone we can reach in an emergency.",
    ),
    (
        r"(?i)\bphone|mobile|contact\s+number\b",
        "Enter a phone number you can be reached on. Example: +91 98765 43210.",
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
    (
        r"(?i)\boccupation\b|\bprofession\b|\bjob\s+title\b|\bdesignation\b|"
        r"\bemployment\s+type\b",
        "Enter what you do for work. Example: Teacher.",
    ),
    (
        r"(?i)\borganization\b|\borganisation\b|\bemployer\s+name\b|"
        r"\bcompany\s+name\b|\binstitution\s+name\b",
        "Enter your school, employer, or institution name.",
    ),
    (
        r"(?i)\bdepartment\b|\bdept\.?\b|\bdivision\s+name\b",
        "Enter your team or department at work or school.",
    ),
    (
        r"(?i)\bremarks?\b|\bcomments?\b|\badditional\s+(?:info|information|details)\b|"
        r"\bspecial\s+instructions?\b|\bother\s+details\b",
        "Optional notes for reviewers. Leave blank if nothing applies.",
    ),
    (
        r"(?i)\b(?:city|town)\s+name\b|\bname\s+of\s+(?:city|town)\b|\bcity\b|\btown\b",
        "Type the city or town where you live. Example: Bangalore.",
    ),
]

# After PHRASE_HINTS: simple word/phrase cues for labels that did not match above.
KEYWORD_FALLBACKS = [
    (
        r"(?i)\be[- ]?mail\b|\bemail\b",
        "Enter a valid email address. Example: name@gmail.com.",
    ),
    (
        r"(?i)\bphone\b|\bmobile\b|\bcell\b|\btelephone\b|\btel\.?\b|\bwhatsapp\b|"
        r"(?<!emergency\s)contact\s*(?:number|no\.?)\b|\bmob\.?\b",
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
        r"\b(?:current|living)\s+address\b|\bliving\s+area\b|\baddress(?:\s*line)?\b(?!.*\bproof\b)",
        "Enter where you live: house or flat, street, city, and PIN code.",
    ),
    (
        r"(?i)\bupload\b|\battach\b|\bchoose\s+file\b",
        "Use the upload button to attach a photo or PDF. Do not type text here.",
    ),
    (
        r"(?i)\b(?:full|first|last|given|family|applicant)\s+name\b|\bsurname\b|\bgiven\s+name\b|\bfamily\s+name\b|\bname\b",
        "Enter your full name as per official records. Example: Priya Sharma.",
    ),
]

# Semantic keyword groups (checked after regex fallbacks; first match wins).
KEYWORD_SEMANTIC_GROUPS = [
    (
        (
            "upload",
            "attach file",
            "choose file",
            "file upload",
            "browse file",
            "attachment",
            "document scan",
            "photo upload",
            "scan copy",
        ),
        "Use the upload button to attach a photo or PDF. Do not type text here.",
    ),
    (
        (
            "emergency contact",
            "emergency no",
            "ice contact",
            "in case of emergency",
            "next of kin",
            "alternate contact",
            "sos contact",
        ),
        "Name and phone of someone we can reach in an emergency.",
    ),
    (
        ("department", "dept", "division", "section name", "business unit"),
        "Enter your team or department at work or school.",
    ),
    (
        (
            "organization",
            "organisation",
            "company name",
            "employer",
            "institute",
            "institution",
            "firm name",
            "org name",
            "workplace",
        ),
        "Enter your school, employer, or institution name.",
    ),
    (
        (
            "occupation",
            "profession",
            "job title",
            "designation",
            "employment",
            "work role",
            "nature of work",
        ),
        "Enter what you do for work. Example: Nurse.",
    ),
    (
        ("city", "town", "municipality", "taluk", "tehsil", "mandal", "village"),
        "Type the city or town where you live.",
    ),
    (
        (
            "remark",
            "remarks",
            "comment",
            "comments",
            "additional info",
            "other details",
            "special instruction",
            "feedback",
            "note to officer",
            "justification",
        ),
        "Optional notes for reviewers. Leave blank if nothing applies.",
    ),
    (
        (
            "address",
            "street",
            "locality",
            "residence",
            "residential",
            "correspondence",
            "mailing",
            "house no",
            "flat no",
            "building",
            "premises",
            "location of",
        ),
        "Enter where you live: house or flat, street, city, and PIN code.",
    ),
]


def _clean(text: str) -> str:
    t = text.strip()
    t = re.sub(r"\s+", " ", t)
    return t


def _semantic_kw_matches(lower: str, keyword: str) -> bool:
    """Word-boundary match for single tokens; phrase match for multi-word cues."""
    if " " in keyword:
        return keyword in lower
    return re.search(rf"\b{re.escape(keyword)}\b", lower) is not None


def _try_semantic_keyword_groups(lower: str) -> Optional[str]:
    for keywords, hint in KEYWORD_SEMANTIC_GROUPS:
        if any(_semantic_kw_matches(lower, kw) for kw in keywords):
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
    """Accessibility-oriented default without echoing the raw label."""
    hint = _try_semantic_keyword_groups(raw.lower())
    if hint:
        return hint
    if len(raw) <= 120:
        return "Fill in this field with the information the form asks for."
    return "Enter the details requested in this section of the form."


def simplify_rules(text: str) -> str:
    """Hybrid contextual simplification without any network call."""
    raw = _clean(text)
    if not raw:
        return "No label was found; ask the site owner for help or skip if optional."

    hint = _try_rule_hints(text)
    if hint:
        return hint
    return _generic_rule_fallback(raw)


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
            "Father's name = पिता का नाम (not applicant's own name). Mother's name = माता का नाम. "
            "Upload fields = फ़ाइल/फोटो/PDF अपलोड करें, टेक्स्ट नहीं।"
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
            "Father's name = ತಂದೆಯ ಹೆಸರು (not your own name). Mother's name = ತಾಯಿಯ ಹೆಸರು. "
            "Upload fields = ಫೋಟೋ/PDF ಅಪ್ಲೋಡ್ ಮಾಡಿ, ಪಠ್ಯ ಅಲ್ಲ."
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
            "Keep answers short and friendly. "
            "If the field is a file upload, tell the user to upload a photo or PDF — never ask them to type text."
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
    Returns (simplified_text, source) where source is 'llm' or HYBRID_SOURCE.
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
        return empty, HYBRID_SOURCE

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
        return result, HYBRID_SOURCE

    if use_kn:
        from simplify_kn import simplify_rules_kn

        result = simplify_rules_kn(cleaned)
        if result.startswith("ಇಲ್ಲಿ ನಮೂದಿಸಿ:") or result.startswith("ಲೇಬಲ್ ಪ್ರಕಾರ"):
            improved = _maybe_translate_fallback(
                _generic_rule_fallback(cleaned), "kn"
            )
            if improved != _generic_rule_fallback(cleaned):
                return improved, "llm"
        return result, HYBRID_SOURCE

    return simplify_rules(cleaned), HYBRID_SOURCE
