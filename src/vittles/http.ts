export const base_url = process.env.VITTLES_BASE_URL || "http://localhost:8422";

export const send = async (
  path: string,
  init: RequestInit,
): Promise<Response> => {
  const method = init.method?.toUpperCase() ?? "GET";
  for (let retry = 0; ; retry++) {
    let response: Response;
    try {
      response = await fetch(base_url + path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      if (method === "POST" || retry === 2) {
        const { message, cause } = error as Error & { cause?: Error };
        throw new Error(
          `${method} ${base_url + path} failed: ${cause?.message ?? message}`,
        );
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** retry));
      continue;
    }
    const retryable =
      response.status === 429 ||
      (response.status >= 500 && init.method !== "POST");
    if (!retryable || retry === 2) {
      return response;
    }
    const waitMs =
      response.status === 429
        ? Number(response.headers.get("Retry-After-Ms")) ||
          Number(response.headers.get("Retry-After")) * 1000 ||
          60_000
        : 500 * 2 ** retry; // 5xx: 500ms, then 1s
    await new Promise((r) => setTimeout(r, waitMs));
  }
};
