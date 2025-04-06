import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials");
          return null;
        }

        console.log(`Attempting authorization for user: ${credentials.email}`);
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        console.log(`Found user in DB for ${credentials.email}:`, user ? {id: user.id, email: user.email, name: user.name, hasPassword: !!user.password} : null);

        if (!user) {
          console.log("No user found with email:", credentials.email);
          return null;
        }
        
        // Ensure user has a password set in the database
        if (!user.password) {
          console.log(`User ${credentials.email} found, but has no password set.`);
          return null; 
        }

        // Compare the provided password with the stored hash
        console.log(`Comparing provided password with hash for user ${credentials.email}...`);
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        console.log(`Password validation result for ${credentials.email}: ${isPasswordValid}`);

        if (!isPasswordValid) {
          console.log("Invalid password for user:", credentials.email);
          return null;
        }

        console.log("User authenticated successfully:", {id: user.id, email: user.email});
        // Return user object without the password hash
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        console.log("JWT token updated:", { id: user.id, role: user.role });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        console.log("Session updated:", { id: token.id, role: token.role });
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
}; 