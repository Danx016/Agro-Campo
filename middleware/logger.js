const fs = require('fs');
const path = require('path');

// Directorio de logs
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Niveles de log
const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SECURITY: 'SECURITY'
};

// Función para escribir logs
function writeLog(level, message, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...details
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  // Log a consola
  if (level === LOG_LEVELS.ERROR || level === LOG_LEVELS.SECURITY) {
    console.error(`[${level}] ${timestamp} - ${message}`);
  } else {
    console.log(`[${level}] ${timestamp} - ${message}`);
  }

  // Log a archivo
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logDir, `app-${today}.log`);
  fs.appendFileSync(logFile, logLine);

  // Logs de seguridad van a archivo separado
  if (level === LOG_LEVELS.SECURITY) {
    const securityLogFile = path.join(logDir, `security-${today}.log`);
    fs.appendFileSync(securityLogFile, logLine);
  }
}

// Middleware de logging de peticiones HTTP
function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Registrar intentos sospechosos
    if (res.statusCode === 401 || res.statusCode === 403) {
      writeLog(LOG_LEVELS.SECURITY, 'Acceso denegado', logData);
    } else if (res.statusCode >= 500) {
      writeLog(LOG_LEVELS.ERROR, 'Error del servidor', logData);
    } else {
      writeLog(LOG_LEVELS.INFO, 'Petición HTTP', logData);
    }

    originalEnd.apply(res, args);
  };

  next();
}

// Funciones de logging específicas
function logSecurityEvent(event, details = {}) {
  writeLog(LOG_LEVELS.SECURITY, event, details);
}

function logError(message, error = {}) {
  writeLog(LOG_LEVELS.ERROR, message, {
    error: error.message || error,
    stack: error.stack
  });
}

function logInfo(message, details = {}) {
  writeLog(LOG_LEVELS.INFO, message, details);
}

module.exports = {
  requestLogger,
  logSecurityEvent,
  logError,
  logInfo,
  LOG_LEVELS
};
