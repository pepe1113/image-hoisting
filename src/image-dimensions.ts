interface Dimensions { width: number; height: number }

function dimensions(width: number, height: number): Dimensions | null {
  return [width, height].every((value) => Number.isInteger(value) && value > 0 && value <= 0x7fffffff)
    ? { width, height } : null;
}

interface Box { type: string; data: number; end: number }

function boxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result: Box[] = [];
  for (let offset = start; offset + 8 <= end;) {
    let size = view.getUint32(offset);
    const header = size === 1 ? 16 : 8;
    if (size === 1) size = Number(view.getBigUint64(offset + 8));
    if (size === 0) size = end - offset;
    if (!Number.isSafeInteger(size) || size < header || offset + size > end) break;
    result.push({ type: String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)), data: offset + header, end: offset + size });
    offset += size;
  }
  return result;
}

function avifDimensions(bytes: Uint8Array): Dimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const meta = boxes(bytes, 0, bytes.length).find((box) => box.type === "meta");
  if (!meta || meta.data + 4 > meta.end) return null;
  const children = boxes(bytes, meta.data + 4, meta.end);
  const primary = children.find((box) => box.type === "pitm");
  const properties = children.find((box) => box.type === "iprp");
  if (!primary || !properties || primary.data + 6 > primary.end) return null;
  const version = view.getUint8(primary.data);
  if (version > 1 || (version === 1 && primary.data + 8 > primary.end)) return null;
  const primaryId = version === 0 ? view.getUint16(primary.data + 4) : view.getUint32(primary.data + 4);
  const propertyBoxes = boxes(bytes, properties.data, properties.end);
  const container = propertyBoxes.find((box) => box.type === "ipco");
  if (!container) return null;
  const items = boxes(bytes, container.data, container.end);
  for (const association of propertyBoxes.filter((box) => box.type === "ipma")) {
    if (association.data + 8 > association.end) continue;
    const version = view.getUint8(association.data);
    if (version > 1) continue;
    const wide = (view.getUint32(association.data) & 1) !== 0;
    const count = view.getUint32(association.data + 4);
    let offset = association.data + 8;
    for (let entry = 0; entry < count; entry += 1) {
      const idBytes = version === 0 ? 2 : 4;
      if (offset + idBytes + 1 > association.end) return null;
      const id = idBytes === 2 ? view.getUint16(offset) : view.getUint32(offset);
      offset += idBytes;
      const length = view.getUint8(offset++);
      for (let index = 0; index < length; index += 1) {
        if (offset + (wide ? 2 : 1) > association.end) return null;
        const propertyIndex = wide ? view.getUint16(offset) & 0x7fff : view.getUint8(offset) & 0x7f;
        offset += wide ? 2 : 1;
        const property = items[propertyIndex - 1];
        if (id === primaryId && property?.type === "ispe" && property.data + 12 <= property.end) {
          return dimensions(view.getUint32(property.data + 4), view.getUint32(property.data + 8));
        }
      }
    }
  }
  return null;
}

// Reads container dimensions, not decoded pixels or EXIF-oriented display dimensions.
export function readImageDimensions(bytes: Uint8Array, mime: string): Dimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, size: number) => String.fromCharCode(...bytes.subarray(offset, offset + size));
  const uint24 = (offset: number) => view.getUint8(offset) + (view.getUint8(offset + 1) << 8) + (view.getUint8(offset + 2) << 16);
  try {
    if (mime === "image/png" && text(12, 4) === "IHDR" && view.getUint32(8) === 13 && bytes.length >= 33) {
      return dimensions(view.getUint32(16), view.getUint32(20));
    }
    if (mime === "image/gif" && ["GIF87a", "GIF89a"].includes(text(0, 6)) && bytes.length >= 13) {
      return dimensions(view.getUint16(6, true), view.getUint16(8, true));
    }
    if (mime === "image/jpeg" && view.getUint16(0) === 0xffd8) {
      for (let offset = 2; offset < bytes.length;) {
        if (view.getUint8(offset++) !== 0xff) return null;
        while (view.getUint8(offset) === 0xff) offset += 1;
        const marker = view.getUint8(offset++);
        if (marker === 0xda || marker === 0xd9) return null;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > bytes.length) return null;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
          return dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3));
        }
        offset += length;
      }
    }
    if (mime === "image/webp" && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
      const end = Math.min(bytes.length, view.getUint32(4, true) + 8);
      for (let offset = 12; offset + 8 <= end;) {
        const type = text(offset, 4);
        const size = view.getUint32(offset + 4, true);
        const data = offset + 8;
        if (data + size > end) return null;
        if (type === "VP8X" && size >= 10) return dimensions(uint24(data + 4) + 1, uint24(data + 7) + 1);
        if (type === "VP8L" && size >= 5 && view.getUint8(data) === 0x2f) {
          const bits = view.getUint32(data + 1, true);
          return dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
        }
        if (type === "VP8 " && size >= 10 && (view.getUint8(data) & 1) === 0 && text(data + 3, 3) === "\x9d\x01\x2a") {
          return dimensions(view.getUint16(data + 6, true) & 0x3fff, view.getUint16(data + 8, true) & 0x3fff);
        }
        offset = data + size + (size % 2);
      }
    }
    if (mime === "image/avif") return avifDimensions(bytes);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  return null;
}
