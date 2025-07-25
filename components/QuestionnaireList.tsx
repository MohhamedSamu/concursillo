'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, type Questionnaire } from '@/lib/supabase';

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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Cuestionarios</h2>
        <Link
          href="/questionnaires/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Nuevo Cuestionario
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded">
          {error}
        </div>
      )}

      {questionnaires.length === 0 ? (
        <div className="text-center text-gray-500">
          No hay cuestionarios aún
        </div>
      ) : (
        <div className="grid gap-4">
          {questionnaires.map((questionnaire) => (
            <div
              key={questionnaire.id}
              className="bg-white p-4 rounded shadow"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">{questionnaire.title}</h3>
                <div className="flex space-x-2">
                  <Link
                    href={`/questionnaires/${questionnaire.id}/edit`}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => deleteQuestionnaire(questionnaire.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Creado el: {new Date(questionnaire.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 