// A real, scannable QR encoder — byte mode, error-correction level M,
// versions 1 through 10 (up to 213 bytes, which covers every deposit address
// and account block this app shows).
//
// Vendored rather than installed: the deposit screens are the one place a
// fake "QR-looking" matrix would be actively harmful (a camera would fail on
// money), and the app ships no QR dependency. This is ISO/IEC 18004 to the
// letter for the subset above — mode/count header, Reed-Solomon over GF(256),
// block interleave, function patterns, all eight masks scored by the standard
// penalty rules.

/** Data codewords, EC codewords per block, and the block layout, per version. */
type Spec = {
  /** Total codewords in the symbol. */
  total: number;
  /** EC codewords in each block. */
  ecPerBlock: number;
  /** [blockCount, dataCodewordsPerBlock] for group 1, then group 2. */
  groups: [number, number][];
};

// Level M only — the level every reference wallet screen uses, and the one
// that survives a phone camera at arm's length on a lit screen.
const SPECS: Record<number, Spec> = {
  1: { total: 26, ecPerBlock: 10, groups: [[1, 16]] },
  2: { total: 44, ecPerBlock: 16, groups: [[1, 28]] },
  3: { total: 70, ecPerBlock: 26, groups: [[1, 44]] },
  4: { total: 100, ecPerBlock: 18, groups: [[2, 32]] },
  5: { total: 134, ecPerBlock: 24, groups: [[2, 43]] },
  6: { total: 172, ecPerBlock: 16, groups: [[4, 27]] },
  7: { total: 196, ecPerBlock: 18, groups: [[4, 31]] },
  8: {
    total: 242,
    ecPerBlock: 22,
    groups: [
      [2, 38],
      [2, 39],
    ],
  },
  9: {
    total: 292,
    ecPerBlock: 22,
    groups: [
      [3, 36],
      [2, 37],
    ],
  },
  10: {
    total: 346,
    ecPerBlock: 26,
    groups: [
      [4, 43],
      [1, 44],
    ],
  },
};

/** Row/column centres of the alignment patterns, per version. */
const ALIGN: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// GF(256) log/antilog tables under the QR primitive polynomial 0x11D.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

/** Generator polynomial for `degree` error-correction codewords. */
function generator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let d = 0; d < degree; d++) {
    const next = new Uint8Array(poly.length + 1);
    for (let i = 0; i < poly.length; i++) {
      next[i] ^= poly[i];
      next[i + 1] ^= mul(poly[i], EXP[d]);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon remainder — the EC codewords for one block. */
function ecCodewords(data: Uint8Array, count: number): Uint8Array {
  const gen = generator(count);
  const rem = new Uint8Array(count);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.copyWithin(0, 1);
    rem[count - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < count; i++) rem[i] ^= mul(gen[i + 1], factor);
    }
  }
  return rem;
}

/** UTF-8 bytes, without depending on TextEncoder being present. */
function utf8(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    let cp = ch.codePointAt(0) as number;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000)
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
  }
  return out;
}

/** Smallest version at level M that holds `byteLength` bytes in byte mode. */
function pickVersion(byteLength: number): number {
  for (let v = 1; v <= 10; v++) {
    const spec = SPECS[v];
    const dataCw = spec.groups.reduce(
      (n, [blocks, per]) => n + blocks * per,
      0,
    );
    const headerBits = 4 + (v >= 10 ? 16 : 8);
    if (dataCw * 8 - headerBits >= byteLength * 8) return v;
  }
  return 0;
}

/** Format-information bits: BCH(15,5) over the level+mask pair, then masked. */
function formatBits(mask: number): number {
  // Level M is 0b00 in the format encoding.
  const data = mask;
  let rem = data << 10;
  for (let i = 4; i >= 0; i--) {
    if (rem & (1 << (i + 10))) rem ^= 0x537 << i;
  }
  return ((data << 10) | rem) ^ 0x5412;
}

/** Version-information bits: BCH(18,6). Only symbols v7 and up carry these. */
function versionBits(version: number): number {
  let rem = version << 12;
  for (let i = 5; i >= 0; i--) {
    if (rem & (1 << (i + 12))) rem ^= 0x1f25 << i;
  }
  return (version << 12) | rem;
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** The standard four penalty rules, summed. Lower is a cleaner symbol. */
function penalty(m: Int8Array, size: number): number {
  const at = (r: number, c: number) => m[r * size + c] & 1;
  let score = 0;

  // Rule 1 — runs of five or more same-coloured modules, in both directions.
  for (let i = 0; i < size; i++) {
    let runH = 1;
    let runV = 1;
    for (let j = 1; j < size; j++) {
      runH = at(i, j) === at(i, j - 1) ? runH + 1 : 1;
      if (runH === 5) score += 3;
      else if (runH > 5) score += 1;
      runV = at(j, i) === at(j - 1, i) ? runV + 1 : 1;
      if (runV === 5) score += 3;
      else if (runV > 5) score += 1;
    }
  }

  // Rule 2 — every 2x2 block of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1))
        score += 3;
    }
  }

  // Rule 3 — the finder-lookalike 1:1:3:1:1 sequence with four light modules
  // on either side, which is what confuses a scanner into a false lock.
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c + 11 <= size; c++) {
      let a = true;
      let b = true;
      for (let k = 0; k < 11; k++) {
        const v = at(r, c + k);
        if (v !== A[k]) a = false;
        if (v !== B[k]) b = false;
      }
      if (a || b) score += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r + 11 <= size; r++) {
      let a = true;
      let b = true;
      for (let k = 0; k < 11; k++) {
        const v = at(r + k, c);
        if (v !== A[k]) a = false;
        if (v !== B[k]) b = false;
      }
      if (a || b) score += 40;
    }
  }

  // Rule 4 — imbalance between dark and light.
  let dark = 0;
  for (let i = 0; i < size * size; i++) dark += m[i] & 1;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/**
 * Encode `text` as a QR symbol.
 *
 * Returns the module matrix as rows of booleans (true = dark), or null when
 * the text is empty or longer than a version-10 level-M symbol holds. Callers
 * render null as a plain fallback rather than a broken code.
 */
