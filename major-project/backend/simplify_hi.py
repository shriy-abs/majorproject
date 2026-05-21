"""
Hindi simplification hints (mirrors simplify.py rule outputs).
"""
from __future__ import annotations

import re
from typing import Optional

PHRASE_HINTS_HI = [
    (
        r"(?i)\b(permanent\s+residential\s+address|permanent\s+address)\b",
        "अपना पूरा घर का पता आधिकारिक दस्तावेज़ जैसा लिखें। उदाहरण: मकान नंबर, गली, शहर, पिन कोड।",
    ),
    (
        r"(?i)\b(full\s+name|applicant'?s?\s+name)\b",
        "अपना पूरा कानूनी नाम आईडी पर जैसा है वैसा लिखें। उदाहरण: प्रिया शर्मा।",
    ),
    (
        r"(?i)\bdate\s+of\s+birth\b",
        "जिस दिन आपका जन्म हुआ वह तारीख चुनें। उदाहरण: 15 मार्च 1998।",
    ),
    (
        r"(?i)\bannual\s+household\s+income\b",
        "परिवार की सालाना आय, टैक्स से पहले, अंकों में लिखें। उदाहरण: 450000।",
    ),
    (
        r"(?i)\baadhaar\b",
        "12 अंकों का आधार नंबर बिना रिक्त स्थान के लिखें। उदाहरण: 123456789012।",
    ),
    (
        r"(?i)\bemail\b",
        "वह ईमेल लिखें जो आप नियमित देखते हैं। उदाहरण: naam@gmail.com।",
    ),
    (
        r"(?i)\bphone|mobile|contact\s+number\b",
        "वह मोबाइल नंबर लिखें जहाँ आप संपर्क हो सकें। उदाहरण: +91 9876543210।",
    ),
    (
        r"(?i)\bid\s+proof|upload\s+id\b",
        "सरकारी आईडी की साफ़ फोटो या स्कैन अपलोड करें।",
    ),
    (
        r"(?i)\bapplication\s+category\b|\bcategory\b",
        "अपनी सही श्रेणी चुनें। उदाहरण: छात्र।",
    ),
    (
        r"(?i)\bpan\b",
        "पैन कार्ड पर जैसा 10 अक्षर का पैन लिखें। उदाहरण: ABCDE1234F।",
    ),
    (
        r"(?i)\bpin\s*code\b",
        "6 अंकों का पिन कोड लिखें। उदाहरण: 560001।",
    ),
    (
        r"(?i)\bfather'?s?\s+name\b",
        "पिता या अभिभावक का पूरा नाम लिखें।",
    ),
    (
        r"(?i)\bpassword\b",
        "मज़बूत पासवर्ड बनाएँ। कम से कम 8 अंक, एक अक्षर और एक संख्या।",
    ),
]

KEYWORD_FALLBACKS_HI = [
    (
        r"(?i)\be[- ]?mail\b|\bemail\b",
        "सही ईमेल पता लिखें। उदाहरण: naam@gmail.com।",
    ),
    (
        r"(?i)\bphone\b|\bmobile\b|\bcontact\s*number\b",
        "अपना फ़ोन नंबर लिखें। उदाहरण: 9876543210।",
    ),
    (
        r"(?i)\bdob\b|\bdate\s+of\s+birth\b",
        "अपनी जन्म तिथि लिखें।",
    ),
    (
        r"(?i)\bincome\b|\bsalary\b",
        "सालाना आय अंकों में लिखें।",
    ),
    (
        r"(?i)\baddress\b|\bpin\b",
        "पूरा पता और पिन कोड लिखें।",
    ),
    (
        r"(?i)\bname\b",
        "पूरा नाम लिखें।",
    ),
]

KEYWORD_SEMANTIC_HI = [
    (("city", "town", "residence"), "वह शहर लिखें जहाँ आप रहते हैं।"),
    (("remark", "comment", "feedback"), "अतिरिक्त जानकारी लिखें या खाली छोड़ें।"),
]


def simplify_rules_hi(text: str) -> str:
    raw = re.sub(r"\s+", " ", text.strip())
    if not raw:
        return "कोई लेबल नहीं मिला। मदद के लिए साइट से पूछें या खाली छोड़ें।"

    lower = raw.lower()
    for pattern, hint in PHRASE_HINTS_HI:
        if re.search(pattern, lower):
            return hint
    for pattern, hint in KEYWORD_FALLBACKS_HI:
        if re.search(pattern, lower):
            return hint
    for keywords, hint in KEYWORD_SEMANTIC_HI:
        if any(kw in lower for kw in keywords):
            return hint

    if len(raw) <= 80:
        return f"यहाँ भरें: {raw}।"
    snippet = raw[:120] + ("…" if len(raw) > 120 else "")
    return f"लेबल के अनुसार भरें: {snippet}।"
