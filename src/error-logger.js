const fs = require("fs");
const path = require("path");
const util = require("util");

class ErrorLogger {
  constructor() {
    this.logFilePath = path.join(process.cwd(), "logs", "error.log");
    this.maxLogSize = 5 * 1024 * 1024; // 5MB
    this.maxLogLines = 10000;

    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Override console.error globally
    this.overrideConsoleError();

    // Handle uncaught exceptions and unhandled rejections
    this.setupGlobalErrorHandlers();
  }

  formatError(error, context = "") {
    const timestamp = new Date().toISOString();
    const message = (error.message || String(error)).split("\n");
    const errorInfo = {
      timestamp,
      context,
      message: message.length === 1 ? message[0] : message,
      stack: (error.stack || new Error().stack)
        .split("\n")
        .map((line) => line.replace(process.cwd(), "")),
      type: error.constructor.name,
      code: error.code,
      statusCode: error.statusCode,
      details: {},
    };

    // Capture additional error properties
    for (const key in error) {
      if (!["message", "stack", "code", "statusCode"].includes(key)) {
        errorInfo.details[key] = error[key];
      }
    }

    return errorInfo;
  }

  logError(error, context = "") {
    try {
      const errorInfo = this.formatError(error, context);
      const logEntry = JSON.stringify(errorInfo, null, 2) + "\n---\n";

      // Append to log file
      fs.appendFileSync(this.logFilePath, logEntry);

      // Check and rotate log if needed
      this.rotateLogIfNeeded();
    } catch (loggingError) {
      // Fallback to stderr if logging fails
      process.stderr.write(`Failed to log error: ${loggingError.message}\n`);
      process.stderr.write(`Original error: ${error.message}\n`);
    }
  }

  rotateLogIfNeeded() {
    try {
      const stats = fs.statSync(this.logFilePath);
      if (stats.size > this.maxLogSize) {
        // Read existing log
        const content = fs.readFileSync(this.logFilePath, "utf8");
        const entries = content
          .split("\n---\n")
          .filter((entry) => entry.trim());

        // Keep only recent entries
        const recentEntries = entries.slice(-Math.floor(this.maxLogLines / 2));
        const truncatedContent = recentEntries.join("\n---\n") + "\n---\n";

        // Archive old log
        const archivePath = this.logFilePath.replace(
          ".log",
          `.${Date.now()}.log`
        );
        fs.renameSync(this.logFilePath, archivePath);

        // Write truncated content to new log
        fs.writeFileSync(this.logFilePath, truncatedContent);
      }
    } catch (err) {
      // Ignore rotation errors
    }
  }

  overrideConsoleError() {
    const originalConsoleError = console.error;
    const self = this;

    console.error = function (...args) {
      // Call original console.error
      originalConsoleError.apply(console, args);

      // Log to error.log
      try {
        const errorMessage = args
          .map((arg) => {
            if (arg instanceof Error) {
              return arg;
            }
            return typeof arg === "object"
              ? util.inspect(arg, { depth: 3 })
              : String(arg);
          })
          .join(" ");

        const error =
          args.find((arg) => arg instanceof Error) || new Error(errorMessage);
        self.logError(error, "console.error");
      } catch (e) {
        // Ignore logging errors
      }
    };
  }

  setupGlobalErrorHandlers() {
    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      this.logError(error, "uncaughtException");
      // Let the process exit after logging
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      error.promise = promise;
      this.logError(error, "unhandledRejection");
    });
  }

  // Wrapper for async functions to catch and log errors
  wrapAsync(fn, context = "") {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.logError(error, context || fn.name || "async function");
        throw error;
      }
    };
  }

  // Wrapper for sync functions to catch and log errors
  wrapSync(fn, context = "") {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.logError(error, context || fn.name || "sync function");
        throw error;
      }
    };
  }

  // Log error without throwing
  logErrorSilently(error, context = "") {
    this.logError(error, context);
  }

  // Log fetch response error with body parsing
  async logFetchResponseError(response, context = "") {
    try {
      const errorBody = await response.json();
      this.logError(
        new Error(`Response body: ${JSON.stringify(errorBody, null, 2)}`),
        `${context} response`
      );
    } catch (e) {
      this.logErrorSilently(e, `${context} response parsing`);
    }
  }
}

// Create singleton instance
const errorLogger = new ErrorLogger();

module.exports = {
  errorLogger,
  logError: errorLogger.logError.bind(errorLogger),
  wrapAsync: errorLogger.wrapAsync.bind(errorLogger),
  wrapSync: errorLogger.wrapSync.bind(errorLogger),
  logErrorSilently: errorLogger.logErrorSilently.bind(errorLogger),
  logFetchResponseError: errorLogger.logFetchResponseError.bind(errorLogger),
};
