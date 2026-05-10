const fs = require('fs');
const content = fs.readFileSync('E:/Mixer/src/pages/DesktopMultitrack.jsx', 'utf8');

let inString = false;
let quoteChar = '';
let startLine = 0;

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (inString) {
            if (char === quoteChar && line[j-1] !== '\\') {
                inString = false;
            }
        } else {
            if (char === '"' || char === "'" || char === '`') {
                inString = true;
                quoteChar = char;
                startLine = i + 1;
            }
        }
    }
    if (inString && quoteChar !== '`') {
        // Single and double quotes cannot span lines in JS
        console.log(`Unclosed string starting at line ${startLine}`);
        inString = false; 
    }
}
if (inString) {
    console.log(`Unclosed template literal starting at line ${startLine}`);
}
