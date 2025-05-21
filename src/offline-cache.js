const fs = require("fs");

const isOffline = process.env.OFFLINE === "1";

module.exports = function withOfflineCache(fn, cacheFile) {
  return async (...args) => {
    try {
      if (isOffline) {
        throw new Error("Offline mode");
      }
      const result = await fn(...args);
      try {
        // Save successful result to cache
        fs.writeFileSync(cacheFile, JSON.stringify(result));
      } catch (error) {
        // Ignore but log it
        console.error("Error writing to cache:", error);
      }
      return result;
    } catch (error) {
      // If offline/error, try to load from cache
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        return cached.map((item) => ({
          ...item,
          title: `📴 ${item.title}`,
        }));
      }
      return [];
    }
  };
};
