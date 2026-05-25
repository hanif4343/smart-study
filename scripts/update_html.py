import re

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all individual js/ script tags
content = re.sub(r'\s*<script src="js/[^"]+\.js"></script>', '', content)

# Insert single obfuscated bundle before </body>
content = content.replace(
    '</body>',
    '    <script src="js/bundle.obf.js"></script>\n</body>'
)

with open('app/src/main/assets/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("  index.html updated — now loads js/bundle.obf.js ✅")
