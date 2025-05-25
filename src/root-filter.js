/**
 * Usage: node src/root-filter.js [gh|li|vc|lm|fg]
 */

const vercelFilter = require("./vercel-filter");
const githubFilter = require("./github-filter");
const linearFilter = require("./linear-filter");
const loomFilter = require("./loom-filter");
const figmaFilter = require("./figma-filter");

async function rootFilter(sourceFilter) {
  try {
    const items = await Promise.all([
      vercelFilter().catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
      githubFilter().catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
      linearFilter().catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
      loomFilter().catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
      figmaFilter().catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
    ]);

    return items
      .flat()
      .filter((item) => sourceFilter == null || item.source === sourceFilter)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
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
    query?.match(/^(?<filter>gh|li|vc|lm|fg)\b/)?.groups?.filter ?? null;

  rootFilter(sourceFilter)
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
