'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function EditQuestionnairePage() {
  const params = useParams();
  const router = useRouter();
  interface Questionnaire {
    id: string;
    title: string;
    created_at?: string;
    updated_at?: string;
  }

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    correct_answer: '',
    wrong_answer_1: '',
    wrong_answer_2: '',
    wrong_answer_3: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewQuestionnaire, setIsNewQuestionnaire] = useState(false);
  const [title, setTitle] = useState('');
  const [questionnaireId, setQuestionnaireId] = useState<string | null>(null);

  useEffect(() => {
    if (params.id === 'new') {
      setIsNewQuestionnaire(true);
      setQuestionnaire(null);
      setQuestions([]);
      setIsLoading(false);
    } else {
      setQuestionnaireId(params.id as string);
      loadQuestionnaire();
    }
  }, [params.id]);

  async function loadQuestionnaire() {
    try {
      setIsLoading(true);
      const { data: questionnaireData, error: questionnaireError } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('id', params.id)
        .single();

      if (questionnaireError) throw questionnaireError;

      setQuestionnaire(questionnaireData);
      setTitle(questionnaireData?.title || '');

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('questionnaire_id', params.id)
        .order('order_number');

      if (questionsError) throw questionsError;

      setQuestions(questionsData || []);
    } catch (err) {
      console.error('Error loading questionnaire:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el cuestionario');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveQuestionnaire() {
    try {
      if (!title.trim()) {
        setError('El título no puede estar vacío');
        return;
      }

      if (isNewQuestionnaire) {
        console.log('Creating new questionnaire with title:', title);
        
        // First, insert the questionnaire
        const { data: insertResult, error: createError } = await supabase
          .from('questionnaires')
          .insert([{ title: title.trim() }])
          .select()
          .single();

        if (createError) {
          console.error('Error creating questionnaire:', createError);
          throw createError;
        }

        // If we don't get data back, fetch it separately
        let newQuestionnaire = insertResult;
        
        if (!newQuestionnaire) {
          console.log('No data received directly, fetching latest questionnaire...');
          const { data: fetchedQuestionnaire, error: fetchError } = await supabase
            .from('questionnaires')
            .select()
            .eq('title', title.trim())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (fetchError) {
            console.error('Error fetching new questionnaire:', fetchError);
            throw fetchError;
          }

          newQuestionnaire = fetchedQuestionnaire;
        }

        if (!newQuestionnaire) {
          console.error('Could not verify questionnaire creation');
          throw new Error('No se pudo verificar la creación del cuestionario');
        }

        console.log('Successfully created questionnaire:', newQuestionnaire);

        // Update the URL without reloading the page
        const newPath = `/admin/questionnaires/${newQuestionnaire.id}`;
        console.log('Updating URL to:', newPath);
        window.history.pushState({}, '', newPath);
        
        setQuestionnaire(newQuestionnaire);
        setQuestionnaireId(newQuestionnaire.id);
        setIsNewQuestionnaire(false);
      } else {
        console.log('Updating questionnaire title:', title);
        
        const { error: updateError } = await supabase
          .from('questionnaires')
          .update({ title: title.trim() })
          .eq('id', questionnaireId);

        if (updateError) {
          console.error('Error updating questionnaire:', updateError);
          throw updateError;
        }

        // Update local state since we know the update succeeded
        setQuestionnaire((prev: Questionnaire | null) => 
          prev ? { ...prev, title: title.trim() } : { id: questionnaireId!, title: title.trim() }
        );
        console.log('Successfully updated questionnaire title');
      }
      setError(null);
    } catch (err) {
      console.error('Error saving questionnaire:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar el cuestionario');
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();

    // If it's a new questionnaire or we don't have an ID, save it first
    if (isNewQuestionnaire || !questionnaireId) {
      await handleSaveQuestionnaire();
      if (error) return; // Don't proceed if there was an error saving the questionnaire
    }

    if (!questionnaireId) {
      setError('Error: No se ha podido obtener el ID del cuestionario');
      return;
    }

    if (questions.length >= 15) {
      setError('No se pueden agregar más de 15 preguntas');
      return;
    }

    try {
      const newOrderNumber = questions.length + 1;
      const newQuestionPayload = {
        ...newQuestion,
        questionnaire_id: questionnaireId,
        order_number: newOrderNumber
      };

      console.log('Adding new question with payload:', newQuestionPayload);

      // First, insert the question
      const { error: insertError } = await supabase
        .from('questions')
        .insert(newQuestionPayload);

      if (insertError) {
        console.error('Error inserting question:', insertError);
        throw insertError;
      }

      // Then fetch the latest question for this questionnaire
      const { data: fetchedQuestion, error: fetchError } = await supabase
        .from('questions')
        .select()
        .eq('questionnaire_id', questionnaireId)
        .eq('order_number', newOrderNumber)
        .single();

      if (fetchError) {
        console.error('Error fetching new question:', fetchError);
        throw fetchError;
      }

      if (!fetchedQuestion) {
        throw new Error('No se pudo verificar la creación de la pregunta');
      }

      console.log('Successfully added question:', fetchedQuestion);

      setQuestions(prevQuestions => {
        const updatedQuestions = [...prevQuestions, fetchedQuestion];
        return updatedQuestions.sort((a, b) => a.order_number - b.order_number);
      });
      
      setNewQuestion({
        question_text: '',
        correct_answer: '',
        wrong_answer_1: '',
        wrong_answer_2: '',
        wrong_answer_3: '',
      });
      setError(null);
    } catch (err) {
      console.error('Error adding question:', err);
      setError(err instanceof Error ? err.message : 'Error al agregar la pregunta');
    }
  }

  async function handleEditQuestion(questionId: string) {
    try {
      const question = questions.find(q => q.id === questionId);
      if (!question) return;

      const { error: updateError } = await supabase
        .from('questions')
        .update({
          question_text: newQuestion.question_text,
          correct_answer: newQuestion.correct_answer,
          wrong_answer_1: newQuestion.wrong_answer_1,
          wrong_answer_2: newQuestion.wrong_answer_2,
          wrong_answer_3: newQuestion.wrong_answer_3,
        })
        .eq('id', questionId);

      if (updateError) throw updateError;

      setQuestions(questions.map(q => 
        q.id === questionId 
          ? { ...q, ...newQuestion }
          : q
      ));
      setIsEditing(null);
      setNewQuestion({
        question_text: '',
        correct_answer: '',
        wrong_answer_1: '',
        wrong_answer_2: '',
        wrong_answer_3: '',
      });
    } catch (err) {
      console.error('Error updating question:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar la pregunta');
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    try {
      const deletedQuestion = questions.find(q => q.id === questionId);
      if (!deletedQuestion) return;

      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (deleteError) throw deleteError;

      // Update order numbers for remaining questions
      const updatedQuestions = questions
        .filter(q => q.id !== questionId)
        .map((q, index) => ({
          ...q,
          order_number: index + 1
        }));

      // Update order numbers in database
      for (const question of updatedQuestions) {
        const { error: updateError } = await supabase
          .from('questions')
          .update({ order_number: question.order_number })
          .eq('id', question.id);

        if (updateError) throw updateError;
      }

      // Update state with reordered questions
      setQuestions(updatedQuestions);
    } catch (err) {
      console.error('Error deleting question:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar la pregunta');
      // Reload questions from database if there was an error
      loadQuestionnaire();
    }
  }

  async function handleMoveQuestion(questionId: string, direction: 'up' | 'down') {
    const currentIndex = questions.findIndex(q => q.id === questionId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    try {
      const currentQuestion = questions[currentIndex];
      const targetQuestion = questions[newIndex];

      // Swap order numbers in database
      const { error: updateError } = await supabase
        .from('questions')
        .update({ order_number: targetQuestion.order_number })
        .eq('id', currentQuestion.id);

      if (updateError) throw updateError;

      const { error: updateError2 } = await supabase
        .from('questions')
        .update({ order_number: currentQuestion.order_number })
        .eq('id', targetQuestion.id);

      if (updateError2) throw updateError2;

      // Update local state
      const newQuestions = [...questions];
      newQuestions[currentIndex] = { ...targetQuestion, order_number: currentQuestion.order_number };
      newQuestions[newIndex] = { ...currentQuestion, order_number: targetQuestion.order_number };
      setQuestions(newQuestions.sort((a, b) => a.order_number - b.order_number));
    } catch (err) {
      console.error('Error moving question:', err);
      setError(err instanceof Error ? err.message : 'Error al mover la pregunta');
    }
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Cargando cuestionario...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 mr-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del cuestionario"
              className="text-2xl font-bold w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleSaveQuestionnaire}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Guardar Título
            </button>
            <Link
              href="/admin"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Volver
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {questions.length >= 15 && !isEditing && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            Has alcanzado el límite de 15 preguntas.
          </div>
        )}
        {(questions.length < 15 || isEditing) && (
          <form onSubmit={handleAddQuestion} className="mb-8 bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4" id="questionForm">
            <h2 className="text-xl font-semibold mb-4">
              {isEditing ? 'Editar Pregunta' : 'Agregar Nueva Pregunta'}
            </h2>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Pregunta
              </label>
              <input
                type="text"
                value={newQuestion.question_text}
                onChange={e => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Respuesta Correcta
              </label>
              <input
                type="text"
                value={newQuestion.correct_answer}
                onChange={e => setNewQuestion({ ...newQuestion, correct_answer: e.target.value })}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Respuesta Incorrecta 1
              </label>
              <input
                type="text"
                value={newQuestion.wrong_answer_1}
                onChange={e => setNewQuestion({ ...newQuestion, wrong_answer_1: e.target.value })}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Respuesta Incorrecta 2
              </label>
              <input
                type="text"
                value={newQuestion.wrong_answer_2}
                onChange={e => setNewQuestion({ ...newQuestion, wrong_answer_2: e.target.value })}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Respuesta Incorrecta 3
              </label>
              <input
                type="text"
                value={newQuestion.wrong_answer_3}
                onChange={e => setNewQuestion({ ...newQuestion, wrong_answer_3: e.target.value })}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="flex items-center justify-end">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleEditQuestion(isEditing);
                    }}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
                  >
                    Guardar Cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(null);
                      setNewQuestion({
                        question_text: '',
                        correct_answer: '',
                        wrong_answer_1: '',
                        wrong_answer_2: '',
                        wrong_answer_3: '',
                      });
                    }}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Agregar Pregunta
                </button>
              )}
            </div>
          </form>
        )}

        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={question.id} className="bg-white shadow-md rounded p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {index + 1}. {question.question_text}
                  </h3>
                  <div className="ml-6 space-y-1">
                    <p key={`correct-${question.id}`} className="text-green-600">✓ {question.correct_answer}</p>
                    <p key={`wrong1-${question.id}`}>✗ {question.wrong_answer_1}</p>
                    <p key={`wrong2-${question.id}`}>✗ {question.wrong_answer_2}</p>
                    <p key={`wrong3-${question.id}`}>✗ {question.wrong_answer_3}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {index > 0 && (
                    <button
                      key={`up-${question.id}`}
                      onClick={() => handleMoveQuestion(question.id, 'up')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded"
                    >
                      ↑
                    </button>
                  )}
                  {index < questions.length - 1 && (
                    <button
                      key={`down-${question.id}`}
                      onClick={() => handleMoveQuestion(question.id, 'down')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded"
                    >
                      ↓
                    </button>
                  )}
                  <button
                    key={`edit-${question.id}`}
                    onClick={() => {
                      setIsEditing(question.id);
                      setNewQuestion({
                        question_text: question.question_text,
                        correct_answer: question.correct_answer,
                        wrong_answer_1: question.wrong_answer_1,
                        wrong_answer_2: question.wrong_answer_2,
                        wrong_answer_3: question.wrong_answer_3,
                      });
                      document.getElementById('questionForm')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Editar
                  </button>
                  <button
                    key={`delete-${question.id}`}
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 