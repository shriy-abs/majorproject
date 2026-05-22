"""
Kannada simplification hints (mirrors simplify.py rule outputs).
"""
from __future__ import annotations

import re

PHRASE_HINTS_KN = [
    (
        r"(?i)\b(permanent\s+residential\s+address|permanent\s+address)\b",
        "ಅಧಿಕೃತ ದಾಖಲೆಗಳಲ್ಲಿರುವಂತೆ ನಿಮ್ಮ ಸಂಪೂರ್ಣ ಮನೆಯ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ಮನೆ ಸಂಖ್ಯೆ, ಬೀದಿ, ನಗರ, ಪಿನ್ ಕೋಡ್.",
    ),
    (
        r"(?i)\b(full\s+name|applicant'?s?\s+name)\b",
        "ಐಡಿಯಲ್ಲಿರುವಂತೆ ನಿಮ್ಮ ಪೂರ್ಣ ಕಾನೂನುಬದ್ಧ ಹೆಸರನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ಪ್ರಿಯಾ ಶರ್ಮಾ.",
    ),
    (
        r"(?i)\bdate\s+of\s+birth\b",
        "ನೀವು ಹುಟ್ಟಿದ ದಿನಾಂಕವನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಉದಾಹರಣೆ: 15 ಮಾರ್ಚ್ 1998.",
    ),
    (
        r"(?i)\bannual\s+household\s+income\b",
        "ಕುಟುಂಬದ ವಾರ್ಷಿಕ ಆದಾಯವನ್ನು ತೆರಿಗೆಗೆ ಮೊದಲು ಸಂಖ್ಯೆಯಲ್ಲಿ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 450000.",
    ),
    (
        r"(?i)\baadhaar\b",
        "ಖಾಲಿ ಜಾಗವಿಲ್ಲದೆ 12 ಅಂಕಿಯ ಆಧಾರ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 123456789012.",
    ),
    (
        r"(?i)\bemail\b",
        "ನೀವು ನಿಯಮಿತವಾಗಿ ನೋಡುವ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: hesaru@gmail.com.",
    ),
    (
        r"(?i)\bphone|mobile|contact\s+number\b",
        "ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಲು ಸಾಧ್ಯವಾದ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: +91 9876543210.",
    ),
    (
        r"(?i)\bid\s+proof|upload\s+id\b",
        "ಸರ್ಕಾರಿ ಐಡಿಯ ಸ್ಪಷ್ಟ ಫೋಟೋ ಅಥವಾ ಸ್ಕ್ಯಾನ್ ಅಪ್ಲೋಡ್ ಮಾಡಿ.",
    ),
    (
        r"(?i)\bapplication\s+category\b|\bcategory\b",
        "ನಿಮಗೆ ಸರಿಯಾದ ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಉದಾಹರಣೆ: ವಿದ್ಯಾರ್ಥಿ.",
    ),
    (
        r"(?i)\bpan\b",
        "ಪ್ಯಾನ್ ಕಾರ್ಡ್ನಲ್ಲಿರುವಂತೆ 10 ಅಕ್ಷರದ ಪ್ಯಾನ್ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ABCDE1234F.",
    ),
    (
        r"(?i)\bpin\s*code\b",
        "6 ಅಂಕಿಯ ಪಿನ್ ಕೋಡ್ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 560001.",
    ),
    (
        r"(?i)\bfather'?s?\s+name\b|\bfather\s+name\b|\bname\s+of\s+(?:the\s+)?father\b|\bpaternal\s+name\b",
        "ನಿಮ್ಮ ತಂದೆಯ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ, ನಿಮ್ಮ ಹೆಸರಲ್ಲ.",
    ),
    (
        r"(?i)\bmother'?s?\s+name\b|\bmother\s+name\b|\bname\s+of\s+(?:the\s+)?mother\b|\bmaternal\s+name\b",
        "ನಿಮ್ಮ ತಾಯಿಯ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ, ನಿಮ್ಮ ಹೆಸರಲ್ಲ.",
    ),
    (
        r"(?i)\b(?:guardian|spouse)'?s?\s+name\b|\bname\s+of\s+(?:the\s+)?guardian\b",
        "ಪೋಷಕ ಅಥವಾ ಜೀವನ ಸಂಗಿಯ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.",
    ),
    (
        r"(?i)\bpassword\b",
        "ಬಲವಾದ ಪಾಸ್ವರ್ಡ್ ರಚಿಸಿ. ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳು, ಒಂದು ಅಕ್ಷರ ಮತ್ತು ಒಂದು ಸಂಖ್ಯೆ.",
    ),
]

