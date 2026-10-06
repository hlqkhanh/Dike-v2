export type PublicConfiguration = {
  apiBaseUrl: string;
};

export function publicConfiguration(): PublicConfiguration {
  const apiBaseUrl = process.env.NEXT_PUBLIC_DIKE_API_BASE_URL;
  if (!apiBaseUrl) {
    return { apiBaseUrl: "/api/v1" };
  }
  return { apiBaseUrl: new URL(apiBaseUrl).toString().replace(/\/$/u, "") };
}
