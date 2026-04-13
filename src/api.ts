const BASE_URL = "https://www.agentscores.xyz";
const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchApi(
  path: string,
  params: Record<string, string> = {}
): Promise<any> {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      url.searchParams.set(k, v);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        body.error || "unknown",
        body.message || `HTTP ${res.status}`
      );
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError") {
      throw new ApiError(0, "timeout", "AgentScore API timed out after 8 seconds");
    }
    throw new ApiError(0, "network", `Cannot reach AgentScore API: ${err.message}`);
  }
}
