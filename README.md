# Cognitive Form Assist — Major Project

All project code lives in **`major-project/`**.

## Quick start

```bash
cd major-project
```

Then follow **[major-project/README.md](major-project/README.md)** for setup (backend, Chrome extension, sample form).

### Run backend

```bash
cd major-project/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 app.py
```

### Load extension

Chrome → `chrome://extensions` → **Load unpacked** → select **`major-project/extension`**

### Demo form

Open **`major-project/test_pages/sample_form.html`** in Chrome (enable **Allow access to file URLs** on the extension).
