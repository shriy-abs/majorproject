# AI-Powered Cognitive Accessibility Assistant for Web Forms

## Major Project Context Document

---

# 1. Project Title

**AI-Powered Cognitive Accessibility Assistant for Web Forms**

---

# 2. Problem Statement

Many users struggle to understand and correctly fill online forms due to:

- complex terminology
- unclear instructions
- confusing field labels
- lack of real-time assistance
- poor accessibility support

This problem is especially visible in:

- government portals
- registration forms
- institutional forms
- application websites

Even when instructions are available, they are often difficult to understand, causing:

- form submission errors
- repeated corrections
- increased cognitive load
- dependence on others for help

The proposed system aims to solve this by providing **real-time, contextual, simplified explanations** for form fields while users fill forms online.

---

# 3. Core Idea

This project proposes a **browser-based assistant** that detects form fields on a webpage and helps the user understand what to enter.

When a user visits a webpage containing a form, the system will:

1. detect the form fields
2. extract the field label / placeholder / nearby instructions
3. simplify the meaning of that field
4. display a small tooltip or help box beside the field
5. optionally provide voice-based assistance

Example:

### Original Field:
**Applicant's Permanent Residential Address**

### Simplified Output:
**Enter the address where you normally live.**

---

# 4. Why This Project Was Chosen

Initially, multiple ideas were considered, including:

## Rejected / Earlier Ideas
- AI-generated content detector
- Fake news / trustworthiness detector
- E-commerce overpricing checker

However, these ideas had issues such as:

### AI Content Detector
- technically unreliable
- difficult to validate
- hard to build accurately in real-time
- high false positives and false negatives

### Fake News Detector
- already explored heavily
- difficult to evaluate properly
- large scope and ambiguous definitions of "trustworthy"

### E-commerce Price Checker
- already exists in many forms
- low novelty
- weaker academic depth unless expanded heavily

After evaluation, the **Web Form Accessibility Assistant** was selected because it is:

- more feasible
- more useful
- technically solid
- easier to demonstrate
- socially relevant
- suitable for final year project scope

---

# 5. Main Design Philosophy

The project is based on the idea that:

> Designing for accessibility and reduced cognitive load helps not only specific groups, but users in general.

This means the system is not only for:

- elderly users
- digitally inexperienced users
- differently-abled users

It can help **everyone** who finds online forms confusing.

This makes the project more inclusive and socially impactful.

---

# 6. Final Project Direction

## Final Chosen Problem Statement

**To develop an AI-powered browser assistant that helps users understand and correctly fill online forms by providing simplified, contextual, real-time guidance for each form field.**

---

# 7. Scope of the Project

## Included in Scope
The system will focus on:

- browser-based form assistance
- detecting web form fields
- understanding field labels and instructions
- simplifying complex text
- showing contextual help beside form fields
- optional text-to-speech guidance
- optional voice interaction (later stage)

## Excluded from Scope (for now)
The project will **not** focus on:

- fake news detection
- AI-generated content detection
- e-commerce price comparison
- WhatsApp message analysis
- YouTube content verification
- phishing detection (unless added much later as extension work)

This scope limitation is intentional to ensure the project is:

- focused
- buildable
- review-friendly
- completable within semester timeline

---

# 8. Project Objectives

The main objectives of the project are:

1. To design a browser-based intelligent assistant for online forms
2. To automatically detect and extract form fields from web pages
3. To identify and interpret labels, placeholders, and instructions
4. To simplify complex field descriptions using AI/NLP
5. To display contextual help in real time beside form elements
6. To optionally provide voice-based accessibility support
7. To improve form usability and reduce user errors

---

# 9. Proposed System Overview

The proposed system will work as a **Chrome browser extension** connected to a backend AI/NLP service.

## High-Level Flow

### Step 1
User opens a webpage containing a form

### Step 2
Browser extension scans the webpage DOM

### Step 3
It identifies:
- input fields
- textareas
- dropdowns
- file upload fields

### Step 4
It extracts related text such as:
- labels
- placeholders
- aria-labels
- nearby instructions

### Step 5
This text is sent to an AI/NLP simplification module

