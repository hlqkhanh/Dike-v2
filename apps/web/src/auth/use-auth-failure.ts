"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { handleAuthenticationError } from "./session-expiry";

export function useAuthFailure(error: unknown) {
  const queryClient = useQueryClient();

  useEffect(() => {
    handleAuthenticationError(queryClient, error);
  }, [error, queryClient]);
}
