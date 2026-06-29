// Logger estruturado — substitui console.log/error
// Níveis: debug, info, warn, error

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] || LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  debug: (...args) => { if (currentLevel <= LEVELS.debug) console.log(`[${timestamp()}] [DEBUG]`, ...args); },
  info: (...args) => { if (currentLevel <= LEVELS.info) console.log(`[${timestamp()}] [INFO]`, ...args); },
  warn: (...args) => { if (currentLevel <= LEVELS.warn) console.warn(`[${timestamp()}] [WARN]`, ...args); },
  error: (...args) => { if (currentLevel <= LEVELS.error) console.error(`[${timestamp()}] [ERROR]`, ...args); },
};

module.exports = logger;
