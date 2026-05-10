const fs = require('fs');
const content = fs.readFileSync('E:/Mixer/src/pages/DesktopMultitrack.jsx', 'utf8');

let balance = 0;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatches = (line.match(/<div/g) || []).length;
    const closeMatches = (line.match(/<\/div>/g) || []).length;
    balance += openMatches;
    balance -= closeMatches;
    if (i === 2441) {
        console.log(`Balance at line 2442: ${balance}`);
    }
}
console.log(`Final balance: ${balance}`);
