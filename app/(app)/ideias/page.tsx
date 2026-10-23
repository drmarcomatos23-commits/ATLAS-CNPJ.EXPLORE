import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Ideias' };

export default function Page() {
  return (
    <>
      <PageHeader title="Ideias" />
      <EmptyState title="Próxima etapa da construção" body="Banco de pautas e rascunhos por pilar (holding, sucessão, empresas, sócios)." />
    </>
  );
}
