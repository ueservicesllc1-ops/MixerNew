const fs = require('fs');
const content = fs.readFileSync('E:/Mixer/src/pages/DesktopMultitrack.jsx', 'utf8');

let balance = 0;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Simple parser: skip comments and strings (approximated)
    let inString = false;
    let quoteChar = '';
    let inComment = false;
    let inBlockComment = false;

    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];

        if (inBlockComment) {
            if (char === '*' && nextChar === '/') {
                inBlockComment = false;
                j++;
            }
            continue;
        }
        if (inComment) break;

        if (inString) {
            if (char === quoteChar && line[j - 1] !== '\\') {
                inString = false;
            }
            continue;
        }

        if (char === '/' && nextChar === '/') {
            inComment = true;
            continue;
        }
        if (char === '/' && nextChar === '*') {
            inBlockComment = true;
            j++;
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            inString = true;
            quoteChar = char;
            continue;
        }

        if (char === '(') balance++;
        if (char === ')') {
            balance--;
            if (balance < 0) {
                console.log(`Negative balance at line ${i + 1}, col ${j + 1}: ${line}`);
                // Don't reset balance, let's see how many times it happens
            }
        }
    }
}
console.log(`Final balance: ${balance}`);
