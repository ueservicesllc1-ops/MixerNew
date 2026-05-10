const fs = require('fs');
const content = fs.readFileSync('E:/Mixer/src/pages/DesktopMultitrack.jsx', 'utf8');

let balance = 0;
let inString = false;
let quoteChar = '';
let inComment = false;
let inBlockComment = false;

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    inComment = false;
    for (let j = 0; j < line.length; j++) {
        // Skip strings and comments
        // ... same logic as before ...
    }
    // Search for <div and </div>
    const openMatches = line.match(/<div/g) || [];
    const closeMatches = line.match(/<\/div>/g) || [];
    balance += openMatches.length;
    balance -= closeMatches.length;
    if (balance < 0) {
        // console.log(`Line ${i+1}: Negative div balance!`);
    }
}
console.log(`Final div balance: ${balance}`);
