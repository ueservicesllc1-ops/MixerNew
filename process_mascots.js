import { execSync } from 'child_process';
import path from 'path';

const ffmpegPath = 'E:/Mixer/node_modules/ffmpeg-static/ffmpeg.exe';
const mascotDir = 'E:/Mixer/public/mascota';
const images = [
    'alegre.png', 'confundido.png', 'dormido.png', 'enojado.png',
    'feliz.png', 'intelectual.png', 'panico.png', 'triste.png'
];

images.forEach(img => {
    const input = path.join(mascotDir, img);
    const output = path.join(mascotDir, img.replace('.png', '_sticker.png'));
    
    console.log(`Processing ${img} with 4-corner floodfill...`);
    try {
        // format=rgba ensures alpha channel exists
        // floodfill from 4 corners to remove background but preserve snout
        // d3=0 means target alpha channel and set to 0.
        // We do it four times for each corner.
        const vf = "format=rgba,floodfill=x=0:y=0:d3=0,floodfill=x=w-1:y=0:d3=0,floodfill=x=0:y=h-1:d3=0,floodfill=x=w-1:y=h-1:d3=0";
        execSync(`"${ffmpegPath}" -i "${input}" -vf "${vf}" "${output}" -y`);
        console.log(`Saved ${output}`);
    } catch (e) {
        console.error(`Error on ${img}`, e);
    }
});
