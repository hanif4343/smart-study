#!/bin/bash
# Restore original placeholder files after dev session

JS="app/src/main/assets/js"

if [ -f "$JS/config.js.bak" ]; then
    mv "$JS/config.js.bak"  "$JS/config.js"
    echo "config.js restored ✅"
fi
if [ -f "$JS/written.js.bak" ]; then
    mv "$JS/written.js.bak" "$JS/written.js"
    echo "written.js restored ✅"
fi
