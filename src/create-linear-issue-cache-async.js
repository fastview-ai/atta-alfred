const path = require("path");
const { logError } = require("./error-logger");
const {
  createLogger,
  redirectConsoleToLog,
  spawnAsyncCache,
  shouldThrottle,
  isProcessRunning,
} = require("./data-cache-async");

module.exports = function createLinearIssueCacheAsync(linearToken) {
  // Check if another instance is already running to prevent race conditions
  if (isProcessRunning("create-linear-issue-cache-async.js")) {
    // Another instance is already running, skip this execution
    return;
  }

  spawnAsyncCache("create-linear-issue-cache-async.js", [linearToken || ""]);
};

if (require.main === module) {
  // Import these only when running as main module to avoid circular dependency
  const { getMetadata, writePrefs } = require("./create-linear-issue-logic");

  const linearToken = process.argv[2] || process.env.LINEAR_API_KEY;

  const log = createLogger("create-linear-issue-cache-async.log");

  // Redirect console output to log file
  redirectConsoleToLog(log, "[create-linear-issue-cache] ");

  // Check if cache file exists and was modified in the last 5 seconds
  const cacheFileName = "create-linear-issue-cache.json";
  const THROTTLE_TIME = 5 * 1000; // 5 seconds

  if (shouldThrottle(cacheFileName, THROTTLE_TIME)) {
    const userDataDir = path.join(process.cwd(), "user-data");
    const cacheFilePath = path.join(userDataDir, cacheFileName);
    const timeSinceModified =
      Date.now() - require("fs").statSync(cacheFilePath).mtime.getTime();
    log(
      `Skipping fetch - cache file modified ${Math.round(
        timeSinceModified / 1000
      )}s ago (throttle: ${THROTTLE_TIME / 1000}s)`
    );
    return;
  }

  const userDataDir = path.join(process.cwd(), "user-data");
  const cacheFilePath = path.join(userDataDir, cacheFileName);
  if (!require("fs").existsSync(cacheFilePath)) {
    log("Cache file doesn't exist, proceeding with fetch");
  }

  log("Starting metadata fetch");
  getMetadata(linearToken)
    .then((metadata) => {
      if (metadata.error) {
        logError(
          new Error(`Metadata fetch failed: ${metadata.error}`),
          "create-linear-issue-cache-async"
        );
        return;
      }

      log("Metadata fetch successful, writing to cache");
      writePrefs(metadata);
      log("Metadata cache write successful");
    })
    .catch((error) => {
      log(`Fetch failure: ${error.message}`);
      logError(error, "create-linear-issue-cache-async main");
    });
}
