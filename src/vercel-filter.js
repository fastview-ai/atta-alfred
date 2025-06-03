const withFilterCache = require("./filter-cache");
const {
  formatSubtitle,
  createFilterItem,
  createErrorItem,
  createNavigationItem,
  wrapFilterResults,
  getEmojiOrFallback,
  executeFilterModule,
} = require("./filter-logic");

const vercelToken = process.env.VERCEL_API_KEY;
const vercelProject = process.env.VERCEL_PROJECT;

function getEmoji(state) {
  switch (state) {
    case "READY":
      return "🚀";
    case "BUILDING":
      return "📦";
    case "ERROR":
    case "CANCELED":
      return "❌";
    default:
      return getEmojiOrFallback(null, state);
  }
}

async function fetchVercelFilter() {
  try {
    if (!vercelToken) {
      throw new Error("Missing VERCEL_API_KEY env var");
    }

    const deployments = [];
    let until = undefined;
    let hasMore = true;

    while (hasMore) {
      const url = new URL("https://api.vercel.com/v6/deployments");
      if (until) {
        url.searchParams.set("until", until);
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
        },
      });

      if (!response.ok) {
        console.error(response);
        throw new Error("Vercel API request failed");
      }

      const data = await response.json();
      deployments.push(...data.deployments);

      hasMore = data.pagination?.next;
      until = data.pagination?.next;
    }

    const deploymentItems = deployments
      .sort((a, b) => {
        // Sort by githubCommitRef first
        const refA = a.meta?.githubCommitRef || "";
        const refB = b.meta?.githubCommitRef || "";
        if (refA !== refB) return refA.localeCompare(refB);

        // Then by createdAt (descending - newest first)
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .filter((deployment, index, array) => {
        // Keep first occurrence of each readyState per githubCommitRef
        // And filter out deployments older than most recent READY state
        if (index === 0) return true;
        const prev = array[index - 1];

        // Find most recent READY deployment
        const readyDeployment = array.find(
          (d) =>
            d.meta?.githubCommitRef === deployment.meta?.githubCommitRef &&
            d.readyState === "READY"
        );
        if (
          readyDeployment &&
          new Date(deployment.createdAt) < new Date(readyDeployment.createdAt)
        ) {
          return false;
        }

        return (
          prev.meta?.githubCommitRef !== deployment.meta?.githubCommitRef ||
          prev.readyState !== deployment.readyState
        );
      })
      .map((deployment) =>
        createFilterItem({
          title: [
            getEmoji(deployment.readyState),
            deployment.meta?.githubCommitRef,
            deployment.meta?.githubCommitMessage,
          ]
            .filter(Boolean)
            .join(" "),
          subtitle: formatSubtitle(
            deployment.creator?.username || "Unknown",
            deployment.createdAt
          ),
          arg: `https://${deployment.url}`,
          iconPath: "./src/icons/vercel.png",
          source: "vc",
          date: new Date(deployment.createdAt),
          uid: `vercel-deployment-${deployment.uid}`,
        })
      );

    const navigationItem = createNavigationItem({
      title: "Vercel deployments",
      arg: `https://vercel.com/${vercelProject}/deployments`,
      iconPath: "./src/icons/vercel.png",
      source: "vc",
      uid: "vercel-navigation",
    });

    return wrapFilterResults(deploymentItems, navigationItem);
  } catch (error) {
    error.scriptFilterItem = createErrorItem({
      title: "Vercel deployments",
      subtitle: "Configure Workflow with your Vercel API Key",
      arg: "https://vercel.com/account/settings/tokens",
      iconPath: "./src/icons/vercel.png",
      source: "vc",
      uid: "vercel-error",
    });
    throw error;
  }
}

const fetchVercelFilterWithCache = withFilterCache(
  fetchVercelFilter,
  "vercel-filter",
  "vercel-cache.json",
  { cachePolicy: process.env.CACHE_POLICY }
);

module.exports = fetchVercelFilterWithCache;

if (require.main === module) {
  executeFilterModule(fetchVercelFilterWithCache);
}
