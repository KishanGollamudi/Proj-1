import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

function normalizeRole(email: string): string {
  if (email.includes('admin')) {
    return 'admin';
  }
  if (email.includes('creator')) {
    return 'creator';
  }
  if (email.includes('editor')) {
    return 'editor';
  }
  return 'customer';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {}
      },
      async authorize(credentials) {
        const email = String(credentials.email ?? '').trim().toLowerCase();
        const password = String(credentials.password ?? '');

        if (!email || !password) {
          return null;
        }

        const role = normalizeRole(email);

        return {
          id: `demo-${role}`,
          email,
          name: role === 'customer' ? 'Demo Customer' : `Demo ${role[0].toUpperCase()}${role.slice(1)}`,
          role,
          accessToken: `${role}-token`,
          refreshToken: `${role}-refresh-token`
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: String(token.id),
        role: String(token.role),
        accessToken: String(token.accessToken)
      };
      return session;
    }
  }
});
