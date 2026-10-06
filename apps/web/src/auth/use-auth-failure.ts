"use client";

import { ApiError } from "@dike/api-client-ts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useAuthFailure(error: unknown) {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      queryClient.clear();
      router.replace("/login");
    }
  }, [error, queryClient, router]);
}
