import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/library(.*)",
  "/summarize(.*)",
  "/notes(.*)",
  "/ask(.*)",
  "/chapters(.*)",
  "/quiz(.*)",
  "/api/video/process",
  "/api/qa/ask",
  "/api/library(.*)",
  "/api/videos(.*)",
  "/api/user(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect({ unauthenticatedUrl: new URL("/sign-in", req.url).toString() });
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
