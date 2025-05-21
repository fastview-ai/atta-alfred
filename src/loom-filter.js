const withOfflineCache = require("./offline-cache");

const loomConnectSID = process.env.LOOM_CONNECT_SID;

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

async function fetchLoomFilter() {
  try {
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
          limit: 12,
          cursor: null,
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
      console.error(response);
      throw new Error("Loom API request failed");
    }

    const data = await response.json();
    const videos = data.data.getLooms.videos.edges;

    return videos
      .map(({ node }) => ({
        title: `🎥 ${node.name}`,
        subtitle: ["\t⮑", node.owner.display_name, "•", fmtDate(node.createdAt)]
          .filter(Boolean)
          .join(" "),
        arg: `https://www.loom.com/share/${node.id}`,
        icon: {
          path: "./src/loom.png",
        },
        source: "lm",
        date: new Date(node.createdAt),
      }))
      .concat([
        {
          title: "Loom videos",
          subtitle: "",
          arg: "https://www.loom.com/looms/videos",
          icon: {
            path: "./src/loom.png",
          },
          source: "lm",
          date: new Date(0),
        },
      ])
      .sort((a, b) => b.date - a.date);
  } catch (error) {
    error.scriptFilterItem = {
      title: "Loom videos",
      subtitle: "Configure Workflow with your Loom browser session cookie",
      arg: "https://www.loom.com/looms/videos",
      icon: {
        path: "./src/loom.png",
      },
      source: "lm",
      date: new Date(0),
    };
    throw error;
  }
}

const fetchLoomFilterWithOfflineCache = withOfflineCache(
  fetchLoomFilter,
  ".loom-cache.json"
);

module.exports = fetchLoomFilterWithOfflineCache;

if (require.main === module) {
  fetchLoomFilterWithOfflineCache()
    .then((items) => console.log(JSON.stringify({ items })))
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
