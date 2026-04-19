import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/_expert")({
  component: ExpertLayout,
});

function ExpertLayout() {
  const { loading, hasAnyRole } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (!hasAnyRole(["expert", "admin"])) {
    return <Navigate to="/unauthorized" />;
  }

  return <Outlet />;
}
