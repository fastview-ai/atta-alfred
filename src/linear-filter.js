const { logError, logFetchResponseError } = require("./error-logger");
const withFilterCache = require("./filter-cache-async").withFilterCache;
const {
  formatSubtitle,
  createFilterItem,
  createErrorItem,
  createNavigationItem,
  wrapFilterResults,
  getEmojiOrFallback,
  executeFilterModule,
  filterByWords,
} = require("./filter-logic");
const {
  priorities,
  sanitise,
  fuzzyMatch,
} = require("./create-linear-issue-logic");

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

// Parse query to extract filter parameters
function parseQueryFilters(query) {
  if (!query) return { filters: {}, searchQuery: "" };

  const words = query.split(" ");
  const paramWords = words.filter(
    (word) => word.startsWith("-") && word.length > 1
  );
  const searchWords = words.filter(
    (word) => !word.startsWith("-") || word.length === 1
  );

  const filters = {
    team: null,
    project: null,
    assignee: null,
    priority: null,
  };

  // Process each parameter word
  paramWords.forEach((word) => {
    const param = word.substring(1).toLowerCase();

    // Check for priority match
    const priorityMatch = priorities.find((p) => fuzzyMatch(p.label, param));
    if (priorityMatch) {
      filters.priority = priorityMatch.id;
    }
    // Other parameters will be matched against actual data
    else {
      // Store the parameter for later matching
      if (!filters.unmatchedParams) filters.unmatchedParams = [];
      filters.unmatchedParams.push(param);
    }
  });

  return {
    filters,
    searchQuery: searchWords.join(" "),
  };
}

// Apply filters to issues
function filterIssuesBySwitches(issues, filters) {
  // If no filters at all, return all issues
  if (!filters || Object.keys(filters).length === 0) {
    return issues;
  }

  // If only priority filter is set (no unmatched params)
  if (!filters.unmatchedParams || filters.unmatchedParams.length === 0) {
    if (filters.priority !== null) {
      return issues.filter((issue) => issue.priority === filters.priority);
    }
    return issues;
  }

  // Apply filters including unmatched params
  return issues.filter((issue) => {
    // Check priority filter first
    if (filters.priority !== null && issue.priority !== filters.priority) {
      return false;
    }

    // All unmatched params must match (intersection)
    for (const param of filters.unmatchedParams) {
      let paramMatched = false;

      // Check team
      if (
        issue.team &&
        (fuzzyMatch(issue.team.name, param) ||
          fuzzyMatch(issue.team.key, param))
      ) {
        paramMatched = true;
      }
      // Check project
      else if (issue.project && fuzzyMatch(issue.project.name, param)) {
        paramMatched = true;
      }
      // Check assignee
      else if (
        issue.assignee &&
        (fuzzyMatch(issue.assignee.name, param) ||
          (issue.assignee.displayName &&
            fuzzyMatch(issue.assignee.displayName, param)))
      ) {
        paramMatched = true;
      }

      // If this param didn't match anything, exclude the issue
      if (!paramMatched) {
        return false;
      }
    }

    // All params matched, include this issue
    return true;
  });
}

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
                assignee { 
                  id
                  name 
                  displayName
                }
                url
                priority
                team {
                  id
                  key
                  name
                }
                project {
                  id
                  name
                }
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
      await logFetchResponseError(response, "fetchAllData");
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

async function linearFilter(query) {
  try {
    const allIssues = await fetchAllIssuesWithCache();

    // Parse query to extract filters and search query
    const { filters, searchQuery } = parseQueryFilters(query);

    // Apply parameter filters
    const filteredIssues = filterIssuesBySwitches(allIssues, filters);

    const issueItems = filteredIssues.map((issue) =>
      createFilterItem({
        title: [
          allIssues.titlePrefix,
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
        source: "ln",
        date: new Date(issue.updatedAt),
        uid: `linear-issue-${issue.identifier}`,
      })
    );

    const navigationItem = createNavigationItem({
      title: "Linear issues",
      arg: `https://linear.app/${linearTeam}`,
      iconPath: "./src/icons/linear.png",
      source: "ln",
      uid: "linear-navigation",
    });

    const allItems = wrapFilterResults(issueItems, navigationItem);
    // Apply text search on the filtered results
    return filterByWords(allItems, searchQuery);
  } catch (error) {
    logError(error, "linearFilter");
    error.scriptFilterItem = createErrorItem({
      title: "Linear issues",
      subtitle: "Configure Workflow with your Linear API Key",
      arg: "https://linear.app/settings/api",
      iconPath: "./src/icons/linear.png",
      source: "ln",
      uid: "linear-error",
    });
    throw error;
  }
}

module.exports = linearFilter;
module.exports.fetchAllData = fetchAllIssues;

if (require.main === module) {
  const query = process.argv.slice(2).join(" ");
  executeFilterModule(() => linearFilter(query));
}
