import fs from "node:fs";
import path from "node:path";
const MCP_NAME_PATTERNS = [/mcp/i, /@modelcontextprotocol/i, /model-context-protocol/i];
const CANDIDATE_CONFIG_FILES = [
    ".mcp.json",
    "mcp.json",
    ".cursor/mcp.json",
    ".vscode/mcp.json",
    "claude_desktop_config.json",
];
function isMcpPackageName(value) {
    return MCP_NAME_PATTERNS.some((pattern) => pattern.test(value));
}
function normaliseRequestedVersion(spec) {
    if (!spec)
        return null;
    const trimmed = spec.trim();
    if (!trimmed)
        return null;
    const cleaned = trimmed.replace(/^[~^]/, "");
    return cleaned || null;
}
function readJsonIfExists(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    catch {
        return null;
    }
}
function resolveLockedVersion(lockfile, packageName) {
    if (!lockfile)
        return null;
    const packageEntry = lockfile.packages?.[`node_modules/${packageName}`];
    if (packageEntry?.version)
        return packageEntry.version;
    const dependencyEntry = lockfile.dependencies?.[packageName];
    if (dependencyEntry?.version)
        return dependencyEntry.version;
    return null;
}
function extractRepositoryUrl(pkg, repoPath) {
    const pkgRepository = typeof pkg?.repository === "string"
        ? pkg.repository
        : pkg?.repository?.url;
    if (pkgRepository)
        return pkgRepository;
    const gitConfigPath = path.join(repoPath, ".git", "config");
    if (!fs.existsSync(gitConfigPath))
        return null;
    try {
        const gitConfig = fs.readFileSync(gitConfigPath, "utf8");
        const match = gitConfig.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
        return match?.[1]?.trim() || null;
    }
    catch {
        return null;
    }
}
function addDependency(dependencyMap, candidate) {
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
function collectFromPackageJson(repoPath, dependencyMap, checkedFiles) {
    const packageJsonPath = path.join(repoPath, "package.json");
    const lockfilePath = path.join(repoPath, "package-lock.json");
    const pkg = readJsonIfExists(packageJsonPath);
    if (!pkg)
        return null;
    checkedFiles.push("package.json");
    const lockfile = readJsonIfExists(lockfilePath);
    if (lockfile)
        checkedFiles.push("package-lock.json");
    const dependencies = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
    };
    for (const [name, requestedVersion] of Object.entries(dependencies)) {
        if (!isMcpPackageName(name))
            continue;
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
function extractPackagesFromCommandObject(value) {
    if (!value || typeof value !== "object")
        return [];
    const command = typeof value.command === "string" ? value.command : "";
    const args = Array.isArray(value.args)
        ? value.args.filter((item) => typeof item === "string")
        : [];
    if (!command || args.length === 0)
        return [];
    const commandUsesPackages = ["npx", "pnpm", "pnpx", "bunx", "yarn", "npm"];
    if (!commandUsesPackages.includes(command))
        return [];
    return args.filter((arg) => {
        if (!arg || arg.startsWith("-"))
            return false;
        if (["exec", "dlx", "create"].includes(arg))
            return false;
        return isMcpPackageName(arg);
    });
}
function walkForConfigPackages(value, source, dependencyMap) {
    if (!value)
        return;
    if (Array.isArray(value)) {
        for (const item of value) {
            walkForConfigPackages(item, source, dependencyMap);
        }
        return;
    }
    if (typeof value !== "object")
        return;
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
function collectFromConfigFiles(repoPath, dependencyMap, checkedFiles) {
    for (const relativePath of CANDIDATE_CONFIG_FILES) {
        const absolutePath = path.join(repoPath, relativePath);
        const config = readJsonIfExists(absolutePath);
        if (!config)
            continue;
        checkedFiles.push(relativePath);
        walkForConfigPackages(config, relativePath, dependencyMap);
    }
}
export function inspectRepoForMcpDependencies(inputPath) {
    const repoPath = path.resolve(inputPath || ".");
    if (!fs.existsSync(repoPath)) {
        throw new Error(`Path does not exist: ${repoPath}`);
    }
    const dependencyMap = new Map();
    const checkedFiles = [];
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
