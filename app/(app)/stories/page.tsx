import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Stories' };

export default function Page() {
  return (
    <>
      <PageHeader title="Stories" />
      <EmptyState title="Próxima etapa da construção" body="Os Stories já são guardados antes de sumirem em 24 h. A tela de análise vem na próxima etapa." />
    </>
  );
}
