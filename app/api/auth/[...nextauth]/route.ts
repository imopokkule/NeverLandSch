import NextAuth, { AuthOptions } from "next-auth"
import DiscordProvider, { DiscordProfile } from "next-auth/providers/discord"
import { createClient } from "@supabase/supabase-js"

export const authOptions: AuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      profile(profile: DiscordProfile) {
        return {
          id: profile.id,
          name: profile.global_name || profile.username,
          email: profile.email,
          image: profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null,
        };
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt" as const,
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "discord") {
        try {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          await supabase.from("app_users").upsert(
            {
              discord_id: account.providerAccountId,
              user_name: user.name,
              avatar_url: user.image,
              last_login: new Date().toISOString(),
            },
            { onConflict: "discord_id" }
          );
        } catch (e) {
          console.error("Failed to upsert app_users:", e);
        }
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.discordId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.discordId as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }