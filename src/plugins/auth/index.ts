import { betterAuth, type BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client } from "../db/index.js";

import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

export const auth = betterAuth<BetterAuthOptions>({
  database: mongodbAdapter(client),
  trustedOrigins: [process.env.CORS_ORIGIN, process.env.CORS_ORIGIN_DEV].filter(
    (origin): origin is string => !!origin
  ),
  user: {
    modelName: "user",
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "student",
        input: false,
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      hd: process.env.GOOGLE_HD || undefined,
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectURI: process.env.GOOGLE_REDIRECT_URI || undefined,
    },
  },
   session: {
        cookieCache: {
            enabled: true,
            maxAge: 10 * 60,
            strategy: "jwt"
        }
    },
  advanced: {
    cookiePrefix : "ams",
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
});

export const authClient = createAuthClient({
	  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
	  plugins: [adminClient()],
});
