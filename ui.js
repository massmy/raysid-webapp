import { subscribe } from "./state.js";

const cpsEl = document.getElementById("cps");
const doseEl = document.getElementById("dose");

const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");

const H = canvas.height;
const W = canvas.width;

const mid = H / 2;

const cpsArea = { x: 40, y: 20, w: W - 50, h: mid - 40 };
const doseArea = { x: 40, y: mid + 20, w: W - 50, h: mid - 40 }


subscribe((s) => {
//   draw(s.history);
    render(s);
});

subscribe((s) => {
  cpsEl.textContent = s.cps.toFixed(2);
  doseEl.textContent = s.dose.toFixed(3);
});

const SCALE = {
  cps: { min: 0, max: 5000 },
  dose: { min: 0, max: 50 } // µSv/h je nach Gerät anpassen
};

function draw(history) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  drawLegend();
  drawAxes(w, h);
//   drawLine(history.cps, h, w, "cps");
//   drawLine(history.dose, h, w, "dose");
// drawLine(history.cps, h, w, "#00ff99");
// drawLine(history.dose, h, w, "#66aaff");
drawLine(history.cps, h, w, "cps", "#00ff99");
drawLine(history.dose, h, w, "dose", "#66aaff");
}

function render(state) {
  ctx.clearRect(0, 0, W, H);

  const cpsScale = computeScale(state.history.cps, "cps");
  const doseScale = computeScale(state.history.dose, "dose");

  drawBox(cpsArea);
  drawGraph(state.history.cps, cpsArea, cpsScale, "#00ff99");
  drawLabels(cpsArea, "CPS", cpsScale);

  drawBox(doseArea);
  drawGraph(state.history.dose, doseArea, doseScale, "#66aaff");
  drawLabels(doseArea, "DOSE", doseScale);
}

// function drawLine(data, h, w, color = "#fff") {
//   if (!data.length) return;

//   const max = Math.max(...data.map(d => d.v));
//   const min = Math.min(...data.map(d => d.v));
//   ctx.strokeStyle = color;
//   ctx.beginPath();

//   data.forEach((p, i) => {
//     const x = (i / (data.length - 1)) * (w - 40) + 30;
//     const y = h - 20 - ((p.v - min) / (max - min || 1)) * (h - 40);

//     if (i === 0) ctx.moveTo(x, y);
//     else ctx.lineTo(x, y);
//   });

//   ctx.stroke();
// }

function drawGraph(data, area, scale, color) {
  if (!data.length) return;

  ctx.strokeStyle = color;
  ctx.beginPath();

  data.forEach((p, i) => {
    const x = area.x + (i / (data.length - 1)) * area.w;

    const norm = (p.v - scale.min) / (scale.max - scale.min || 1);
    const y = area.y + (1 - Math.max(0, Math.min(1, norm))) * area.h;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

function drawLine(data, h, w, type, color) {
  if (!data.length) return;

  const scale = computeScale(data, type);

  ctx.strokeStyle = color;
  ctx.beginPath();

  data.forEach((p, i) => {
    const x = (i / (data.length - 1)) * (w - 40) + 30;

    const norm = (p.v - scale.min) / (scale.max - scale.min || 1);
    const y = h - 20 - Math.max(0, Math.min(1, norm)) * (h - 40);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  drawScaleLabels(type, scale);
}

function drawAxes(w, h) {
  ctx.fillStyle = "#aaa";
  ctx.font = "11px sans-serif";

  // Y labels CPS
  ctx.fillText("CPS 0", 5, h - 20);
  ctx.fillText(`CPS ${SCALE.cps.max}`, 5, 20);

  // Y labels Dose
  ctx.fillText("µSv/h 0", 70, h - 20);
  ctx.fillText(`µSv/h ${SCALE.dose.max}`, 70, 20);

  ctx.strokeStyle = "#444";
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(30, h);
  ctx.stroke();
}

function drawLegend() {
  ctx.fillStyle = "#00ff99";
  ctx.fillText("CPS", 40, 20);

  ctx.fillStyle = "#66aaff";
  ctx.fillText("Dose", 100, 20);
}

function computeScale(data, type) {
  const { min: hardMin, max: hardMax } = SCALE[type];

  if (!data.length) return { min: hardMin, max: hardMax };

  let min = Infinity;
  let max = -Infinity;

  for (const p of data) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }

  // padding gegen Flackern
  const pad = (max - min) * 0.1 || 1;

  min = Math.max(hardMin, min - pad);
  max = Math.min(hardMax, max + pad);

  return { min, max };
}

function drawBox(area) {
  ctx.strokeStyle = "#222";
  ctx.strokeRect(area.x, area.y, area.w, area.h);
}

function drawLabels(area, title, scale) {
  ctx.fillStyle = "#aaa";
  ctx.font = "12px sans-serif";

  ctx.fillText(
    `${title} max: ${scale.max}`,
    area.x,
    area.y - 5
  );

  ctx.fillText(
    `${title} min: ${scale.min}`,
    area.x,
    area.y + area.h + 15
  );
}