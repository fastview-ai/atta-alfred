const { logError, logErrorSilently } = require("./error-logger");

const {
  createLogger,
  redirectConsoleToLog,
  spawnAsyncCache,
  writeToCache,
  readFromCache,
  shouldThrottle,
} = require("./data-cache-async");

const isOffline = process.env.OFFLINE === "1";

function withFilterCache(
  filterFn,
  filterModule,
  cacheFile,
  { cachePolicy = "offline-only" } = {}
) {
  const filterWithCache = async () => {
    try {
      if (isOffline) {
        throw new Error("Offline mode");
      }

      if (cachePolicy === "cache-only") {
        // cache policy cache only means we always eagerly use the cache
        // thus returning stale results
        const staleResult = readFromCache(cacheFile);
        if (staleResult) {
          filterCacheAsync(filterModule, cacheFile);
          return staleResult;
        }

        const result = await filterFn();
        writeToCache(cacheFile, result);
        return result;
      } else if (cachePolicy === "offline-only") {
        // cache policy offline only means we will only use the cache when offline
        const result = await filterFn();
        writeToCache(cacheFile, result);
        return result;
      }
    } catch (error) {
      // If offline/error, try to load from cache
      const cached = readFromCache(cacheFile);
      if (cached) {
        logErrorSilently(error, `${filterModule} offline/error`);
        return cached.map((item) => ({
          ...item,
          title: `📴 ${item.title}`,
        }));
      } else {
        throw error;
      }
    }
  };

  filterWithCache.filter = filterFn;

  return filterWithCache;
}

function filterCacheAsync(filterModule, cacheFile) {
  spawnAsyncCache("filter-cache-async.js", [filterModule, cacheFile]);
}

module.exports = {
  withFilterCache,
  filterCacheAsync,
  writeToCache,
  readFromCache,
};

if (require.main === module) {
  const filterModuleName = process.argv[2];
  const filterCacheName = process.argv[3];

  const { fetchAllData } = require(`./${filterModuleName}`);

  const log = createLogger("filter-cache-async.log");

  // Redirect console output to log file
  redirectConsoleToLog(log, `[${filterModuleName}] `);

  // Check if cache file exists and was modified in the last 5 seconds
  const THROTTLE_TIME = 5 * 1000; // 5 seconds

  if (shouldThrottle(filterCacheName, THROTTLE_TIME)) {
    const path = require("path");
    const fs = require("fs");
    const userDataDir = path.join(process.cwd(), "user-data");
    const cacheFilePath = path.join(userDataDir, filterCacheName);
    const timeSinceModified =
      Date.now() - fs.statSync(cacheFilePath).mtime.getTime();
    log(
      `Skipping fetch - cache file modified ${Math.round(
        timeSinceModified / 1000
      )}s ago (throttle: ${THROTTLE_TIME / 1000}s)`
    );
    return;
  }

  log("Fetch");
  fetchAllData()
    .then((result) => {
      log("Fetch success, caching to disk");
      writeToCache(filterCacheName, result);
      log("Caching to disk success");
    })
    .catch((error) => {
      log(`Fetch failure: ${error.message}`);
      logError(error, `${filterModuleName} fetch failure`);
    });
}
