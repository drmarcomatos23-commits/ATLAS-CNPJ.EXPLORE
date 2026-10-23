import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Público' };

export default function Page() {
  return (
    <>
      <PageHeader title="Público" />
      <EmptyState title="Próxima etapa da construção" body="Cidade, idade e gênero dos seguidores. A coleta já roda toda segunda-feira; a tela vem na etapa de público." />
    </>
  );
}
