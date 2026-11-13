// SQLite module built into Node (node:sqlite, Node 22.13+), no npm dependencies.
// Node marks it as "experimental" and prints a warning on every start –
// we silence only this one warning, all others work normally.

const originalEmitWarning = process.emitWarning;
process.emitWarning = function emitWarning(warning, ...args) {
  const text = typeof warning === 'string' ? warning : warning?.message;
  const type = typeof args[0] === 'string' ? args[0] : args[0]?.type ?? warning?.name;
  if (type === 'ExperimentalWarning' && /SQLite/i.test(text || '')) return;
  return originalEmitWarning.call(process, warning, ...args);
};

const { DatabaseSync } = await import('node:sqlite');

export { DatabaseSync };
