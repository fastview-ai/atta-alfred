const utils = require("./create-linear-issue-utils");

// Format subtitle for display
function formatSubtitle(params, metadataStatus) {
  const parts = [];

  if (params.teamName) parts.push(`Team: ${params.teamName}`);
  if (params.projectName) parts.push(`Project: ${params.projectName}`);
  if (params.assigneeName) parts.push(`Assignee: ${params.assigneeName}`);
  if (params.priorityLabel) parts.push(`Priority: ${params.priorityLabel}`);

  // Show appropriate status based on metadata loading result
  if (metadataStatus && metadataStatus.fetching) {
    parts.push("⟳ Loading metadata from Linear...");
  } else if (metadataStatus && metadataStatus.error) {
    parts.push(`⚠️ ${metadataStatus.error}`);
  } else {
    // Show a warning if parameters are specified but not matched due to missing data
    const hasUnmatchedParams =
      params.unmatched && params.unmatched.some((p) => p.startsWith("-"));
    const hasMissingMetadata =
      !params.teamName &&
      !params.projectName &&
      !params.assigneeName &&
      !(params.unmatched && params.unmatched.length === 0);

    if (hasUnmatchedParams && hasMissingMetadata) {
      parts.push("⚠️ Loading data from Linear...");
    }
  }

  return parts.length > 0 ? parts.join(" | ") : "";
}

async function main() {
  try {
    const input = process.argv[2] || "";

    // Parse the input using shared function
    const { paramWords, titleWords } = utils.parseInput(input);

    // Read metadata from cache first
    let metadata = utils.readPrefs();
    let metadataStatus = null;

    // Check if we need to fetch metadata
    const needsMetadata =
      metadata?.teams?.length === 0 ||
      metadata?.projects?.length === 0 ||
      metadata?.users?.length === 0;

    // Process parameters using current metadata (even if empty)
    let params = utils.processParameters(paramWords, metadata);

    // Check if any parameters couldn't be matched
    const hasUnmatchedParams =
      params.unmatched && params.unmatched.some((p) => p.startsWith("-"));

    // If we need metadata and there are unmatched parameters, try to fetch it
    if (needsMetadata && hasUnmatchedParams) {
      // First, output an intermediate result showing we're fetching
      const intermediateOutput = {
        items: [
          {
            uid: "linear-issue",
            title: "Create Linear issue" + (input ? `: ${input}` : ""),
            subtitle: "⟳ Loading data from Linear...",
            arg: input,
            valid: true,
          },
        ],
      };
      console.log(JSON.stringify(intermediateOutput));

      // Try to fetch metadata from Linear
      metadataStatus = { fetching: true };
      try {
        const linearToken = process.env.LINEAR_API_KEY;
        if (linearToken) {
          const freshMetadata = await utils.getMetadata(linearToken);
          if (!freshMetadata.error) {
            metadata = freshMetadata;

            // Save this metadata for future use
            utils.writePrefs({
              ...metadata,
              teamsChoice: metadata.teamsChoice || null,
              projectsChoice: metadata.projectsChoice || null,
              usersChoice: metadata.usersChoice || null,
              prioritiesChoice: metadata.prioritiesChoice || null,
            });

            // Re-process parameters with the new metadata
            params = utils.processParameters(paramWords, metadata);
            metadataStatus = null;
          } else {
            metadataStatus = { error: freshMetadata.error };
          }
        } else {
          metadataStatus = { error: "LINEAR_API_KEY is not set" };
        }
      } catch (error) {
        metadataStatus = { error: error.message };
      }
    }

    // Apply default preferences using shared logic
    const paramsWithDefaults = utils.applyDefaultPreferences(params, metadata);

    // Add unmatched parameters to title words and format title
    titleWords.unshift(...params.unmatched);
    const title = titleWords.map((word) => word.trim()).join(" ");

    // Validate title using shared logic
    const titleValidation = utils.validateTitle(title);

    // Format the subtitle using shared function
    const subtitle = titleValidation.valid
      ? formatSubtitle(paramsWithDefaults, metadataStatus)
      : `⚠️ ${titleValidation.message}`;

    // Output the Alfred JSON
    const output = {
      items: [
        {
          uid: "linear-issue",
          title:
            "Create Linear issue" + (titleValidation.valid ? `: ${title}` : ""),
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
          subtitle: `Error parsing input: ${error.message}`,
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
