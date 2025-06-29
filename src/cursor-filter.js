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

const cursorSessionToken = process.env.CURSOR_SESSION_TOKEN;
const cursorTeamId = process.env.CURSOR_TEAM_ID;
const cursorUserId = process.env.CURSOR_USER_ID;

async function fetchAllUsageEvents() {
  if (!cursorSessionToken) {
    throw new Error("Missing CURSOR_SESSION_TOKEN env var");
  }
  if (!cursorTeamId) {
    throw new Error("Missing CURSOR_TEAM_ID env var");
  }
  if (!cursorUserId) {
    throw new Error("Missing CURSOR_USER_ID env var");
  }

  const allUsageEvents = [];
  let page = 1;
  let hasMoreData = true;
  const pageSize = 100;

  // Get data for last 30 days
  const endDate = Date.now();
  const startDate = endDate - 30 * 24 * 60 * 60 * 1000;

  while (hasMoreData) {
    const response = await fetch(
      "https://www.cursor.com/api/dashboard/get-filtered-usage-events",
      {
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/json",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          "sec-ch-ua-arch": '"arm"',
          "sec-ch-ua-bitness": '"64"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-ch-ua-platform-version": '"15.5.0"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          cookie: `NEXT_LOCALE=en; WorkosCursorSessionToken=${cursorSessionToken};`,
          Referer: "https://www.cursor.com/dashboard?tab=usage",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: JSON.stringify({
          teamId: parseInt(cursorTeamId),
          startDate: startDate.toString(),
          endDate: endDate.toString(),
          userId: parseInt(cursorUserId),
          page: page,
          pageSize: pageSize,
        }),
        method: "POST",
      }
    );

    if (!response.ok) {
      await logFetchResponseError(response, "fetchAllUsageEvents");
      throw new Error("Cursor API request failed");
    }

    const data = await response.json();
    const usageEvents = data.usageEventsDisplay;

    if (!usageEvents || !Array.isArray(usageEvents)) {
      throw new Error("Invalid response format from Cursor API");
    }

    allUsageEvents.push(...usageEvents);

    // Check if there are more pages (if we got a full page, there might be more)
    hasMoreData = usageEvents.length === pageSize;
    page++;
  }

  return allUsageEvents;
}

function aggregateUsageIntoSprints(usageEvents) {
  if (!usageEvents.length) return [];

  // Sort events by timestamp (descending - most recent first)
  const sortedEvents = usageEvents.sort(
    (a, b) => parseInt(b.timestamp) - parseInt(a.timestamp)
  );

  const sprints = [];
  const SPRINT_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

  let currentSprint = {
    events: [sortedEvents[0]],
    startTime: parseInt(sortedEvents[0].timestamp),
    endTime: parseInt(sortedEvents[0].timestamp),
  };

  for (let i = 1; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    const eventTime = parseInt(event.timestamp);

    // Check if this event is within 15 minutes of the current sprint's start
    if (currentSprint.endTime - eventTime <= SPRINT_THRESHOLD_MS) {
      // Add to current sprint
      currentSprint.events.push(event);
      currentSprint.endTime = Math.min(currentSprint.endTime, eventTime);
    } else {
      // Start a new sprint
      sprints.push(currentSprint);
      currentSprint = {
        events: [event],
        startTime: eventTime,
        endTime: eventTime,
      };
    }
  }

  // Don't forget the last sprint
  sprints.push(currentSprint);

  return sprints;
}

function calculateSprintCost(sprint) {
  return sprint.events.reduce((total, event) => {
    // Remove $ sign and convert to float
    const cost = parseFloat(event.usageBasedCosts.replace("$", "")) || 0;
    return total + cost;
  }, 0);
}

const fetchAllUsageEventsWithCache = withFilterCache(
  fetchAllUsageEvents,
  "cursor-filter",
  "cursor-cache.json",
  { cachePolicy: process.env.CACHE_POLICY }
);

async function cursorFilter(query) {
  try {
    const allUsageEvents = await fetchAllUsageEventsWithCache();
    const sprints = aggregateUsageIntoSprints(allUsageEvents);

    const sprintItems = sprints.map((sprint, index) => {
      const cost = calculateSprintCost(sprint);
      const startDate = new Date(parseInt(sprint.startTime));
      const endDate = new Date(parseInt(sprint.endTime));

      // Get unique models used in this sprint
      const models = [...new Set(sprint.events.map((e) => e.model))];
      const cleanedModels = models
        .filter((model) => model !== "Unknown")
        .map((model) => model.replace(/(-thinking|-\d+(.\d+)?)/g, ""))
        .filter((model, index, array) => array.indexOf(model) === index)
        .sort((a, b) => {
          const aHasOpus = a.includes("opus");
          const bHasOpus = b.includes("opus");
          if (aHasOpus && !bHasOpus) return -1;
          if (!aHasOpus && bHasOpus) return 1;
          return 0;
        });

      const modelsText =
        cleanedModels.length > 2
          ? `${cleanedModels.slice(0, 2).join(", ")} +${
              cleanedModels.length - 2
            }`
          : cleanedModels.join(", ");

      return createFilterItem({
        title: `💰${cost > 3 ? "🔥" : ""} $${cost.toFixed(2)} - ${
          sprint.events.length
        } requests`,
        subtitle: formatSubtitle(
          `${modelsText}`,
          startDate.toISOString(),
          [],
          true
        ),
        arg: "https://www.cursor.com/dashboard?tab=usage",
        iconPath: "./src/icons/cursor.png",
        source: "cr",
        date: startDate,
        // uid: `cursor-sprint-${index}`,
      });
    });

    const navigationItem = createNavigationItem({
      title: "Cursor usage dashboard",
      arg: "https://www.cursor.com/dashboard?tab=usage",
      iconPath: "./src/icons/cursor.png",
      source: "cr",
      // uid: "cursor-navigation",
    });

    const allItems = wrapFilterResults(sprintItems, navigationItem);
    return filterByWords(allItems, query);
  } catch (error) {
    logError(error, "cursorFilter");
    error.scriptFilterItem = createErrorItem({
      title: "Cursor usage",
      subtitle: "Configure Workflow with your Cursor session token",
      arg: "https://www.cursor.com/dashboard?tab=usage",
      iconPath: "./src/icons/cursor.png",
      source: "cr",
      // uid: "cursor-error",
    });
    throw error;
  }
}

module.exports = cursorFilter;
module.exports.fetchAllData = fetchAllUsageEvents;

if (require.main === module) {
  const query = process.argv.slice(2).join(" ");
  executeFilterModule(() => cursorFilter(query));
}
