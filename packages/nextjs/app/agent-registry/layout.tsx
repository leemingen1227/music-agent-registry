import { ReactNode } from "react";
import { Footer } from "~~/components/Footer";

export default function AgentRegistryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="relative flex flex-col flex-1">
        <div className="flex-grow bg-base-100 p-4">{children}</div>
      </main>
      <Footer />
    </>
  );
}
