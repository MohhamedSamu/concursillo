'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, type Questionnaire } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function QuestionnaireList() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestionnaires();
  }, []);

  async function fetchQuestionnaires() {
    try {
      const { data, error } = await supabase
        .from('questionnaires')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestionnaires(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ha ocurrido un error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteQuestionnaire(id: string) {
    try {
      const { error } = await supabase
        .from('questionnaires')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setQuestionnaires(questionnaires.filter(q => q.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ha ocurrido un error');
    }
  }

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Cuestionarios</h1>
      <div className="grid gap-4">
        {questionnaires.map((questionnaire) => (
          <div key={questionnaire.id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{questionnaire.title}</h2>
              <div className="flex gap-2">
                <Link
                  href={`/admin/questionnaires/${questionnaire.id}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Editar
                </Link>
                <Link
                  href={`/host/${questionnaire.id}`}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Iniciar Juego
                </Link>
                <button
                  onClick={() => deleteQuestionnaire(questionnaire.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/admin/questionnaires/new"
        className="mt-4 inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Crear Nuevo Cuestionario
      </Link>
    </div>
  );
} 