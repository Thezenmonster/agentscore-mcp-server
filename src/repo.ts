import fs from "node:fs";
import path from "node:path";

export type RepoDependency = {
  name: string;
  requestedVersion: string | null;
  version: string | null;
  source: string;
};

type RepositoryContext = {
  repoPath: string;
  repoUrl: string | null;
  dependencies: RepoDependency[];
  checkedFiles: string[];
};

const MCP_NAME_PATTERNS = [/mcp/i, /@modelcontextprotocol/i, /model-context-protocol/i];
const CANDIDATE_CONFIG_FILES = [
  ".mcp.json",
  "mcp.json",
  ".cursor/mcp.json",
  ".vscode/mcp.json",
  "claude_desktop_config.json",
];

function isMcpPackageName(value: string): boolean {
  return MCP_NAME_PATTERNS.some((pattern) => pattern.test(value));
}

function normaliseRequestedVersion(spec: string | undefined): string | null {
  if (!spec) return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/^[~^]/, "");
  return cleaned || null;
}

function readJsonIfExists(filePath: string): any | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function resolveLockedVersion(lockfile: any, packageName: string): string | null {
  if (!lockfile) return null;

  const packageEntry = lockfile.packages?.[`node_modules/${packageName}`];
  if (packageEntry?.version) return packageEntry.version;

  const dependencyEntry = lockfile.dependencies?.[packageName];
  if (dependencyEntry?.version) return dependencyEntry.version;

  return null;
}

function extractRepositoryUrl(pkg: any, repoPath: string): string | null {
  const pkgRepository = typeof pkg?.repository === "string"
    ? pkg.repository
    : pkg?.repository?.url;
  if (pkgRepository) return pkgRepository;

  const gitConfigPath = path.join(repoPath, ".git", "config");
  if (!fs.existsSync(gitConfigPath)) return null;

  try {
    const gitConfig = fs.readFileSync(gitConfigPath, "utf8");
    const match = gitConfig.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

function addDependency(
  dependencyMap: Map<string, RepoDependency>,
  candidate: RepoDependency,
) {
  const existing = dependencyMap.get(candidate.name);
  if (!existing) {
    dependencyMap.set(candidate.name, candidate);
    return;
  }

  dependencyMap.set(candidate.name, {
    ...existing,
    requestedVersion: existing.requestedVersion || candidate.requestedVersion,
    version: existing.version || candidate.version,
    source: existing.source,
  });
}

function collectFromPackageJson(
  repoPath: string,
  dependencyMap: Map<string, RepoDependency>,
  checkedFiles: string[],
): string | null {
  const packageJsonPath = path.join(repoPath, "package.json");
  const lockfilePath = path.join(repoPath, "package-lock.json");
  const pkg = readJsonIfExists(packageJsonPath);
  if (!pkg) return null;

  checkedFiles.push("package.json");
  const lockfile = readJsonIfExists(lockfilePath);
  if (lockfile) checkedFiles.push("package-lock.json");

  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  for (const [name, requestedVersion] of Object.entries(dependencies)) {
    if (!isMcpPackageName(name)) continue;

    addDependency(dependencyMap, {
      name,
      requestedVersion: typeof requestedVersion === "string"
        ? normaliseRequestedVersion(requestedVersion) || requestedVersion
        : null,
      version: resolveLockedVersion(lockfile, name),
      source: "package.json",
    });
  }

  return extractRepositoryUrl(pkg, repoPath);
}

function extractPackagesFromCommandObject(value: any): string[] {
  if (!value || typeof value !== "object") return [];

  const command = typeof value.command === "string" ? value.command : "";
  const args = Array.isArray(value.args)
    ? value.args.filter((item: unknown): item is string => typeof item === "string")
    : [];

  if (!command || args.length === 0) return [];

  const commandUsesPackages = ["npx", "pnpm", "pnpx", "bunx", "yarn", "npm"];
  if (!commandUsesPackages.includes(command)) return [];

  return args.filter((arg: string) => {
    if (!arg || arg.startsWith("-")) return false;
    if (["exec", "dlx", "create"].includes(arg)) return false;
    return isMcpPackageName(arg);
  });
}

function walkForConfigPackages(
  value: any,
  source: string,
  dependencyMap: Map<string, RepoDependency>,
) {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      walkForConfigPackages(item, source, dependencyMap);
    }
    return;
  }

  if (typeof value !== "object") return;

  for (const packageName of extractPackagesFromCommandObject(value)) {
    addDependency(dependencyMap, {
      name: packageName,
      requestedVersion: null,
      version: null,
      source,
    });
  }

  for (const child of Object.values(value)) {
    walkForConfigPackages(child, source, dependencyMap);
  }
}

function collectFromConfigFiles(
  repoPath: string,
  dependencyMap: Map<string, RepoDependency>,
  checkedFiles: string[],
) {
  for (const relativePath of CANDIDATE_CONFIG_FILES) {
    const absolutePath = path.join(repoPath, relativePath);
    const config = readJsonIfExists(absolutePath);
    if (!config) continue;

    checkedFiles.push(relativePath);
    walkForConfigPackages(config, relativePath, dependencyMap);
  }
}

export function inspectRepoForMcpDependencies(inputPath?: string): RepositoryContext {
  const repoPath = path.resolve(inputPath || ".");
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Path does not exist: ${repoPath}`);
  }

  const dependencyMap = new Map<string, RepoDependency>();
  const checkedFiles: string[] = [];
  const repoUrl = collectFromPackageJson(repoPath, dependencyMap, checkedFiles);
  collectFromConfigFiles(repoPath, dependencyMap, checkedFiles);

  const dependencies = [...dependencyMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    repoPath,
    repoUrl,
    dependencies,
    checkedFiles,
  };
}
