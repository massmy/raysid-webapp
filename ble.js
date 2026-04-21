import { parseFrame } from "./parser.js";
import { setState, pushHistory } from "./state.js";
import { wrap } from "./raysid.js";


let tx, rx;
let device = null;
let server = null;
let connected = false;

// export async function connect() {
//   const device = await navigator.bluetooth.requestDevice({
//     // filters: [{ services: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"] }],
//     acceptAllDevices: true,
//     optionalServices: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"]
//   });

//   const server = await device.gatt.connect();
//   const service = await server.getPrimaryService("49535343-fe7d-4ae5-8fa9-9fafd205e455");

//   tx = await service.getCharacteristic("49535343-8841-43f4-a8d4-ecbe34729bb3");
//   rx = await service.getCharacteristic("49535343-1e4d-4bd9-ba61-23c647249616");

//   await rx.startNotifications();
//   rx.addEventListener("characteristicvaluechanged", onNotify);

//   await sendHello();

//   setState({ connected: true });
// }

export async function connect() {
  device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    // filters: [{ services: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"] }],
    optionalServices: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"]
  });

  device.addEventListener("gattserverdisconnected", onDisconnect);

  await doConnect();
}

async function doConnect() {
  server = await device.gatt.connect();

  const service = await server.getPrimaryService(
    "49535343-fe7d-4ae5-8fa9-9fafd205e455"
  );

  tx = await service.getCharacteristic(
    "49535343-8841-43f4-a8d4-ecbe34729bb3"
  );

  rx = await service.getCharacteristic(
    "49535343-1e4d-4bd9-ba61-23c647249616"
  );

  await rx.startNotifications();
  rx.addEventListener("characteristicvaluechanged", onNotify);
    await sendHello();
    connected = true;
    startPingLoop();
  setState({ connected: true, error: null });
}

function onNotify(e) {
  const frame = new Uint8Array(e.target.value.buffer);
  const pkt = parseFrame(frame);

  if (!pkt) return;

  if (pkt.type === "cps") {
    setState({ cps: pkt.cps, dose: pkt.dose });
    pushHistory("cps", pkt.cps);
    pushHistory("dose", pkt.dose);
  }

  if (pkt.type === "battery") {
    setState({ battery: pkt });
  }

  if (pkt.type === "spectrum") {
    setState({ spectrum: pkt });
  }
}

async function sendHello() {
  const hello = new Uint8Array([
    0xFF,0xEE,0xEE,0x17,0x64,0x8F,0x32,0x12,
    0x00,0x64,0x17,0x20,0x8F,0x0E
  ]);

  await tx.writeValueWithoutResponse(hello);
  await new Promise(r => setTimeout(r, 200));
  await tx.writeValueWithoutResponse(hello);
}

function onDisconnect() {
  setState({
    connected: false,
    error: "disconnected"
  });

  // optional: auto reconnect
    stopPingLoop();
    connected = false;
  scheduleReconnect();
}

let reconnectTimer = null;

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    try {
      await doConnect();
    } catch (e) {
      scheduleReconnect(); // retry loop
    }
  }, 1000);
}

export async function sendPing(tab = 0) {
  if (!connected || !tx) return;

  const unix = Math.floor(Date.now() / 1000);

  const payload = new Uint8Array([
    0x12,
    tab & 0xff,
    (unix >> 24) & 0xff,
    (unix >> 16) & 0xff,
    (unix >> 8) & 0xff,
    unix & 0xff
  ]);

  const packet = wrap(payload);

  try {
    await tx.writeValueWithoutResponse(packet);
  } catch (e) {
    connected = false;
  }
}

let pingTimer = null;

function startPingLoop() {
  if (pingTimer) return;

  pingTimer = setInterval(() => {
    sendPing(0); // CPS
  }, 500);
}

function stopPingLoop() {
  clearInterval(pingTimer);
  pingTimer = null;
}