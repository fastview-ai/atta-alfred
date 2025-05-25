#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function readPlist(filePath) {
  try {
    // Use macOS plutil to convert plist to JSON
    const jsonOutput = execSync(`plutil -convert json -o - "${filePath}"`, {
      encoding: "utf8",
    });
    return JSON.parse(jsonOutput);
  } catch (error) {
    console.error(`Error reading plist file ${filePath}:`, error.message);
    return null;
  }
}

function generateEnvFile(quiet = false) {
  const workflowDir = process.cwd();
  const prefsPath = path.join(workflowDir, "prefs.plist");
  const infoPath = path.join(workflowDir, "info.plist");
  const envPath = path.join(workflowDir, ".env");

  if (!quiet) console.log("Reading plist files...");

  // Read prefs.plist (contains API keys)
  const prefs = readPlist(prefsPath);
  if (!prefs) {
    console.error("Failed to read prefs.plist");
    process.exit(1);
  }

  // Read info.plist (contains variables section)
  const info = readPlist(infoPath);
  if (!info || !info.variables) {
    console.error("Failed to read info.plist or variables section not found");
    process.exit(1);
  }

  // Combine all environment variables
  const envVars = {
    ...prefs,
    ...info.variables,
  };

  // Generate .env file content
  let envContent =
    "# Environment variables generated from Alfred workflow configuration\n";
  envContent += "# Generated on: " + new Date().toISOString() + "\n\n";

  // Add prefs.plist variables (API keys)
  envContent += "# API Keys and Credentials (from prefs.plist)\n";
  Object.keys(prefs).forEach((key) => {
    envContent += `${key}=${prefs[key]}\n`;
  });

  envContent += "\n# Workflow Variables (from info.plist)\n";
  Object.keys(info.variables).forEach((key) => {
    envContent += `${key}=${info.variables[key]}\n`;
  });

  // Write .env file
  fs.writeFileSync(envPath, envContent);

  if (!quiet) {
    console.log("✅ .env file generated successfully!");
    console.log(`📄 Location: ${envPath}`);
    console.log(`📊 Total variables: ${Object.keys(envVars).length}`);

    // Show summary
    console.log("\n📋 Variables included:");
    console.log("   API Keys:", Object.keys(prefs).join(", "));
    console.log("   Workflow vars:", Object.keys(info.variables).join(", "));
  }
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2);
  const quiet = args.includes("--quiet") || args.includes("-q");
  generateEnvFile(quiet);
}

module.exports = { generateEnvFile };
