import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AvailabilityPage } from "@/components/AvailabilityPage";

export const Route = createFileRoute("/availability")({
  head: () => ({
    meta: [
      { title: "Availability - Velvet Vault" },
      { name: "description", content: "Check product booking schedules and availability." },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AppShell>
      <AvailabilityPage />
    </AppShell>
  );
}