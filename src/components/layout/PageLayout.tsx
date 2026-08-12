import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-canvas flex min-h-screen flex-col">
      <Header />
      <main className="relative z-[1] flex-1">{children}</main>
      <Footer />
    </div>
  );
}
