import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Reels' };

export default function Page() {
  return (
    <>
      <PageHeader title="Reels" />
      <EmptyState title="Próxima etapa da construção" body="Tempo médio assistido e retenção dos Reels." />
    </>
  );
}
