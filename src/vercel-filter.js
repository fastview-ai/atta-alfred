const withOfflineCache = require("./offline-cache");

const vercelToken = process.env.VERCEL_API_KEY;
const vercelProject = process.env.VERCEL_PROJECT;

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
      return process.env.NODE_ENV === "production" ? "❓" : state;
  }
}

async function fetchVercelFilter() {
  try {
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

    return deployments
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

      .map((deployment) => ({
        title: [
          getEmoji(deployment.readyState),
          deployment.meta?.githubCommitRef,
          deployment.meta?.githubCommitMessage,
        ]
          .filter(Boolean)
          .join(" "),
        subtitle: [
          "\t⮑",
          deployment.creator?.username || "Unknown",
          "•",
          fmtDate(deployment.createdAt),
        ]
          .filter(Boolean)
          .join(" "),
        arg: `https://${deployment.url}`,
        icon: {
          path: "./src/vercel.png",
        },
        source: "vc",
        date: new Date(deployment.createdAt),
      }))
      .concat([
        {
          title: "Vercel deployments",
          subtitle: "",
          arg: `https://vercel.com/${vercelProject}/deployments`,
          icon: {
            path: "./src/vercel.png",
          },
          source: "vc",
          date: new Date(0),
        },
      ])
      .sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });
  } catch (error) {
    error.scriptFilterItem = {
      title: "Vercel deployments",
      subtitle: "Configure Workflow with your Vercel API Key",
      arg: "https://vercel.com/account/settings/tokens",
      icon: {
        path: "./src/vercel.png",
      },
      source: "vc",
      date: new Date(0),
    };
    throw error;
  }
}

const fetchVercelFilterWithOfflineCache = withOfflineCache(
  fetchVercelFilter,
  ".vercel-cache.json"
);

module.exports = fetchVercelFilterWithOfflineCache;

if (require.main === module) {
  fetchVercelFilter()
    .then((items) =>
      console.log(
        JSON.stringify({
          items,
        })
      )
    )
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
