import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { DeliveriesPage } from "@/components/DeliveriesPage";

export const Route = createFileRoute("/deliveries")({
  head: () => ({
    meta: [
      { title: "Deliveries - Velvet Vault" },
      {
        name: "description",
        content: "Manage product deliveries by date.",
      },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("user_role")?.trim().toLowerCase();
      if (!role) {
        throw redirect({ to: "/login" });
      }
      if (role !== "admin" && role !== "employee") {
        throw redirect({ to: "/availability" });
      }
    }
  },
  component: () => <AppShell><DeliveriesPage /></AppShell>,
});
