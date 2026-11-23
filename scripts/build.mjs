import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = fs.readFileSync(path.join(root, 'src/shell.html'), 'utf8');
for (const [token, file] of [['STYLES','styles.css'], ['DATA','schedule.json'], ['TELEGRAM','telegram.js'], ['CORE','core.js'], ['DRIVING','driving.js'], ['DRIVING_UI','driving-ui.js'], ['APP','app.js']]) {
  const content = fs.readFileSync(path.join(root, 'src', file), 'utf8');
  html = html.replace(`/* ${token} */`, () => content.replace(/<\/script/gi, '<\\/script'));
}
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Built standalone index.html (${Buffer.byteLength(html)} bytes).`);
