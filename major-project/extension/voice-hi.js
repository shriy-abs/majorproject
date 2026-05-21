/**
 * Hindi voice translations — full phrases for TTS (not just setting hi-IN lang).
 */
(function () {
  /** Longest keys first for greedy matching */
  const EXACT = [
    [
      "Email should include an @ symbol, for example name@gmail.com.",
      "ईमेल में @ चिह्न होना चाहिए। उदाहरण: naam@gmail.com।",
    ],
    [
      "Email should include a dot after the @, for example name@gmail.com.",
      "ईमेल में @ के बाद बिंदु होना चाहिए। उदाहरण: naam@gmail.com।",
    ],
    [
      "This does not look like a complete email. Check spelling and try again.",
      "यह सही ईमेल नहीं लगता। कृपया वर्तनी जाँचें।",
    ],
    [
      "Phone numbers should use digits only. Remove letters and symbols except + if needed.",
      "फ़ोन नंबर में केवल अंक होने चाहिए। अक्षर हटाएँ। + चिह्न चल सकता है।",
    ],
    [
      "Enter your home address exactly as on official documents. Example: House no., street, city, PIN code.",
      "अपना पूरा घर का पता आधिकारिक दस्तावेज़ जैसा लिखें। उदाहरण: मकान नंबर, गली, शहर, पिन कोड।",
    ],
    [
      "Enter your full legal name as printed on your ID. Example: Priya Sharma.",
      "अपना पूरा कानूनी नाम आईडी पर जैसा है वैसा लिखें। उदाहरण: प्रिया शर्मा।",
    ],
    [
      "Pick the calendar day you were born. Example: 15 March 1998.",
      "जिस दिन आपका जन्म हुआ वह तारीख चुनें। उदाहरण: 15 मार्च 1998।",
    ],
    [
      "Enter your household's total yearly income before tax, in numbers. Example: 450000.",
      "परिवार की सालाना आय, टैक्स से पहले, अंकों में लिखें। उदाहरण: 450000।",
    ],
    [
      "Enter your 12-digit Aadhaar with no spaces. Example: 123456789012.",
      "12 अंकों का आधार नंबर बिना रिक्त स्थान के लिखें। उदाहरण: 123456789012।",
    ],
    [
      "Enter an email you check regularly. Example: name@gmail.com.",
      "वह ईमेल लिखें जो आप नियमित देखते हैं। उदाहरण: naam@gmail.com।",
    ],
    [
      "Enter a phone number you can be reached on. Example: +91 98765 43210.",
      "वह मोबाइल नंबर लिखें जहाँ आप संपर्क हो सकें। उदाहरण: +91 9876543210।",
    ],
    [
      "Upload a clear scan or photo of a government ID. Example: Aadhaar PDF or JPEG.",
      "सरकारी आईडी की साफ़ फोटो या स्कैन अपलोड करें। उदाहरण: आधार पीडीएफ या जेपीईजी।",
    ],
    [
      "Choose the category that matches you best. Example: Student.",
      "अपनी सही श्रेणी चुनें। उदाहरण: छात्र।",
    ],
    [
      "Enter your 10-character PAN as on the card. Example: ABCDE1234F.",
      "पैन कार्ड पर जैसा 10 अक्षर का पैन लिखें। उदाहरण: ABCDE1234F।",
    ],
    [
      "Enter your 6-digit postal PIN. Example: 560001.",
      "6 अंकों का पिन कोड लिखें। उदाहरण: 560001।",
    ],
    [
      "Enter a valid email address. Example: name@gmail.com.",
      "सही ईमेल पता लिखें। उदाहरण: naam@gmail.com।",
    ],
    [
      "Enter your phone number. Example: 9876543210.",
      "अपना फ़ोन नंबर लिखें। उदाहरण: 9876543210।",
    ],
    [
      "Enter your date of birth. Example: 15 March 2000.",
      "अपनी जन्म तिथि लिखें। उदाहरण: 15 मार्च 2000।",
    ],
    [
      "Enter your yearly income in numbers. Example: 500000.",
      "सालाना आय अंकों में लिखें। उदाहरण: 500000।",
    ],
    [
      "Enter your complete home address. Example: House No, Street, City, PIN code.",
      "पूरा घर का पता लिखें। उदाहरण: मकान नंबर, गली, शहर, पिन कोड।",
    ],
    [
      "Enter your full name as per official records. Example: Priya Sharma.",
      "अधिकारिक रिकॉर्ड के अनुसार पूरा नाम लिखें। उदाहरण: प्रिया शर्मा।",
    ],
    [
      "Enter the city where you currently live. Example: Bangalore.",
      "वह शहर लिखें जहाँ आप अभी रहते हैं। उदाहरण: बेंगलुरु।",
    ],
    [
      "Enter any additional information if required. You can leave this blank if not applicable.",
      "अगर ज़रूरी हो तो अतिरिक्त जानकारी लिखें। नहीं तो खाली छोड़ सकते हैं।",
    ],
    [
      "No label was found; ask the site owner for help or skip if optional.",
      "कोई लेबल नहीं मिला। मदद के लिए साइट से पूछें या खाली छोड़ें।",
    ],
    [
      "Enter the value this field is asking for.",
      "इस फ़ील्ड में जो माँगा गया है वह भरें।",
    ],
  ];

  const FIELD_KIND_HI = {
    email: "कृपया अपना ईमेल पता दर्ज करें। उदाहरण: naam@gmail.com",
    phone: "कृपया अपना मोबाइल नंबर दर्ज करें। कम से कम 10 अंक।",
    password: "मज़बूत पासवर्ड बनाएँ। कम से कम 8 अंक, एक अक्षर और एक संख्या।",
  };

  function translate(text) {
    if (!text) return text;
    let out = text.trim();

    const typo = out.match(/^Did you mean (\S+)\?$/i);
    if (typo) return `क्या आपका मतलब ${typo[1]} है?`;

    const exact = EXACT.find(([en]) => out === en);
    if (exact) return exact[1];

    for (const [en, hi] of EXACT) {
      if (out.includes(en)) {
        out = out.replace(en, hi);
        break;
      }
    }

    out = out.replace(
      /Enter at least 10 digits\. You have (\d+) so far\./,
      "कम से कम 10 अंक दर्ज करें। अभी $1 अंक हैं।"
    );
    out = out.replace(
      /Use a stronger password with (.+)\./,
      "मज़बूत पासवर्ड बनाएँ: $1।"
    );
    out = out.replace(/at least 8 characters/g, "कम से कम 8 अक्षर");
    out = out.replace(/a letter/g, "एक अक्षर");
    out = out.replace(/a number/g, "एक संख्या");
    out = out.replace(
      /This field is asking for: (.+)\. Use simple words/,
      "यह फ़ील्ड पूछ रहा है: $1। सरल शब्दों में भरें"
    );
    out = out.replace(/^Enter: [""](.+)[""]\.$/, "यहाँ भरें: $1।");
    out = out.replace(
      /^Enter what the label describes: [""](.+)[""]\.$/,
      "लेबल के अनुसार भरें: $1।"
    );

    return out;
  }

  window.CFAVoiceHI = {
    translate,
    fieldKindHint: (kind) => (kind && FIELD_KIND_HI[kind]) || null,
  };
})();
