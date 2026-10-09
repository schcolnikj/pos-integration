import { send } from "./http.ts";

let token: string | null = null;
let expiresAt = 0;

export const getToken = async (force = false): Promise<string> => {
  if (!force && token && Date.now() < expiresAt) {
    return token;
  }

  const { VITTLES_CLIENT_ID: clientId, VITTLES_CLIENT_SECRET: clientSecret } =
    process.env;
  if (!clientId || !clientSecret) {
    throw new Error(
      "VITTLES_CLIENT_ID and VITTLES_CLIENT_SECRET must be set (see .env.example).",
    );
  }

  const response = await send("/oauth/token", {
    method: "POST",
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok)
    throw new Error(`Token request failed: Error ${response.status}.`);

  const res: {
    access_token: string;
    expires_in?: number;
    expires?: number;
    token_type: string;
  } = await response.json();

  const expiresIn = res.expires_in ?? res.expires;
  if (typeof expiresIn !== "number") {
    throw new Error("Token response missing expires_in or expires");
  }

  token = res.access_token;
  expiresAt = Date.now() + (expiresIn - 5) * 1000;
  return token;
};
