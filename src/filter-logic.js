// Common date formatting function used across all filters
function formatRelativeDate(date) {
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

// Common subtitle formatter using the "⮑ user • date" pattern
function formatSubtitle(user, date, additionalInfo = []) {
  const parts = ["\t⮑", user, "•", formatRelativeDate(date)];

  // Insert additional info before the date
  if (additionalInfo.length > 0) {
    parts.splice(-2, 0, ...additionalInfo, "•");
  }

  return parts.filter(Boolean).join(" ");
}

// Common date-based sorting (newest first)
function sortByDateDescending(items) {
  return items.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Common item creation helper
function createFilterItem({
  title,
  subtitle,
  arg,
  iconPath,
  source,
  date = new Date(),
  uid,
}) {
  return {
    title,
    subtitle,
    arg,
    icon: {
      path: iconPath,
    },
    source,
    date,
    uid,
  };
}

// Common error item creation
function createErrorItem({ title, subtitle, arg, iconPath, source, uid }) {
  return createFilterItem({
    title,
    subtitle,
    arg,
    iconPath,
    source,
    date: new Date(0),
    uid,
  });
}

// Common main module execution pattern - this function should be called from the main module
function executeFilterModule(filterWithCache, errorItem) {
  filterWithCache()
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
          items: [errorItem || error.scriptFilterItem],
        })
      );
    });
}

// Helper to create fallback/navigation items
function createNavigationItem({
  title,
  subtitle = "",
  arg,
  iconPath,
  source,
  uid,
}) {
  return createFilterItem({
    title,
    subtitle,
    arg,
    iconPath,
    source,
    date: new Date(0), // Use epoch for navigation items to sort them last
    uid,
  });
}

// Common filter wrapper that adds navigation item and sorts
function wrapFilterResults(items, navigationItem) {
  return sortByDateDescending(items.concat([navigationItem]));
}

// Environment-aware emoji fallback
function getEmojiOrFallback(emoji, fallback) {
  return process.env.NODE_ENV === "production" ? "❓" : emoji || fallback;
}

// Common query filtering function - matches words in any order
function filterByQuery(items, query) {
  if (!query || query.trim() === "") {
    return items;
  }

  const queryWords = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);

  if (queryWords.length === 0) {
    return items;
  }

  return items.filter(item => {
    const searchText = `${item.title} ${item.subtitle}`.toLowerCase();
    
    // Check if all query words exist somewhere in the search text
    return queryWords.every(word => searchText.includes(word));
  });
}

module.exports = {
  formatRelativeDate,
  formatSubtitle,
  sortByDateDescending,
  createFilterItem,
  createErrorItem,
  executeFilterModule,
  createNavigationItem,
  wrapFilterResults,
  getEmojiOrFallback,
  filterByQuery,
};
