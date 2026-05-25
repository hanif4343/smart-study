# 📚 Smart Study

Bengali study app — Android WebView + Firebase + Google Apps Script.

## Project Structure

```
smart-study/
├── app/src/main/
│   ├── assets/
│   │   ├── index.html          ← Main app (HTML + CSS)
│   │   ├── js/                 ← JS modules (21 files)
│   │   │   ├── config.js       ← Firebase/GAS config (secrets injected in CI)
│   │   │   ├── auth.js         ← Login, signup, Google auth
│   │   │   ├── quiz.js         ← Quiz engine
│   │   │   └── ...             ← Other modules
│   │   └── sw.js               ← Service worker
│   └── java/com/hanif/smart_study/
│       ├── MainActivity.java   ← WebView + AndroidBridge
│       ├── MyFirebaseMessagingService.java
│       ├── ReminderReceiver.java
│       └── ...
├── scripts/
│   ├── build.sh                ← Bundle + Minify + Obfuscate JS
│   └── update_html.py          ← Updates index.html to load bundle
├── .github/workflows/
│   └── build.yml               ← CI: inject keys → bundle → APK
├── package.json                ← npm devDependencies
└── capacitor.config.json       ← Capacitor config (future migration)
```

## CI Build Flow

```
push to main
  → npm install (terser + javascript-obfuscator)
  → Inject secrets into js/config.js
  → scripts/build.sh:
      concat 21 JS files → bundle.js
      terser minify      → bundle.min.js
      obfuscate          → bundle.obf.js
      update index.html  → loads bundle.obf.js only
      delete source JS
  → Gradle assembleRelease (ProGuard enabled)
  → Sign APK
  → GitHub Release
```

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `FIREBASE_URL` | Firebase Realtime DB URL |
| `SECRET_KEY` | App secret key |
| `GAS_URL` | Google Apps Script web app URL |
| `GEMINI_API_KEY` | Gemini API key |
| `ADMIN_PHONE` | Admin phone number (e.g. 017XXXXXXXX) |
| `GOOGLE_SERVICES_JSON` | Firebase google-services.json content |
| `KEYSTORE_BASE64` | Base64 encoded .jks keystore |
| `STORE_PASSWORD` | Keystore password |
| `KEY_PASSWORD` | Key password |


## Local Development

```bash
# 1. .env তৈরি করো
cp .env.example .env
# .env এ real values বসাও

# 2. Dev mode চালু করো (secrets inject হবে)
bash scripts/dev.sh

# 3. Browser এ খোলো
open app/src/main/assets/index.html

# 4. কাজ শেষে restore করো
bash scripts/dev-restore.sh
```

> ⚠️ `.env` কখনো git commit করবে না — `.gitignore` এ আছে।


Open `app/src/main/assets/index.html` in browser directly.  
For Android: open project in Android Studio → Run.

## Package Info

- **App ID:** `com.hanif.smart_study`
- **App Name:** Smart Study
- **Min SDK:** 21 (Android 5.0)
- **Target SDK:** 34 (Android 14)
