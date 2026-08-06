const sharp = require('sharp');
const path = require('path');

const srcPath = 'C:/Users/anton/OneDrive/Desktop/WhatsApp Image 2026-08-06 at 15.37.18.jpeg';
const pubDir = path.join(__dirname, '../public');
const appDir = path.join(__dirname, '../src/app');

async function makeRoundLogo() {
  const metadata = await sharp(srcPath).metadata();
  const size = Math.min(metadata.width, metadata.height);

  const squareBuffer = await sharp(srcPath)
    .extract({
      left: Math.floor((metadata.width - size) / 2),
      top: Math.floor((metadata.height - size) / 2),
      width: size,
      height: size
    })
    .toBuffer();

  const circleSvg = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );

  await sharp(squareBuffer)
    .composite([{ input: circleSvg, blend: 'dest-in' }])
    .png()
    .toFile(path.join(pubDir, 'brand-logo.png'));

  const roundPath = path.join(pubDir, 'brand-logo.png');

  await sharp(roundPath).resize(16, 16).png().toFile(path.join(pubDir, 'favicon-16x16.png'));
  await sharp(roundPath).resize(32, 32).png().toFile(path.join(pubDir, 'favicon-32x32.png'));
  await sharp(roundPath).resize(180, 180).png().toFile(path.join(pubDir, 'apple-touch-icon.png'));
  await sharp(roundPath).resize(192, 192).png().toFile(path.join(pubDir, 'android-chrome-192x192.png'));
  await sharp(roundPath).resize(512, 512).png().toFile(path.join(pubDir, 'android-chrome-512x512.png'));

  await sharp(roundPath).resize(32, 32).toFormat('png').toFile(path.join(pubDir, 'favicon.ico'));
  await sharp(roundPath).resize(32, 32).toFormat('png').toFile(path.join(appDir, 'favicon.ico'));

  const logoResized = await sharp(roundPath)
    .resize({ height: 420, fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 10, g: 15, b: 20, alpha: 1 }
    }
  })
  .composite([{ input: logoResized, gravity: 'center' }])
  .png()
  .toFile(path.join(pubDir, 'og-image.png'));

  console.log('ROUND LOGO GENERATED SUCCESSFULLY!');
}

makeRoundLogo().catch(err => console.error(err));
