const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'resources');
fs.mkdirSync(output, { recursive: true });

for (const name of ['icon.png', 'robot.png']) {
  fs.copyFileSync(path.resolve(root, '../assets', name), path.join(output, name));
}
fs.copyFileSync(path.resolve(root, '../../LICENSE'), path.join(output, 'CoCo-LICENSE.txt'));
for (const family of ['nunito', 'noto-sans-sc']) {
  const source = path.join(root, 'node_modules', '@fontsource-variable', family);
  const file = family + '-latin-wght-normal.woff2';
  fs.copyFileSync(path.join(source, 'files', file), path.join(output, file));
  fs.copyFileSync(path.join(source, 'LICENSE'), path.join(output, family + '-OFL.txt'));
}
