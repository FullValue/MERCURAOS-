import type { NextRequest } from "next/server";
import { actualiserSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return actualiserSession(request);
}

export const config = {
  matcher: [
    // Toutes les routes sauf assets statiques et fichiers d'image.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
