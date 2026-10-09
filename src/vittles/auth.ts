import { send, VittlesError } from "./http.ts";

export let token: string | null = null;
export let expiresAt = 0;

export const getToken = async (force = false): Promise<string> => {
  if (!force && token && Date.now() < expiresAt) {
    return token;
  }

  const response = await send("/oauth/token", {
    method: "POST",
    body: JSON.stringify({
      client_id: process.env.VITTLES_CLIENT_ID || "",
      client_secret: process.env.VITTLES_CLIENT_SECRET || "",
    }),
  });

  if (!response.ok)
    throw new VittlesError(
      `Token request failed: Error ${response.status}.`,
      response.status,
    );

  const res: {
    access_token: string;
    expires_in?: number;
    expires?: number;
    token_type: string;
  } = await response.json();

  const expiresIn = res.expires_in ?? res.expires;
  if (typeof expiresIn !== "number") {
    throw new VittlesError("Token response missing expires_in or expires", 502);
  }

  token = res.access_token;
  expiresAt = Date.now() + (expiresIn - 5) * 1000;
  return token;
};
