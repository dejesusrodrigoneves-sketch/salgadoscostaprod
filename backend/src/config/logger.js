// Logger estruturado — substitui console.log/error
// Níveis: debug, info, warn, error

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] || LEVELS.info;
const jsonMode = process.env.LOG_FORMAT === 'json';

function timestamp() {
  return new Date().toISOString();
}

function format(level, args, context) {
  if (jsonMode) {
    const msg = args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ');
    return JSON.stringify({ ts: timestamp(), level, msg, ...(context || {}) });
  }
  const ctx = context && Object.keys(context).length > 0 ? ' ' + JSON.stringify(context) : '';
  const msg = args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ');
  return `[${timestamp()}] [${level.toUpperCase()}] ${msg}${ctx}`;
}

function safeStringify(v) {
  if (v instanceof Error) return v.stack || String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

const logger = {
  debug: (...args) => { if (currentLevel <= LEVELS.debug) console.log(format('debug', args)); },
  info: (...args) => { if (currentLevel <= LEVELS.info) console.log(format('info', args)); },
  warn: (...args) => { if (currentLevel <= LEVELS.warn) console.warn(format('warn', args)); },
  error: (...args) => { if (currentLevel <= LEVELS.error) console.error(format('error', args)); },
  child: (context) => ({
    debug: (...args) => { if (currentLevel <= LEVELS.debug) console.log(format('debug', args, context)); },
    info: (...args) => { if (currentLevel <= LEVELS.info) console.log(format('info', args, context)); },
    warn: (...args) => { if (currentLevel <= LEVELS.warn) console.warn(format('warn', args, context)); },
    error: (...args) => { if (currentLevel <= LEVELS.error) console.error(format('error', args, context)); },
  }),
};

module.exports = logger;
