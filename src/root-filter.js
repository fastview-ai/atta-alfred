/**
 * Usage: node src/root-filter.js
 */

const vercelFilter = require("./vercel-filter");
const githubFilter = require("./github-filter");
const linearFilter = require("./linear-filter");

async function fetchRootFilter(sourceFilter) {
  try {
    const items = [];

    const [githubResult, linearResult, vercelResult] = await Promise.all([
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
    ]);

    items.push(...vercelResult, ...githubResult, ...linearResult);
    
    return items
      .filter((item) => sourceFilter == null || item.source === sourceFilter)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    error.scriptFilterItem = {
      title: "Unknown error",
      subtitle: error.message,
      icon: {
        path: "./src/fastview.png",
      },

      source: "root",
      date: new Date(),
    };
    throw error;
  }
}

module.exports = fetchRootFilter;

if (require.main === module) {
  const query = process.argv[2];
  const sourceFilter =
    query.match(/^(?<filter>gh|li)\b/)?.groups?.filter ?? null;
  fetchRootFilter(sourceFilter)
    .then((items) => console.log(JSON.stringify({ items })))
    .catch(
      (error) =>
        console.error(error) ||
        console.log(
          JSON.stringify({
            items: [error.scriptFilterItem],
          })
        )
    );
}
