import path from 'path';
import fs from 'fs';

const mascotDir = 'E:/Mixer/public/mascota';
const images = [
    'alegre.png', 'confundido.png', 'dormido.png', 'enojado.png',
    'feliz.png', 'intelectual.png', 'panico.png', 'triste.png'
];

images.forEach(img => {
    const input = path.join(mascotDir, img);
    const output = path.join(mascotDir, img.replace('.png', '_sticker.png'));
    
    console.log(`Restoring original for ${img}...`);
    try {
        // Just copy the original to the _sticker.png name
        // This removes my "transparency" logic entirely, restoring the snout.
        fs.copyFileSync(input, output);
    } catch (e) {
        console.error(`Failed to restore ${img}`, e);
    }
});
