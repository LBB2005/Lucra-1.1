import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe config — no PrismaAdapter, no Node.js modules.
// Used by middleware for session checking only.
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Always allow auth routes
      if (pathname.startsWith("/api/auth")) return true;

      // Login page: let through (middleware.ts handles the redirect if already logged in)
      if (pathname === "/login") return true;

      // Everything else requires auth
      return isLoggedIn;
    },
  },
};
