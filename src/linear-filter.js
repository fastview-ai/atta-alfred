const withOfflineCache = require("./offline-cache");

const linearToken = process.env.LINEAR_API_KEY;
const linearTeam = process.env.LINEAR_TEAM;

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
    case "backlog":
    case "unstarted":
    case "todo":
      return "⚪️";
    case "started":
    case "in progress":
    case "in review":
      return "🔵";
    case "done":
    case "completed":
      return "🟢";
    case "canceled":
    case "duplicate":
      return "🔴";
    default:
      return process.env.NODE_ENV === "production" ? "❓" : state;
  }
}

const priorityName = {
  0: "🧊",
  1: "🚨",
  2: "1️⃣",
  3: "2️⃣",
  4: "3️⃣",
};

async function fetchLinearFilter() {
  try {
    if (!linearToken) {
      throw new Error("Missing LINEAR_API_KEY env var");
    }

    if (!linearTeam) {
      throw new Error("Missing LINEAR_TEAM env var");
    }

    const allIssues = [];
    let hasNextPage = true;
    let endCursor = null;

    while (hasNextPage) {
      const response = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: linearToken,
        },
        body: JSON.stringify({
          query: `
            query($after: String) {
              issues(first: 100, after: $after) {
                nodes {
                  title
                  identifier 
                  state { name }
                  updatedAt
                  assignee { name }
                  url
                  priority
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          `,
          variables: {
            after: endCursor,
          },
        }),
      });

      if (!response.ok) {
        console.error(response);
        throw new Error("Linear API request failed");
      }

      const { data } = await response.json();
      allIssues.push(...data.issues.nodes);

      hasNextPage = data.issues.pageInfo.hasNextPage;
      endCursor = data.issues.pageInfo.endCursor;
    }

    return allIssues
      .map((issue) => ({
        title: [
          getEmoji(issue.state.name.toLowerCase()),
          issue.identifier,
          priorityName[issue.priority],
          issue.title,
        ]
          .filter(Boolean)
          .join(" "),
        subtitle: [
          "\t⮑",
          issue.assignee
            ? issue.assignee.name
            : issue.creator?.name || "Unassigned",
          "•",
          fmtDate(issue.updatedAt),
        ]
          .filter(Boolean)
          .join(" "),
        arg: issue.url,
        icon: {
          path: "./src/linear.png",
        },

        source: "li",
        date: new Date(issue.updatedAt),
      }))
      .concat([
        {
          title: "Issues",
          subtitle: "",
          arg: `https://linear.app/${linearTeam}`,
          icon: {
            path: "./src/linear.png",
          },

          source: "li",
          date: new Date(0),
        },
      ])
      .sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });
  } catch (error) {
    error.scriptFilterItem = {
      title: "Linear issues",
      subtitle: "Configure Workflow with your Linear API Key",
      arg: `https://linear.app/${LINEAR_TEAM}/settings/account/security/api-keys/new`,
      icon: {
        path: "./src/linear.png",
      },

      source: "li",
      date: new Date(0),
    };
    throw error;
  }
}

const fetchLinearFilterWithOfflineCache = withOfflineCache(
  fetchLinearFilter,
  "linear-filter",
  ".linear-cache.json",
  { cachePolicy: process.env.CACHE_POLICY }
);

module.exports = fetchLinearFilterWithOfflineCache;

if (require.main === module) {
  fetchLinearFilterWithOfflineCache()
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
