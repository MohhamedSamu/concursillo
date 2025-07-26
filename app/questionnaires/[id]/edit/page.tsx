'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, type Question, type Questionnaire } from '@/lib/supabase';

export default function QuestionnaireEditor({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    correct_answer: '',
    wrong_answer_1: '',
    wrong_answer_2: '',
    wrong_answer_3: ''
  });

  // Load questionnaire and questions
  useEffect(() => {
    loadQuestionnaire();
  }, [params.id]);

  async function loadQuestionnaire() {
    try {
      // Load questionnaire
      const { data: questionnaire, error: questionnaireError } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('id', params.id)
        .single();

      if (questionnaireError) throw questionnaireError;
      setQuestionnaire(questionnaire);

      // Load questions
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('questionnaire_id', params.id)
        .order('order_number', { ascending: true });

      if (questionsError) throw questionsError;
      setQuestions(questions || []);
    } catch (err) {
      console.error('Error loading questionnaire:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el cuestionario');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!questionnaire) return;

    try {
      // Get next order number
      const nextOrder = questions.length > 0 
        ? Math.max(...questions.map(q => q.order_number)) + 1 
        : 1;

      // Create new question
      const { data: question, error } = await supabase
        .from('questions')
        .insert({
          ...newQuestion,
          questionnaire_id: questionnaire.id,
          order_number: nextOrder
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setQuestions([...questions, question]);
      setNewQuestion({
        question_text: '',
        correct_answer: '',
        wrong_answer_1: '',
        wrong_answer_2: '',
        wrong_answer_3: ''
      });

      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded';
      successDiv.textContent = 'Pregunta agregada exitosamente';
      document.body.appendChild(successDiv);
      setTimeout(() => successDiv.remove(), 3000);
    } catch (err) {
      console.error('Error adding question:', err);
      setError(err instanceof Error ? err.message : 'Error al agregar la pregunta');
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingQuestion || !editingId) return;

    try {
      const { error } = await supabase
        .from('questions')
        .update({
          question_text: editingQuestion.question_text,
          correct_answer: editingQuestion.correct_answer,
          wrong_answer_1: editingQuestion.wrong_answer_1,
          wrong_answer_2: editingQuestion.wrong_answer_2,
          wrong_answer_3: editingQuestion.wrong_answer_3
        })
        .eq('id', editingId);

      if (error) throw error;

      // Update local state
      setQuestions(questions.map(q => 
        q.id === editingId ? { ...q, ...editingQuestion } : q
      ));
      setIsEditing(false);
      setEditingId(null);
      setEditingQuestion(null);

      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded';
      successDiv.textContent = 'Pregunta actualizada exitosamente';
      document.body.appendChild(successDiv);
      setTimeout(() => successDiv.remove(), 3000);
    } catch (err) {
      console.error('Error updating question:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar la pregunta');
    }
  }

  function startEditing(question: Question) {
    setEditingQuestion({
      ...question
    });
    setIsEditing(true);
    setEditingId(question.id);
  }

  async function moveQuestion(questionId: string, direction: 'up' | 'down') {
    const currentIndex = questions.findIndex(q => q.id === questionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    try {
      // Get the questions to swap
      const currentQuestion = questions[currentIndex];
      const targetQuestion = questions[newIndex];

      // Swap their order numbers
      const { error: error1 } = await supabase
        .from('questions')
        .update({ order_number: targetQuestion.order_number })
        .eq('id', currentQuestion.id);

      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from('questions')
        .update({ order_number: currentQuestion.order_number })
        .eq('id', targetQuestion.id);

      if (error2) throw error2;

      // Update local state
      const newQuestions = [...questions];
      newQuestions[currentIndex] = { ...targetQuestion, order_number: currentQuestion.order_number };
      newQuestions[newIndex] = { ...currentQuestion, order_number: targetQuestion.order_number };
      newQuestions.sort((a, b) => a.order_number - b.order_number);
      setQuestions(newQuestions);
    } catch (err) {
      console.error('Error moving question:', err);
      setError(err instanceof Error ? err.message : 'Error al mover la pregunta');
    }
  }

  async function handleDelete(questionId: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta pregunta?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      // Update local state
      setQuestions(questions.filter(q => q.id !== questionId));

      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded';
      successDiv.textContent = 'Pregunta eliminada exitosamente';
      document.body.appendChild(successDiv);
      setTimeout(() => successDiv.remove(), 3000);
    } catch (err) {
      console.error('Error deleting question:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar la pregunta');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando cuestionario...</div>
      </div>
    );
  }

  if (error || !questionnaire) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-red-600 text-xl">{error || 'Cuestionario no encontrado'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Bar */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link
                  href="/questionnaires"
                  className="text-gray-500 hover:text-gray-700"
                >
                  ← Volver a Cuestionarios
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <Link
                href={`/host/${questionnaire.id}`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Iniciar Juego
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h1 className="text-3xl font-bold mb-6">{questionnaire.title}</h1>

            {/* Questions List */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Preguntas ({questions.length})</h2>
              {questions.length === 0 ? (
                <p className="text-gray-500">No hay preguntas aún</p>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
                      {editingId === question.id ? (
                        <form onSubmit={handleEdit} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Pregunta
                            </label>
                            <input
                              type="text"
                              value={editingQuestion?.question_text || ''}
                              onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, question_text: e.target.value } : null)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Respuesta Correcta
                            </label>
                            <input
                              type="text"
                              value={editingQuestion?.correct_answer || ''}
                              onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, correct_answer: e.target.value } : null)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Respuesta Incorrecta 1
                            </label>
                            <input
                              type="text"
                              value={editingQuestion?.wrong_answer_1 || ''}
                              onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, wrong_answer_1: e.target.value } : null)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Respuesta Incorrecta 2
                            </label>
                            <input
                              type="text"
                              value={editingQuestion?.wrong_answer_2 || ''}
                              onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, wrong_answer_2: e.target.value } : null)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Respuesta Incorrecta 3
                            </label>
                            <input
                              type="text"
                              value={editingQuestion?.wrong_answer_3 || ''}
                              onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, wrong_answer_3: e.target.value } : null)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              required
                            />
                          </div>

                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditing(false);
                                setEditingId(null);
                                setEditingQuestion(null);
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                            >
                              Guardar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium">Pregunta {index + 1}</span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => moveQuestion(question.id, 'up')}
                                disabled={index === 0}
                                className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => moveQuestion(question.id, 'down')}
                                disabled={index === questions.length - 1}
                                className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => startEditing(question)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDelete(question.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                          <p className="text-lg mb-2">{question.question_text}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-green-100 rounded">
                              ✓ {question.correct_answer}
                            </div>
                            <div className="p-2 bg-red-100 rounded">
                              ✗ {question.wrong_answer_1}
                            </div>
                            <div className="p-2 bg-red-100 rounded">
                              ✗ {question.wrong_answer_2}
                            </div>
                            <div className="p-2 bg-red-100 rounded">
                              ✗ {question.wrong_answer_3}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {questions.length >= 20 ? (
              <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 p-4 rounded mb-8">
                Has alcanzado el límite de 20 preguntas.
              </div>
            ) : null}

            {/* Add Question Form */}
            {!isEditing && questions.length < 20 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Pregunta
                  </label>
                  <input
                    type="text"
                    value={newQuestion.question_text}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Respuesta Correcta
                  </label>
                  <input
                    type="text"
                    value={newQuestion.correct_answer}
                    onChange={(e) => setNewQuestion({ ...newQuestion, correct_answer: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Respuesta Incorrecta 1
                  </label>
                  <input
                    type="text"
                    value={newQuestion.wrong_answer_1}
                    onChange={(e) => setNewQuestion({ ...newQuestion, wrong_answer_1: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Respuesta Incorrecta 2
                  </label>
                  <input
                    type="text"
                    value={newQuestion.wrong_answer_2}
                    onChange={(e) => setNewQuestion({ ...newQuestion, wrong_answer_2: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Respuesta Incorrecta 3
                  </label>
                  <input
                    type="text"
                    value={newQuestion.wrong_answer_3}
                    onChange={(e) => setNewQuestion({ ...newQuestion, wrong_answer_3: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Agregar Pregunta
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 