export function encodeQR(text: string): boolean[][] | null {
  if (!text) return null;
  const bytes = utf8(text);
  const version = pickVersion(bytes.length);
  if (version === 0) return null;

  const spec = SPECS[version];
  const size = 17 + version * 4;
  const countBits = version >= 10 ? 16 : 8;

  // --- Bit stream: mode indicator, length, payload, terminator, padding.
  const bits: number[] = [];
  const push = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, countBits);
  for (const b of bytes) push(b, 8);

  const dataCw = spec.groups.reduce((n, [blocks, per]) => n + blocks * per, 0);
  const capacity = dataCw * 8;
  for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const PAD = [0xec, 0x11];
  for (let i = 0; bits.length < capacity; i++) push(PAD[i % 2], 8);

  const codewords = new Uint8Array(dataCw);
  for (let i = 0; i < dataCw; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    codewords[i] = byte;
  }

  // --- Split into blocks, add EC, then interleave both halves.
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const [blocks, per] of spec.groups) {
    for (let b = 0; b < blocks; b++) {
      const block = codewords.slice(offset, offset + per);
      offset += per;
      dataBlocks.push(block);
      ecBlocks.push(ecCodewords(block, spec.ecPerBlock));
    }
  }

  const final: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) if (i < block.length) final.push(block[i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of ecBlocks) final.push(block[i]);
  }

  // --- Function patterns. `reserved` marks modules the data stream skips.
  const modules = new Int8Array(size * size);
  const reserved = new Uint8Array(size * size);
  const set = (r: number, c: number, dark: boolean) => {
    modules[r * size + c] = dark ? 1 : 0;
    reserved[r * size + c] = 1;
  };

  const finder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const ring =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(rr, cc, ring || core);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  const centres = ALIGN[version];
  for (const r of centres) {
    for (const c of centres) {
      // Alignment patterns never overlap a finder.
      if (
        (r === 6 && c === 6) ||
        (r === 6 && c === size - 7) ||
        (r === size - 7 && c === 6)
      )
        continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          set(r + dr, c + dc, ring !== 1);
        }
      }
    }
  }

  // Dark module — always set, always at this coordinate.
  set(size - 8, 8, true);

  // Reserve the format areas before the data walk reaches them.
  for (let i = 0; i < 9; i++) {
    if (!reserved[8 * size + i]) set(8, i, false);
    if (!reserved[i * size + 8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8 * size + (size - 1 - i)]) set(8, size - 1 - i, false);
    if (!reserved[(size - 1 - i) * size + 8]) set(size - 1 - i, 8, false);
  }
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      set(r, c, false);
      set(c, r, false);
    }
  }

  // --- Data walk: two-column strips, right to left, alternating direction.
  let bitIndex = 0;
  const totalBits = final.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern; the strips step over it.
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let k = 0; k < 2; k++) {
        const c = right - k;
        if (reserved[r * size + c]) continue;
        let bit = 0;
        if (bitIndex < totalBits) {
          bit = (final[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
          bitIndex++;
        }
        modules[r * size + c] = bit;
      }
    }
    upward = !upward;
  }

  // --- Mask selection: build all eight, keep the least penalised.
  let best: Int8Array | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = Int8Array.from(modules);
    const fn = MASKS[mask];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (reserved[r * size + c]) continue;
        if (fn(r, c)) candidate[r * size + c] ^= 1;
      }
    }
    writeFormat(candidate, size, mask);
    if (version >= 7) writeVersion(candidate, size, version);
    // The candidate carries the format info for its OWN mask, so whichever
    // one wins already declares itself correctly to a scanner.
    const score = penalty(candidate, size);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  const chosen = best as Int8Array;

  const out: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(chosen[r * size + c] === 1);
    out.push(row);
  }
  return out;
}

function writeFormat(m: Int8Array, size: number, mask: number) {
  const bits = formatBits(mask);
  const put = (r: number, c: number, v: number) => {
    m[r * size + c] = v;
  };
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> i) & 1;
    // Copy one: around the top-left finder, stepping over the timing row/column.
    if (i < 6) put(8, i, bit);
    else if (i === 6) put(8, 7, bit);
    else if (i === 7) put(8, 8, bit);
    else if (i === 8) put(7, 8, bit);
    else put(14 - i, 8, bit);
    // Copy two: split between the bottom-left and top-right finders.
    if (i < 8) put(size - 1 - i, 8, bit);
    else put(8, size - 15 + i, bit);
  }
  // The dark module lives at the tail of copy two's run and must survive it —
  // the format loop writes straight over it, so it is restored last.
  put(size - 8, 8, 1);
}

function writeVersion(m: Int8Array, size: number, version: number) {
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const bit = (bits >> i) & 1;
    const r = Math.floor(i / 3);
    const c = size - 11 + (i % 3);
    m[r * size + c] = bit;
    m[c * size + r] = bit;
  }
}
