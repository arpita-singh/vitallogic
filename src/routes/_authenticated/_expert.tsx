import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_expert")({
  beforeLoad: ({ context }) => {
    if (!context.auth?.hasAnyRole(["expert", "admin"])) {
      throw redirect({ to: "/unauthorized" });
    }
  },
  component: () => <Outlet />,
});
