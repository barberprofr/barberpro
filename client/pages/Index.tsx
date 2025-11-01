import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import SharedLayout from "@/components/SharedLayout";
import PrestationsForm from "@/components/Salon/PrestationsForm";
import StatsCards from "@/components/Salon/StatsCards";
import { useConfig } from "@/lib/api";

export default function Index() {
  const { data: config, isLoading } = useConfig();
  if (isLoading) {
    return <SharedLayout />;
  }
  if (!config?.isAdmin) {
    return <Navigate to="/" replace />;
  }
  return (
    <SharedLayout>
      <div className="mx-auto max-w-md space-y-4">
        <PrestationsForm />
        <StatsCards />
      </div>
    </SharedLayout>
  );
}
