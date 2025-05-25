/**
 * Usage: node src/root-filter.js [gh|ln|vc|lm|fg]
 */

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
        console.error(error);
        return [error.scriptFilterItem];
      }),
      githubFilter(restQuery).catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
      linearFilter(restQuery).catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
      loomFilter(restQuery).catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
      figmaFilter(restQuery).catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
    ]);

    const allItems = items
      .flat()
      .filter((item) => sourceFilter == null || item.source === sourceFilter);

    return sortByDateDescending(allItems);
  } catch (error) {
    error.scriptFilterItem = {
      title: "Unknown error",
      subtitle: error.message,
      icon: {
        path: "./src/icons/fastview.png",
      },
      source: "root",
      date: new Date(),
      uid: "root-error",
    };
    throw error;
  }
}

module.exports = rootFilter;

if (require.main === module) {
  const query = process.argv[2];
  const sourceFilter =
    query?.match(/^(?<filter>gh|ln|vc|lm|fg)\b/)?.groups?.filter ?? null;
  const restQuery = query?.replace(/^(?:gh|ln|vc|lm|fg)\b\s*/, "") ?? "";

  rootFilter(sourceFilter, restQuery)
    .then((items) => {
      console.log(JSON.stringify({ items }));
    })
    .catch((error) => {
      console.error(error);
      console.log(
        JSON.stringify({
          items: [error.scriptFilterItem],
        })
      );
    });
}
