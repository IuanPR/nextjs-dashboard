import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import type { User } from '@/app/lib/definitions';
import * as argon from 'argon2';

const prisma = new PrismaClient();

async function getUser(email: string): Promise<User | null> {
  try {
    return prisma.user.findFirst({
      where: { email: email },
    });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      type: 'credentials',
      async authorize(credentials) {
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
            newUser: z.string(),
          })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password, newUser } = parsedCredentials.data;
          const user = await getUser(email);

          if (newUser === 'false') {
            if (!user) return null;

            const passwordsMatch = await argon.verify(user.password, password);

            if (passwordsMatch) return user;
          } else if (newUser === 'true') {
            try {
              console.log('Creating new user');

              const hashedPassword = await argon.hash(password);

              const newUser = await prisma.user.create({
                data: {
                  email: email,
                  name: email,
                  password: hashedPassword,
                },
              });

              return newUser;
            } catch {
              console.log('Failed to create new user');
              return null;
            }
          }
        }

        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
});
