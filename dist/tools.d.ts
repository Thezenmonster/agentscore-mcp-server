type ToolResult = {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
};
export declare function handleTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
export {};
