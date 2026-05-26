import type { Metadata } from "next";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Sentinel dashboard",
  description: "Dashboard dinamica per i monitor Sentinel"
};

export default function Page(): React.ReactElement {
  return <DashboardClient />;
}
