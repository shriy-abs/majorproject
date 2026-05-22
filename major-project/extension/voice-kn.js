/**
 * Kannada voice translations — phrases for TTS.
 */
(function () {
  const EXACT = [
    [
      "Email should include an @ symbol, for example name@gmail.com.",
      "ಇಮೇಲ್ನಲ್ಲಿ @ ಚಿಹ್ನೆ ಇರಬೇಕು. ಉದಾಹರಣೆ: hesaru@gmail.com.",
    ],
    [
      "Email should include a dot after the @, for example name@gmail.com.",
      "ಇಮೇಲ್ನಲ್ಲಿ @ ನಂತರ ಬಿಂದು ಇರಬೇಕು. ಉದಾಹರಣೆ: hesaru@gmail.com.",
    ],
    [
      "This does not look like a complete email. Check spelling and try again.",
      "ಇದು ಸರಿಯಾದ ಇಮೇಲ್ ಅಲ್ಲ. ದಯವಿಟ್ಟು ಕಾಗುಣತೆ ಪರಿಶೀಲಿಸಿ.",
    ],
    [
      "Phone numbers should use digits only. Remove letters and symbols except + if needed.",
      "ಫೋನ್ ಸಂಖ್ಯೆಯಲ್ಲಿ ಅಂಕಿಗಳು ಮಾತ್ರ ಇರಬೇಕು. ಅಕ್ಷರಗಳನ್ನು ತೆಗೆದುಹಾಕಿ.",
    ],
    [
      "Enter your home address exactly as on official documents. Example: House no., street, city, PIN code.",
      "ಅಧಿಕೃತ ದಾಖಲೆಗಳಲ್ಲಿರುವಂತೆ ನಿಮ್ಮ ಸಂಪೂರ್ಣ ಮನೆಯ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ.",
    ],
    [
      "Enter your full legal name as printed on your ID. Example: Priya Sharma.",
      "ಐಡಿಯಲ್ಲಿರುವಂತೆ ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ಪ್ರಿಯಾ ಶರ್ಮಾ.",
    ],
    [
      "Enter an email you check regularly. Example: name@gmail.com.",
      "ನೀವು ನಿಯಮಿತವಾಗಿ ನೋಡುವ ಇಮೇಲ್ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: hesaru@gmail.com.",
    ],
    [
      "Enter a phone number you can be reached on. Example: +91 98765 43210.",
      "ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಲು ಸಾಧ್ಯವಾದ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.",
    ],
    [
      "Enter a valid email address. Example: name@gmail.com.",
      "ಸರಿಯಾದ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ.",
    ],
    [
      "Enter your phone number. Example: 9876543210.",
      "ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 9876543210.",
    ],
    [
      "No label was found; ask the site owner for help or skip if optional.",
      "ಯಾವುದೇ ಲೇಬಲ್ ಕಂಡುಬಂದಿಲ್ಲ. ಸಹಾಯಕ್ಕಾಗಿ ಸೈಟ್ ಮಾಲೀಕರನ್ನು ಕೇಳಿ.",
    ],
    [
      "Enter the value this field is asking for.",
      "ಈ ಫೀಲ್ಡ್ ಕೇಳುವ ಮಾಹಿತಿಯನ್ನು ನಮೂದಿಸಿ.",
    ],
  ];

  const FIELD_KIND_KN = {
    email: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: hesaru@gmail.com",
    phone: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ. ಕನಿಷ್ಠ 10 ಅಂಕಿಗಳು.",
    password: "ಬಲವಾದ ಪಾಸ್ವರ್ಡ್ ರಚಿಸಿ. ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳು, ಒಂದು ಅಕ್ಷರ ಮತ್ತು ಒಂದು ಸಂಖ್ಯೆ.",
  };

  function translate(text) {
    if (!text) return text;
    let out = text.trim();

    const typo = out.match(/^Did you mean (\S+)\?$/i);
    if (typo) return `ನಿಮಗೆ ${typo[1]} ಅರ್ಥವೇ?`;

    const exact = EXACT.find(([en]) => out === en);
    if (exact) return exact[1];

    for (const [en, kn] of EXACT) {
      if (out.includes(en)) {
        out = out.replace(en, kn);
        break;
      }
    }

    out = out.replace(
      /Enter at least 10 digits\. You have (\d+) so far\./,
      "ಕನಿಷ್ಠ 10 ಅಂಕಿಗಳು ನಮೂದಿಸಿ. ಈಗ $1 ಅಂಕಿಗಳಿವೆ."
    );
    out = out.replace(
      /Use a stronger password with (.+)\./,
      "ಬಲವಾದ ಪಾಸ್ವರ್ಡ್ ಬಳಸಿ: $1."
    );
    out = out.replace(/at least 8 characters/g, "ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳು");
    out = out.replace(/a letter/g, "ಒಂದು ಅಕ್ಷರ");
    out = out.replace(/a number/g, "ಒಂದು ಸಂಖ್ಯೆ");
    out = out.replace(
      /This field is asking for: (.+)\. Use simple words/,
      "ಈ ಫೀಲ್ಡ್ ಕೇಳುತ್ತಿದೆ: $1. ಸರಳ ಪದಗಳಲ್ಲಿ ನಮೂದಿಸಿ"
    );

    return out;
  }

  window.CFAVoiceKN = {
    translate,
    fieldKindHint: (kind) => (kind && FIELD_KIND_KN[kind]) || null,
  };
})();
