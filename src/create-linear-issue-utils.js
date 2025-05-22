const fs = require("fs");

// Map priority strings to Linear priority numbers - shared across both files
const priorities = [
  { label: "No priority", id: 0 },
  { label: "urgent", id: 1 },
  { label: "p0", id: 1 },
  { label: "1", id: 1 },
  { label: "u", id: 1 },
  { label: "high", id: 2 },
  { label: "p1", id: 2 },
  { label: "2", id: 2 },
  { label: "h", id: 2 },
  { label: "medium", id: 3 },
  { label: "p2", id: 3 },
  { label: "3", id: 3 },
  { label: "m", id: 3 },
  { label: "low", id: 4 },
  { label: "p3", id: 4 },
  { label: "4", id: 4 },
  { label: "l", id: 4 },
];

// Utility functions
function sanitise(x) {
  return x.replace(/[\s_-]/g, "").toLowerCase();
}

function fuzzyMatch(string, substr) {
  return sanitise(string).startsWith(sanitise(substr));
}

function findMatch(word, collection, matcher) {
  if (!word || !collection) return null;
  return collection.find((item) => matcher(item, word));
}

// Create common matchers for all parameter types
const matchers = {
  teams: (team, word) =>
    [team.name, team.key]
      .filter(Boolean)
      .some((s) => fuzzyMatch(s, word.substring(1))),
  projects: (project, word, teamId) =>
    (teamId == null ||
      project.teams?.nodes?.some((team) => team.id === teamId)) &&
    fuzzyMatch(project.name, word.substring(1)),
  users: (user, word) =>
    [user.name, user.displayName, user.email?.split("@")[0]]
      .filter(Boolean)
      .some((s) => fuzzyMatch(s, word.substring(1))),
  priorities: (priority, word) => fuzzyMatch(priority.label, word.substring(1)),
};

// Read Linear preferences from cache files
function readPrefs() {
  let savedPrefs = null;
  try {
    // If cache doesn't exist or couldn't be parsed, try linear-prefs.json
    if (!savedPrefs) {
      try {
        savedPrefs = JSON.parse(fs.readFileSync(".linear-prefs.json"));
      } catch (e) {
        // Ignore file not found errors
      }
    }

    // Make sure savedPrefs has the required arrays
    if (savedPrefs) {
      // Ensure teams, projects, and users arrays exist
      savedPrefs.teams = savedPrefs.teams || [];
      savedPrefs.projects = savedPrefs.projects || [];
      savedPrefs.users = savedPrefs.users || [];
    }
  } catch (e) {
    console.error("Error reading prefs:", e.message);
  }

  return savedPrefs || {};
}

