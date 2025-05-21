const { writeToCache } = require("./filter-cache");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

module.exports = function offlineCacheWriteAsync(filterModule, cacheFile) {
  const nodePath = process.env.NODE_PATH ?? "node";
  const cwd = process.cwd();
  const scriptPath = path.join(cwd, "src", "offline-cache-write-async.js");

  const child = spawn(nodePath, [scriptPath, filterModule, cacheFile], {
    detached: true,
    stdio: "ignore",
    cwd: cwd,
  });

  child.unref();
};

if (require.main === module) {
  const filterModuleName = process.argv[2];
  const filterCacheName = process.argv[3];

  const { filter } = require(`./${filterModuleName}`);

  const logFile = path.join(__dirname, ".offline-cache-write-async.log");
  const maxLogSize = 1024 * 1024; // 1MB
  const maxLogLines = 1000;

  const log = (msg) => {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp}: [${filterModuleName}] ${msg}\n`;

    try {
      // Always append first
      fs.appendFileSync(logFile, logEntry);

      // Check file size after append
      const stats = fs.statSync(logFile);
      if (stats.size > maxLogSize) {
        // Read existing log
        const content = fs.readFileSync(logFile, "utf8");
        const lines = content.split("\n");

        // Keep only last maxLogLines
        const truncatedContent = lines.slice(-maxLogLines).join("\n") + "\n";

        // Overwrite with truncated content
        fs.writeFileSync(logFile, truncatedContent);
      }
    } catch (err) {
      // If file doesn't exist, create it
      if (err.code === "ENOENT") {
        fs.writeFileSync(logFile, logEntry);
      }
    }
  };

  // Redirect console output to log file
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  process.stdout.write = function (chunk, encoding, callback) {
    log(`[stdout] ${chunk}`);
    originalStdoutWrite.apply(process.stdout, arguments);
  };

  process.stderr.write = function (chunk, encoding, callback) {
    log(`[stderr] ${chunk}`);
    originalStderrWrite.apply(process.stderr, arguments);
  };

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
