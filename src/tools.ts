import { fetchApi, ApiError } from "./api.js";
import {
  inspectRepoForMcpDependencies,
  type RepoDependency,
} from "./repo.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type VerdictResult = {
  name: string;
  requestedVersion: string | null;
  version: string | null;
  source: string;
  verdict: string;
  score: number | null;
  risk: string | null;
  monitored?: boolean;
  reasons: string[];
};

const WEBSITE_BASE = "https://www.agentscores.xyz";

function text(s: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: s }], isError };
}

function buildIntentUrl(intent: "pilot" | "review", value?: string | null): string {
  const url = new URL("/contact", WEBSITE_BASE);
  url.searchParams.set("intent", intent);
  if (intent === "pilot" && value) {
    url.searchParams.set("repo", value);
  }
  if (intent === "review" && value) {
    url.searchParams.set("package", value);
  }
  return url.toString();
}

function normaliseRepositoryUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("git@github.com:")) {
    return `https://github.com/${trimmed.slice("git@github.com:".length).replace(/\.git$/, "")}`;
  }

  if (trimmed.startsWith("https://github.com/")) {
    return trimmed.replace(/\.git$/, "");
  }

  return trimmed;
}

function policyGateHint(options: { repoUrl?: string | null; packageName?: string | null }): string {
  const lines = [
    "",
    "Policy Gate:",
    "  Run check_my_repo to inspect every MCP dependency used by this repo.",
    "  Run generate_policy_gate_setup to turn the same checks into a CI gate.",
  ];

  if (options.repoUrl) {
    lines.push(`  Start a free pilot: ${buildIntentUrl("pilot", options.repoUrl)}`);
  } else if (options.packageName) {
    lines.push(`  Start a free pilot: ${buildIntentUrl("pilot")}`);
    lines.push(`  Need a written review for this package? ${buildIntentUrl("review", options.packageName)}`);
  } else {
    lines.push(`  Start a free pilot: ${buildIntentUrl("pilot")}`);
  }

  return lines.join("\n");
}

function handleApiError(err: unknown): ToolResult {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return text("Too many requests to AgentScore. Wait a moment and try again.", true);
    }
    return text(`AgentScore API error: ${err.message}`, true);
  }
  if (err instanceof Error) {
    return text(err.message, true);
  }
  return text("AgentScore is temporarily unavailable.", true);
}

