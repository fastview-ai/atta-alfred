#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function readPlist(filePath) {
  try {
    // Use Node.js built-in plist parsing
    const plistContent = fs.readFileSync(filePath, "utf8");
    
    // Simple XML parser for plist format
    const parseValue = (xmlStr, startTag, endTag) => {
      const start = xmlStr.indexOf(startTag);
      const end = xmlStr.indexOf(endTag, start);
      if (start === -1 || end === -1) return null;
      return xmlStr.substring(start + startTag.length, end).trim();
    };
    
    const result = {};
    
    // Find the main dict content
    const dictStart = plistContent.indexOf('<dict>');
    const dictEnd = plistContent.lastIndexOf('</dict>');
    if (dictStart === -1 || dictEnd === -1) return null;
    
    const dictContent = plistContent.substring(dictStart + 6, dictEnd);
    
    // Parse key-value pairs
    const keyRegex = /<key>(.*?)<\/key>\s*<(string|integer|true|false|dict|array)(?:[^>]*)>(.*?)<\/\2>/gs;
    let match;
    
    while ((match = keyRegex.exec(dictContent)) !== null) {
      const key = match[1].trim();
      const type = match[2];
      const value = match[3].trim();
      
      switch (type) {
        case 'string':
          result[key] = value;
          break;
        case 'integer':
          result[key] = parseInt(value, 10);
          break;
        case 'true':
          result[key] = true;
          break;
        case 'false':
          result[key] = false;
          break;
        case 'dict':
          // For nested dicts, parse recursively
          const nestedDict = {};
          const nestedKeyRegex = /<key>(.*?)<\/key>\s*<(string|integer|true|false)(?:[^>]*)>(.*?)<\/\2>/gs;
          let nestedMatch;
          while ((nestedMatch = nestedKeyRegex.exec(value)) !== null) {
            const nestedKey = nestedMatch[1].trim();
            const nestedType = nestedMatch[2];
            const nestedValue = nestedMatch[3].trim();
            
            switch (nestedType) {
              case 'string':
                nestedDict[nestedKey] = nestedValue;
                break;
              case 'integer':
                nestedDict[nestedKey] = parseInt(nestedValue, 10);
                break;
              case 'true':
                nestedDict[nestedKey] = true;
                break;
              case 'false':
                nestedDict[nestedKey] = false;
                break;
            }
          }
          result[key] = nestedDict;
          break;
      }
    }
    
    return result;
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
