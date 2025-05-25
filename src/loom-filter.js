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

const loomConnectSID = process.env.LOOM_CONNECT_SID;

async function fetchAllVideos() {
  if (!loomConnectSID) {
    throw new Error("Missing LOOM_CONNECT_SID env var");
  }
  const allVideos = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await fetch("https://www.loom.com/graphql", {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "apollographql-client-name": "web",
        "apollographql-client-version": "d910ff6",
        "content-type": "application/json",
        priority: "u=1, i",
        "sec-ch-ua":
          '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-loom-request-source": "loom_web_d910ff6",
        cookie: `connect.sid=${loomConnectSID};`,
        Referer: "https://www.loom.com/looms/videos",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: JSON.stringify({
        operationName: "GetLoomsForLibrary",
        variables: {
          source: "ALL",
          sortType: "RECENT",
          sortOrder: "DESC",
          filters: [],
          limit: 99,
          cursor: cursor,
          folderId: null,
          timeRange: null,
        },
        query: `query GetLoomsForLibrary($limit: Int!, $cursor: String, $folderId: String, $sourceValue: String, $source: LoomsSource!, $sortType: LoomsSortType!, $sortOrder: LoomsSortOrder!, $sortGrouping: LoomsSortGrouping, $filters: [[LoomsCollectionFilter!]!], $timeRange: TimeRange) {
            getLooms {
              __typename
              ... on GetLoomsPayload {
                videos(
                  first: $limit
                  after: $cursor
                  folderId: $folderId
                  sourceValue: $sourceValue
                  source: $source
                  sortType: $sortType
                  sortOrder: $sortOrder
                  sortGrouping: $sortGrouping
                  filters: $filters
                  timeRange: $timeRange
                ) {
                  edges {
                    cursor
                    node {
                      id
                      name
                      createdAt
                      owner {
                        display_name
                      }
                      __typename
                    }
                    __typename
                  }
                  pageInfo {
                    endCursor
                    hasNextPage
                    __typename
                  }
                  __typename
                }
                __typename
              }
            }
          }`,
      }),
      method: "POST",
    });

    if (!response.ok) {
      await logFetchResponseError(response, "fetchAllData");
      throw new Error("Loom API request failed");
    }

    const data = await response.json();
    const videos = data.data?.getLooms?.videos;

    if (!videos?.edges) {
      throw new Error("Invalid response format from Loom API");
    }

    allVideos.push(...videos.edges);

    hasNextPage = videos.pageInfo.hasNextPage;
    cursor = videos.pageInfo.endCursor;
  }

  return allVideos;
}

const fetchAllVideosWithCache = withFilterCache(
  fetchAllVideos,
  "loom-filter",
  "loom-cache.json",
  { cachePolicy: process.env.CACHE_POLICY }
);

async function loomFilter(query) {
  try {
    const allVideos = await fetchAllVideosWithCache();

    const videoItems = allVideos.map(({ node }) =>
      createFilterItem({
        title: [allVideos.titlePrefix, `🎥`, node.name]
          .filter(Boolean)
          .join(" "),
        subtitle: formatSubtitle(node.owner.display_name, node.createdAt),
        arg: `https://www.loom.com/share/${node.id}`,
        iconPath: "./src/icons/loom.png",
        source: "lm",
        date: new Date(node.createdAt),
        uid: `loom-video-${node.id}`,
      })
    );

    const navigationItem = createNavigationItem({
      title: "Loom videos",
      arg: "https://www.loom.com/looms/videos",
      iconPath: "./src/icons/loom.png",
      source: "lm",
      uid: "loom-navigation",
    });

    const allItems = wrapFilterResults(videoItems, navigationItem);
    return filterByWords(allItems, query);
  } catch (error) {
    logError(error, "loomFilter");
    error.scriptFilterItem = createErrorItem({
      title: "Loom videos",
      subtitle: "Configure Workflow with your Loom connect.sid cookie",
      arg: "https://www.loom.com/my-videos",
      iconPath: "./src/icons/loom.png",
      source: "lm",
      uid: "loom-error",
    });
    throw error;
  }
}

module.exports = loomFilter;
module.exports.fetchAllData = fetchAllVideos;

if (require.main === module) {
  const query = process.argv.slice(2).join(" ");
  executeFilterModule(() => loomFilter(query));
}