// Fetch metadata from Linear API
async function getMetadata(linearToken) {
  if (!linearToken) {
    linearToken = process.env.LINEAR_API_KEY;
    if (!linearToken) {
      return { error: "LINEAR_API_KEY is not set" };
    }
  }

  try {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: linearToken,
      },
      body: JSON.stringify({
        query: `
          query {
            teams {
              nodes {
                id
                key
                name
                createdAt
                members {
                  nodes {
                    id
                    isMe
                  }
                }
              }
            }
            projects {
              nodes {
                id
                name
                teams {
                  nodes {
                    id
                  }
                }
              }
            }
            users {
              nodes {
                id
                name
                email
                displayName
                isMe
              }
            }
          }
      `,
      }),
    });

    if (!response.ok) {
      return { error: "Failed to fetch metadata from Linear API" };
    }

    const { data } = await response.json();

    return {
      teams: data.teams.nodes,
      projects: data.projects.nodes,
      users: data.users.nodes,
      priorities,
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Write preferences to file
function writePrefs(prefs, isDryRun = false) {
  // Add timestamps for each choice
  const prefsWithTimestamps = {
    ...prefs,
    teamsChoiceTimestamp: prefs.teamsChoice ? Date.now() : null,
    projectsChoiceTimestamp: prefs.projectsChoice ? Date.now() : null,
    usersChoiceTimestamp: prefs.usersChoice ? Date.now() : null,
    prioritiesChoiceTimestamp: prefs.prioritiesChoice ? Date.now() : null,
  };

  fs.writeFileSync(
    ".linear-prefs.json",
    JSON.stringify(prefsWithTimestamps, null, isDryRun ? 2 : null)
  );

  return prefsWithTimestamps;
}

// Parse input into parameters and title
function parseInput(input) {
  const inputWords = input.split(" ");
  const paramWords = inputWords.filter((word) => word.startsWith("-"));
  const titleWords = inputWords.filter((word) => !word.startsWith("-"));

  return { paramWords, titleWords };
}

// Shared logic for parsing parameters and applying defaults
function processParameters(paramWords, metadata) {
  const results = {
    teamId: null,
    projectId: null,
    assigneeId: null,
    priorityId: null,
    teamName: null,
    projectName: null,
    assigneeName: null,
    priorityLabel: null,
    unmatched: [...paramWords], // Clone the array to preserve original
  };

  // Define setters for each parameter type
  const setters = {
    teams: (team) => {
      results.teamId = team.id;
      results.teamName = team.name;
    },
    projects: (project) => {
      results.projectId = project.id;
      results.projectName = project.name;
    },
    users: (user) => {
      results.assigneeId = user.id;
      results.assigneeName = user.displayName || user.name;
    },
    priorities: (priority) => {
      results.priorityId = priority.id;
      results.priorityLabel = priority.label;
    },
  };

  // Process parameters in the same order as create-linear-issue.js
  for (const [key, matcher] of Object.entries(matchers)) {
    // Process each word in reverse order (as in create-linear-issue.js)
    for (let i = results.unmatched.length - 1; i >= 0; i--) {
      const word = results.unmatched[i];

      // Special case for projects which need teamId
      const matcherFn =
        key === "projects"
          ? (project, word) => matcher(project, word, results.teamId)
          : matcher;

      const collection = key === "priorities" ? priorities : metadata?.[key];
      const match = findMatch(word, collection, matcherFn);

      if (match) {
        setters[key](match);
        results.unmatched.splice(i, 1); // Remove matched parameter
        break;
      }
    }
  }

  return results;
}

// Apply default preferences if no explicit parameters
function applyDefaultPreferences(params, metadata) {
  const EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  const isExpired = (timestamp) => !timestamp || now - timestamp > EXPIRY_TIME;
  const results = { ...params }; // Clone to avoid modifying original

  // Handle team/project fallbacks identical to create-linear-issue.js
  if (results.teamId == null && results.projectId == null) {
    results.projectId = isExpired(metadata.projectsChoiceTimestamp)
      ? null
      : metadata.projectsChoice;
    results.teamId = isExpired(metadata.teamsChoiceTimestamp)
      ? null
      : metadata.teamsChoice;
  } else if (results.projectId == null) {
    results.teamId = isExpired(metadata.teamsChoiceTimestamp)
      ? null
      : metadata.teamsChoice;
  } else if (results.teamId == null) {
    const project = metadata.projects?.find((p) => p.id === results.projectId);
    if (project?.teams?.nodes?.length > 0) {
      results.teamId = project.teams.nodes[0].id;
    } else {
      results.teamId = isExpired(metadata.teamsChoiceTimestamp)
        ? null
        : metadata.teamsChoice;
    }
  }

  if (results.assigneeId == null) {
    results.assigneeId = isExpired(metadata.usersChoiceTimestamp)
      ? null
      : metadata.usersChoice;
  }

  if (results.priorityId == null) {
    results.priorityId = isExpired(metadata.prioritiesChoiceTimestamp)
      ? null
      : metadata.prioritiesChoice;
  }

  // Look up names for IDs from defaults
  if (results.teamId && !results.teamName && metadata.teams) {
    const team = metadata.teams.find((t) => t.id === results.teamId);
    if (team) results.teamName = team.name;
  }

  if (results.projectId && !results.projectName && metadata.projects) {
    const project = metadata.projects.find((p) => p.id === results.projectId);
    if (project) results.projectName = project.name;
  }

  if (results.assigneeId && !results.assigneeName && metadata.users) {
    const user = metadata.users.find((u) => u.id === results.assigneeId);
    if (user) results.assigneeName = user.displayName || user.name;
  }

  if (results.priorityId !== null) {
    const priority = priorities.find((p) => p.id === results.priorityId);
    if (priority) results.priorityLabel = priority.label;
  }

  // Preserve unmatched parameters
  results.unmatched = params.unmatched || [];

  return results;
}

// Validate title (has content and multiple words)
function validateTitle(title) {
  if (!title) {
    return { valid: false, message: "Please provide a title" };
  } else if (title.trim().split(/\s+/).length === 1) {
    return {
      valid: false,
      message: "Please provide a more descriptive title with multiple words",
    };
  }
  return { valid: true, message: null };
}

module.exports = {
  priorities,
  sanitise,
  fuzzyMatch,
  findMatch,
  matchers,
  readPrefs,
  getMetadata,
  writePrefs,
  parseInput,
  processParameters,
  applyDefaultPreferences,
  validateTitle,
};
