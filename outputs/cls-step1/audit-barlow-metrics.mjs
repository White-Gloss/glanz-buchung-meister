import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Read only the untransformed head, hhea and OS/2 tables. This is a metric
// inspector, not a complete WOFF2 decoder. No packages or servers are needed.
const repo = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url)));
const arialDirectory = process.argv[3] ?? 'C:/Windows/Fonts';
const tags = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post',
  'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

function readTables(bytes) {
  const tables = new Map();
  if (bytes.toString('ascii', 0, 4) === 'wOF2') {
    if (bytes.readUInt32BE(4) === 0x74746366) throw new Error('Font collections are unsupported');
    if (bytes.length !== bytes.readUInt32BE(8)) throw new Error('Invalid WOFF2 length');
    let cursor = 48;
    const readBase128 = () => {
      let value = 0;
      for (let i = 0; i < 5; i += 1) {
        if (cursor >= bytes.length) throw new Error('Truncated WOFF2 directory');
        const byte = bytes[cursor++];
        if ((i === 0 && byte === 0x80) || value > 0x01ffffff) throw new Error('Invalid UIntBase128');
        value = value * 128 + (byte & 127);
        if (!(byte & 128)) return value;
      }
      throw new Error('UIntBase128 is too long');
    };
    const entries = [];
    for (let i = 0; i < bytes.readUInt16BE(12); i += 1) {
      const flags = bytes[cursor++];
      const index = flags & 63;
      const version = flags >> 6;
      let tag = tags[index];
      if (index === 63) {
        tag = bytes.toString('ascii', cursor, cursor + 4);
        cursor += 4;
      }
      const originalLength = readBase128();
      const transformed = (tag === 'glyf' || tag === 'loca') ? version !== 3 : version !== 0;
      const length = transformed ? readBase128() : originalLength;
      entries.push({ tag, length, transformed });
    }
    const compressedLength = bytes.readUInt32BE(20);
    const data = zlib.brotliDecompressSync(bytes.subarray(cursor, cursor + compressedLength));
    let offset = 0;
    for (const entry of entries) {
      if (offset + entry.length > data.length) throw new Error('Table exceeds decompressed data');
      if (!entry.transformed) tables.set(entry.tag, data.subarray(offset, offset + entry.length));
      offset += entry.length;
    }
    if (offset !== data.length) throw new Error('Unexpected bytes in decompressed data');
  } else if (bytes.readUInt32BE(0) === 0x00010000 || bytes.toString('ascii', 0, 4) === 'OTTO') {
    for (let i = 0; i < bytes.readUInt16BE(4); i += 1) {
      const directoryOffset = 12 + 16 * i;
      const tag = bytes.toString('ascii', directoryOffset, directoryOffset + 4);
      const offset = bytes.readUInt32BE(directoryOffset + 8);
      const length = bytes.readUInt32BE(directoryOffset + 12);
      if (offset + length > bytes.length) throw new Error('SFNT table exceeds font length');
      tables.set(tag, bytes.subarray(offset, offset + length));
    }
  } else {
    throw new Error('Only standalone WOFF2 or SFNT fonts are supported');
  }
  return tables;
}

function readMetrics(file) {
  const bytes = fs.readFileSync(file);
  const tables = readTables(bytes);
  const head = tables.get('head');
  const hhea = tables.get('hhea');
  const os2 = tables.get('OS/2');
  if (!head || !hhea || !os2 || os2.length < 90) throw new Error(`Required metric tables missing: ${file}`);
  const fsSelection = os2.readUInt16BE(62);
  const hheaAscent = hhea.readInt16BE(4);
  const hheaDescent = hhea.readInt16BE(6);
  const hheaLineGap = hhea.readInt16BE(8);
  const typoAscent = os2.readInt16BE(68);
  const typoDescent = os2.readInt16BE(70);
  const typoLineGap = os2.readInt16BE(72);
  const useTypoMetrics = Boolean(fsSelection & 128);
  return {
    file: file.replaceAll('\\', '/'),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    unitsPerEm: head.readUInt16BE(18),
    weight: os2.readUInt16BE(4),
    xHeight: os2.readInt16BE(86),
    capHeight: os2.readInt16BE(88),
    averageCharacterWidth: os2.readInt16BE(2),
    hheaAscent, hheaDescent, hheaLineGap,
    typoAscent, typoDescent, typoLineGap,
    winAscent: os2.readUInt16BE(74),
    winDescent: os2.readUInt16BE(76),
    fsSelection, useTypoMetrics,
    targetAscent: useTypoMetrics ? typoAscent : hheaAscent,
    targetDescent: useTypoMetrics ? typoDescent : hheaDescent,
    targetLineGap: useTypoMetrics ? typoLineGap : hheaLineGap,
  };
}

const arialRegular = readMetrics(path.join(arialDirectory, 'arial.ttf'));
const arialBold = readMetrics(path.join(arialDirectory, 'arialbd.ttf'));
const percent = value => Number((value * 100).toFixed(6));
const fonts = [300, 400, 500, 600].map(weight => {
  const target = readMetrics(path.join(repo, 'public/fonts', `barlow-${weight}.woff2`));
  const fallback = weight === 600 ? arialBold : arialRegular;
  const adjustment = (target.xHeight / target.unitsPerEm) / (fallback.xHeight / fallback.unitsPerEm);
  return {
    target,
    fallbackFile: fallback.file,
    fallbackSource: weight === 600 ? ['Arial Bold', 'Arial-BoldMT'] : ['Arial', 'ArialMT'],
    cssWeight: weight,
    css: {
      sizeAdjustPercent: percent(adjustment),
      ascentOverridePercent: percent(target.targetAscent / target.unitsPerEm / adjustment),
      descentOverridePercent: percent(Math.abs(target.targetDescent) / target.unitsPerEm / adjustment),
      lineGapOverridePercent: percent(target.targetLineGap / target.unitsPerEm / adjustment),
    },
  };
});

process.stdout.write(`${JSON.stringify({
  inspectedAt: new Date().toISOString(),
  method: 'Measured normalized x-height alignment with target vertical metric overrides',
  formulas: {
    adjustment: '(Barlow.xHeight / Barlow.unitsPerEm) / (Arial.xHeight / Arial.unitsPerEm)',
    sizeAdjustPercent: '100 * adjustment',
    ascentOverridePercent: '100 * (Barlow.targetAscent / Barlow.unitsPerEm) / adjustment',
    descentOverridePercent: '100 * abs(Barlow.targetDescent / Barlow.unitsPerEm) / adjustment',
    lineGapOverridePercent: '100 * (Barlow.targetLineGap / Barlow.unitsPerEm) / adjustment',
  },
  limits: [
    'Matching x-height and vertical metrics does not make distinct glyph advance widths identical.',
    'Arial values are measured from the recorded local font binaries; other installed versions can differ.',
    'Do not apply these Arial metric values to Helvetica or unrelated fallback fonts.',
    'Explicit fallback descriptors cover normal-style weights 300, 400, 500 and 600; higher weights can synthesize bold.',
  ],
  specification: 'https://www.w3.org/TR/WOFF2/#table_dir_format',
  fallbackFonts: [arialRegular, arialBold],
  fonts,
}, null, 2)}\n`);
