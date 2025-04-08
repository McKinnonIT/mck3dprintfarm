import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from 'bcryptjs';
import { DefaultSession } from "next-auth";

// Define a fallback role name if needed
const DEFAULT_USER_ROLE = 'User'; 

// Extend Session and User types for TypeScript
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string; // Keep existing role
      allowedPages?: string[]; // Add allowedPages
    } & DefaultSession["user"];
  }

  interface User {
    allowedPages?: string[]; // Only add the new field
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string; // Keep existing role
    allowedPages?: string[]; // Add allowedPages
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) {
          console.log("Authorization failed: Missing credentials.");
          return null;
        }
        console.log(`Attempting authorization for user: ${credentials.email}`);
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: {
              id: true,
              email: true,
              name: true,
              password: true, 
              isEnabled: true, 
              role: { // Select the related role
                select: { // Select needed fields from role
                  name: true,
                  allowedPages: true // Fetch allowedPages string
                }
              }
            }
          });
          // Log fetched user info (excluding password)
          console.log(`Found user in DB for ${credentials.email}:`, user ? {id: user.id, email: user.email, name: user.name, roleName: user.role?.name, isEnabled: user.isEnabled, allowedPages: user.role?.allowedPages } : null);

          if (!user) {
            console.log("No user found with email:", credentials.email);
            return null;
          }
          
          if (!user.isEnabled) {
              console.log(`Authorization failed for ${credentials.email}: Account is disabled.`);
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
          
          // Get role name and parse allowedPages
          const roleName = user.role?.name ?? DEFAULT_USER_ROLE;
          const allowedPagesArray = JSON.parse(user.role?.allowedPages || '[]') as string[];

          // Return user object for JWT callback, including allowedPages
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: roleName,
            allowedPages: allowedPagesArray, // Pass the parsed array
          };
        } catch (error) {
          console.error("Authorization error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On sign-in or explicit update, populate token with user data
      if (user) { // user object comes from the authorize callback
        token.id = user.id;
        token.role = user.role;
        token.allowedPages = user.allowedPages; // Add allowedPages to token
        console.log("JWT populated on sign-in:", { id: token.id, role: token.role, allowedPages: token.allowedPages });
      }
       // Re-enable session update trigger handling
       if (trigger === "update" && session?.role) {
         token.role = session.role;
         // Potentially refetch allowedPages if role changes
         // This part depends on how role updates are handled elsewhere
         console.log("JWT updated via trigger:", { role: token.role });
         // Example: Refetch allowedPages based on new role (requires DB call)
         // const updatedRoleData = await prisma.role.findUnique(...);
         // token.allowedPages = JSON.parse(updatedRoleData?.allowedPages || '[]');
       }
      // --- End re-enable ---
      return token;
    },
    async session({ session, token }) {
      // Transfer necessary info from token to session object
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.allowedPages = token.allowedPages; // Add allowedPages to session
        console.log("Session created/updated:", { userId: session.user.id, role: session.user.role, allowedPages: session.user.allowedPages });
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
  // Remove debug mode
  // debug: true, // REMOVED
}; 