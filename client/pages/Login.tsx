import { Navigate } from "react-router-dom";
import SharedLayout from "@/components/SharedLayout";
import { useConfig } from "@/lib/api";

export default function Login() {
  const { data: config, isLoading } = useConfig();
  const isAdmin = !!config?.isAdmin;
  // Helper function to check if subscription is valid
  const isSubscriptionValid = (status: string | null | undefined): boolean => {
    if (!status) return false;
    const validStatuses = ["active", "trialing", "paid"];
    return validStatuses.includes(status.toLowerCase());
  };
  const hasActiveSubscription = isSubscriptionValid(config?.subscriptionStatus);

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
