'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type Questionnaire } from '@/lib/supabase';

export default function QuestionnairePage() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuestionnaires();
  }, []);

  async function loadQuestionnaires() {
    try {
      console.log('Loading questionnaires...');
      const { data, error } = await supabase
        .from('questionnaires')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Loaded questionnaires:', data);
      setQuestionnaires(data || []);
    } catch (err) {
      console.error('Error loading questionnaires:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los cuestionarios');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar este cuestionario?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('questionnaires')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setQuestionnaires(questionnaires.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting questionnaire:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar el cuestionario');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando cuestionarios...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Cuestionarios</h1>
          <Link
            href="/questionnaires/new"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Nuevo Cuestionario
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {questionnaires.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No hay cuestionarios. ¡Crea uno nuevo!
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Título
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha de Creación
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {questionnaires.map((questionnaire) => (
                  <tr key={questionnaire.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {questionnaire.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(questionnaire.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/questionnaires/${questionnaire.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/host/${questionnaire.id}`}
                        className="text-green-600 hover:text-green-800 mr-4"
                      >
                        Iniciar Juego
                      </Link>
                      <button
                        onClick={() => handleDelete(questionnaire.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 