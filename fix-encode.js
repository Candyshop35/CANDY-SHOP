// fix-double-utf8.js — undo double UTF-8 encoding corruption
// The file was: UTF-8 bytes → read as Windows-1252 → written as UTF-8
// Recovery: current UTF-8 string → encode as Windows-1252 → decode as UTF-8
const fs = require('fs');

// Windows-1252 mapping: byte → Unicode code point (for bytes 0x80-0x9F)
const W1252 = [
  0x20AC,0x81,0x201A,0x192,0x201E,0x2026,0x2020,0x2021,
  0x2C6,0x2030,0x160,0x2039,0x152,0x8D,0x17D,0x8F,
  0x90,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,
  0x2DC,0x2122,0x161,0x203A,0x153,0x9D,0x17E,0x178
];

// Reverse map: Unicode code point → Windows-1252 byte
const REV = new Map();
W1252.forEach((cp, i) => {
  if (cp <= 0xFF) REV.set(cp, 0x80 + i);
});

function toWin1252Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp > 0xFFFF) i++; // surrogate pair
    if (cp <= 0x7F) {
      bytes.push(cp);
    } else if (cp >= 0xA0 && cp <= 0xFF) {
      bytes.push(cp); // Latin-1 direct
    } else if (REV.has(cp)) {
      bytes.push(REV.get(cp)); // Windows-1252 specific
    } else {
      // Can't map back — this char shouldn't be in a mojibake sequence
      return null; // signal failure
    }
  }
  return Buffer.from(bytes);
}

const buf = fs.readFileSync('app.js', 'utf8');
const bytes = toWin1252Bytes(buf);

if (!bytes) {
  console.log('Some chars cannot be mapped to Win-1252 bytes, trying line-by-line');
  // Try line by line — most lines are ASCII
  const lines = buf.split('\n');
  const fixedLines = [];
  let ok = 0, fail = 0;
  for (const line of lines) {
    const b = toWin1252Bytes(line);
    if (b) {
      fixedLines.push(b.toString('utf8'));
      ok++;
    } else {
      // Can't recover this line — keep as-is
      fixedLines.push(line);
      fail++;
    }
  }
  console.log(`Line-by-line: ${ok} recovered, ${fail} kept as-is`);
  const result = fixedLines.join('\n');
  try {
    new (require('vm').Script)(result, { filename: 'app.js' });
    console.log('Syntax: OK!');
  } catch (e) {
    console.log('Syntax error:', e.message.split('\n').slice(0, 2).join('\n'));
  }
  fs.writeFileSync('app.js', result);
} else {
  const result = bytes.toString('utf8');
  try {
    new (require('vm').Script)(result, { filename: 'app.js' });
    console.log('Whole-file: Syntax OK!');
  } catch (e) {
    console.log('Whole-file error:', e.message.split('\n').slice(0, 2).join('\n'));
  }
  fs.writeFileSync('app.js', result);
}
