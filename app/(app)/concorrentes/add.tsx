'use client';
import { useActionState } from 'react';
import { addCompetitorAction } from '@/app/actions';
import { buttonClass, inputClass } from '@/components/ui';

export function AddCompetitor() {
  const [state, action, pending] = useActionState(addCompetitorAction, { ok: true, message: '' });
  return (
    <form action={action} className="mb-6 max-w-lg">
      <label htmlFor="username" className="mb-1 block text-sm font-medium">Adicionar concorrente</label>
      <div className="flex gap-2">
        <input id="username" name="username" placeholder="@escritorio_exemplo" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          required className={inputClass} aria-describedby={state.message ? 'msg-conc' : undefined} />
        <button disabled={pending} aria-busy={pending} className={buttonClass('primary')}>{pending ? 'Buscando…' : 'Adicionar'}</button>
      </div>
      {state.message && <p id="msg-conc" role={state.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${state.ok ? 'text-success' : 'text-danger'}`}>{state.message}</p>}
    </form>
  );
}
