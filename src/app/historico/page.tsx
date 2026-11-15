import { Suspense } from "react";
import { HistoryView } from "@/components/HistoryView";

export const metadata = { title: "Histórico — Fuego RD" };

export default function Page() {
  return (
    <Suspense>
      <HistoryView />
    </Suspense>
  );
}
