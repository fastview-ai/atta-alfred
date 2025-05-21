const fs = require('fs');
const { execSync } = require("child_process");
const offlineCacheWriteAsync = require("./offline-cache-write-async");

const linearToken = process.env.LINEAR_API_KEY;
if (!linearToken) {
  throw new Error("LINEAR_API_KEY is not set");
}

const dryRun = (() => {
  try {
    if (process.env.DRY_RUN === "1") return true;
    const gitStatus = execSync("git status --porcelain").toString();
    return gitStatus
      .split("\n")
      .some((line) => line.trim().endsWith("create-linear-issue.js"));
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "ENOTDIR") {
      return true;
    }
    return false;
  }
})();

// Map priority strings to Linear priority numbers
const priorities = [
  { label: "0", id: 0 },
  { label: "1", id: 1 },
  { label: "p0", id: 1 },
  { label: "urgent", id: 1 },
  { label: "u", id: 1 },
  { label: "2", id: 2 },
  { label: "p1", id: 2 },
  { label: "high", id: 2 },
  { label: "h", id: 2 },
  { label: "3", id: 3 },
  { label: "p2", id: 3 },
  { label: "medium", id: 3 },
  { label: "m", id: 3 },
  { label: "4", id: 4 },
  { label: "p3", id: 4 },
  { label: "low", id: 4 },
  { label: "l", id: 4 },
];

async function createIssue(teamId, projectId, assigneeId, priority, title) {
  if (dryRun) {
    console.log(
      teamId?.slice(0, 4) || null,
      projectId?.slice(0, 4) || null,
      assigneeId?.slice(0, 4) || null,
      priority || 0,
      title
    );
  }

  const doFetch = dryRun ? console.log : fetch;
  const response = await doFetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: linearToken,
    },
    body: JSON.stringify({
      query: `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                url
                assignee {
                  displayName
                }
              }
            }
          }
        `,
      variables: {
        input: {
          teamId,
          projectId,
          assigneeId,
          priority,
          title,
        },
      },
    }),
  });

  offlineCacheWriteAsync("linear-filter", ".linear-cache.json");

  if (!response?.ok) {
    console.error(response);
    try {
      const errorBody = await response.json();
      console.error("Response body:", JSON.stringify(errorBody, null, 2));
    } catch (e) {
      // Response doesn't contain valid JSON
    }
    throw new Error("Fetch Error: " + (response.statusText ?? "unknown"));
  }

  const { data, errors } = await response.json();
  if (errors) {
    console.log(`GraphQL Error: ${errors[0].message}`);
    throw new Error(errors[0].message);
  }

  return data.issueCreate.issue;
}

async function getMetadata() {
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
    throw new Error("Failed to fetch teams");
  }

  const { data } = await response.json();

  return {
    teams: data.teams.nodes,
    projects: data.projects.nodes,
    users: data.users.nodes,
    priorities,
  };
}

function readPrefs() {
  // Load saved preferences
  let savedPrefs = null;
  try {
    savedPrefs = JSON.parse(fs.readFileSync(".linear-prefs.json"));
  } catch (e) {
    if (e.code !== "ENOENT" && !(e instanceof SyntaxError)) {
      throw e;
    }
  }

  return savedPrefs;
}

function writePrefs(prefs) {
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
    JSON.stringify(prefsWithTimestamps, null, dryRun ? 2 : null)
  );
}

