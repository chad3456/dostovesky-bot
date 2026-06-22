import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyEmailOtp } from "@/lib/otp";

const providers: NextAuthConfig["providers"] = [];

// Email one-time passcode sign-in. The code is issued via
// POST /api/auth/email/request and verified here.
providers.push(
  Credentials({
    id: "email-otp",
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      code: { label: "Code", type: "text" },
    },
    async authorize(creds) {
      const user = await verifyEmailOtp(
        String(creds?.email || ""),
        String(creds?.code || ""),
      );
      if (!user) return null;
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
);

// Real Google sign-in — only registered when credentials are configured.
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

// Deterministic test login. NEVER enabled in production.
if (
  process.env.ENABLE_TEST_LOGIN === "true" &&
  process.env.NODE_ENV !== "production"
) {
  providers.push(
    Credentials({
      id: "test-login",
      name: "Test Login",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(creds) {
        const email = String(creds?.email || "").toLowerCase().trim();
        if (!email) return null;
        const name = String(creds?.name || email.split("@")[0]);
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name },
        });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
