const { writeToCache, readFromCache } = require("./filter-cache");
const offlineCacheWriteAsync = require("./offline-cache-write-async");

const isOffline = process.env.OFFLINE === "1";

module.exports = function withOfflineCache(
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
          offlineCacheWriteAsync(filterModule, cacheFile);
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
};
