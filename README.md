# Atta Alfred Workflow

An Alfred workflow for quick access to Atta's Linear issues, GitHub pull requests, Vercel deployments+secrets, and Figma comments.

## Required Configuration

- **GitHub Personal access tokens**:
  - Generate new token with max expiry, owned by Fastview-AI, with access to fastview-ai/sparrow-ml repository
  - Request GitHub org admin for approval
  - https://github.com/settings/tokens

- **Linear Personal API Key**:
  - Generate an API Key from **Linear &gt; Settings &gt; Account &gt; Security &amp; Access &gt; Personal API Key**
  - https://linear.app/fastview/settings/account/security/api-keys/new

- **Vercel Token**:
  - Generate a token from **Vercel &gt; Settings &gt; Tokens**
  - https://vercel.com/account/settings/tokens

- **Figma Personal Access Token**:
  - Generate a personal access token **Figma &gt; Profile / Settings &gt; Security tab &gt; Personal Access Token**
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
✅ Pull requests &gt; Read-only

### Development

This workflow uses Node.js for script execution. By default it uses `node` command but you can change it by setting the `NODE_PATH` variable.

## Features

### Quick Navigation
- `aa` - Shows a list of searchable resources
- `aa ln` - Searches Linear issues by issue identifier or title
- `aa gh` - Searches GitHub pull requests by branch name or title
- `aa vc` - Searches Vercel deployments by branch name or title
- `aa fg` - Searches Figma comments by content
- `aa lm` - Searches Loom videos by title

### Environment Variables
- `aa vc env &lt;prod|dev|preview&gt;` - Copies environment variables from Vercel formatted for your .env file

The environment variables are formatted as a .env file and copied to your clipboard.

### Issue Creation

- `aa &lt;title&gt; -team -project -assignee -priority` - Create a new Linear issue and posts a system notification with the new ticket number
  - Example: `aa Fix authentication bug -p1`
  - Example: `aa -eng -canvas -oac -p1 Fix authentication bug`

- Enable notifications in MacOS settings and ensure Alfred is allowed during Focus mode

## Author

Created by Omar Chehab (@oac)
