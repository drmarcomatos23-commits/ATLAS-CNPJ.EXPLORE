import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Agenda' };

export default function Page() {
  return (
    <>
      <PageHeader title="Agenda" />
      <EmptyState title="Próxima etapa da construção" body="Calendário e agendamento de Reels, carrosséis, imagens e Stories, com sugestão de horário e checagem da legenda pelas regras da OAB." />
    </>
  );
}
