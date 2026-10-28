/* eslint-disable react-refresh/only-export-components --
   This module is app configuration (route table + router instance), not a
   component module; fast refresh never applies to it. */
import { Link, RouteObject, createBrowserRouter } from "react-router-dom";
import DashboardPage from "@/features/dashboard/DashboardPage";
import EditorRoute from "@/features/editor/EditorRoute";
import PreviewRoute from "@/features/preview/PreviewRoute";
function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950">
      <p className="display text-xl text-zinc-100">Page not found</p>
      <Link to="/" className="text-sm text-accent hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}

export const routes: RouteObject[] = [
  { path: "/", element: <DashboardPage /> },
  { path: "/editor/:projectId", element: <EditorRoute /> },
  { path: "/preview/:projectId/:pageId", element: <PreviewRoute /> },
  { path: "*", element: <NotFound /> },
];

export const router = createBrowserRouter(routes);
