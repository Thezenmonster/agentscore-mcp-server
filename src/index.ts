#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleTool } from "./tools.js";

const server = new McpServer({
  name: "agentscore",
  version: "2.1.0",
});

// --- Tools ---

server.tool(
  "scan_package",
  "Scan an npm package for MCP security issues. Checks install scripts, prompt injection patterns, suspicious URLs, source code patterns, dependency count, metadata completeness, and publisher provenance. Returns score (0-100), risk level, and detailed findings.",
  {
    npm: z.string().describe("npm package name (e.g. 'exa-mcp-server', '@modelcontextprotocol/server-github')"),
  },
  async (args) => handleTool("scan_package", args)
);

server.tool(
  "get_verdict",
  "Get a trust verdict for an MCP package: allow, warn, or block. Based on scan findings (score and severity). Also reports monitoring status and publisher posture. Use this before installing or connecting to an MCP server.",
  {
    npm: z.string().describe("npm package name"),
  },
  async (args) => handleTool("get_verdict", args)
);

server.tool(
  "check_exposure",
  "Check which monitored MCP servers depend on a given package. Use this during incident response to find blast radius. Example: 'which MCP servers use axios?'",
  {
    npm: z.string().describe("npm package name to check exposure for (e.g. 'axios')"),
  },
  async (args) => handleTool("check_exposure", args)
);

server.tool(
  "check_abuse",
  "Check if a package or agent has been reported to the KYA abuse database. Returns whether abuse has been reported and any details.",
  {
    agent: z.string().describe("Package name or agent identifier to check"),
  },
  async (args) => handleTool("check_abuse", args)
);

server.tool(
  "monitor_status",
  "Check if an MCP package is under continuous monitoring and get its scan history. Shows current score, risk level, and recent changes.",
  {
    npm: z.string().describe("npm package name"),
  },
  async (args) => handleTool("monitor_status", args)
);

server.tool(
  "check_my_repo",
  "Inspect the current repo for MCP dependencies, look up AgentScore verdicts for each package, and summarise what should be gated in CI. Use this when a developer wants to understand all MCP packages in a repo instead of scanning one package at a time.",
  {
    path: z.string().optional().describe("Optional path to the repo root. Defaults to the current working directory."),
  },
  async (args) => handleTool("check_my_repo", args)
);

server.tool(
  "generate_policy_gate_setup",
  "Generate the exact GitHub Actions workflow needed to enforce AgentScore Policy Gate for a repo. Detects MCP dependencies locally and returns the YAML, secret name, and pilot link needed for setup.",
  {
    path: z.string().optional().describe("Optional path to the repo root. Defaults to the current working directory."),
    repo_url: z.string().optional().describe("Optional repository URL override for the pilot handoff link."),
  },
  async (args) => handleTool("generate_policy_gate_setup", args)
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AgentScore MCP server v2.1 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
