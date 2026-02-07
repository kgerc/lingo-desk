import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import courseApplicationService, {
  CourseApplication,
  ConvertToStudentData,
} from '../services/courseApplicationService';
import { X, CheckCircle, XCircle, UserPlus, Copy, Eye } from 'lucide-react';

interface ApplicationDetailsModalProps {
  application: CourseApplication;
  onClose: () => void;
  onStatusChange: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Nowe',
  ACCEPTED: 'Zaakceptowane',
  REJECTED: 'Odrzucone',
};

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function generatePassword(length = 10): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const ApplicationDetailsModal: React.FC<ApplicationDetailsModalProps> = ({
  application,
  onClose,
  onStatusChange,
}) => {
  const queryClient = useQueryClient();
  const [showConvertForm, setShowConvertForm] = useState(false);

  const { firstName: defaultFirst, lastName: defaultLast } = splitName(application.name);
  const [generatedPassword] = useState(() => generatePassword());

  const [convertData, setConvertData] = useState<ConvertToStudentData>({
    firstName: defaultFirst,
    lastName: defaultLast,
    email: application.email,
    password: generatedPassword,
    phone: application.phone || '',
    languageLevel: application.languageLevel || '',
    language: 'en',
  });
  const [convertErrors, setConvertErrors] = useState<Record<string, string>>({});

  const updateStatusMutation = useMutation({
    mutationFn: ({ status, internalNotes }: { status: string; internalNotes?: string }) =>
      courseApplicationService.updateStatus(application.id, status, internalNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      onStatusChange();
    },
  });

  const convertMutation = useMutation({
    mutationFn: (data: ConvertToStudentData) =>
      courseApplicationService.convertToStudent(application.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      onStatusChange();
      toast.success('Uczeń został utworzony na podstawie zgłoszenia');
      onClose();
    },
    onError: () => {
      toast.error('Nie udało się utworzyć ucznia');
    },
  });

  const handleAccept = async () => {
    await updateStatusMutation.mutateAsync({ status: 'ACCEPTED' });
    toast.success('Zgłoszenie zaakceptowane');
  };

  const handleReject = async () => {
    await updateStatusMutation.mutateAsync({ status: 'REJECTED' });
    toast.success('Zgłoszenie odrzucone');
  };

  const validateConvert = () => {
    const errors: Record<string, string> = {};
    if (!convertData.firstName.trim()) errors.firstName = 'Imię jest wymagane';
    if (!convertData.lastName.trim()) errors.lastName = 'Nazwisko jest wymagane';
    if (!convertData.email.trim()) errors.email = 'Email jest wymagany';
    if (!convertData.password || convertData.password.length < 6)
      errors.password = 'Hasło musi mieć min. 6 znaków';
    setConvertErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateConvert()) return;
    convertMutation.mutate(convertData);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(convertData.password);
    toast.success('Hasło skopiowane');
  };

  const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="py-2">
      <dt className="text-xs font-medium text-gray-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || <span className="text-gray-300">—</span>}</dd>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-gray-400" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Szczegóły zgłoszenia</h2>
                <p className="text-sm text-gray-500">{application.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Status */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-medium text-gray-500">Status:</span>
              <span
                className={`px-3 py-1 text-sm font-semibold rounded-full ${STATUS_BADGE[application.status]}`}
              >
                {STATUS_LABEL[application.status]}
              </span>
              {application.convertedStudentId && (
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800">
                  Skonwertowany na ucznia
                </span>
              )}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-6">
              <DetailRow label="Imię i nazwisko" value={application.name} />
              <DetailRow label="Email" value={application.email} />
              <DetailRow label="Telefon" value={application.phone} />
              <DetailRow label="Poziom językowy" value={application.languageLevel} />
              <DetailRow
                label="Preferowany kurs"
                value={application.course ? `${application.course.name} (${application.course.level})` : null}
              />
              <DetailRow label="Data zgłoszenia" value={new Date(application.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            </div>

            {(application.preferences || application.availability || application.notes) && (
              <div className="space-y-3 mb-6 border-t border-gray-200 pt-4">
                {application.preferences && (
                  <DetailRow label="Preferencje / oczekiwania" value={application.preferences} />
                )}
                {application.availability && (
                  <DetailRow label="Dostępność" value={application.availability} />
                )}
                {application.notes && (
                  <DetailRow label="Dodatkowe uwagi" value={application.notes} />
                )}
              </div>
            )}

            {application.internalNotes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                <p className="text-xs font-medium text-yellow-800 uppercase mb-1">Notatki wewnętrzne</p>
                <p className="text-sm text-yellow-900">{application.internalNotes}</p>
              </div>
            )}

            {/* Action buttons for NEW */}
            {application.status === 'NEW' && (
              <div className="flex gap-3 border-t border-gray-200 pt-4">
                <button
                  onClick={handleAccept}
                  disabled={updateStatusMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Zaakceptuj
                </button>
                <button
                  onClick={handleReject}
                  disabled={updateStatusMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Odrzuć
                </button>
              </div>
            )}

            {/* Convert to student section */}
            {application.status === 'ACCEPTED' && !application.convertedStudentId && (
              <div className="border-t border-gray-200 pt-4">
                {!showConvertForm ? (
                  <button
                    onClick={() => setShowConvertForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Utwórz ucznia na podstawie zgłoszenia
                  </button>
                ) : (
                  <form onSubmit={handleConvert} className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Utwórz ucznia
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Imię</label>
                        <input
                          type="text"
                          value={convertData.firstName}
                          onChange={(e) => setConvertData({ ...convertData, firstName: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                            convertErrors.firstName ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                          }`}
                        />
                        {convertErrors.firstName && <p className="mt-1 text-xs text-red-600">{convertErrors.firstName}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko</label>
                        <input
                          type="text"
                          value={convertData.lastName}
                          onChange={(e) => setConvertData({ ...convertData, lastName: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                            convertErrors.lastName ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                          }`}
                        />
                        {convertErrors.lastName && <p className="mt-1 text-xs text-red-600">{convertErrors.lastName}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={convertData.email}
                        onChange={(e) => setConvertData({ ...convertData, email: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                          convertErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                        }`}
                      />
                      {convertErrors.email && <p className="mt-1 text-xs text-red-600">{convertErrors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hasło</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={convertData.password}
                          onChange={(e) => setConvertData({ ...convertData, password: e.target.value })}
                          className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                            convertErrors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={handleCopyPassword}
                          className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                          title="Kopiuj hasło"
                        >
                          <Copy className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                      {convertErrors.password && <p className="mt-1 text-xs text-red-600">{convertErrors.password}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                        <input
                          type="tel"
                          value={convertData.phone || ''}
                          onChange={(e) => setConvertData({ ...convertData, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Poziom językowy</label>
                        <select
                          value={convertData.languageLevel || ''}
                          onChange={(e) => setConvertData({ ...convertData, languageLevel: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="">-- Wybierz --</option>
                          {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={convertMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50"
                      >
                        <UserPlus className="h-4 w-4" />
                        {convertMutation.isPending ? 'Tworzenie...' : 'Utwórz ucznia'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConvertForm(false)}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Anuluj
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationDetailsModal;
