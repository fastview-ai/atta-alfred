const { logErrorSilently } = require("./error-logger");

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// Common logging functionality with file rotation
function createLogger(
  logFileName,
  maxLogSize = 1024 * 1024,
  maxLogLines = 1000
) {
  const log = (msg, prefix = "") => {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp}: ${prefix}${msg}\n`;

    try {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const logFilePath = path.join(logsDir, logFileName);

      // Always append first
      fs.appendFileSync(logFilePath, logEntry);

      // Check file size after append
      const stats = fs.statSync(logFilePath);
      if (stats.size > maxLogSize) {
        // Read existing log
        const content = fs.readFileSync(logFilePath, "utf8");
        const lines = content.split("\n");

        // Keep only last maxLogLines
        const truncatedContent = lines.slice(-maxLogLines).join("\n") + "\n";

        // Overwrite with truncated content
        fs.writeFileSync(logFilePath, truncatedContent);
      }
    } catch (err) {
      // If file doesn't exist, create it
      if (err.code === "ENOENT") {
        const logsDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        const logFilePath = path.join(logsDir, logFileName);
        fs.writeFileSync(logFilePath, logEntry);
      }
    }
  };

  return log;
}

// Console redirection to log file
function redirectConsoleToLog(log, prefix = "") {
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  process.stdout.write = function (chunk, encoding, callback) {
    log(`${prefix}[stdout] ${chunk}`);
    originalStdoutWrite.apply(process.stdout, arguments);
  };

  process.stderr.write = function (chunk, encoding, callback) {
    log(`${prefix}[stderr] ${chunk}`);
    originalStderrWrite.apply(process.stderr, arguments);
  };
}

// Generic async cache spawner
function spawnAsyncCache(scriptName, args = []) {
  const nodePath = process.env.NODE_PATH || "node";
  const cwd = process.cwd();
  const scriptPath = path.join(cwd, "src", scriptName);

  const child = spawn(nodePath, [scriptPath, ...args], {
    detached: true,
    stdio: "ignore",
    cwd: cwd,
  });

  child.unref();
}

// Cache utility functions
function writeToCache(cacheFile, result) {
  if (result.length > 0) {
    try {
      // Ensure user-data directory exists
      const userDataDir = path.join(process.cwd(), "user-data");
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }

      // Save successful result to cache in user-data directory
      const cachePath = path.join(userDataDir, cacheFile);
      fs.writeFileSync(cachePath, JSON.stringify(result));
    } catch (error) {
      // Ignore but log it
      logErrorSilently(error, "writeToCache");
    }
  }
}

function readFromCache(cacheFile) {
  try {
    const userDataDir = path.join(process.cwd(), "user-data");
    const cachePath = path.join(userDataDir, cacheFile);

    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      if (!Array.isArray(cached) || cached.length === 0) {
        return null;
      }
      return cached;
    }
    return null;
  } catch (error) {
    // Ignore but log it
    logErrorSilently(error, "readFromCache");
    return null;
  }
}

// Throttling helper
function shouldThrottle(cacheFilePath, throttleTimeMs = 5000) {
  try {
    const userDataDir = path.join(process.cwd(), "user-data");
    const cachePath = path.join(userDataDir, cacheFilePath);
    const stats = fs.statSync(cachePath);
    const timeSinceModified = Date.now() - stats.mtime.getTime();
    return timeSinceModified < throttleTimeMs;
  } catch (err) {
    return false; // File doesn't exist, no throttling needed
  }
}

// Process checking helper (for race condition prevention)
function isProcessRunning(scriptName) {
  try {
    const { execSync } = require("child_process");
    const psOutput = execSync(`ps aux | grep "${scriptName}" | grep -v grep`, {
      encoding: "utf8",
    });
    return psOutput.trim().length > 0;
  } catch (e) {
    return false; // ps command failed or no processes found
  }
}

module.exports = {
  createLogger,
  redirectConsoleToLog,
  spawnAsyncCache,
  writeToCache,
  readFromCache,
  shouldThrottle,
  isProcessRunning,
};
