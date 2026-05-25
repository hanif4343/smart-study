#!/bin/bash
# Smart Study — Local Development Helper
# Browser এ directly index.html খোলার আগে fake secrets inject করো

set -e

JS="app/src/main/assets/js"

echo "🔧 Dev mode: injecting placeholder values..."

# Backup originals
cp "$JS/config.js"  "$JS/config.js.bak"
cp "$JS/written.js" "$JS/written.js.bak"

# Inject dev placeholders (real values .env থেকে নাও)
if [ -f ".env" ]; then
  source .env
  sed -i "s|%%FIREBASE_URL%%|${FIREBASE_URL:-https://example-default-rtdb.firebaseio.com}|g" "$JS/config.js"
  sed -i "s|%%SECRET_KEY%%|${SECRET_KEY:-dev_secret}|g"                                      "$JS/config.js"
  sed -i "s|%%GAS_URL%%|${GAS_URL:-https://script.google.com/dev}|g"                         "$JS/config.js"
  sed -i "s|%%ADMIN_PHONE%%|${ADMIN_PHONE:-01700000000}|g"                                   "$JS/config.js"
  sed -i "s|%%GEMINI_API_KEY%%|${GEMINI_API_KEY:-dev_gemini_key}|g"                          "$JS/written.js"
  echo "  .env থেকে values নেওয়া হয়েছে ✅"
else
  echo "  WARNING: .env file নেই — dummy values ব্যবহার করা হচ্ছে"
  sed -i "s|%%FIREBASE_URL%%|https://example-default-rtdb.firebaseio.com|g" "$JS/config.js"
  sed -i "s|%%SECRET_KEY%%|dev_secret|g"                                     "$JS/config.js"
  sed -i "s|%%GAS_URL%%|https://script.google.com/dev|g"                     "$JS/config.js"
  sed -i "s|%%ADMIN_PHONE%%|01700000000|g"                                   "$JS/config.js"
  sed -i "s|%%GEMINI_API_KEY%%|dev_key|g"                                    "$JS/written.js"
fi

echo ""
echo "✅ Done! Browser এ খোলো:"
echo "   file://$(pwd)/app/src/main/assets/index.html"
echo ""
echo "⚠️  কাজ শেষে restore করো: bash scripts/dev-restore.sh"
