import fs from 'fs';
import crypto from 'crypto';

// 1. Generate 10 MB of random binary data
const dataSize = 10 * 1024 * 1024 + 12345; // 10MB + some bytes to make it not a multiple of anything
const originalData = crypto.randomBytes(dataSize);
console.log(`Generated ${dataSize} bytes of random data.`);

// 2. Simulate the JS implementation of saveTrackBlob
const toB64 = (bytes) => {
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + step, bytes.length)));
    }
    return btoa(binary);
};

const CHUNK = 1024 * 1024;
const len = originalData.length;
let offset = 0;
let first = true;

const tempFile = 'scratch/test_output.bin';
if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

while (offset < len) {
    const end = Math.min(offset + CHUNK, len);
    const piece = originalData.subarray(offset, end);
    const b64 = toB64(piece);
    
    // Simulate Android side decoding base64 and appending to file
    const decodedBytes = Buffer.from(b64, 'base64');
    
    if (first) {
        fs.writeFileSync(tempFile, decodedBytes);
        first = false;
    } else {
        fs.appendFileSync(tempFile, decodedBytes);
    }
    offset = end;
}

// 3. Compare original data with written data
const writtenData = fs.readFileSync(tempFile);
console.log(`Written ${writtenData.length} bytes.`);

if (originalData.equals(writtenData)) {
    console.log("✅ Success! The reassembled file is identical to the original.");
} else {
    console.log("❌ Error! The reassembled file is CORRUPTED!");
    // Find first difference
    for (let i = 0; i < len; i++) {
        if (originalData[i] !== writtenData[i]) {
            console.log(`First difference at byte index ${i}: original=${originalData[i]}, written=${writtenData[i]}`);
            break;
        }
    }
}

// Clean up
if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
