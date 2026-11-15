import { Suspense } from "react";
import { HistoryView } from "@/components/HistoryView";

export const metadata = { title: "Histórico — Satflame" };

export default function Page() {
  return (
    <Suspense>
      <HistoryView />
    </Suspense>
  );
}
