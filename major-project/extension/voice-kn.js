/**
 * Kannada voice translations — phrases for TTS and display fallback.
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
      "ಫೋನ್ ಸಂಖ್ಯೆಯಲ್ಲಿ ಅಂಕಿಗಳು ಮಾತ್ರ ಇರಬೇಕು. ಅಕ್ಷರಗಳನ್ನು ತೆಗೆದುಹಾಕಿ. + ಚಿಹ್ನೆ ಬಳಸಬಹುದು.",
    ],
    [
      "Enter your home address exactly as on official documents. Example: House no., street, city, PIN code.",
      "ಅಧಿಕೃತ ದಾಖಲೆಗಳಲ್ಲಿರುವಂತೆ ನಿಮ್ಮ ಸಂಪೂರ್ಣ ಮನೆಯ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ಮನೆ ಸಂಖ್ಯೆ, ಬೀದಿ, ನಗರ, ಪಿನ್ ಕೋಡ್.",
    ],
    [
      "Enter your full legal name as printed on your ID. Example: Priya Sharma.",
      "ಐಡಿಯಲ್ಲಿರುವಂತೆ ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ಪ್ರಿಯಾ ಶರ್ಮಾ.",
    ],
    [
      "Pick the calendar day you were born. Example: 15 March 1998.",
      "ನೀವು ಹುಟ್ಟಿದ ದಿನಾಂಕವನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಉದಾಹರಣೆ: 15 ಮಾರ್ಚ್ 1998.",
    ],
    [
      "Enter your household's total yearly income before tax, in numbers. Example: 450000.",
      "ಕುಟುಂಬದ ವಾರ್ಷಿಕ ಆದಾಯವನ್ನು ತೆರಿಗೆಗೆ ಮೊದಲು ಸಂಖ್ಯೆಯಲ್ಲಿ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 450000.",
    ],
    [
      "Enter your 12-digit Aadhaar with no spaces. Example: 123456789012.",
      "ಖಾಲಿ ಜಾಗವಿಲ್ಲದೆ 12 ಅಂಕಿಯ ಆಧಾರ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 123456789012.",
    ],
    [
      "Enter an email you check regularly. Example: name@gmail.com.",
      "ನೀವು ನಿಯಮಿತವಾಗಿ ನೋಡುವ ಇಮೇಲ್ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: hesaru@gmail.com.",
    ],
    [
      "Enter a phone number you can be reached on. Example: +91 98765 43210.",
      "ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಲು ಸಾಧ್ಯವಾದ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: +91 9876543210.",
    ],
    [
      "Choose a file to upload: a clear photo or PDF of your government ID (Aadhaar, Voter ID, or Passport). Accepted: JPG, PNG, or PDF. Do not type text here.",
      "ಸರ್ಕಾರಿ ಐಡಿಯ ಸ್ಪಷ್ಟ ಫೋಟೋ ಅಥವಾ PDF ಅಪ್ಲೋಡ್ ಮಾಡಿ (ಆಧಾರ್, ವೋಟರ್ ಐಡಿ ಅಥವಾ ಪಾಸ್ಪೋರ್ಟ್). ಇಲ್ಲಿ ಪಠ್ಯ ಬರೆಯಬೇಡಿ.",
    ],
    [
      "Choose a file to upload: a photo or PDF of your address proof (utility bill, rent agreement, etc.). Accepted: JPG, PNG, or PDF. Do not type text here.",
      "ವಿಳಾಸದ ಪುರಾವಿನ ಫೋಟೋ ಅಥವಾ PDF ಅಪ್ಲೋಡ್ ಮಾಡಿ. ಇಲ್ಲಿ ಪಠ್ಯ ಬರೆಯಬೇಡಿ.",
    ],
    [
      "Use the file upload button to attach a document (image or PDF). Do not enter text in this field.",
      "ಫೈಲ್ ಅಪ್ಲೋಡ್ ಬಟನ್ ಮೂಲಕ ದಾಖಲೆ ಲಗತ್ತಿಸಿ. ಪಠ್ಯ ನಮೂದಿಸಬೇಡಿ.",
    ],
    [
      "Choose the category that matches you best. Example: Student.",
      "ನಿಮಗೆ ಸರಿಯಾದ ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಉದಾಹರಣೆ: ವಿದ್ಯಾರ್ಥಿ.",
    ],
    [
      "Enter your 10-character PAN as on the card. Example: ABCDE1234F.",
      "ಪ್ಯಾನ್ ಕಾರ್ಡ್ನಲ್ಲಿರುವಂತೆ 10 ಅಕ್ಷರದ ಪ್ಯಾನ್ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ABCDE1234F.",
    ],
    [
      "Enter your 6-digit postal PIN. Example: 560001.",
      "6 ಅಂಕಿಯ ಪಿನ್ ಕೋಡ್ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 560001.",
    ],
    [
      "Enter a valid email address. Example: name@gmail.com.",
      "ಸರಿಯಾದ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: hesaru@gmail.com.",
    ],
    [
      "Enter your phone number. Example: 9876543210.",
      "ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 9876543210.",
    ],
    [
      "Enter your date of birth. Example: 15 March 2000.",
      "ನಿಮ್ಮ ಜನ್ಮ ದಿನಾಂಕ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 15 ಮಾರ್ಚ್ 2000.",
    ],
    [
      "Enter your yearly income in numbers. Example: 500000.",
      "ವಾರ್ಷಿಕ ಆದಾಯವನ್ನು ಸಂಖ್ಯೆಯಲ್ಲಿ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: 500000.",
    ],
    [
      "Enter your complete home address. Example: House No, Street, City, PIN code.",
      "ಸಂಪೂರ್ಣ ಮನೆಯ ವಿಳಾಸ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ಮನೆ ಸಂಖ್ಯೆ, ಬೀದಿ, ನಗರ, ಪಿನ್ ಕೋಡ್.",
    ],
    [
      "Enter your full name as per official records. Example: Priya Sharma.",
      "ಅಧಿಕೃತ ದಾಖಲೆಗಳ ಪ್ರಕಾರ ಪೂರ್ಣ ಹೆಸರು ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ಪ್ರಿಯಾ ಶರ್ಮಾ.",
    ],
    [
      "Enter the city where you currently live. Example: Bangalore.",
      "ನೀವು ವಾಸಿಸುವ ನಗರ ನಮೂದಿಸಿ. ಉದಾಹರಣೆ: ಬೆಂಗಳೂರು.",
    ],
    [
      "Enter any additional information if required. You can leave this blank if not applicable.",
      "ಅಗತ್ಯವಿದ್ದರೆ ಹೆಚ್ಚುವರಿ ಮಾಹಿತಿ ನಮೂದಿಸಿ. ಇಲ್ಲದಿದ್ದರೆ ಖಾಲಿ ಬಿಡಬಹುದು.",
    ],
    [
      "No label was found; ask the site owner for help or skip if optional.",
      "ಯಾವುದೇ ಲೇಬಲ್ ಕಂಡುಬಂದಿಲ್ಲ. ಸಹಾಯಕ್ಕಾಗಿ ಸೈಟ್ ಮಾಲೀಕರನ್ನು ಕೇಳಿ ಅಥವಾ ಖಾಲಿ ಬಿಡಿ.",
    ],
    [
      "Enter the value this field is asking for.",
      "ಈ ಫೀಲ್ಡ್ ಕೇಳುವ ಮಾಹಿತಿಯನ್ನು ನಮೂದಿಸಿ.",
    ],
    [
      "Enter your father's full name as on official records.",
      "ನಿಮ್ಮ ತಂದೆಯ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ, ನಿಮ್ಮ ಹೆಸರಲ್ಲ.",
    ],
    [
      "Enter your mother's full name as on official records.",
      "ನಿಮ್ಮ ತಾಯಿಯ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ, ನಿಮ್ಮ ಹೆಸರಲ್ಲ.",
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
    out = out.replace(/^Enter: [""](.+)[""]\.$/, "ಇಲ್ಲಿ ನಮೂದಿಸಿ: $1.");
    out = out.replace(
      /^Enter what the label describes: [""](.+)[""]\.$/,
      "ಲೇಬಲ್ ಪ್ರಕಾರ ನಮೂದಿಸಿ: $1."
    );

    return out;
  }

  window.CFAVoiceKN = {
    translate,
    fieldKindHint: (kind) => (kind && FIELD_KIND_KN[kind]) || null,
  };
})();
