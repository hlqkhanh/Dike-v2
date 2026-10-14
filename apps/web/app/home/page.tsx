"use client";

import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../src/auth/api";
import { AuthenticatedHome } from "../components/authenticated-home";

export default function AuthenticatedHomePage() {
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    enabled: false,
  });
  return session.data?.authenticated && session.data.user ? (
    <AuthenticatedHome session={session.data} />
  ) : null;
}
