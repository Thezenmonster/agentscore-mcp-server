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
export declare function inspectRepoForMcpDependencies(inputPath?: string): RepositoryContext;
export {};
