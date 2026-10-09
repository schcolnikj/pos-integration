export const base_url = process.env.VITTLES_BASE_URL || "http://localhost:8422";

export class VittlesError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const send = async (
  path: string,
  init: RequestInit,
): Promise<Response> => {
  for (let retry = 0; ; retry++) {
    const response = await fetch(base_url + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const retryable =
      response.status === 429 ||
      (response.status >= 500 && init.method !== "POST");
    if (!retryable || retry === 2) {
      return response;
    }
    if (response.status === 429) {
      const waitMs = Number(response.headers.get("Retry-After-Ms")) || 60000;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
};
