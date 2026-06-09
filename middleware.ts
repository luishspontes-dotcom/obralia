import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Portal público do cliente (/p/{token}) — sem auth, sem refresh de sessão.
  if (request.nextUrl.pathname.startsWith("/p/")) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static
     * - _next/image
     * - favicon
     * - /p/* (portal público do cliente — sem auth)
     * - public files (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|p/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
