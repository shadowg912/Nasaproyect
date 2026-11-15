import { Skeleton, SkeletonLines } from "@/components/ui/Skeleton";

export default function Loading() {
  return <div className="rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] p-7"><Skeleton className="h-10 max-w-md" label="Cargando histórico…" /><div className="mt-6 grid gap-4 md:grid-cols-3"><Skeleton className="h-60 md:col-span-2" /><div className="rounded-[var(--radius-md)] bg-white p-5"><SkeletonLines /></div></div></div>;
}
