const withOfflineCache = require("./offline-cache");

const figmaToken = process.env.FIGMA_API_KEY;
const figmaFile = process.env.FIGMA_FILE;

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

function getEmoji(resolved) {
  return resolved ? "✅" : "💬";
}

async function fetchFigmaFilter() {
  try {
    let allComments = [];
    let after = null;

    do {
      const url = new URL(
        `https://api.figma.com/v1/files/${figmaFile}/comments`
      );
      if (after) {
        url.searchParams.append("after", after);
      }

      const response = await fetch(url, {
        headers: {
          "X-Figma-Token": figmaToken,
        },
      });

      if (!response.ok) {
        console.error(response);
        throw new Error("Figma API request failed");
      }

      const data = await response.json();
      allComments = allComments.concat(data.comments);
      after = data.pagination?.after;
    } while (after);

    return allComments
      .filter((comment) => comment.client_meta?.node_id != null)
      .map((comment) => ({
        title: [getEmoji(comment.resolved_at != null), comment.message]
          .filter(Boolean)
          .join(" "),
        subtitle: ["\t⮑", comment.user.handle, "•", fmtDate(comment.created_at)]
          .filter(Boolean)
          .join(" "),
        arg: `https://www.figma.com/file/${figmaFile}?node-id=${comment.client_meta?.node_id}`,
        icon: {
          path: "./src/figma.png",
        },
        source: "fg",
        date: new Date(comment.created_at),
      }))
      .concat([
        {
          title: "Figma comments",
          subtitle: "",
          arg: `https://www.figma.com/file/${figmaFile}`,
          icon: {
            path: "./src/figma.png",
          },
          source: "fg",
          date: new Date(0),
        },
      ])
      .sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });
  } catch (error) {
    error.scriptFilterItem = {
      title: "Figma comments",
      subtitle: "Configure Workflow with your Figma Personal AccessToken",
      arg: "https://www.figma.com/",
      icon: {
        path: "./src/figma.png",
      },
      source: "fg",
      date: new Date(0),
    };
    throw error;
  }
}

const fetchFigmaFilterWithOfflineCache = withOfflineCache(
  fetchFigmaFilter,
  ".figma-cache.json"
);

module.exports = fetchFigmaFilterWithOfflineCache;

if (require.main === module) {
  fetchFigmaFilterWithOfflineCache()
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
