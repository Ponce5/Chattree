const fs = require('fs');
const path = require('path');
const fflate = require(path.join(__dirname, '../../Web/node_modules/fflate'));

const pluginDir = path.join(__dirname, '../plugins/official/calendar');
const filesToInclude = [
  'plugin.json',
  'plugin.wasm',
  'icon.png',
  'README.md'
];

const zipData = {};
for (const file of filesToInclude) {
  const filePath = path.join(pluginDir, file);
  if (fs.existsSync(filePath)) {
    zipData[file] = fs.readFileSync(filePath);
    console.log(`Added ${file} (${zipData[file].length} bytes)`);
  } else {
    console.error(`Warning: ${file} not found!`);
  }
}

const zipped = fflate.zipSync(zipData, { level: 9 });

// Save calendar-v1.2.2.chattree-plugin and calendar.chattree-plugin
const v122Path = path.join(pluginDir, 'calendar-v1.2.2.chattree-plugin');
const latestPath = path.join(pluginDir, 'calendar.chattree-plugin');

fs.writeFileSync(v122Path, zipped);
fs.writeFileSync(latestPath, zipped);

console.log(`Successfully created:`);
console.log(`- ${v122Path} (${zipped.length} bytes)`);
console.log(`- ${latestPath} (${zipped.length} bytes)`);

// Clean up old package versions if exist
const oldPaths = [
  path.join(pluginDir, 'calendar-v1.2.0.chattree-plugin'),
  path.join(pluginDir, 'calendar-v1.2.1.chattree-plugin')
];
for (const oldPath of oldPaths) {
  if (fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
    console.log(`Removed obsolete ${oldPath}`);
  }
}
