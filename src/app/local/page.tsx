import { MapApp } from "@/components/map/MapApp";

export const metadata = { title: "Local · Satflame" };

export default function LocalPage() {
  return <MapApp mode="local" />;
}