async function main() {
  try {
    const input = process.argv[2];

    if (!input) {
      console.error("Missing required input");
      console.log("Please provide an issue title");
      return;
    }

    const metadata = await getMetadata();
    const inputWords = input.split(" ");
    const paramWords = inputWords.filter((word) => word.startsWith("-"));
    const titleWords = inputWords.filter((word) => !word.startsWith("-"));

    let teamId = null;
    let projectId = null;
    let assigneeId = null;
    let priorityId = null;
    let title = null;

    function findMatch(word, collection, matcher) {
      if (!word || !collection) return null;
      return collection.find((item) => matcher(item, word));
    }

    const sanitise = (x) => x.replace(/[\s_-]/g, "").toLowerCase();

    const fuzzyMatch = (string, substr) =>
      sanitise(string).startsWith(sanitise(substr));

    const matchers = {
      teams: (team, word) =>
        [team.name, team.key].filter(Boolean).some((s) => fuzzyMatch(s, word)),
      projects: (project, word) =>
        (teamId == null ||
          project.teams.nodes.some((team) => team.id === teamId)) &&
        fuzzyMatch(project.name, word),
      users: (user, word) =>
        [user.name, user.displayName, user.email.split("@")[0]]
          .filter(Boolean)
          .some((s) => fuzzyMatch(s, word)),
      priorities: (priority, word) => fuzzyMatch(priority.label, word),
    };

    const setters = {
      teams: (team) => {
        teamId = team.id;
      },
      projects: (project) => {
        projectId = project.id;
      },
      users: (user) => {
        assigneeId = user.id;
      },
      priorities: (priority) => {
        priorityId = priority.id;
      },
    };

    // Try to match against each type
    for (const [key, matcher] of Object.entries(matchers)) {
      // Process each word
      for (let i = paramWords.length - 1; i >= 0; i--) {
        const word = paramWords[i];

        const collection = metadata[key];
        const match = findMatch(word, collection, matcher);

        if (match) {
          setters[key](match);
          paramWords.splice(i, 1);
          break;
        }
      }
    }
    titleWords.unshift(...paramWords);

    const pastPrefs = readPrefs() || {};

    const EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds
    const now = Date.now();
    const isExpired = (timestamp) =>
      !timestamp || now - timestamp > EXPIRY_TIME;

    if (teamId == null && projectId == null) {
      projectId = isExpired(pastPrefs.projectsChoiceTimestamp)
        ? null
        : pastPrefs.projectsChoice;
      teamId = isExpired(pastPrefs.teamsChoiceTimestamp)
        ? null
        : pastPrefs.teamsChoice;
    } else if (projectId == null) {
      teamId = isExpired(pastPrefs.teamsChoiceTimestamp)
        ? null
        : pastPrefs.teamsChoice;
    } else if (teamId == null) {
      const project = metadata.projects.find((p) => p.id === projectId);
      if (project?.teams?.nodes?.length > 0) {
        teamId = project.teams.nodes[0].id;
      } else {
        teamId = isExpired(pastPrefs.teamsChoiceTimestamp)
          ? null
          : pastPrefs.teamsChoice;
      }
    }

    if (assigneeId == null) {
      assigneeId = isExpired(pastPrefs.usersChoiceTimestamp)
        ? null
        : pastPrefs.usersChoice;
    }

    if (priorityId == null) {
      priorityId = isExpired(pastPrefs.prioritiesChoiceTimestamp)
        ? null
        : pastPrefs.prioritiesChoice;
    }

    writePrefs({
      ...metadata,
      teamsChoice: teamId,
      projectsChoice: projectId,
      usersChoice: assigneeId,
      prioritiesChoice: priorityId,
    });

    title = titleWords.map((word) => word.trim()).join(" ");
    if (!title) {
      console.log("Please provide a title");
      return;
    }

    // Check if title is only one word
    if (title.trim().split(/\s+/).length === 1) {
      console.log(
        "Please provide a more descriptive title with multiple words"
      );
      return;
    }

    try {
      const defaultTeamID = metadata.teams
        .filter((team) => team.members.nodes.some((member) => member.isMe))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]?.id;
      const issue = await createIssue(
        teamId || (!projectId && defaultTeamID) || null,
        projectId || null,
        assigneeId || null,
        priorityId || 0,
        title
      );
      console.log(issue.identifier);
    } catch (error) {
      console.error(error);
      console.log("Failed to create the issue.");
      return;
    }
  } catch (error) {
    console.error(error);
    console.log("An unexpected error occurred.");
    return;
  }
}

if (require.main === module) {
  main();
}
