# @agentscore-xyz/mcp-server

MCP security trust layer. Scan packages, get trust verdicts, inspect repo-wide MCP dependencies, generate Policy Gate setup, check incident exposure, and query the abuse database. Seven tools for MCP security decisions. No API key, zero config.

[![KYA Scan](https://agentscores.xyz/api/scan/badge?npm=@agentscore-xyz/mcp-server)](https://agentscores.xyz/scan?npm=@agentscore-xyz/mcp-server)

> **Scan any MCP package for security issues:** [agentscores.xyz](https://agentscores.xyz)

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentscore": {
      "command": "npx",
      "args": ["-y", "@agentscore-xyz/mcp-server"]
    }
  }
}
```

### Cursor / Any MCP Client

```bash
npx @agentscore-xyz/mcp-server
```

## What This Does

Your AI can now make security decisions about MCP packages:

> **You:** "Is exa-mcp-server safe to install?"
>
> **Claude:** *calls get_verdict* "Verdict: ALLOW. Score 90/100, LOW risk. No provenance attestations (published by personal account). 9 tools exposed including web_search_exa and crawling_exa."

> **You:** "The axios package was compromised. Which MCP servers are affected?"
>
> **Claude:** *calls check_exposure* "Multiple monitored MCP servers depend on axios, including exa-mcp-server, tavily-mcp, and figma-mcp."

> **You:** "Scan @azure-devops/mcp for security issues"
>
> **Claude:** *calls scan_package* "Score 75/100, MODERATE risk. Found: preinstall script modifying npm registry config. No provenance attestations."

> **You:** "Check this repo for MCP dependencies"
>
> **Claude:** *calls check_my_repo* "MCP dependencies found: 5. Two are warnings. Run generate_policy_gate_setup to turn these checks into a CI gate."

> **You:** "Set up AgentScore Policy Gate for this repo"
>
> **Claude:** *calls generate_policy_gate_setup* "Here is the exact GitHub Actions workflow, the AGENTSCORE_KEY secret name, and the pilot link for your repo."

## Available Tools

| Tool | What it does |
|------|-------------|
| `scan_package` | Full security scan: install scripts, prompt injection, source code patterns, provenance posture, MCP tool extraction |
| `get_verdict` | Trust decision: allow, warn, or block based on scan findings. Also reports monitoring status and publisher posture. |
| `check_my_repo` | Inspect the current repo for MCP dependencies and summarise verdicts for every package detected locally. |
| `generate_policy_gate_setup` | Generate the exact GitHub Actions workflow and pilot handoff link needed to enforce Policy Gate in CI. |
| `check_exposure` | Incident response: which monitored MCP servers depend on a given package? |
| `check_abuse` | Query the KYA abuse database for reported packages or agents |
| `monitor_status` | Check if a package is under continuous monitoring and get scan history |

## From Ad-Hoc Scans To CI Enforcement

The MCP server now bridges one-off package checks into the sticky product:

1. Run `check_my_repo` to see every MCP package used in a repo.
2. Run `generate_policy_gate_setup` to get the exact GitHub Actions workflow.
3. Start the free pilot to receive a repo-scoped `AGENTSCORE_KEY`.

That turns "is this package safe?" into "this repo now enforces MCP dependency policy on every PR."

## Risk Levels

| Score | Risk | Meaning |
|-------|------|---------|
| 85-100 | LOW | Clean or minor issues only |
| 70-84 | MODERATE | Some findings, review recommended |
| 50-69 | ELEVATED | Significant findings, use with caution |
| 30-49 | HIGH | Serious issues, not recommended |
| 0-29 | CRITICAL | Do not use |

## What the Scanner Checks

- Install scripts (postinstall/preinstall hooks with network calls or code execution)
- Prompt injection patterns in package metadata
- Suspicious URLs (sketchy TLDs, ngrok, raw IPs)
- Source code patterns (command injection, unsafe eval, hardcoded secrets)
- Publisher provenance (trusted publishing, attestations)
- Dependency count and metadata completeness
- MCP tool definitions extracted from published source

## Monitoring

AgentScore continuously monitors hundreds of MCP packages. The `check_exposure` and `monitor_status` tools use this live dataset. When a package like axios gets compromised, you can instantly find which MCP servers are affected.

## Links

- **Website:** [agentscores.xyz](https://agentscores.xyz)
- **API Docs:** [agentscores.xyz/docs](https://agentscores.xyz/docs)
- **Methodology:** [agentscores.xyz/methodology](https://agentscores.xyz/methodology)

## Licence

MIT
