import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Relatórios' };

export default function Page() {
  return (
    <>
      <PageHeader title="Relatórios" />
      <EmptyState title="Próxima etapa da construção" body="Relatório mensal em PDF com métricas, melhores posts e comparativo com concorrentes." />
    </>
  );
}
