'use client';
import { useActionState } from 'react';
import { signInAction } from '@/app/actions';
import { buttonClass, inputClass } from '@/components/ui';

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, { message: '' });
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          aria-describedby={state.message ? 'erro-login' : undefined} className={inputClass} />
      </div>
      {state.message && <p id="erro-login" role="alert" className="text-sm text-danger">{state.message}</p>}
      <button type="submit" disabled={pending} aria-busy={pending} className={`${buttonClass('primary')} w-full`}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
