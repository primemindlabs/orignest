import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

// Root — redirect based on auth state
export default async function RootPage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  } else {
    redirect('/sign-in');
  }
}
