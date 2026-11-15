import { redirect } from "next/navigation";

/** «República Dominicana» ahora se llama «Local». */
export default function RdPage() {
  redirect("/local");
}
