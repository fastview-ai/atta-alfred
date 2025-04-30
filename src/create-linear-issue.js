const fs = require('fs');

const linearToken = process.env.LINEAR_API_KEY;

async function createIssue(teamId, title, priority) {
  try {
    // Load saved preferences
    let savedPrefs = {};
    try {
      savedPrefs = JSON.parse(fs.readFileSync(".linear-prefs.json"));
    } catch (e) {
      // File doesn't exist yet, use defaults
    }

    // Use provided values or fall back to saved preferences
    teamId = teamId || savedPrefs.lastTeamId;
    priority = priority || savedPrefs.lastPriority;

    // Save preferences for next time
    try {
      fs.writeFileSync(
        ".linear-prefs.json",
        JSON.stringify({
          lastTeamId: teamId,
          lastPriority: priority,
        })
      );
    } catch (e) {
      // Do nothing
    }

    // Get current user ID first
    const userResponse = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: linearToken,
      },
      body: JSON.stringify({
        query: `
          query {
            viewer {
              id
            }
          }
        `,
      }),
    });

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user info");
    }

    const userData = await userResponse.json();
    const userId = userData.data.viewer.id;

    const response = await fetch("https://api.linear.app/graphql", {
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
              }
            }
          }
        `,
        variables: {
          input: {
            teamId,
            title,
            priority,
            assigneeId: userId,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create Linear issue");
    }

    const { data } = await response.json();

    return data.issueCreate.issue;
  } catch (error) {
    console.error(error);
    console.log("Failed to create the issue in Linear.");
    process.exit(1);
  }
}

async function getTeamId(teamKey) {
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
  const team = data.teams.nodes.find((t) => t.key.toLowerCase() === teamKey.toLowerCase());

  if (!team) {
    throw new Error(`Team with key ${teamKey} not found`);
  }

  return team.id;
}

if (require.main === module) {
  try {
    const input = process.argv[2];

    if (!input) {
      console.error("Missing required input");
      console.log("Please provide an issue title");
      process.exit(1);
    }

    const match = input.match(
      /^(?:(\w{3})\s+)?(?:(p?[uhml0-4]|urgent|high|medium|low)\s+)?(.+)$/i
    );

    if (!match) {
      console.error("Invalid input format");
      console.log("Usage: [team] [priority] <title>");
      process.exit(1);
    }

    const [_, teamKey, priorityStr, title] = match;

    if (!title.trim()) {
      console.error("Invalid input format");
      console.log("Usage: [team] [priority] <title>");
      process.exit(1);
    }


    // Map priority strings to Linear priority numbers
    const priorityMap = {
      p0: 0,
      0: 0,
      p1: 1,
      1: 1,
      urgent: 1,
      u: 1,
      p2: 2,
      2: 2,
      high: 2,
      h: 2,
      p3: 3,
      3: 3,
      medium: 3,
      m: 3,
      p4: 4,
      4: 4,
      low: 4,
      l: 4,
    };

    const priority = priorityStr
      ? priorityMap[priorityStr.toLowerCase()]
      : undefined;

    const createIssuePromise = teamKey
      ? getTeamId(teamKey).then((teamId) =>
          createIssue(teamId, title, priority)
        )
      : createIssue(null, title, priority);

    createIssuePromise
      .then((issue) => {
        console.log(issue.identifier);
      })
      .catch((error) => {
        console.error(error);
        console.log(
          "Failed to create the issue."
        );
        process.exit(1);
      });
  } catch (error) {
    console.error(error);
    console.log("An unexpected error occurred.");
    process.exit(1);
  }
}
