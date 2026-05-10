const fs = require('fs');
const content = fs.readFileSync('E:/Mixer/src/pages/DesktopMultitrack.jsx', 'utf8');

let open = 0;
let close = 0;
const regexOpen = /<div/g;
const regexClose = /<\/div>/g;

let m;
while ((m = regexOpen.exec(content)) !== null) open++;
while ((m = regexClose.exec(content)) !== null) close++;

console.log(`Open <div>: ${open}, Close </div>: ${close}, Balance: ${open - close}`);
