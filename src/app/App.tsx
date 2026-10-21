import { RouterProvider } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { router } from "@/app/router";

/**
 * Phase 1 application composition.
 * Routing: `/` dashboard · `/editor/:projectId` (Phase 2 will replace the
 * placeholder with the real editor shell).
 */
export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
