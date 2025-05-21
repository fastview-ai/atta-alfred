const withOfflineCache = require("./offline-cache");

const githubToken = process.env.GITHUB_API_KEY;
const githubRepo = process.env.GITHUB_REPO;

function fmtDate(date) {
  const now = new Date();
  const inputDate = new Date(date);
  const diffTime = now - inputDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  } else {
    return inputDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

function getEmoji(state, mergedAt) {
  switch (state) {
    case "open":
      return "🔵";
    case "closed":
      if (mergedAt) return "🟢";
      else return "🔴";
    default:
      return process.env.NODE_ENV === "production" ? "❓" : state;
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

    return pulls
      .map((pr) => ({
        title: [getEmoji(pr.state, pr.merged_at), pr.head.ref, pr.title]
          .filter(Boolean)
          .join(" "),
        subtitle: ["\t⮑", pr.user.login, "•", fmtDate(pr.updated_at)]
          .filter(Boolean)
          .join(" "),
        arg: pr._links.html.href,
        icon: {
          path: "./src/github.png",
        },

        source: "gh",
        date: new Date(pr.updated_at),
      }))
      .concat([
        {
          title: "GitHub pull requests",
          subtitle: "",
          arg: `https://github.com/${githubRepo}/pulls`,
          icon: {
            path: "./src/github.png",
          },

          source: "gh",
          date: new Date(0),
        },
      ])
      .sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });
  } catch (error) {
    error.scriptFilterItem = {
      title: "GitHub pull requests",
      subtitle: "Configure Workflow with your GitHub API Key",
      arg: "https://github.com/settings/tokens",
      icon: {
        path: "./src/github.png",
      },

      source: "gh",
      date: new Date(0),
    };
    throw error;
  }
}

const fetchGithubFilterWithOfflineCache = withOfflineCache(
  fetchGithubFilter,
  "github-filter",
  ".github-cache.json",
  { cachePolicy: process.env.CACHE_POLICY }
);

module.exports = fetchGithubFilterWithOfflineCache;

if (require.main === module) {
  fetchGithubFilterWithOfflineCache()
    .then((items) => {
      console.log(
        JSON.stringify({
          items,
        })
      );
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
