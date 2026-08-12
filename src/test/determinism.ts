const fixedNow = new Date("2026-08-12T00:00:00.000Z");
let nextId = 1;

export const testClock = {
  now: () => new Date(fixedNow),
};

export const testIds = {
  next: () => `test-id-${nextId++}`,
};

export function resetTestDeterminism() {
  nextId = 1;
}
