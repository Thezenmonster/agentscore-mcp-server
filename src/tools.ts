import { fetchApi, ApiError } from "./api.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function text(s: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: s }], isError };
}

function handleApiError(err: unknown): ToolResult {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return text("Too many requests to AgentScore. Wait a moment and try again.", true);
    }
    return text(`AgentScore API error: ${err.message}`, true);
  }
  return text("AgentScore API is temporarily unavailable.", true);
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

export async function handleTool(
  name: string,
  args: Record<string, unknown>
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

      default:
        return text(`Unknown tool: ${name}`, true);
    }
  } catch (err) {
    return handleApiError(err);
  }
}
