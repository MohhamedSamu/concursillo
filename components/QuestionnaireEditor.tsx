'use client';

import { useState } from 'react';
import { supabase, type Question } from '@/lib/supabase';

interface Props {
  questionnaire_id: string;
  onUpdate?: () => void;
}

export default function QuestionnaireEditor({ questionnaire_id, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState('');

  async function loadQuestions() {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('questionnaire_id', questionnaire_id)
        .order('order_number', { ascending: true });

      if (error) throw error;
      setQuestions(data || []);
    } catch (err) {
      console.error('Error loading questions:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar las preguntas');
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

      // Notify parent
      if (onUpdate) onUpdate();
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

      // Notify parent
      if (onUpdate) onUpdate();

      // Show success message
      alert('Pregunta eliminada exitosamente');
    } catch (err) {
      console.error('Error deleting question:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar la pregunta');
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

      // Notify parent
      if (onUpdate) onUpdate();

      // Show success message
      alert('Pregunta actualizada exitosamente');
    } catch (err) {
      console.error('Error updating question:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar la pregunta');
    }
  }

  return (
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
  );
} 