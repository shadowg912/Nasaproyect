import { MapApp } from "@/components/map/MapApp";

export const metadata = { title: "Local · Fuego RD" };

export default function LocalPage() {
  return <MapApp mode="local" />;
}
