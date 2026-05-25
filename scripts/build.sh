#!/bin/bash
set -e

ASSETS="app/src/main/assets"
JS_DIR="$ASSETS/js"
BUNDLE="$JS_DIR/bundle.js"
BUNDLE_MIN="$JS_DIR/bundle.min.js"
BUNDLE_OBF="$JS_DIR/bundle.obf.js"

# Local bin (after npm install)
TERSER="./node_modules/.bin/terser"
OBFUSCATOR="./node_modules/.bin/javascript-obfuscator"

echo "==============================="
echo " Smart Study JS Build Pipeline"
echo "==============================="

echo ""
echo "📦 [1/5] Concatenating JS..."
cat \
  "$JS_DIR/config.js" \
  "$JS_DIR/firebase.js" \
  "$JS_DIR/home.js" \
  "$JS_DIR/typing.js" \
  "$JS_DIR/quiz.js" \
  "$JS_DIR/media.js" \
  "$JS_DIR/xp.js" \
  "$JS_DIR/notification.js" \
  "$JS_DIR/theme.js" \
  "$JS_DIR/flashcard.js" \
  "$JS_DIR/utils.js" \
  "$JS_DIR/written.js" \
  "$JS_DIR/auth.js" \
  "$JS_DIR/leaderboard.js" \
  "$JS_DIR/spacedrep.js" \
  "$JS_DIR/revision.js" \
  "$JS_DIR/progress.js" \
  "$JS_DIR/social.js" \
  "$JS_DIR/sync.js" \
  "$JS_DIR/review.js" \
  "$JS_DIR/visual_flashcard.js" \
  > "$BUNDLE"
echo "  Raw: $(wc -c < $BUNDLE) bytes"

echo ""
echo "🗜️  [2/5] Minifying..."
$TERSER "$BUNDLE" \
  --compress passes=2,pure_getters=true \
  --mangle toplevel=false \
  --output "$BUNDLE_MIN"
echo "  Minified: $(wc -c < $BUNDLE_MIN) bytes"

echo ""
echo "🔐 [3/5] Obfuscating..."
$OBFUSCATOR "$BUNDLE_MIN" \
  --output "$BUNDLE_OBF" \
  --compact true \
  --control-flow-flattening true \
  --control-flow-flattening-threshold 0.4 \
  --dead-code-injection true \
  --dead-code-injection-threshold 0.2 \
  --string-array true \
  --string-array-encoding base64 \
  --string-array-threshold 0.75 \
  --rename-globals false \
  --self-defending true \
  --source-map false
echo "  Obfuscated: $(wc -c < $BUNDLE_OBF) bytes"

echo ""
echo "🔗 [4/5] Updating index.html..."
python3 scripts/update_html.py

echo ""
echo "🧹 [5/5] Cleaning source JS..."
rm -f "$BUNDLE" "$BUNDLE_MIN"
for f in config firebase home typing quiz media xp notification theme \
          flashcard utils written auth leaderboard spacedrep revision \
          progress social sync review visual_flashcard; do
  rm -f "$JS_DIR/${f}.js"
done

OBF_SIZE=$(wc -c < "$BUNDLE_OBF")
echo ""
echo "==============================="
echo " ✅ Done! bundle.obf.js = $OBF_SIZE bytes"
echo "==============================="
