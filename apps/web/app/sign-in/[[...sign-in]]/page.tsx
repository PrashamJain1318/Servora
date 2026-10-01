import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <SignIn />
    </main>
  );
}
