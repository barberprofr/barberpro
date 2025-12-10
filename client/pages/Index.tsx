import SharedLayout from "@/components/SharedLayout";
import PrestationsForm from "@/components/Salon/PrestationsForm";
import StatsCards from "@/components/Salon/StatsCards";

export default function Index() {
  // SharedLayout handles access control and subscription blocking
  // No need to redirect here, as SharedLayout will show the subscription popup
  // and block access if subscription is not valid (active, trialing, or paid)
  return (
    <SharedLayout>
      <div className="mx-auto max-w-md space-y-6 py-4">
        <PrestationsForm />
        <StatsCards />
      </div>
    </SharedLayout>
  );
}
