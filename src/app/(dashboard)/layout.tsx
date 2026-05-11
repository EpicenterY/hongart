import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import { ToastContainer } from "@/components/ui";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-60">
        <main className="pb-20 lg:pb-6">{children}</main>
      </div>
      <BottomNav />
      <ToastContainer />
    </div>
  );
}
