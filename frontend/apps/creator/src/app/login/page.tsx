'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function CreatorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false
    });

    if (result?.error) {
      setError('Invalid credentials');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">Creator Sign in</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Email" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Password" />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Sign in</button>
      </form>
    </div>
  );
}
