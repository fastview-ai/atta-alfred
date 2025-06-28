/**
 * Usage: node src/root-filter.js [gh|ln|vc|lm|fg]
 */

const { logError, logErrorSilently } = require("./error-logger");
const vercelFilter = require("./vercel-filter");
const githubFilter = require("./github-filter");
const linearFilter = require("./linear-filter");
const loomFilter = require("./loom-filter");
const figmaFilter = require("./figma-filter");
const { sortByDateDescending } = require("./filter-logic");

async function rootFilter(sourceFilter, restQuery) {
  try {
    const items = await Promise.all([
      vercelFilter(restQuery).catch((error) => {
        logErrorSilently(error, "vercelFilter");
        return [];
      }),
      githubFilter(restQuery).catch((error) => {
        logErrorSilently(error, "githubFilter");
        return [];
      }),
      linearFilter(restQuery).catch((error) => {
        logErrorSilently(error, "linearFilter");
        return [];
      }),
      loomFilter(restQuery).catch((error) => {
        logErrorSilently(error, "loomFilter");
        return [];
      }),
      figmaFilter(restQuery).catch((error) => {
        logErrorSilently(error, "figmaFilter");
        return [];
      }),
    ]);

    const allItems = items
      .flat()
      .filter((item) => sourceFilter == null || item.source === sourceFilter);

    return sortByDateDescending(allItems);
  } catch (error) {
    logError(error, "rootFilter");
    error.scriptFilterItem = {
      title: "Error occurred",
      subtitle: error.message,
      icon: {
        path: "./src/icons/fastview.png",
      },
      source: "root",
      date: new Date(),
      // uid: "root-error",
    };
    throw error;
  }
}

module.exports = rootFilter;

if (require.main === module) {
  const query = process.argv.slice(2).join(" ");
  const sourceFilter =
    query?.match(/^(?<filter>gh|ln|vc|lm|fg)\b/)?.groups?.filter ?? null;
  const restQuery = query?.replace(/^(?:gh|ln|vc|lm|fg)\b\s*/, "") ?? "";

  rootFilter(sourceFilter, restQuery)
    .then((items) => {
      console.log(JSON.stringify({ items }));
    })
    .catch((error) => {
      logError(error, "rootFilter main");
      console.log(
        JSON.stringify({
          items: [error.scriptFilterItem],
        })
      );
    });
} 