function formatScan(data: any): string {
  const lines = [
    `Package: ${data.package}@${data.version}`,
    `Score: ${data.score}/100`,
    `Risk: ${data.risk}`,
    `Recommendation: ${data.recommendation}`,
    "",
  ];

  if (data.findings?.length > 0) {
    lines.push(`Findings (${data.findings.length}):`);
    for (const f of data.findings) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.type}: ${f.detail}`);
    }
  } else {
    lines.push("No security issues found.");
  }

  if (data.posture) {
    lines.push("", "Publisher Posture:");
    lines.push(`  Provenance: ${data.posture.provenance ? "Yes" : "No"}`);
    lines.push(`  Trusted Publishing: ${data.posture.trusted_publishing ? "Yes" : "No"}`);
    lines.push(`  Publisher: ${data.posture.publisher || "unknown"}`);
  }

  if (data.mcp_tools?.length > 0) {
    lines.push("", `MCP Tools (${data.mcp_tools.length}):`);
    for (const t of data.mcp_tools) {
      lines.push(`  ${t.name}: ${t.description?.slice(0, 100) || "no description"}`);
    }
  }

  lines.push(policyGateHint({ packageName: data.package }));
  return lines.join("\n");
}

function formatVerdict(data: any): string {
  const lines = [
    `Verdict: ${data.verdict.toUpperCase()}`,
    `Package: ${data.package}@${data.version}`,
    `Score: ${data.score}/100`,
    `Risk: ${data.risk}`,
    `Monitored: ${data.monitored ? "Yes" : "No"}`,
  ];

  if (data.reasons?.length > 0) {
    lines.push("", `Reasons: ${data.reasons.join(", ")}`);
  }

  if (data.posture) {
    lines.push("", "Publisher Posture:");
    lines.push(`  Provenance: ${data.posture.provenance ? "Yes" : "No"}`);
    lines.push(`  Trusted Publishing: ${data.posture.trusted_publishing ? "Yes" : "No"}`);
  }

  if (data.tool_count > 0) {
    lines.push("", `Tools exposed: ${data.tool_count}`);
  }

  lines.push(policyGateHint({ packageName: data.package }));
  return lines.join("\n");
}

function formatExposure(data: any): string {
  const lines = [
    `Exposure check for: ${data.compromised_package}`,
    `Monitored packages: ${data.total_monitored}`,
    `Affected: ${data.total_affected}`,
  ];

  if (data.affected?.length > 0) {
    lines.push("", "Affected MCP servers:");
    for (const a of data.affected) {
      lines.push(`  ${a.package} (score: ${a.package_score}/100, risk: ${a.package_risk})`);
    }
  } else {
    lines.push("", "No monitored MCP servers depend on this package.");
  }

  return lines.join("\n");
}

function formatAbuse(data: any): string {
  if (data.status === "reported") {
    const lines = [
      `ABUSE REPORTED for ${data.agent}`,
      `Reports: ${data.report_count}`,
      `Severity: ${data.severity}`,
      `Recommendation: ${data.recommendation}`,
    ];
    if (data.reasons?.length > 0) {
      lines.push(`Reasons: ${data.reasons.join(", ")}`);
    }
    return lines.join("\n");
  }
  return `No abuse reports found for ${data.agent}. Status: clean.`;
}

function formatMonitor(data: any): string {
  if (!data.monitored) {
    return `${data.package || "This package"} is not currently under monitoring.`;
  }

  const lines = [
    `Package: ${data.package}`,
    `Monitored: Yes`,
    `Current Score: ${data.current_score}/100`,
    `Current Risk: ${data.current_risk}`,
    `Last Scanned: ${data.last_scanned}`,
  ];

  if (data.history?.length > 0) {
    lines.push("", "Recent history:");
    for (const h of data.history.slice(0, 5)) {
      lines.push(`  ${h.scanned_at?.split("T")[0]} - Score: ${h.score}/100, Risk: ${h.risk}`);
    }
  }

  return lines.join("\n");
}

async function fetchVerdictForDependency(dep: RepoDependency): Promise<VerdictResult> {
  try {
    const data = await fetchApi("/api/verdict", { npm: dep.name });
    return {
      name: dep.name,
      requestedVersion: dep.requestedVersion,
      version: dep.version || data.version || dep.requestedVersion,
      source: dep.source,
      verdict: data.verdict || "unknown",
      score: typeof data.score === "number" ? data.score : null,
      risk: data.risk || null,
      monitored: Boolean(data.monitored),
      reasons: Array.isArray(data.reasons) ? data.reasons : [],
    };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        name: dep.name,
        requestedVersion: dep.requestedVersion,
        version: dep.version || dep.requestedVersion,
        source: dep.source,
        verdict: "unknown",
        score: null,
        risk: null,
        reasons: [err.code || "lookup_failed"],
      };
    }
    throw err;
  }
}

function formatRepoSummary(
  repoPath: string,
  repoUrl: string | null,
  checkedFiles: string[],
  results: VerdictResult[],
): string {
  const lines = [
    `Repo path: ${repoPath}`,
    `Repository: ${repoUrl || "not detected"}`,
    `Checked files: ${checkedFiles.length > 0 ? checkedFiles.join(", ") : "none"}`,
  ];

  if (results.length === 0) {
    lines.push("", "No MCP dependencies found in the checked files.");
    lines.push("If this repo uses MCP packages indirectly, point me at the repo root or add them explicitly.");
    return lines.join("\n");
  }

  const counts = {
    allow: results.filter((item) => item.verdict === "allow").length,
    warn: results.filter((item) => item.verdict === "warn").length,
    block: results.filter((item) => item.verdict === "block").length,
    unknown: results.filter((item) => item.verdict === "unknown").length,
  };

  lines.push(
    "",
    `MCP dependencies found: ${results.length}`,
    `Allow: ${counts.allow} | Warn: ${counts.warn} | Block: ${counts.block} | Unknown: ${counts.unknown}`,
    "",
    "Dependency verdicts:",
  );

  for (const item of results) {
    const version = item.version || item.requestedVersion || "version unknown";
    const score = item.score ?? "?";
    const risk = item.risk || "unknown";
    const reasons = item.reasons.length > 0 ? ` | reasons: ${item.reasons.join(", ")}` : "";
    lines.push(
      `  ${item.name}@${version} - ${item.verdict.toUpperCase()} (${score}/100, ${risk}) [source: ${item.source}]${reasons}`,
    );
  }

  lines.push(
    "",
    "Next step:",
    "  Run generate_policy_gate_setup to get the exact GitHub Actions workflow for this repo.",
    `  Start a free pilot: ${buildIntentUrl("pilot", repoUrl)}`,
  );

  return lines.join("\n");
}

function buildWorkflowYaml(packages: string[]): string {
  const lines = [
    "name: AgentScore Policy Gate",
    "",
    "on:",
    "  pull_request:",
    "  push:",
    "    branches: [main]",
    "",
    "jobs:",
    "  mcp-policy:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: Thezenmonster/mcp-verdict-action@v1",
    "        with:",
    "          api-key: ${{ secrets.AGENTSCORE_KEY }}",
    '          fail-open: "false"',
  ];

  if (packages.length > 0) {
    lines.push(`          packages: "${packages.join(",")}"`);
  }

  return lines.join("\n");
}

function formatPolicyGateSetup(
  repoPath: string,
  repoUrl: string | null,
  dependencies: RepoDependency[],
  checkedFiles: string[],
): string {
  const explicitPackages = dependencies.map((dep) => dep.name);
  const pilotUrl = buildIntentUrl("pilot", repoUrl);
  const lines = [
    `Repo path: ${repoPath}`,
    `Repository: ${repoUrl || "not detected"}`,
    `Checked files: ${checkedFiles.length > 0 ? checkedFiles.join(", ") : "none"}`,
    `Detected MCP dependencies: ${explicitPackages.length > 0 ? explicitPackages.join(", ") : "none"}`,
    "",
    "Next steps:",
    `1. Start a free Policy Gate pilot to get a repo-scoped key: ${pilotUrl}`,
    "2. Add a GitHub Actions secret named AGENTSCORE_KEY to the repo.",
    "3. Save this workflow as .github/workflows/agentscore-policy-gate.yml:",
    "",
    buildWorkflowYaml(explicitPackages),
  ];

  if (explicitPackages.length === 0) {
    lines.push(
      "",
      "Note:",
      "  No MCP packages were detected locally. The Action can still auto-detect root package.json dependencies,",
      "  but if this repo uses MCP packages via config files only, add them explicitly to the packages input.",
    );
  } else {
    lines.push(
      "",
      "Why this workflow uses an explicit package list:",
      "  It keeps CI aligned with the MCP dependencies detected in this repo, even when they come from config files",
      "  and not just the root package.json.",
    );
  }

  return lines.join("\n");
}

export async function handleTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "scan_package": {
        const npm = args.npm as string;
        if (!npm?.trim()) return text("Package name is required.", true);
        const data = await fetchApi("/api/scan", { npm });
        if (data.status === "not_found") return text(`Package "${npm}" not found on npm.`, true);
        return text(formatScan(data));
      }

      case "get_verdict": {
        const npm = args.npm as string;
        if (!npm?.trim()) return text("Package name is required.", true);
        const data = await fetchApi("/api/verdict", { npm });
        return text(formatVerdict(data));
      }

      case "check_exposure": {
        const npm = args.npm as string;
        if (!npm?.trim()) return text("Package name is required.", true);
        const data = await fetchApi("/api/exposure", { npm });
        return text(formatExposure(data));
      }

      case "check_abuse": {
        const agent = args.agent as string;
        if (!agent?.trim()) return text("Agent or package name is required.", true);
        const data = await fetchApi("/api/abuse/check", { agent });
        return text(formatAbuse(data));
      }

      case "monitor_status": {
        const npm = args.npm as string;
        if (!npm?.trim()) return text("Package name is required.", true);
        const data = await fetchApi("/api/monitor", { npm });
        return text(formatMonitor(data));
      }

      case "check_my_repo": {
        const inputPath = typeof args.path === "string" ? args.path : undefined;
        const repo = inspectRepoForMcpDependencies(inputPath);
        const repoUrl = normaliseRepositoryUrl(repo.repoUrl);
        const results = await Promise.all(repo.dependencies.map(fetchVerdictForDependency));
        return text(formatRepoSummary(repo.repoPath, repoUrl, repo.checkedFiles, results));
      }

      case "generate_policy_gate_setup": {
        const inputPath = typeof args.path === "string" ? args.path : undefined;
        const repoUrlArg = typeof args.repo_url === "string" ? args.repo_url : undefined;
        const repo = inspectRepoForMcpDependencies(inputPath);
        const repoUrl = normaliseRepositoryUrl(repoUrlArg || repo.repoUrl);
        return text(formatPolicyGateSetup(repo.repoPath, repoUrl, repo.dependencies, repo.checkedFiles));
      }

      default:
        return text(`Unknown tool: ${name}`, true);
    }
  } catch (err) {
    return handleApiError(err);
  }
}