KEYWORD_FALLBACKS_KN = [
    (
        r"(?i)\be[- ]?mail\b|\bemail\b",
        "ಸರಿಯಾದ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: hesaru@gmail.com.",
    ),
    (
        r"(?i)\bphone\b|\bmobile\b|\bcell\b|\btelephone\b|\btel\.?\b|\bwhatsapp\b|\bcontact\s*(?:number|no\.?)\b",
        "ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 9876543210.",
    ),
    (
        r"(?i)\bdob\b|\bdate\s+of\s+birth\b|\bbirth\s*date\b",
        "ನಿಮ್ಮ ಜನ್ಮ ದಿನಾಂಕವನ್ನು ನಮೂದಿಸಿ.",
    ),
    (
        r"(?i)\bincome\b|\bsalary\b|\bremuneration\b",
        "ವಾರ್ಷಿಕ ಆದಾಯವನ್ನು ಸಂಖ್ಯೆಯಲ್ಲಿ ನಮೂದಿಸಿ.",
    ),
    (
        r"(?i)\b(?:street|locality|pin\s*code|postal|zip|address)\b",
        "ಸಂಪೂರ್ಣ ವಿಳಾಸ ಮತ್ತು ಪಿನ್ ಕೋಡ್ ನಮೂದಿಸಿ.",
    ),
    (
        r"(?i)\b(?:full|first|last|given|family|applicant)\s+name\b|\bsurname\b|\bname\b",
        "ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.",
    ),
]

KEYWORD_SEMANTIC_KN = [
    (("city", "town", "residence", "location"), "ನೀವು ವಾಸಿಸುವ ನಗರವನ್ನು ನಮೂದಿಸಿ."),
    (("comment", "remark", "feedback", "notes"), "ಅಗತ್ಯವಿದ್ದರೆ ಹೆಚ್ಚುವರಿ ಮಾಹಿತಿ ನಮೂದಿಸಿ ಅಥವಾ ಖಾಲಿ ಬಿಡಿ."),
]


def simplify_rules_kn(text: str) -> str:
    raw = re.sub(r"\s+", " ", text.strip())
    if not raw:
        return "ಯಾವುದೇ ಲೇಬಲ್ ಕಂಡುಬಂದಿಲ್ಲ. ಸಹಾಯಕ್ಕಾಗಿ ಸೈಟ್ ಮಾಲೀಕರನ್ನು ಕೇಳಿ ಅಥವಾ ಖಾಲಿ ಬಿಡಿ."

    lower = raw.lower()
    for pattern, hint in PHRASE_HINTS_KN:
        if re.search(pattern, lower):
            return hint
    for pattern, hint in KEYWORD_FALLBACKS_KN:
        if re.search(pattern, lower):
            return hint
    for keywords, hint in KEYWORD_SEMANTIC_KN:
        if any(kw in lower for kw in keywords):
            return hint

    if len(raw) <= 80:
        return f"ಇಲ್ಲಿ ನಮೂದಿಸಿ: {raw}."
    snippet = raw[:120] + ("…" if len(raw) > 120 else "")
    return f"ಲೇಬಲ್ ಪ್ರಕಾರ ನಮೂದಿಸಿ: {snippet}."
