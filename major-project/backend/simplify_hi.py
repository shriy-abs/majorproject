"""
Hindi simplification hints (mirrors simplify.py rule outputs).
"""
from __future__ import annotations

import re
from typing import Optional

PHRASE_HINTS_HI = [
    (
        r"(?i)\bupload\s+(?:government\s+)?(?:id|identity)\s*proof\b|"
        r"\bupload\s+(?:government\s+)?id\s*proof\s*\([^)]*(?:aadhaar|voter|passport)",
        "सरकारी आईडी की साफ़ फोटो या PDF अपलोड करें (आधार, वोटर आईडी या पासपोर्ट)। "
        "JPG, PNG या PDF चुनें। यहाँ टेक्स्ट न लिखें।",
    ),
    (
        r"(?i)\bupload\s+address\s*proof\b|"
        r"\bupload\s+address\s*proof\s*\([^)]*(?:utility|rent|bill|agreement)",
        "पते का प्रमाण (बिजली बिल, किराया अनुबंध आदि) की फोटो या PDF अपलोड करें। "
        "यहाँ टेक्स्ट न लिखें।",
    ),
    (
        r"(?i)\bupload\b.*\b(?:proof|document|certificate|photo|scan)\b|"
        r"\battach\s+(?:file|document)\b|\bchoose\s+file\b",
        "फ़ाइल अपलोड बटन से दस्तावेज़ (फोटो या PDF) चुनें। टेक्स्ट न भरें।",
    ),
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
        r"(?i)\baadhaar\s*(?:number|no\.?|#)?\b|\b12[- ]?digit\s+aadhaar\b",
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
        r"(?i)\bfather'?s?\s+name\b|\bfather\s+name\b|\bname\s+of\s+(?:the\s+)?father\b|\bpaternal\s+name\b",
        "अपने पिता का पूरा नाम लिखें, अपना नाम नहीं।",
    ),
    (
        r"(?i)\bmother'?s?\s+name\b|\bmother\s+name\b|\bname\s+of\s+(?:the\s+)?mother\b|\bmaternal\s+name\b",
        "अपनी माता का पूरा नाम लिखें, अपना नाम नहीं।",
    ),
    (
        r"(?i)\b(?:guardian|spouse)'?s?\s+name\b|\bname\s+of\s+(?:the\s+)?guardian\b",
        "अभिभावक या पति/पत्नी का पूरा नाम लिखें।",
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
        r"(?i)\bphone\b|\bmobile\b|\bcell\b|\btelephone\b|\btel\.?\b|\bwhatsapp\b|\bcontact\s*(?:number|no\.?)\b|\bmob\.?\b",
        "अपना फ़ोन नंबर लिखें। उदाहरण: 9876543210।",
    ),
    (
        r"(?i)\bdob\b|\bdate\s+of\s+birth\b|\bbirth\s*date\b|\bbirthdate\b",
        "अपनी जन्म तिथि लिखें। उदाहरण: 15 मार्च 2000।",
    ),
    (
        r"(?i)\bincome\b|\bsalary\b|\bremuneration\b",
        "सालाना आय अंकों में लिखें। उदाहरण: 500000।",
    ),
    (
        r"(?i)\b(?:street|locality|pin\s*code|postal|zip|mailing|correspondence|residential|residence|permanent)\b|"
        r"\b(?:current|living)\s+address\b|\bliving\s+area\b|\baddress(?:\s*line)?\b(?!.*\bproof\b)",
        "पूरा घर का पता और पिन कोड लिखें। उदाहरण: मकान नंबर, गली, शहर, पिन कोड।",
    ),
    (
        r"(?i)\b(?:full|first|last|given|family|applicant)\s+name\b|\bsurname\b|\bname\b",
        "पूरा नाम लिखें। उदाहरण: प्रिया शर्मा।",
    ),
    (
        r"(?i)\bpassword\b|\bpassphrase\b",
        "मज़बूत पासवर्ड बनाएँ। कम से कम 8 अक्षर, एक अक्षर और एक संख्या।",
    ),
    (
        r"(?i)\bupload\b|\battach\b|\bfile\b|\bdocument\b",
        "स्पष्ट फ़ाइल या फोटो अपलोड करें।",
    ),
    (
        r"(?i)\bselect\b|\bchoose\b|\bpick\b|\boption\b",
        "सूची से सही विकल्प चुनें।",
    ),
]

KEYWORD_SEMANTIC_HI = [
    (("city", "town", "residence", "location", "place"), "वह शहर लिखें जहाँ आप रहते हैं। उदाहरण: बेंगलुरु।"),
    (("remark", "comment", "feedback", "notes", "description"), "अतिरिक्त जानकारी लिखें या खाली छोड़ें।"),
    (("gender", "sex"), "अपना लिंग चुनें।"),
    (("state", "district", "taluk", "village"), "अपना राज्य/जिला/गाँव चुनें या लिखें।"),
    (("qualification", "education", "degree"), "अपनी शिक्षा/योग्यता चुनें या लिखें।"),
    (("occupation", "profession", "employment"), "अपना व्यवसाय या नौकरी का प्रकार लिखें।"),
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
