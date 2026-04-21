export const state = {
  connected: false,
  cps: 0,
  dose: 0,
  battery: null,
  spectrum: null,

  history: {
    cps: [],
    dose: []
  }
};

const MAX_POINTS = 300;

export function pushHistory(type, value) {
  const arr = state.history[type];
  arr.push({ t: Date.now(), v: value });

  if (arr.length > MAX_POINTS) {
    arr.shift();
  }

  listeners.forEach(fn => fn(state));
}

const listeners = [];

export function subscribe(fn) {
  listeners.push(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}