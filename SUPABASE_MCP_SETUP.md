# Supabase MCP Setup (no Vercel required)

## Prerequisites
- Supabase account and project
- Personal Access Token (PAT)
- Project Reference (project ref)
- Node.js 18+

## Create a Supabase Personal Access Token
1. Supabase dashboard → Account → Access Tokens
2. Create a token (name it e.g. "MCP"), scope to your org if needed
3. Copy the token securely (you cannot view it again)

## Find your Project Ref
- In your project URL `https://supabase.com/dashboard/project/<project-ref>`, copy `<project-ref>`

## Configure your local MCP client (.mcp.json)
Most MCP-enabled editors (Cursor, Claude Desktop) look for a `.mcp.json` in the workspace root. Create `cre-console/.mcp.json` with:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref=<your-project-ref>",
        "--read-only"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "<sbp_4a2da751c18167a661319b10c3a129011ccfeeaf>"
      }
    }
  }
}
```

Notes:
- Replace placeholders with your values
- Remove `--read-only` only if you want write operations

## Optional: use environment variables
If your client loads `.env`, you can put:

```bash
SUPABASE_ACCESS_TOKEN=your_pat
SUPABASE_PROJECT_REF=your_project_ref
```

Then update args to `"--project-ref=${SUPABASE_PROJECT_REF}"`.

## Use with this repo
This app does not proxy Supabase MCP via Next.js; you connect directly from your MCP client using `.mcp.json`. No Vercel is used or required.

## Useful commands
```bash
npx @supabase/mcp-server-supabase@latest --help
```

## Security
- Never commit tokens or secrets
- Prefer read-only during exploration
- Rotate tokens regularly

## Troubleshooting
- Ensure Node 18+ and stable network
- Verify PAT is valid and project ref exists
- Restart your editor/client after adding `.mcp.json`

