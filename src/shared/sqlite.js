// Wbudowany w Node moduł SQLite (node:sqlite, Node 22.13+), bez zależności z npm.
// Node oznacza go jako „experimental” i wypisuje ostrzeżenie przy każdym starcie –
// wyciszamy tylko to jedno ostrzeżenie, pozostałe działają normalnie.

const originalEmitWarning = process.emitWarning;
process.emitWarning = function emitWarning(warning, ...args) {
  const text = typeof warning === 'string' ? warning : warning?.message;
  const type = typeof args[0] === 'string' ? args[0] : args[0]?.type ?? warning?.name;
  if (type === 'ExperimentalWarning' && /SQLite/i.test(text || '')) return;
  return originalEmitWarning.call(process, warning, ...args);
};

const { DatabaseSync } = await import('node:sqlite');

export { DatabaseSync };
