import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSubmitted(true);
    } catch {
      // Show generic message — don't reveal whether request failed
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center mr-8">
            <div className="h-20 w-20 flex items-center justify-center">
              <img
                src="/lingodesk_logo_medium.png"
                alt="LingoDesk Logo"
                className="h-full w-full object-cover scale-150 ml-1 mt-1"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <h1 className="text-4xl font-bold text-secondary">LingoDesk</h1>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Resetowanie hasła
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Pamiętasz hasło?{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary/80">
              Wróć do logowania
            </Link>
          </p>
        </div>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 text-green-800 px-6 py-5 rounded-lg text-center space-y-2">
            <p className="font-semibold">Sprawdź swoją skrzynkę</p>
            <p className="text-sm">
              Jeśli podany adres email istnieje w systemie, wyślemy na niego link do zresetowania hasła.
              Link jest ważny przez 1 godzinę.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Nie dostałeś wiadomości? Sprawdź folder spam lub{' '}
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="text-primary hover:text-primary/80 underline"
              >
                spróbuj ponownie
              </button>
              .
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Adres email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="twoj@email.pl"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50"
            >
              {loading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
