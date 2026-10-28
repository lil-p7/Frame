import { useRef, type ReactNode } from "react";
import { Toaster } from "sonner";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";

/**
 * App-wide providers. The Dexie repository instance is created lazily inside
 * the component so importing this module (e.g. in tests) does not touch
 * IndexedDB until the app actually renders.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const repositoryRef = useRef<DexieProjectRepository | null>(null);
  if (repositoryRef.current === null) {
    repositoryRef.current = new DexieProjectRepository();
  }

  return (
    <RepositoryContext.Provider value={repositoryRef.current}>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#171717",
            border: "1px solid #292929",
            color: "#f4f4f0",
          },
        }}
        closeButton
      />
    </RepositoryContext.Provider>
  );
}
