const { logError, logFetchResponseError } = require("./error-logger");
const withFilterCache = require("./filter-cache-async").withFilterCache;
const {
  formatSubtitle,
  createFilterItem,
  createErrorItem,
  createNavigationItem,
  wrapFilterResults,
  executeFilterModule,
  filterByWords,
} = require("./filter-logic");

const figmaToken = process.env.FIGMA_API_KEY;
const figmaFile = process.env.FIGMA_FILE;

function getEmoji(resolved) {
  return resolved ? "✅" : "💬";
}

async function fetchAllComments() {
  if (!figmaToken) {
    throw new Error("Missing FIGMA_API_KEY env var");
  }

  if (!figmaFile) {
    throw new Error("Missing FIGMA_FILE env var");
  }

  let allComments = [];
  let after = null;

  do {
    const url = new URL(`https://api.figma.com/v1/files/${figmaFile}/comments`);
    if (after) {
      url.searchParams.append("after", after);
    }

    const response = await fetch(url, {
      headers: {
        "X-Figma-Token": figmaToken,
      },
    });

    if (!response.ok) {
      await logFetchResponseError(response, "fetchAllData");
      throw new Error("Figma API request failed");
    }

    const data = await response.json();
    allComments = allComments.concat(data.comments);
    after = data.pagination?.after;
  } while (after);

  return allComments;
}

const fetchAllCommentsWithCache = withFilterCache(
  fetchAllComments,
  "figma-filter",
  "figma-cache.json",
  { cachePolicy: process.env.CACHE_POLICY }
);

async function figmaFilter(query) {
  try {
    const allComments = await fetchAllCommentsWithCache();

    const commentItems = allComments
      .filter((comment) => comment.client_meta?.node_id != null)
      .map((comment) =>
        createFilterItem({
          title: [
            allComments.titlePrefix,
            getEmoji(comment.resolved_at != null),
            comment.message,
          ]
            .filter(Boolean)
            .join(" "),
          subtitle: formatSubtitle(comment.user.handle, comment.created_at),
          arg: `https://www.figma.com/file/${figmaFile}?node-id=${comment.client_meta?.node_id}`,
          iconPath: "./src/icons/figma.png",
          source: "fg",
          date: new Date(comment.created_at),
          // uid: `figma-comment-${comment.id}`,
        })
      );

    const navigationItem = createNavigationItem({
      title: "Figma comments",
      arg: `https://www.figma.com/file/${figmaFile}`,
      iconPath: "./src/icons/figma.png",
      source: "fg",
      // uid: "figma-navigation",
    });

    const allItems = wrapFilterResults(commentItems, navigationItem);
    return filterByWords(allItems, query);
  } catch (error) {
    logError(error, "figmaFilter");
    error.scriptFilterItem = createErrorItem({
      title: "Figma files",
      subtitle: "Configure Workflow with your Figma API Key",
      arg: "https://www.figma.com/developers/api#access-tokens",
      iconPath: "./src/icons/figma.png",
      source: "fg",
      // uid: "figma-error",
    });
    throw error;
  }
}

module.exports = figmaFilter;
module.exports.fetchAllData = fetchAllComments;

if (require.main === module) {
  const query = process.argv.slice(2).join(" ");
  executeFilterModule(() => figmaFilter(query));
}
