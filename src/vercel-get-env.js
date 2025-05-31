const { logError, logFetchResponseError } = require("./error-logger");
const {
  createFilterItem,
  createErrorItem,
  executeFilterModule,
  formatRelativeDate,
} = require("./filter-logic");

const vercelToken = process.env.VERCEL_API_KEY;
const vercelProject = process.env.VERCEL_PROJECT;

async function fetchEnvironmentVariables(projectId, targetEnv) {
  if (!vercelToken) {
    throw new Error("Missing VERCEL_API_KEY env var");
  }

  // Fetch all environment variables first
  const allEnvs = await fetch(
    new URL(`https://api.vercel.com/v10/projects/${projectId}/env`),
    {
      headers: { Authorization: `Bearer ${vercelToken}` },
    }
  ).then(async (response) => {
    if (!response.ok) {
      await logFetchResponseError(response, "fetchEnvironmentVariables");
      throw new Error("Vercel API request failed");
    }
    const data = await response.json();
    return data.envs || [];
  });

  // For any encrypted variables, fetch their decrypted values
  // Process environment variables serially with rate limiting
  const decryptedEnvs = [];
  let startTime = Date.now();
  let requestCount = 0;
  const BATCH_SIZE = 5; // 5 requests per second
  const DELAY_BETWEEN_REQUESTS = 1000 / BATCH_SIZE; // 200ms between requests
  for (const env of allEnvs) {
    // If value already exists, no need to fetch
    if (env.decrypted && env.value) {
      decryptedEnvs.push(env);
      continue;
    }

    try {
      // Calculate time since start of current batch
      const elapsedTime = Date.now() - startTime;
      const expectedTime = (requestCount % BATCH_SIZE) * DELAY_BETWEEN_REQUESTS;

      // If we're ahead of schedule, wait the remaining time
      if (elapsedTime < expectedTime) {
        await new Promise((resolve) =>
          setTimeout(resolve, expectedTime - elapsedTime)
        );
      }

      // If we've hit the batch limit, wait for next second to start
      if (requestCount > 0 && requestCount % BATCH_SIZE === 0) {
        const timeSinceStart = Date.now() - startTime;
        if (timeSinceStart < 1000) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 - timeSinceStart)
          );
        }
        // Reset start time for next batch
        startTime = Date.now();
      }

      const response = await fetch(
        new URL(
          `https://api.vercel.com/v10/projects/${projectId}/env/${env.id}`
        ),
        {
          headers: { Authorization: `Bearer ${vercelToken}` },
        }
      );

      requestCount++;

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit hit - wait 2 seconds before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000));
          requestCount--; // Retry this request
          continue;
        }
        await logFetchResponseError(response, "fetchDecryptedValue");
        decryptedEnvs.push(env); // Return original env if decryption fails
        continue;
      }

      const data = await response.json();
      // Ensure we preserve the lastEditedByDisplayName from original env
      data.lastEditedByDisplayName = env.lastEditedByDisplayName;
      decryptedEnvs.push(data);
    } catch (error) {
      logError(error, "fetchDecryptedValue");
      decryptedEnvs.push(env); // Return original env if request fails
    }
  }

  // Filter and map environment variables for target environment
  const envMap = decryptedEnvs
    .filter((env) => env.target?.includes(targetEnv))
    .reduce((map, env) => map.set(env.key, env), new Map());

  // Sort alphabetically by key
  return Array.from(envMap.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function formatEnvFile(envVars, environment) {
  if (!environment) {
    return "# No environment specified";
  }

  if (envVars.length === 0) {
    return `# No environment variables found for ${environment}`;
  }

  const envLines = envVars
    .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
    .map((env) => {
      const comment = env.comment ? ` ${env.comment}` : "";
      const lastEditedBy = env.lastEditedByDisplayName
        ? ` ${env.lastEditedByDisplayName}`
        : "";
      const updatedAt = env.updatedAt
        ? ` • ${formatRelativeDate(env.updatedAt)}`
        : "";
      const value = env.decrypted ? env.value : "[ENCRYPTED]";
      return `${env.key}="${value}" #${lastEditedBy}${updatedAt}${comment}`;
    });

  const header = `# Environment variables for ${environment.toUpperCase()} retrieved on ${new Date().toLocaleDateString()}`;

  return [header, "", ...envLines].join("\n");
}

async function vercelGetEnv(query) {
  try {
    // Parse the query to determine environment
    const trimmedQuery = query?.trim().toLowerCase();
    let environment = null;
    let environmentDisplay = null;

    if (trimmedQuery === "prod" || trimmedQuery === "production") {
      environment = "production";
      environmentDisplay = "production";
    } else if (trimmedQuery === "dev" || trimmedQuery === "development") {
      environment = "development";
      environmentDisplay = "development";
    } else if (trimmedQuery === "preview") {
      environment = "preview";
      environmentDisplay = "preview";
    }

    // Extract project ID from VERCEL_PROJECT (format: owner/project-name)
    const projectParts = vercelProject?.split("/");
    if (!projectParts || projectParts.length !== 2) {
      throw new Error(
        "Invalid VERCEL_PROJECT format. Expected 'owner/project-name'"
      );
    }
    const projectId = projectParts[1];

    const environments = [
      { key: "production", display: "Production", icon: "🚀" },
      { key: "development", display: "Development", icon: "🔧" },
      { key: "preview", display: "Preview", icon: "👀" },
    ];

    // Get variable counts for each environment
    const envVars = Object.fromEntries(
      await Promise.all(
        environments.map(async (env) => {
          try {
            const vars = await fetchEnvironmentVariables(projectId, env.key);
            return [env.key, vars];
          } catch (error) {
            logError(error, "vercelGetEnv");
            return [env.key, []];
          }
        })
      )
    );
    // Filter environments based on query
    const filteredEnvironments = trimmedQuery
      ? environments.filter(
          (env) =>
            env.key === environment ||
            env.key.toLowerCase().includes(trimmedQuery) ||
            env.display.toLowerCase().includes(trimmedQuery)
        )
      : environments;

    // Return filtered environments
    return filteredEnvironments.map((env) => {
      // Sort by updatedAt to find most recent
      const lastEntry = [...envVars[env.key]].sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];
      const specificVars = envVars[env.key].filter(
        (v) => v.target.includes(env.key) && v.target.length === 1
      ).length;
      const allVars = envVars[env.key].filter(
        (v) => v.target.includes(env.key) && v.target.length > 1
      ).length;
      const varCount = `Copy ${specificVars} + ${allVars} shared variables`;

      const subtitleParts = [
        lastEntry?.lastEditedByDisplayName,
        lastEntry && formatRelativeDate(lastEntry.updatedAt),
        varCount,
      ].filter(Boolean);

      return createFilterItem({
        title: `${env.icon} ${env.display} environment variables`,
        subtitle: subtitleParts.join(" • "),
        arg: formatEnvFile(envVars[env.key], env.key),
        iconPath: "./src/icons/vercel.png",
        uid: `vercel-env-option-${env.key}`,
      });
    });
  } catch (error) {
    logError(error, "vercelGetEnv");
    const errorItem = createErrorItem({
      title: "Vercel  environment variables",
      subtitle: "Configure Workflow with your Vercel API Key",
      arg: "https://vercel.com/account/settings/tokens",
      iconPath: "./src/icons/vercel.png",
      uid: "vercel-env-error",
    });

    return [errorItem];
  }
}

module.exports = vercelGetEnv;

if (require.main === module) {
  const query = process.argv.slice(2).join(" ");
  executeFilterModule(() => vercelGetEnv(query));
}
