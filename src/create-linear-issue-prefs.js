const fs = require("fs");
const path = require("path");

// Get path to .linear-prefs.json relative to this script
const prefsPath = path.join(__dirname, "../.linear-prefs.json");

try {
  // Read and parse the JSON file
  if (fs.existsSync(prefsPath)) {
    const data = JSON.parse(fs.readFileSync(prefsPath, "utf8"));

    const sanitise = (x) => x.replace(/[\s_-]/g, "");
    if (data) {
      // Extract values to be used as Alfred variables
      const teamId = data.teamsChoice;
      const projectId = data.projectsChoice;
      const assigneeId = data.usersChoice;
      const priorityId = data.prioritiesChoice;

      // Output variables in Alfred format
      const team = data.teams.find((t) => t.id === teamId);
      const randomTeam =
        data.teams[Math.floor(Math.random() * data.teams.length)];
      const project = data.projects.find((p) => p.id === projectId);
      const randomProject = data.projects
        .filter((p) => {
          const teamToCheck = team || randomTeam;
          return p.teams.nodes.some((t) => t.id === teamToCheck.id);
        })
        .sort(() => Math.random() - 0.5)
        .map((p) => p.name)[0];
      const assignee = data.users.find((u) => u.id === assigneeId);
      const randomAssignee = data.users
        .sort(() => Math.random() - 0.5)
        .map((u) => u.displayName)[0];
      const priority = data.priorities.find((p) => p.id === priorityId);
      const randomPriority = data.priorities
        .sort(() => Math.random() - 0.5)
        .map((p) => p.label)[0];
      console.log(
        [
          (team || project || assignee || priority) && "📌",
          team && `team=${sanitise(team.name)}`,
          project && `project=${sanitise(project.name)}`,
          assignee && `assignee=${sanitise(assignee.displayName)}`,
          priority && `priority=${sanitise(priority.label)}`,
          "🎲",
          `-${sanitise(randomTeam.name)}`,
          `-${sanitise(randomProject)}`,
          `-${sanitise(randomAssignee)}`,
          `-${sanitise(randomPriority)}`,
        ]
          .filter(Boolean)
          .join(" ")
      );
    }
  } else {
    console.log(["-team", "-project", "-assignee", "-priority"].join(" "));
  }
} catch (err) {
  console.error(`Error reading preferences: ${err}`);
  console.log(["-team", "-project", "-assignee", "-priority"].join(" "));
}
