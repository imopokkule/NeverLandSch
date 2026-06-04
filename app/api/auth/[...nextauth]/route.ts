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
          name: profile.username,
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
          const now = new Date().toISOString();
          const discord_id = account.providerAccountId;

          // 初回ログイン時のみ INSERT（created_at を初回登録日として確定）
          const { error: insertError } = await supabase.from("app_users").insert({
            discord_id,
            user_name: user.name,
            avatar_url: user.image,
            last_login: now,
          });

          if (insertError) {
            // 重複（既存ユーザー）は user_name / avatar_url / last_login だけ更新
            // created_at は一切触らない
            await supabase.from("app_users").update({
              user_name: user.name,
              avatar_url: user.image,
              last_login: now,
            }).eq("discord_id", discord_id);
          }
        } catch (e) {
          console.error("Failed to update app_users:", e);
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