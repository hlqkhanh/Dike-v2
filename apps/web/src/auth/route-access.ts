// Only these pages are available without a session. New routes are protected by default.
const publicRoutes = new Set(["/", "/login", "/offline"]);

export function requiresAuthentication(pathname: string) {
  return !publicRoutes.has(pathname.replace(/\/+$/, "") || "/");
}

export function hasStandaloneLayout(pathname: string) {
  return (
    publicRoutes.has(pathname) ||
    ["/home", "/auth/complete", "/onboarding/phone"].includes(pathname)
  );
}
