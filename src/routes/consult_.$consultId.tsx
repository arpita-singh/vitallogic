import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/consult_/$consultId")({
  component: ConsultLayout,
});

function ConsultLayout() {
  return <Outlet />;
}
