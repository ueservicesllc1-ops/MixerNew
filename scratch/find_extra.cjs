const fs = require('fs');
const content = fs.readFileSync('E:/Mixer/src/pages/DesktopMultitrack.jsx', 'utf8');

let balance = 0;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '(') balance++;
        if (line[j] === ')') {
            balance--;
            if (balance < 0) {
                console.log(`Line ${i + 1}: Extra closing parenthesis found. Balance: ${balance}`);
                // balance = 0; // Don't reset, let's see how deep it goes
            }
        }
    }
}
console.log(`Final balance: ${balance}`);
