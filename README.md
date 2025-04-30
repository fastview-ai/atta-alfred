
# Fastview.ai Alfred Workflow

An Alfred workflow for quick access to Fastview.ai GitHub and Linear resources.

## Features

### Quick Navigation
- `fv` - Shows a list of searchable resources
- `fv` - Opens Linear issues for the Fastview team
- `fv` - Opens GitHub pull requests for the sparrow-ml repository

### Issue Creation
- `fv [team] [project] [assignee] [priority] <title>` - Create a new Linear issue
  - Example: `fv eng p1 Fix authentication bug`
  - Example: `fv eng canvas oac p1 Fix authentication bug`

## Setup

1. Install the workflow in Alfred
2. Configure the following environment variables:

### Required Configuration
- **GitHub Token**: Generate new token (classic) from [GitHub Settings](https://github.com/settings/tokens)
  - Set as `GITHUB_API_KEY` in workflow configuration
  - Format: `ghp_...`

- **Linear Token**: Generate an API Key from [Linear Settings](https://linear.app/fastview/settings/account/security/api-keys/new)
  - Set as `LINEAR_API_KEY` in workflow configuration
  - Format: `lin_api_...`

### Default Variables
The workflow comes preconfigured with:
- GitHub Repository: `fastview-ai/sparrow-ml`
- Linear Team: `fastview`

## Development

This workflow uses Node.js for script execution. The default Node.js path is configured to use NVM's installation.

## Author

Created by Omar Chehab (@oac)
