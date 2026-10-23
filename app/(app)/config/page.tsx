import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Configurações' };

export default function Page() {
  return (
    <>
      <PageHeader title="Configurações" />
      <EmptyState title="Próxima etapa da construção" body="Fuso, notificações por e-mail e situação do token da Meta." />
    </>
  );
}
