const fs = require('fs');
const content = fs.readFileSync('E:/Mixer/src/pages/DesktopMultitrack.jsx', 'utf8');

function check(charOpen, charClose, label) {
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
            const char = line[j];
            const nextChar = line[j+1];
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') { inBlockComment = false; j++; }
                continue;
            }
            if (inString) {
                if (char === quoteChar && line[j-1] !== '\\') inString = false;
                continue;
            }
            if (char === '/' && nextChar === '/') { inComment = true; break; }
            if (char === '/' && nextChar === '*') { inBlockComment = true; j++; continue; }
            if (char === '"' || char === "'" || char === '`') { inString = true; quoteChar = char; continue; }

            if (char === charOpen) balance++;
            if (char === charClose) balance--;
        }
        if (i === 3930) console.log(`${label} Balance at line 3931: ${balance}`);
    }
    console.log(`${label} Final Balance: ${balance}`);
}

check('(', ')', 'Parens');
check('{', '}', 'Braces');
