import { betterAuth, type BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client } from "../db/index.js";

// 👇 import admin plugin
// import { admin } from "better-auth/plugins";
// import { admin } from "better-auth/plugins";

export const auth = betterAuth<BetterAuthOptions>({
  database: mongodbAdapter(client),
  trustedOrigins: [process.env.CORS_ORIGIN, process.env.CORS_ORIGIN_DEV].filter(
    (origin): origin is string => !!origin
  ),
  user: {
    modelName: "User",
    additionalFields: {
      role: {
        type: "string",
        required: true,
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
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },

  // 👇 here add the plugin
  // plugins: [
  //   admin()
  // ],

  
});
