const withFilterCache = require("./filter-cache-async").withFilterCache;
const {
  formatSubtitle,
  createFilterItem,
  createErrorItem,
  createNavigationItem,
  wrapFilterResults,
  getEmojiOrFallback,
  executeFilterModule,
  filterByQuery,
} = require("./filter-logic");

const linearToken = process.env.LINEAR_API_KEY;
const linearTeam = process.env.LINEAR_TEAM;

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
      return getEmojiOrFallback(null, state);
  }
}

const priorityName = {
  0: "🧊",
  1: "🚨",
  2: "1️⃣",
  3: "2️⃣",
  4: "3️⃣",
};

async function fetchAllIssues() {
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

  return allIssues;
}

const fetchAllIssuesWithCache = withFilterCache(
  fetchAllIssues,
  "linear-filter",
  "linear-cache.json",
  { cachePolicy: process.env.CACHE_POLICY }
);

async function linearFilter() {
  try {
    const allIssues = await fetchAllIssuesWithCache();

    const issueItems = allIssues.map((issue) =>
      createFilterItem({
        title: [
          getEmoji(issue.state.name.toLowerCase()),
          issue.identifier,
          priorityName[issue.priority],
          issue.title,
        ]
          .filter(Boolean)
          .join(" "),
        subtitle: formatSubtitle(
          issue.assignee?.name || "Unassigned",
          issue.updatedAt
        ),
        arg: issue.url,
        iconPath: "./src/icons/linear.png",
        source: "li",
        date: new Date(issue.updatedAt),
        uid: `linear-issue-${issue.identifier}`,
      })
    );

    const navigationItem = createNavigationItem({
      title: "Linear issues",
      arg: `https://linear.app/${linearTeam}`,
      iconPath: "./src/icons/linear.png",
      source: "li",
      uid: "linear-navigation",
    });

    return wrapFilterResults(issueItems, navigationItem);
  } catch (error) {
    error.scriptFilterItem = createErrorItem({
      title: "Linear issues",
      subtitle: "Configure Workflow with your Linear API Key",
      arg: `https://linear.app/${linearTeam}/settings/account/security/api-keys/new`,
      iconPath: "./src/icons/linear.png",
      source: "li",
      uid: "linear-error",
    });
    throw error;
  }
}

module.exports = linearFilter;
module.exports.fetchAllData = fetchAllIssues;

if (require.main === module) {
  executeFilterModule(linearFilter);
}
