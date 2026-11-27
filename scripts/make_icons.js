// Etapa 91 (Parte 4): regera todos os ícones públicos a partir do logo-mestre
// (public/brand-logo.png — limpo, sem nada preto), substituindo os artefatos
// anteriores que tinham um anel preto desenhado nos ícones pequenos/
// apple-touch-icon e um fundo quase-preto no og-image (scripts/make_round.js,
// linha do `background: { r:10, g:15, b:20 }`). O logo em si não é redesenhado
// — só reempacotado em fundo claro e opaco, do jeito que cada plataforma
// exige (ver pedido do usuário, Parte 4).
//
// Regras seguidas aqui:
//  - apple-touch-icon, android/manifest "any" e favicons: OPACOS (sem canal
//    alfa) — iOS/Android preenchem transparência com preto, então a saída
//    nunca pode ter alfa.
//  - ícone "maskable": logo redesenhado em ~80% central (zona segura) sobre
//    fundo sólido claro — o SO recorta o resto, então o que sai da zona seguro
//    pode ser cortado sem perder a árvore/corações.
//  - favicon.ico: ICO de verdade com múltiplos tamanhos embutidos (PNG por
//    frame), não um PNG renomeado — o gerador antigo escrevia só um PNG com
//    extensão .ico.
//  - og-image: fundo claro (branco), não mais o quase-preto de antes.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const pubDir = path.join(__dirname, "../public");
const MASTER = path.join(pubDir, "brand-logo.png");

const LIGHT_BG = "#FFFFFF";

async function opaqueResize(size) {
  return sharp(MASTER)
    .resize(size, size, { fit: "contain", background: LIGHT_BG })
    .flatten({ background: LIGHT_BG })
    .png()
    .toBuffer();
}

/** Logo escalado para `scale` (0–1) do canvas, centralizado sobre fundo
 * sólido claro — usado pelo ícone maskable (zona segura ~80%). */
async function centeredOnCanvas(canvasSize, scale) {
  const logoSize = Math.round(canvasSize * scale);
  const logo = await sharp(MASTER)
    .resize(logoSize, logoSize, { fit: "contain", background: LIGHT_BG })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 3,
      background: LIGHT_BG,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .flatten({ background: LIGHT_BG })
    .removeAlpha()
    .png()
    .toBuffer();
}

/** Monta um .ico de verdade (ICONDIR + ICONDIRENTRY + PNG por frame) — todo
 * navegador/SO moderno aceita PNG embutido em ICO desde que width/height no
 * header batam com a imagem real. */
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  const datas = [];
  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // byte size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    datas.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...entries, ...datas]);
}

async function makeIcons() {
  if (!fs.existsSync(MASTER)) {
    throw new Error(`Logo-mestre não encontrado: ${MASTER}`);
  }

  // --- apple-touch-icon (opaco, 180x180) ---
  await sharp(await opaqueResize(180)).toFile(path.join(pubDir, "apple-touch-icon.png"));

  // --- android-chrome / manifest "any" (opacos) ---
  await sharp(await opaqueResize(192)).toFile(path.join(pubDir, "android-chrome-192x192.png"));
  await sharp(await opaqueResize(512)).toFile(path.join(pubDir, "android-chrome-512x512.png"));

  // --- maskable (zona segura ~80%, fundo sólido) ---
  await sharp(await centeredOnCanvas(512, 0.8)).toFile(path.join(pubDir, "maskable-icon-512.png"));

  // --- favicons PNG (opacos) ---
  const favicon16 = await opaqueResize(16);
  const favicon32 = await opaqueResize(32);
  const favicon48 = await opaqueResize(48);
  await sharp(favicon16).toFile(path.join(pubDir, "favicon-16x16.png"));
  await sharp(favicon32).toFile(path.join(pubDir, "favicon-32x32.png"));

  // --- favicon.ico de verdade (16/32/48 embutidos) ---
  const ico = buildIco([
    { size: 16, buffer: favicon16 },
    { size: 32, buffer: favicon32 },
    { size: 48, buffer: favicon48 },
  ]);
  fs.writeFileSync(path.join(pubDir, "favicon.ico"), ico);

  // --- og-image (1200x630, fundo claro — era quase-preto antes) ---
  const ogLogo = await sharp(MASTER).resize({ height: 420, fit: "contain" }).toBuffer();
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: LIGHT_BG,
    },
  })
    .composite([{ input: ogLogo, gravity: "center" }])
    .flatten({ background: LIGHT_BG })
    .removeAlpha()
    .png()
    .toFile(path.join(pubDir, "og-image.png"));

  console.log("Ícones regenerados a partir do logo-mestre, todos opacos e com fundo claro.");
}

makeIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