### Step 6
The simplified explanation is returned

### Step 7
A tooltip/help box is shown near the field

### Step 8 (optional)
Text can also be read aloud using text-to-speech

---

# 10. Why Browser Extension Approach Was Chosen

A browser extension was chosen because it allows the system to:

- work directly on webpages
- interact with forms in real time
- read and analyze HTML form fields
- provide help without requiring changes to the target website

This is better than building a separate website because:

- users fill forms on external websites, not inside our own app
- extension-based support is more practical and realistic
- it demonstrates a stronger real-world use case

---

# 11. Why We Are Starting with a Sample Form First

The project will **not start directly on government websites**.

Instead, development begins with a **custom sample form page**.

## Why?
Because real-world websites:
- can be messy
- may use inconsistent HTML
- may dynamically load forms
- may block scripts or extensions
- are harder to debug in early stages

Starting with a sample page allows us to:

- control the structure
- test field detection
- test tooltip placement
- debug more easily
- build a stable prototype first

This is the correct engineering approach.

---

# 12. Development Strategy

The project will be built in **layers**, not all at once.

## Correct Build Order

1. Create sample form webpage
2. Build Chrome extension shell
3. Detect form fields
4. Extract labels and instructions
5. Show tooltip beside fields
6. Add hardcoded simple explanations
7. Connect backend
8. Add AI-based simplification
9. Add optional voice features
10. Perform evaluation and testing

This layered development is important because it ensures:

- stable progress
- easier debugging
- reviewable milestones
- reduced project risk

---

# 13. Current Technical Approach

The project is being developed using a **modular architecture**.

## Modules

### 1. Webpage / Test Form Module
A custom HTML form used for initial testing

### 2. Browser Extension Module
Runs inside webpages and interacts with the form

### 3. Field Detection Module
Identifies input fields from the webpage

### 4. Label Extraction Module
Finds associated labels and instructions

### 5. Simplification Module
Converts complex field descriptions into simple language

### 6. Tooltip / UI Module
Displays explanations near the form fields

### 7. Voice Support Module (optional)
Reads instructions aloud or supports interaction

### 8. Evaluation Module
Measures whether the system actually improves usability

---

# 14. Planned Tech Stack

## Frontend / Browser Side
- HTML
- CSS
- JavaScript

## Browser Platform
- Google Chrome
- Chrome Extension (Manifest V3)

## Backend
- Python

## Backend Framework (Planned)
- Flask or FastAPI

## AI / NLP Layer
Possible options:
- API-based LLM approach
- local transformer-based model
- hybrid simplification approach

## Optional Accessibility Features
- SpeechSynthesis API (Text-to-Speech)
- Web Speech API (Voice Input)

---

# 15. Planned Folder Structure

```bash
major-project/
│
├── extension/
│   ├── manifest.json
│   ├── content.js
│   ├── style.css
│
├── backend/
│   ├── app.py
│   ├── simplify.py
│   ├── requirements.txt
│
├── test_pages/
│   ├── sample_form.html
│
├── docs/
│   ├── architecture.png
│   ├── literature_review.docx
│
└── README.md
```

---

# 16. Running the project (end-to-end)

## 1. Backend (Python)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Leave this running. Default URL: `http://127.0.0.1:5000`  
Health check: open `http://127.0.0.1:5000/api/health` in the browser — you should see `{"ok":true}`.

**Optional — OpenAI:** set environment variables before starting the server:

- `OPENAI_API_KEY` — if set, simplification uses the API first; otherwise rule-based text is used.
- `OPENAI_MODEL` — optional, default `gpt-4o-mini`.

## 2. Chrome extension

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `extension` folder.
3. For local `file://` test pages: open the extension **Details** → enable **Allow access to file URLs**.
4. (Optional) Open extension **Options** to change the backend base URL if not using port 5000.

## 3. Try the sample form

Open `test_pages/sample_form.html` (via `file://` or any static server). Each field should show a **?** button. Click it for a simplified explanation; use **Read aloud** for speech (browser TTS).

If the backend is off, the extension still works using a short **offline fallback** message.
