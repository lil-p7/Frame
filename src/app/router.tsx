/* eslint-disable react-refresh/only-export-components --
   This module is app configuration (route table + router instance), not a
   component module; fast refresh never applies to it. */
import { Link, RouteObject, createBrowserRouter } from "react-router-dom";
import DashboardPage from "@/features/dashboard/DashboardPage";
import EditorRoute from "@/features/editor/EditorRoute";
function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-900">
      <p className="text-lg font-semibold">Page not found</p>
      <Link to="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        Back to dashboard
      </Link>
    </div>
  );
}

export const routes: RouteObject[] = [
  { path: "/", element: <DashboardPage /> },
  { path: "/editor/:projectId", element: <EditorRoute /> },
  { path: "*", element: <NotFound /> },
];

export const router = createBrowserRouter(routes);
