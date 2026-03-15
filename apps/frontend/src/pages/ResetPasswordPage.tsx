import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';

const MIN_PASSWORD_LENGTH = 8;

function getPasswordStrength(password: string): { label: string; color: string; score: number } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Bardzo słabe', color: 'bg-red-500', score };
  if (score === 2) return { label: 'Słabe', color: 'bg-orange-400', score };
  if (score === 3) return { label: 'Średnie', color: 'bg-yellow-400', score };
  if (score === 4) return { label: 'Mocne', color: 'bg-blue-500', score };
  return { label: 'Bardzo mocne', color: 'bg-green-500', score };
}

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Brak tokenu resetującego. Wygeneruj nowy link resetujący.');
    }
  }, [token]);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Hasła nie są zgodne.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      toast.success('Hasło zostało zmienione. Możesz się teraz zalogować.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Wystąpił błąd. Spróbuj wygenerować nowy link resetujący.');
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
            Nowe hasło
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Wróć do{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary/80">
              logowania
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
              {(error.includes('wygasł') || error.includes('użyty') || error.includes('nieprawidłowy')) && (
                <p className="mt-2">
                  <Link to="/forgot-password" className="underline font-medium">
                    Wygeneruj nowy link resetujący
                  </Link>
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Nowe hasło
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full ${i <= strength.score ? strength.color : 'bg-gray-200'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Powtórz hasło
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${
                  confirmPassword && confirmPassword !== password ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1 text-xs text-red-600">Hasła nie są zgodne</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50"
          >
            {loading ? 'Zapisywanie...' : 'Ustaw nowe hasło'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
