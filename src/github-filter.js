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

const githubToken = process.env.GITHUB_API_KEY;
const githubRepo = process.env.GITHUB_REPO;

function getEmoji(state, mergedAt) {
  switch (state) {
    case "open":
      return "🔵";
    case "closed":
      if (mergedAt) return "🟢";
      else return "🔴";
    default:
      return getEmojiOrFallback(null, state);
  }
}

async function fetchGithubFilter() {
  try {
    if (!githubToken) {
      throw new Error("Missing GITHUB_API_KEY env var");
    }

    if (!githubRepo) {
      throw new Error("Missing GITHUB_REPO env var");
    }

    const pulls = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/repos/${githubRepo}/pulls?state=all&per_page=100&page=${page}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${githubToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!response.ok) {
        console.error(response);
        throw new Error("GitHub API request failed");
      }

      const pageData = await response.json();
      pulls.push(...pageData);

      hasMore = pageData.length === 100;
      page++;
    }

    const pullItems = pulls.map((pr) =>
      createFilterItem({
        title: [getEmoji(pr.state, pr.merged_at), pr.head.ref, pr.title]
          .filter(Boolean)
          .join(" "),
        subtitle: formatSubtitle(pr.user.login, pr.updated_at),
        arg: pr._links.html.href,
        iconPath: "./src/icons/github.png",
        source: "gh",
        date: new Date(pr.updated_at),
      })
    );

    const navigationItem = createNavigationItem({
      title: "GitHub pull requests",
      arg: `https://github.com/${githubRepo}/pulls`,
      iconPath: "./src/icons/github.png",
      source: "gh",
    });

    return wrapFilterResults(pullItems, navigationItem);
  } catch (error) {
    error.scriptFilterItem = createErrorItem({
      title: "GitHub pull requests",
      subtitle: "Configure Workflow with your GitHub API Key",
      arg: "https://github.com/settings/tokens",
      iconPath: "./src/icons/github.png",
      source: "gh",
    });
    throw error;
  }
}

const fetchGithubFilterWithCache = withFilterCache(
  fetchGithubFilter,
  "github-filter",
  "github-cache.json",
  { cachePolicy: process.env.CACHE_POLICY }
);

module.exports = fetchGithubFilterWithCache;

if (require.main === module) {
  executeFilterModule(fetchGithubFilterWithCache);
}
