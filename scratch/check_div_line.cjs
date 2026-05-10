const fs = require('fs');
const content = fs.readFileSync('E:/Mixer/src/pages/DesktopMultitrack.jsx', 'utf8');

function checkDiv(label) {
    let balance = 0;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const openMatches = (line.match(/<div/g) || []).length;
        const closeMatches = (line.match(/<\/div>/g) || []).length;
        balance += openMatches;
        balance -= closeMatches;
        if (i === 3930) console.log(`${label} Balance at line 3931: ${balance}`);
    }
    console.log(`${label} Final Balance: ${balance}`);
}

checkDiv('Div');
