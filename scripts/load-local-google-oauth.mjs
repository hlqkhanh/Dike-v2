import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PLACEHOLDER_PATTERN =
  /^(?:$|local-not-configured|replace-|example|your-)/iu;

const isConfigured = (value) =>
  typeof value === "string" && !PLACEHOLDER_PATTERN.test(value.trim());

const defaultCredentialPath = () => {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return join(
      process.env.LOCALAPPDATA,
      "Dike",
      "secrets",
      "google-oauth-local.json",
    );
  }

  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "dike",
    "secrets",
    "google-oauth-local.json",
  );
};

export const loadLocalGoogleOAuth = () => {
  if (
    isConfigured(process.env.DIKE_GOOGLE_CLIENT_ID) &&
    isConfigured(process.env.DIKE_GOOGLE_CLIENT_SECRET)
  ) {
    return;
  }

  const credentialPath =
    process.env.DIKE_GOOGLE_OAUTH_FILE ?? defaultCredentialPath();
  if (!existsSync(credentialPath)) return;

  const document = JSON.parse(readFileSync(credentialPath, "utf8"));
  const credential = document.web;
  if (
    !credential ||
    !isConfigured(credential.client_id) ||
    !isConfigured(credential.client_secret)
  ) {
    throw new Error(
      `Google OAuth credential at ${credentialPath} is not a Web application credential.`,
    );
  }

  process.env.DIKE_GOOGLE_CLIENT_ID = credential.client_id;
  process.env.DIKE_GOOGLE_CLIENT_SECRET = credential.client_secret;
};
