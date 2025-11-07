import { Navigate } from "react-router-dom";
import SharedLayout from "@/components/SharedLayout";
import { useConfig } from "@/lib/api";

export default function Login() {
  const { data: config, isLoading } = useConfig();
  const isAdmin = !!config?.isAdmin;
  const hasActiveSubscription = config?.subscriptionStatus === "active";

  if (isLoading) {
    return <SharedLayout />;
  }

  // Only redirect to /app if admin AND has active subscription
  // Otherwise, SharedLayout will handle showing the subscription popup
  if (isAdmin && hasActiveSubscription) {
    return <Navigate to="/app" replace />;
  }

  return <SharedLayout />;
}
