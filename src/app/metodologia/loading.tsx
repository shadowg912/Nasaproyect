import { Skeleton, SkeletonLines } from "@/components/ui/Skeleton";

export default function Loading() {
  return <div className="rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] p-7"><Skeleton className="h-10 max-w-md" label="Cargando metodología…" /><div className="mt-6 rounded-[var(--radius-md)] bg-white p-5"><SkeletonLines /></div></div>;
}
