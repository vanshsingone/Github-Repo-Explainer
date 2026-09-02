import { clerkMiddleware } from "@clerk/nextjs/server";

const middleware = clerkMiddleware();

// Next.js 16 renamed middleware to proxy
export function proxy(
  ...args: Parameters<typeof middleware>
): ReturnType<typeof middleware> {
  return middleware(...args);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes

    
    "/(api|trpc)(.*)",
  ],
};