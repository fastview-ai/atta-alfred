const {
  createLogger,
  redirectConsoleToLog,
  spawnAsyncCache,
  writeToCache,
  readFromCache,
} = require("./data-cache-async");

function filterCacheAsync(filterModule, cacheFile) {
  spawnAsyncCache("filter-cache-async.js", [filterModule, cacheFile]);
}

module.exports = { filterCacheAsync, writeToCache, readFromCache };

if (require.main === module) {
  const filterModuleName = process.argv[2];
  const filterCacheName = process.argv[3];

  const { filter } = require(`./${filterModuleName}`);

  const log = createLogger("filter-cache-async.log");

  // Redirect console output to log file
  redirectConsoleToLog(log, `[${filterModuleName}] `);

  log("Fetch");
  filter()
    .then((result) => {
      log("Fetch success, caching to disk");
      writeToCache(filterCacheName, result);
      log("Caching to disk success");
    })
    .catch((error) => {
      log(`Fetch failure: ${error.message}`);
      console.error(error);
    });
}
