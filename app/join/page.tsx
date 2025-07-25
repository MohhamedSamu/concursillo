'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinGame() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError('Por favor ingresa un código');
      return;
    }
    router.push(`/join/${code.toUpperCase()}`);
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
                  Unirse al Juego
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                      Código del Juego
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="code"
                        id="code"
                        value={code}
                        onChange={(e) => {
                          setError('');
                          setCode(e.target.value.toUpperCase());
                        }}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Ingresa el código de 6 caracteres"
                        maxLength={6}
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
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Unirse
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