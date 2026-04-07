export declare class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string);
}
export declare function fetchApi(path: string, params?: Record<string, string>): Promise<any>;
