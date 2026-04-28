const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const COLORS = {
  bg: [0x0a, 0x0a, 0x0b],
  bgGradient: [0x15, 0x16, 0x1a],
  primary: [0x3d, 0xdc, 0x97],
  primaryDark: [0x2e, 0xb8, 0x7b],
  cardBg: [0x1d, 0x1f, 0x24],
};

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crc ^ buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePNG(filepath, width, height, getPixel) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const off = y * (stride + 1) + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filepath, png);
  console.log(`✓ ${path.basename(filepath)} (${width}x${height})`);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function generateIcon(size, transparent = false) {
  return (x, y) => {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    const diagonalT = (x + y) / (size * 2);
    const bg = transparent ? null : lerpColor(COLORS.bgGradient, COLORS.bg, diagonalT);

    const ringR = size * 0.32;
    const ringW = size * 0.018;
    const d = dist(x, y, cx, cy);
    const ringMask = smoothstep(ringR + ringW, ringR + ringW - 1, d) * smoothstep(ringR - ringW - 1, ringR - ringW, d);
    const ringAlpha = ringMask * 0.45;

    const stemHalfW = size * 0.045;
    const stemHalfH = size * 0.24;
    const stemMask = (Math.abs(x - cx) <= stemHalfW + 0.5 && Math.abs(y - cy) <= stemHalfH + 0.5) ? 1 : 0;

    const arcOuterR = size * 0.18;
    const arcInnerR = size * 0.12;
    const arcCenterY1 = cy - size * 0.115;
    const arcCenterY2 = cy + size * 0.115;
    let arc1 = 0;
    let arc2 = 0;
    const d1 = dist(x, y, cx, arcCenterY1);
    const d2 = dist(x, y, cx, arcCenterY2);
    if (d1 >= arcInnerR && d1 <= arcOuterR && y <= arcCenterY1 + size * 0.005) arc1 = 1;
    if (d2 >= arcInnerR && d2 <= arcOuterR && y >= arcCenterY2 - size * 0.005) arc2 = 1;

    const dollarMask = Math.max(stemMask, arc1, arc2);

    if (transparent) {
      if (dollarMask > 0 || ringAlpha > 0) {
        const a = Math.round(255 * Math.max(dollarMask, ringAlpha * 0.6));
        return [...COLORS.primary, a];
      }
      return [0, 0, 0, 0];
    }

    let [r0, g0, b0] = bg;
    if (ringAlpha > 0) {
      [r0, g0, b0] = lerpColor([r0, g0, b0], COLORS.primary, ringAlpha);
    }
    if (dollarMask > 0) {
      [r0, g0, b0] = COLORS.primary;
    }
    return [r0, g0, b0, 255];
  };
}

function generateSplash(width, height) {
  return (x, y) => {
    const cx = width / 2;
    const cy = height / 2;
    const diagonalT = ((x / width) + (y / height)) / 2;
    const [r, g, b] = lerpColor(COLORS.bgGradient, COLORS.bg, diagonalT);

    const iconSize = Math.min(width, height) * 0.28;
    const iconLeft = cx - iconSize / 2;
    const iconTop = cy - iconSize / 2;

    if (x >= iconLeft && x < iconLeft + iconSize && y >= iconTop && y < iconTop + iconSize) {
      const lx = Math.floor(x - iconLeft);
      const ly = Math.floor(y - iconTop);
      const sub = generateIcon(iconSize)(lx, ly);
      return sub;
    }

    return [r, g, b, 255];
  };
}

console.log('Gerando ícones...');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

writePNG(path.join(ASSETS_DIR, 'icon.png'), 1024, 1024, generateIcon(1024));
writePNG(path.join(ASSETS_DIR, 'adaptive-icon.png'), 1024, 1024, generateIcon(1024, true));
writePNG(path.join(ASSETS_DIR, 'splash.png'), 1242, 2436, generateSplash(1242, 2436));
writePNG(path.join(ASSETS_DIR, 'favicon.png'), 48, 48, generateIcon(48));

console.log('\n✓ Ícones gerados em assets/');
console.log('  icon.png         (1024x1024) — App icon iOS/Android');
console.log('  adaptive-icon.png (1024x1024) — Foreground Android adaptive');
console.log('  splash.png       (1242x2436) — Splash screen');
console.log('  favicon.png      (48x48)     — Web favicon');
