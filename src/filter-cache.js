const fs = require("fs");

function writeToCache(cacheFile, result) {
  if (result.length > 0) {
    try {
      // Save successful result to cache
      fs.writeFileSync(cacheFile, JSON.stringify(result));
    } catch (error) {
      // Ignore but log it
      console.error("Error writing to cache:", error);
    }
  }
}

function readFromCache(cacheFile) {
  try {
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      if (!Array.isArray(cached) || cached.length === 0) {
        return null;
      }
      return cached;
    }
    return null;
  } catch (error) {
    // Ignore but log it
    console.error("Error reading from cache:", error);
    return null;
  }
}

module.exports = { writeToCache, readFromCache };
