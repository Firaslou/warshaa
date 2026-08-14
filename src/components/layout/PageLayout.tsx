import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileTabBar } from "./MobileTabBar";
import { LiveQuickStartGate } from "@/components/live/LiveQuickStartGate";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-canvas flex min-h-screen flex-col">
      <Header />
      <main className="relative z-[1] flex-1 pb-28 md:pb-0">{children}</main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileTabBar />
      <LiveQuickStartGate />
    </div>
  );
}
