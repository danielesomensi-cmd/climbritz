import {
  encodeColor,
  encodePreset,
  encodeAllOff,
  parseApiLevel,
  PLACEMENT_ROLES,
  type EncoderHold,
} from '../kilter-protocol';

// --- encodeColor ---

describe('encodeColor', () => {
  test('pure red #FF0000 → 0b11100000 = 224', () => {
    // R=255→7, G=0→0, B=0→0 → (7<<5)|(0<<2)|0 = 224
    expect(encodeColor('FF0000')).toBe(0b11100000); // 224
  });

  test('pure green #00FF00 → 0b00011100 = 28', () => {
    // R=0→0, G=255→7, B=0→0 → (0<<5)|(7<<2)|0 = 28
    expect(encodeColor('00FF00')).toBe(0b00011100); // 28
  });

  test('pure blue #0000FF → 0b00000011 = 3', () => {
    // R=0→0, G=0→0, B=255→3 → (0<<5)|(0<<2)|3 = 3
    expect(encodeColor('0000FF')).toBe(0b00000011); // 3
  });

  test('white #FFFFFF → 0b11111111 = 255', () => {
    expect(encodeColor('FFFFFF')).toBe(0xFF);
  });

  test('black #000000 → 0', () => {
    expect(encodeColor('000000')).toBe(0);
  });

  test('handles # prefix', () => {
    expect(encodeColor('#FF0000')).toBe(224);
  });

  test('Start role color 00FF00 → 28', () => {
    expect(encodeColor(PLACEMENT_ROLES[12])).toBe(28);
  });

  test('Foot role color FFB600 → 0b11110110 = 246', () => {
    // R=255→7, G=182→5, B=0→0 → (7<<5)|(5<<2)|0 = 224+20 = 244
    // Wait: G=0xB6=182, 182/32=5.6875, floor=5 → (7<<5)|(5<<2)|0 = 224+20 = 244
    expect(encodeColor('FFB600')).toBe((7 << 5) | (5 << 2) | 0); // 244
  });
});

// --- encodePreset: reference vector for Preset #1 "All Corners" ---

describe('encodePreset', () => {
  const PRESET_1_HOLDS: EncoderHold[] = [
    { position: 33, role_id: 12 },
    { position: 0, role_id: 12 },
    { position: 68, role_id: 12 },
    { position: 476, role_id: 12 },
  ];

  test('Preset #1 "All Corners" matches hand-computed reference vector', () => {
    const chunks = encodePreset(PRESET_1_HOLDS);

    // 4 holds × 3 bytes = 12 data bytes + 1 marker = 13-byte body
    // Wrapped: [0x01, 13, checksum, 0x02, ...13 body bytes, 0x03] = 18 bytes
    // 18 < 20 → 1 chunk
    expect(chunks).toHaveLength(1);

    // Body: [T=84, 33,0,28, 0,0,28, 68,0,28, 220,1,28]
    // Checksum: (84+33+0+28+0+0+28+68+0+28+220+1+28) & 0xFF = 518 & 255 = 6
    //           ~6 & 255 = 249
    const expected = new Uint8Array([
      1, 13, 249, 2, // header: SOH, length, checksum, STX
      84,             // V3_ONLY marker 'T'
      33, 0, 28,      // position 33 (LE), color green
      0, 0, 28,       // position 0, color green
      68, 0, 28,      // position 68, color green
      220, 1, 28,     // position 476 (LE: 476&255=220, 476>>8=1), color green
      3,              // ETX footer
    ]);

    expect(chunks[0]).toEqual(expected);
  });

  test('empty holds array produces same output as encodeAllOff', () => {
    const emptyChunks = encodePreset([]);
    const allOffChunks = encodeAllOff();
    expect(emptyChunks).toEqual(allOffChunks);
  });

  test('custom color preset (#9) encodes color directly', () => {
    const holds: EncoderHold[] = [
      { position: 67, color: 'FF0000' },
      { position: 72, color: 'FF0000' },
    ];
    const chunks = encodePreset(holds);
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    // Flatten and find the data section (after 0x02 marker)
    const flat = Array.from(chunks[0]);
    const stxIdx = flat.indexOf(2); // 0x02 = STX
    const body = flat.slice(stxIdx + 1, flat.length - 1); // exclude ETX

    // Body: [T=84, 67,0,224, 72,0,224]
    expect(body[0]).toBe(84); // V3_ONLY
    expect(body[1]).toBe(67); // position 67 low
    expect(body[2]).toBe(0);  // position 67 high
    expect(body[3]).toBe(224); // red = 0b11100000
    expect(body[4]).toBe(72);
    expect(body[5]).toBe(0);
    expect(body[6]).toBe(224);
  });
});

