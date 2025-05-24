const utils = require("./create-linear-issue-logic");

const linearToken = process.env.LINEAR_API_KEY;

// Format subtitle for display
function formatSubtitle(params) {
  const parts = [];

  if (params.teamName) parts.push(`Team: ${params.teamName}`);
  if (params.projectName) parts.push(`Project: ${params.projectName}`);
  if (params.assigneeName) parts.push(`Assignee: ${params.assigneeName}`);
  if (params.priorityLabel) parts.push(`Priority: ${params.priorityLabel}`);

  return parts.length > 0 ? parts.join(" | ") : "";
}

async function main() {
  try {
    const input = process.argv[2] || "";

    // Use the unified workflow processing
    const workflow = await utils.processWorkflow(input, linearToken);

    // Handle error case gracefully for filter
    if (workflow.error) {
      const output = {
        items: [
          {
            uid: "error",
            title: "New Linear issue",
            subtitle: "",
            valid: false,
          },
        ],
      };
      console.log(JSON.stringify(output));
      return;
    }

    const { params: paramsWithDefaults, title, titleValidation } = workflow;

    // Format the subtitle using shared function
    const subtitle = formatSubtitle(paramsWithDefaults);

    // Output the Alfred JSON
    const output = {
      items: [
        {
          uid: "linear-issue",
          title: "Create Linear issue" + (title ? `: ${title}` : ""),
          subtitle: subtitle,
          arg: input,
          valid: titleValidation.valid,
        },
      ],
    };

    console.log(JSON.stringify(output));
  } catch (error) {
    // If there's an error, return a single error item
    const output = {
      items: [
        {
          uid: "error",
          title: "New Linear issue",
          subtitle: "",
          valid: false,
        },
      ],
    };

    console.log(JSON.stringify(output));
  }
}

// For Alfred, we need to run this immediately
if (require.main === module) {
  main();
}
