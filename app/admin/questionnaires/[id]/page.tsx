'use client';

import { useParams } from 'next/navigation';
import QuestionnaireEditor from '@/components/QuestionnaireEditor';

export default function QuestionnaireEditorPage() {
  const params = useParams();
  const questionnaire_id = params.id as string;

  return <QuestionnaireEditor questionnaire_id={questionnaire_id} />;
} 