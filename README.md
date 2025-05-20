# Fastview.ai Alfred Workflow

An Alfred workflow for quick access to Fastview.ai Linear issues, GitHub pull requests, Vercel deployments, and Figma comments.

## Required Configuration

- **GitHub Personal access tokens**:
  - Generate new token with max expiry, owned by Fastview-AI, with access to fastview-ai/sparrow-ml repository
  - Request GitHub org admin for approval
  - https://github.com/settings/tokens

- **Linear Personal API Key**:
  - Generate an API Key from **Linear > Settings > Account > Security & Access > Personal API Key**
  - https://linear.app/fastview/settings/account/security/api-keys/new

- **Vercel Token**:
  - Generate a token from **Vercel > Settings > Tokens**
  - https://vercel.com/account/settings/tokens

- **Figma Personal Access Token**:
  - Generate a personal access token **Figma > Profile / Settings > Security tab > Personal Access Token**
  - https://figma.com/

- **Loom Personal Access Token**:
  - Copy the connect.sid value from Chrome Dev Tools Network tab
  - https://loom.com/

### GitHub Fine Grained Token (Alternative steps)

(alternatively, but requires permission from admin) Fine grained token
✅ Token name: Alfred
✅ Resource owner: fastview-ai
✅ Expiration: max (1yr)

Only select repositories
✅ fastview-ai/sparrow-ml

Repository permissions
✅ Pull requests > Read-only

### Development

This workflow uses Node.js for script execution. By default it uses `node` command but you can change it by setting the `NODE_PATH` variable.

## Features

### Quick Navigation
- `fv` - Shows a list of searchable resources
- `fv` - Searches Linear issues by issue identifier or title
- `fv` - Searches GitHub pull requests by branch name or title
- `fv` - Searches Vercel deployments by branch name or title
- `fv` - Searches Figma comments by comment text

### Issue Creation
- `fv -team -project -assignee -priority title` - Create a new Linear issue
  - Example: `fv Fix authentication bug -p1`
  - Example: `fv -eng -canvas -oac -p1 Fix authentication bug`

## Author

Created by Omar Chehab (@oac)