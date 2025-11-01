import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import SharedLayout from "@/components/SharedLayout";
import { useConfig } from "@/lib/api";

export default function Login() {
  const { data: config, isLoading } = useConfig();
  const isAdmin = !!config?.isAdmin;

  if (isLoading) {
    return <SharedLayout />;
  }

  if (isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <SharedLayout />;
}
