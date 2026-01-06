const fs = require('fs');
const path = require('path');
const https = require('https');

const hdrUrl = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/brown_photostudio_02_1k.hdr';
const destPath = path.join(process.cwd(), 'client/public/textures/studio_small_09_1k.hdr');

console.log(`Downloading HDR from ${hdrUrl}...`);

const file = fs.createWriteStream(destPath);

https.get(hdrUrl, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: Status Code ${response.statusCode}`);
    process.exit(1);
  }

  const totalSize = parseInt(response.headers['content-length'], 10);
  let downloadedSize = 0;

  response.pipe(file);

  response.on('data', (chunk) => {
    downloadedSize += chunk.length;
    if (totalSize) {
        const percent = ((downloadedSize / totalSize) * 100).toFixed(2);
        process.stdout.write(`\rProgress: ${percent}%`);
    }
  });

  file.on('finish', () => {
    file.close(() => {
      console.log('\nDownload completed successfully!');
    });
  });
}).on('error', (err) => {
  fs.unlink(destPath, () => {}); // Delete the file async. (But we don't check the result)
  console.error(`Error: ${err.message}`);
});
