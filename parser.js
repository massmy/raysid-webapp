// ===== Spectrum Reassembly State =====
let specBuf = new Uint8Array(0);
let specExpected = 0;
let specStart = 0;

function append(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

// ===== Entry =====
export function parseFrame(raw) {
  const now = performance.now();

  if (!raw || raw.length < 2) return null;

  const len = raw[0] === 0 ? 256 : raw[0];
  const type = raw[1];

  const isSpectrum = type === 0x30 || type === 0x31 || type === 0x32;

  // timeout reset
  if (specExpected && now - specStart > 500) {
    specBuf = new Uint8Array(0);
    specExpected = 0;
  }

  // assembling spectrum
  if (specExpected) {
    specBuf = append(specBuf, raw);

    if (specBuf.length >= specExpected) {
      const frame = specBuf.slice(0, specExpected);
      specBuf = new Uint8Array(0);
      specExpected = 0;
      return parseComplete(frame);
    }
    return null;
  }

  // start new spectrum
  if (isSpectrum) {
    specBuf = raw;
    specExpected = len;
    specStart = now;
    return null;
  }

  return parseComplete(raw);
}

// ===== Dispatcher =====
function parseComplete(frame) {
  if (frame.length < 4) return null;

  const type = frame[1];

  if (type === 0x17) return parseCPS(frame);
  if (type === 0x02) return parseBattery(frame);
  if (type === 0x30 || type === 0x31 || type === 0x32) return parseSpectrum(frame);

  return null;
}

// ===== CPS =====
function checksum3(data) {
  let out = 0;
  for (let i = 0; i < data.length; i += 3) {
    const v =
      (data[i] << 16) |
      ((data[i + 1] || 0) << 8) |
      (data[i + 2] || 0);
    out ^= v;
  }
  return out & 0xFFFFFF;
}

function validateCPS(frame) {
  if (frame.length < 7) return false;

  const calc = checksum3(frame.slice(1, -3));
  const exp = frame.slice(-4, -2);

  const mid = (calc >> 8) & 0xff;
  const high = (calc >> 16) & 0xff;

  return exp[0] === mid && exp[1] === high;
}

function unpack(v) {
  let mult = Math.floor(v / 6000);
  let res = v % 6000;
  while (mult--) res *= 10;
  return res;
}

function parseCPS(frame) {
  if (frame.length < 13 || frame[1] !== 0x17) return null;
  if (!validateCPS(frame)) return null;

  let cps = 0;
  let dose = 0;

  const sets = frame.length <= 20 ? 2 : 12;

  for (let k = 0; k < sets; k++) {
    const base = k * 3 + 2;
    if (base + 2 >= frame.length) break;

    const t = frame[base];
    const raw = frame[base + 1] | (frame[base + 2] << 8);
    const val = unpack(raw) / 600;

    if (t === 0) cps = val;
    if (t === 1) dose = val / 100;
  }

  return { type: "cps", cps, dose };
}

// ===== Battery =====
function parseBattery(frame) {
  if (frame.length < 6 || frame[1] !== 0x02) return null;

  const tempRaw = frame[2] | (frame[3] << 8);
  const temp = tempRaw / 10 - 100;
  const level = frame[4];
  const charging = !!frame[5];

  if (level > 100) return null;
  if (temp < -40 || temp > 80) return null;

  return { type: "battery", level, temp, charging };
}

// ===== Spectrum =====
function parseSpectrum(frame) {
  const length = frame[0] || 256;
  if (frame.length < length) return null;

  const type = frame[1];

  let div = 1;
  if (type === 0x31) div = 3;
  else if (type === 0x32) div = 9;

  const start = frame[2] | (frame[3] << 8);
  if (start > 2000) return null;

  let cur =
    (frame[6] << 16) |
    (frame[5] << 8) |
    frame[4];

  let bins = {};
  let x = Math.floor(start / div);

  bins[x++] = cur / div;

  let pos = 7;
  const limit = length - 3;

  while (pos < limit) {
    const b = frame[pos++];
    const pt = b === 0 ? 4 : (b >> 6);
    let n = b === 0 ? 1 : (b & 0x3f);

    while (n-- > 0 && pos < limit) {
      let diff = 0;

      if (pt === 0) {
        const byte = frame[pos];
        diff = (byte >> 4);
        if (diff > 7) diff -= 16;
        cur += diff;
        bins[x++] = cur / div;

        if (--n < 0) break;

        diff = (byte & 0x0f);
        if (diff > 7) diff -= 16;
        cur += diff;
        bins[x++] = cur / div;

        pos++;
      }

      else if (pt === 1) {
        diff = frame[pos++];
        if (diff > 127) diff -= 256;
        cur += diff;
        bins[x++] = cur / div;
      }

      else if (pt === 2 && pos + 1 < limit) {
        const b0 = frame[pos];
        const b1 = frame[pos + 1];

        diff = ((b0 << 4) | (b1 >> 4)) & 0xfff;
        if (diff > 2047) diff -= 4096;
        cur += diff;
        bins[x++] = cur / div;

        pos += 2;
        if (--n < 0) break;

        if (pos < limit) {
          const b2 = frame[pos];
          diff = ((b1 & 0xf) << 8) | b2;
          if (diff > 2047) diff -= 4096;
          cur += diff;
          bins[x++] = cur / div;
          pos++;
        }
      }

      else if (pt === 3 && pos + 1 < limit) {
        diff = frame[pos] | (frame[pos + 1] << 8);
        if (diff > 32767) diff -= 65536;
        pos += 2;
        cur += diff;
        bins[x++] = cur / div;
      }

      else if (pt === 4 && pos + 2 < limit) {
        diff =
          frame[pos] |
          (frame[pos + 1] << 8) |
          (frame[pos + 2] << 16);

        if (diff > 8388607) diff -= 16777216;
        pos += 3;
        cur += diff;
        bins[x++] = cur / div;
      }

      else {
        return { type: "spectrum", bins };
      }
    }
  }

  return { type: "spectrum", bins };
}