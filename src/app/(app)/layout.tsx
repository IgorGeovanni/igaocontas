import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { SessionTimeout } from "@/components/SessionTimeout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SessionTimeout />
      <Sidebar />
      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
