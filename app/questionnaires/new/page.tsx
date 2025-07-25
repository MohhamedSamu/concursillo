'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function NewQuestionnaire() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Creating new questionnaire with title:', title);

      // Create new questionnaire
      const { data: questionnaire, error } = await supabase
        .from('questionnaires')
        .insert([{ title }])
        .select()
        .single();

      if (error) throw error;

      console.log('Created questionnaire:', questionnaire);

      // Validate the returned UUID
      if (!questionnaire?.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(questionnaire.id)) {
        throw new Error('ID de cuestionario inválido generado por el servidor');
      }

      // Redirect to edit page with the validated UUID
      const editUrl = `/questionnaires/${questionnaire.id}/edit`;
      console.log('Redirecting to:', editUrl);
      router.push(editUrl);
    } catch (err) {
      console.error('Error creating questionnaire:', err);
      setError(err instanceof Error ? err.message : 'Error al crear el cuestionario');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">
                  Nuevo Cuestionario
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Título del Cuestionario
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="title"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Ingresa el título"
                        required
                      />
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-red-600">
                        {error}
                      </p>
                    )}
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Creando...' : 'Crear Cuestionario'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 