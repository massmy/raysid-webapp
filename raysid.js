export async function crc1(data) {
  let crc = 0;
  let i = 0;

  while (i < data.length) {
    const rem = data.length - i;

    if (rem >= 4) {
      crc += (data[i+3]<<24)|(data[i+2]<<16)|(data[i+1]<<8)|data[i];
      i += 4;
    } else if (rem === 3) {
      crc += (data[i+2]<<16)|(data[i+1]<<8)|data[i];
      i += 3;
    } else if (rem === 2) {
      crc += (data[i+1]<<8)|data[i];
      i += 2;
    } else {
      crc += data[i++];
    }
  }

  return crc >>> 0;
}

export async function crc2(data) {
  let out = 0;
  for (const b of data) out ^= b;
  return out & 0xff;
}

export async function wrap(payload) {
  const c1 = crc1(payload);

  const inner = new Uint8Array(1 + 4 + payload.length);
  inner[0] = 0xee;

  new DataView(inner.buffer).setUint32(1, c1, false);
  inner.set(payload, 5);

  const c2 = crc2(inner);

  const out = new Uint8Array(inner.length + 3);
  out[0] = 0xff;
  out[1] = c2;
  out.set(inner, 2);
  out[out.length - 1] = out.length;

  return out;
}