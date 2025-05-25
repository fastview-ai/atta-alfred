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

- [experimental] **Loom Cookie**:
  - Copy the connect.sid value from Chrome Dev Tools Network tab, unsure what the expiry is on this.
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
- `fv ln` - Searches Linear issues by issue identifier or title
- `fv gh` - Searches GitHub pull requests by branch name or title
- `fv vc` - Searches Vercel deployments by branch name or title
- `fv fg` - Searches Figma comments by content
- `fv lm` - Searches Loom videos by title

### Issue Creation

- `fv <title> -team -project -assignee -priority` - Create a new Linear issue and posts a system notification with the new ticket number
  - Example: `fv Fix authentication bug -p1`
  - Example: `fv -eng -canvas -oac -p1 Fix authentication bug`

- Enable notifications in MacOS settings and ensure Alfred is allowed during Focus mode

## Author

Created by Omar Chehab (@oac)