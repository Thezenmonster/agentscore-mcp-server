#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleTool } from "./tools.js";

const server = new McpServer({
  name: "agentscore",
  version: "2.0.1",
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

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AgentScore MCP server v2.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
