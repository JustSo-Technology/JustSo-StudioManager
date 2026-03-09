import {
  ClientSecretPost,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  buildEndSessionUrl,
  calculatePKCECodeChallenge,
  discovery,
  fetchUserInfo,
  randomPKCECodeVerifier,
  randomState,
  skipSubjectCheck,
  type Configuration,
} from "openid-client";

let cachedConfiguration: Promise<Configuration> | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required auth config: ${name}`);
  }
  return value;
}

export function getAuthentikConfig() {
  return {
    issuerUrl: getRequiredEnv("AUTH_ISSUER_URL"),
    clientId: getRequiredEnv("AUTH_CLIENT_ID"),
    clientSecret: getRequiredEnv("AUTH_CLIENT_SECRET"),
    redirectUri: getRequiredEnv("AUTH_REDIRECT_URI"),
    postLogoutRedirectUri: getRequiredEnv("AUTH_LOGOUT_REDIRECT_URI"),
    scope: process.env.AUTH_SCOPE || "openid profile email",
  };
}

export async function getOidcClient() {
  if (!cachedConfiguration) {
    const config = getAuthentikConfig();
    cachedConfiguration = discovery(
      new URL(config.issuerUrl),
      config.clientId,
      { redirect_uris: [config.redirectUri], response_types: ["code"] },
      ClientSecretPost(config.clientSecret),
    );
  }
  return cachedConfiguration;
}

export async function buildLoginUrl(requestState?: string) {
  const config = await getOidcClient();
  const auth = getAuthentikConfig();
  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
  const state = requestState || randomState();
  const redirectUrl = buildAuthorizationUrl(config, {
    redirect_uri: auth.redirectUri,
    scope: auth.scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  return {
    url: redirectUrl.toString(),
    state,
    codeVerifier,
  };
}

export async function exchangeCallback(url: string, codeVerifier: string, state: string) {
  const config = await getOidcClient();
  const tokens = await authorizationCodeGrant(config, new URL(url), {
    pkceCodeVerifier: codeVerifier,
    expectedState: state,
  });
  return { config, tokens };
}

export async function getUserInfo(accessToken: string) {
  const config = await getOidcClient();
  return fetchUserInfo(config, accessToken, skipSubjectCheck);
}

export async function buildLogoutUrl(idTokenHint?: string) {
  const config = await getOidcClient();
  const auth = getAuthentikConfig();
  const parameters: Record<string, string> = {
    post_logout_redirect_uri: auth.postLogoutRedirectUri,
  };
  if (idTokenHint) {
    parameters.id_token_hint = idTokenHint;
  }
  return buildEndSessionUrl(config, parameters).toString();
}
