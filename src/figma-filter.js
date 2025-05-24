const withFilterCache = require("./filter-cache");
const {
  formatSubtitle,
  createFilterItem,
  createErrorItem,
  createNavigationItem,
  wrapFilterResults,
  executeFilterModule,
} = require("./filter-logic");

const figmaToken = process.env.FIGMA_API_KEY;
const figmaFile = process.env.FIGMA_FILE;

function getEmoji(resolved) {
  return resolved ? "✅" : "💬";
}

async function fetchFigmaFilter() {
  try {
    if (!figmaToken) {
      throw new Error("Missing FIGMA_API_KEY env var");
    }

    if (!figmaFile) {
      throw new Error("Missing FIGMA_FILE env var");
    }

    let allComments = [];
    let after = null;

    do {
      const url = new URL(
        `https://api.figma.com/v1/files/${figmaFile}/comments`
      );
      if (after) {
        url.searchParams.append("after", after);
      }

      const response = await fetch(url, {
        headers: {
          "X-Figma-Token": figmaToken,
        },
      });

      if (!response.ok) {
        console.error(response);
        throw new Error("Figma API request failed");
      }

      const data = await response.json();
      allComments = allComments.concat(data.comments);
      after = data.pagination?.after;
    } while (after);

    const commentItems = allComments
      .filter((comment) => comment.client_meta?.node_id != null)
      .map((comment) =>
        createFilterItem({
          title: [getEmoji(comment.resolved_at != null), comment.message]
            .filter(Boolean)
            .join(" "),
          subtitle: formatSubtitle(comment.user.handle, comment.created_at),
          arg: `https://www.figma.com/file/${figmaFile}?node-id=${comment.client_meta?.node_id}`,
          iconPath: "./src/icons/figma.png",
          source: "fg",
          date: new Date(comment.created_at),
          uid: `figma-comment-${comment.id}`,
        })
      );

    const navigationItem = createNavigationItem({
      title: "Figma comments",
      arg: `https://www.figma.com/file/${figmaFile}`,
      iconPath: "./src/icons/figma.png",
      source: "fg",
      uid: "figma-navigation",
    });

    return wrapFilterResults(commentItems, navigationItem);
  } catch (error) {
    error.scriptFilterItem = createErrorItem({
      title: "Figma comments",
      subtitle: "Configure Workflow with your Figma Personal AccessToken",
      arg: "https://www.figma.com/",
      iconPath: "./src/icons/figma.png",
      source: "fg",
      uid: "figma-error",
    });
    throw error;
  }
}

const fetchFigmaFilterWithCache = withFilterCache(
  fetchFigmaFilter,
  "figma-filter",
  "figma-cache.json",
  { cachePolicy: process.env.CACHE_POLICY }
);

module.exports = fetchFigmaFilterWithCache;

if (require.main === module) {
  executeFilterModule(fetchFigmaFilterWithCache);
}
