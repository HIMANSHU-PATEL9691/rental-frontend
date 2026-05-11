import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ReturnItemsPage } from "@/components/ReturnItemsPage";

export const Route = createFileRoute("/return-items")({
  head: () => ({
    meta: [
      { title: "Return Items - Velvet Vault" },
      {
        name: "description",
        content: "List of all currently rented items that need to be returned.",
      },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("user_role");
      if (!role) {
        throw redirect({ to: "/login" });
      }
      if (role !== "admin") {
        throw redirect({ to: "/availability" });
      }
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AppShell>
      <ReturnItemsPage />
    </AppShell>
  );
}