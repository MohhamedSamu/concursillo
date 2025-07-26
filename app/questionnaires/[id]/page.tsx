import { redirect } from 'next/navigation';
 
export default function QuestionnairePage({ params }: { params: { id: string } }) {
  redirect(`/questionnaires/${params.id}/edit`);
} 