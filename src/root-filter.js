/**
 * Usage: node src/root-filter.js [gh|li]
 * $ node src/root-filter.js
 * $ node src/root-filter.js gh
 * $ node src/root-filter.js li
 */

const githubFilter = require("./github-filter");
const linearFilter = require("./linear-filter");

async function fetchRootFilter(sourceFilter) {
  try {
    const items = [];

    const [githubResult, linearResult] = await Promise.all([
      githubFilter().catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
      linearFilter().catch((error) => {
        console.error(error);
        return [error.scriptFilterItem];
      }),
    ]);

    items.push(...githubResult, ...linearResult);

    return items
      .filter((item) => sourceFilter == null || item.source === sourceFilter)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    error.scriptFilterItem = {
      title: "Unknown error",
      subtitle: "Configure Workflow with Keys",
      arg: `https://www.github.com/${githubRepo}/`,
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