// --- Chunking: large preset splits into multiple chunks ---

describe('chunking', () => {
  test('preset with many holds splits into >=2 BLE chunks', () => {
    // 44 holds → 44×3=132 data bytes + 1 marker = 133-byte body
    // Wrapped: 133 + 5 overhead = 138 bytes → ceil(138/20) = 7 chunks
    const holds: EncoderHold[] = Array.from({ length: 44 }, (_, i) => ({
      position: i,
      role_id: 13,
    }));
    const chunks = encodePreset(holds);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // All chunks are Uint8Array with max 20 bytes
    for (const chunk of chunks) {
      expect(chunk).toBeInstanceOf(Uint8Array);
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
  });

  test('reassembled chunks form a valid wrapped packet', () => {
    const holds: EncoderHold[] = Array.from({ length: 10 }, (_, i) => ({
      position: i * 10,
      role_id: 12,
    }));
    const chunks = encodePreset(holds);

    // Reassemble
    const flat: number[] = [];
    for (const chunk of chunks) flat.push(...Array.from(chunk));

    // Must start with 0x01 and end with 0x03
    expect(flat[0]).toBe(0x01);
    expect(flat[flat.length - 1]).toBe(0x03);

    // Verify checksum: bytes between 0x02 and 0x03
    const stxIdx = flat.indexOf(0x02);
    const etxIdx = flat.lastIndexOf(0x03);
    const body = flat.slice(stxIdx + 1, etxIdx);
    const declaredLength = flat[1];
    const declaredChecksum = flat[2];

    expect(body.length).toBe(declaredLength);

    // Recompute checksum
    let sum = 0;
    for (const b of body) sum = (sum + b) & 0xFF;
    const computed = ~sum & 0xFF;
    expect(computed).toBe(declaredChecksum);
  });
});

// --- Checksum integrity ---

describe('checksum integrity', () => {
  test('flipping one byte in payload changes checksum', () => {
    const holds: EncoderHold[] = [
      { position: 100, role_id: 12 },
      { position: 200, role_id: 13 },
    ];
    const chunks = encodePreset(holds);
    const flat = Array.from(chunks[0]);

    // Extract original checksum
    const originalChecksum = flat[2];

    // Flip a byte in the body (after STX=0x02 at index 3)
    const bodyStart = flat.indexOf(0x02) + 1;
    const modified = [...flat];
    modified[bodyStart] ^= 0xFF; // flip marker byte

    // Recompute checksum over modified body
    const etxIdx = modified.lastIndexOf(0x03);
    const modBody = modified.slice(bodyStart, etxIdx);
    let sum = 0;
    for (const b of modBody) sum = (sum + b) & 0xFF;
    const newChecksum = ~sum & 0xFF;

    expect(newChecksum).not.toBe(originalChecksum);
  });
});

// --- encodeAllOff ---

describe('encodeAllOff', () => {
  test('produces a valid single-chunk packet with T marker only', () => {
    const chunks = encodeAllOff();
    expect(chunks).toHaveLength(1);

    // Body = [T=84], wrapped = [1, 1, checksum(84), 2, 84, 3]
    // checksum(84) = ~(84 & 255) & 255 = ~84 & 255 = 171
    const expected = new Uint8Array([1, 1, 171, 2, 84, 3]);
    expect(chunks[0]).toEqual(expected);
  });
});

// --- parseApiLevel ---

describe('parseApiLevel', () => {
  test('device name with @3 → 3', () => {
    expect(parseApiLevel('mykilterboard@3')).toBe(3);
  });

  test('device name with @2 → 2', () => {
    expect(parseApiLevel('board@2')).toBe(2);
  });

  test('device name without @ → 2 (legacy default)', () => {
    expect(parseApiLevel('Kilter Board')).toBe(2);
  });

  test('device name with # serial and @3 → 3', () => {
    expect(parseApiLevel('KB#12345@3')).toBe(3);
  });
});
