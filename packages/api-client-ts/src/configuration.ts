export type ApiClientConfiguration = {
  baseUrl: string;
  credentials?: RequestCredentials;
  requestId?: () => string;
};

export function createApiClientConfiguration(
  configuration: ApiClientConfiguration,
): Required<Omit<ApiClientConfiguration, "requestId">> &
  Pick<ApiClientConfiguration, "requestId"> {
  return {
    baseUrl: configuration.baseUrl.replace(/\/$/u, ""),
    credentials: configuration.credentials ?? "include",
    requestId: configuration.requestId,
  };
}
