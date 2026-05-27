function getPoolForMode(mode) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  const confusion = ["B", "D", "P", "Q", "6", "9", "M", "N"];

  if (mode === "numbers") return numbers;
  if (mode === "mixed") return [...letters, ...numbers];
  if (mode === "confusion") return confusion;
  return letters;
}

function normalizeKey(key) {
  if (!key) return "";
  if (/^[a-z]$/i.test(key)) return key.toUpperCase();
  if (/^\d$/.test(key)) return key;
  return "";
}

function calculateAccuracy(hits, attempts) {
  if (!attempts) return 0;
  return (hits / attempts) * 100;
}

function mostMissedSymbol(missedBySymbol) {
  const entries = Object.entries(missedBySymbol || {});
  if (!entries.length) return "";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

module.exports = {
  getPoolForMode,
  normalizeKey,
  calculateAccuracy,
  mostMissedSymbol,
};
