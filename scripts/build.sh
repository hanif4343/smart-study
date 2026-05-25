#!/bin/bash
# Smart Study — JS Bundle + Minify + Obfuscate
# Called from GitHub Actions after: npm install

set -e

ASSETS="app/src/main/assets"
JS_DIR="$ASSETS/js"
BUNDLE="$JS_DIR/bundle.js"
BUNDLE_MIN="$JS_DIR/bundle.min.js"
BUNDLE_OBF="$JS_DIR/bundle.obf.js"

# Use local node_modules if available, else global
TERSER="$(npm bin)/terser"
OBFUSCATOR="$(npm bin)/javascript-obfuscator"
[ ! -f "$TERSER" ] && TERSER="terser"
[ ! -f "$OBFUSCATOR" ] && OBFUSCATOR="javascript-obfuscator"

echo "==============================="
echo " Smart Study JS Build Pipeline"
echo "==============================="

echo ""
echo "📦 [1/5] Concatenating JS files..."
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
echo "  Raw: $(wc -c < $BUNDLE) bytes ($(wc -l < $BUNDLE) lines)"

echo ""
echo "🗜️  [2/5] Minifying with Terser..."
$TERSER "$BUNDLE" \
  --compress passes=3,drop_console=false,pure_getters=true,unsafe_math=false \
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
  --disable-console-output false \
  --source-map false
echo "  Obfuscated: $(wc -c < $BUNDLE_OBF) bytes"

echo ""
echo "🔗 [4/5] Updating index.html..."
python3 scripts/update_html.py

echo ""
echo "🧹 [5/5] Cleaning source files..."
rm -f "$BUNDLE" "$BUNDLE_MIN"
for f in config firebase home typing quiz media xp notification theme \
          flashcard utils written auth leaderboard spacedrep revision \
          progress social sync review visual_flashcard; do
  rm -f "$JS_DIR/${f}.js"
done

echo ""
echo "==============================="
echo " ✅ Build complete!"
ORIG=$(cat $JS_DIR/../js/*.js 2>/dev/null | wc -c || echo 0)
OBF=$(wc -c < "$BUNDLE_OBF")
echo "   Output: bundle.obf.js ($OBF bytes)"
echo "==============================="
