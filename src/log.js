// Minimalistisches Logging mit Uhrzeit.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export function createLogger(level = 'info') {
  const min = LEVELS[level] ?? LEVELS.info;
  const stamp = () => new Date().toLocaleTimeString('de-DE', { hour12: false });
  const make = (name, fn) => (...args) => {
    if (LEVELS[name] >= min) fn(`[${stamp()}]`, ...args);
  };
  return {
    debug: make('debug', console.debug),
    info: make('info', console.log),
    warn: make('warn', console.warn),
    error: make('error', console.error),
  };
}
