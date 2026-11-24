export interface ZipArchiveEntry {
  name: string;
  data: Uint8Array;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function sanitizeZipEntryName(rawName: string, fallbackIndex: number): string {
  const normalized = rawName
    .replaceAll('\\', '/')
    .replace(/^[a-zA-Z]:/, '')
    .replace(/[\x00-\x1f\x7f]/g, '');

  const segments = normalized
    .split('/')
    .map((segment) => segment.replace(/:/g, '_').trim())
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

  return segments.join('/') || `file-${fallbackIndex + 1}.bin`;
}

function encodeDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, Math.min(2107, date.getUTCFullYear()));
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Pure TypeScript Store-mode (uncompressed) ZIP archive builder.
 * Works identically in Node.js and modern browsers with zero external dependencies.
 */
export function createZipArchive(
  entries: readonly ZipArchiveEntry[],
  timestamp: Date = new Date()
): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const usedNames = new Set<string>();
  const { dosTime, dosDate } = encodeDosDateTime(timestamp);
  let offset = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let safeName = sanitizeZipEntryName(entry.name, i);
    if (usedNames.has(safeName)) {
      const slashIdx = safeName.lastIndexOf('/');
      const dotIdx = safeName.lastIndexOf('.');
      const hasExtension = dotIdx > slashIdx + 1;
      const stem = hasExtension ? safeName.slice(0, dotIdx) : safeName;
      const ext = hasExtension ? safeName.slice(dotIdx) : '';
      let suffix = 2;
      while (usedNames.has(`${stem}-${suffix}${ext}`)) {
        suffix++;
      }
      safeName = `${stem}-${suffix}${ext}`;
    }
    usedNames.add(safeName);

    const nameBytes = encodeUtf8(safeName);
    const data = entry.data;
    const checksum = crc32(data);
    const size = data.byteLength;

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Compression method 0 = Store
    lv.setUint16(10, dosTime, true); // Mod time
    lv.setUint16(12, dosDate, true); // Mod date
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central directory header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 filename flag
    cv.setUint16(10, 0, true); // Store
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra length
    cv.setUint16(32, 0, true); // Comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal attrs
    cv.setUint32(38, 0, true); // External attrs
    cv.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.byteLength + data.byteLength;
  }

  let centralDirSize = 0;
  for (const part of centralParts) {
    centralDirSize += part.byteLength;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralDirSize + eocd.byteLength;
  const archive = new Uint8Array(totalLength);
  let cursor = 0;
  for (const part of localParts) {
    archive.set(part, cursor);
    cursor += part.byteLength;
  }
  for (const part of centralParts) {
    archive.set(part, cursor);
    cursor += part.byteLength;
  }
  archive.set(eocd, cursor);

  return archive;
}
