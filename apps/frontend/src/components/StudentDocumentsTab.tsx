import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Trash2,
  Eye,
  Download,
  Mail,
  FileText,
  Paperclip,
  File as FileIcon,
  X,
  Check,
  Archive,
} from 'lucide-react';
import toast from 'react-hot-toast';
import documentService, {
  StudentDocument,
  StudentDocumentType,
  DocumentStatus,
  UploadDocumentData,
} from '../services/documentService';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  studentId: string;
  studentEmail?: string;
}

const TYPE_LABELS: Record<StudentDocumentType, string> = {
  CONTRACT: 'Umowa',
  ATTACHMENT: 'Załącznik',
  OTHER: 'Inny',
};

const TYPE_COLORS: Record<StudentDocumentType, string> = {
  CONTRACT: 'bg-blue-100 text-blue-700',
  ATTACHMENT: 'bg-gray-100 text-gray-700',
  OTHER: 'bg-purple-100 text-purple-700',
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: 'Oczekuje',
  SENT: 'Wysłano',
  SIGNED: 'Podpisano',
  ARCHIVED: 'Zarchiwizowano',
};

const STATUS_COLORS: Record<DocumentStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SENT: 'bg-blue-100 text-blue-700',
  SIGNED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

const TYPE_ICONS: Record<StudentDocumentType, React.ReactNode> = {
  CONTRACT: <FileText className="w-4 h-4" />,
  ATTACHMENT: <Paperclip className="w-4 h-4" />,
  OTHER: <FileIcon className="w-4 h-4" />,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function StudentDocumentsTab({ studentId, studentEmail }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<StudentDocumentType>('ATTACHMENT');
  const [uploadNotes, setUploadNotes] = useState('');

  // Send email modal state
  const [sendModalDocId, setSendModalDocId] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState('');

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['student-documents', studentId],
    queryFn: () => documentService.getStudentDocuments(studentId),
    enabled: !!studentId,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, metadata }: { file: File; metadata: UploadDocumentData }) =>
      documentService.uploadDocument(studentId, file, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] });
      toast.success('Dokument przesłany pomyślnie');
      resetUploadModal();
    },
    onError: () => toast.error('Błąd podczas przesyłania dokumentu'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof documentService.updateDocument>[1] }) =>
      documentService.updateDocument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] });
      toast.success('Dokument zaktualizowany');
    },
    onError: () => toast.error('Błąd podczas aktualizacji dokumentu'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentService.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] });
      toast.success('Dokument usunięty');
      setDeleteConfirmId(null);
    },
    onError: () => toast.error('Błąd podczas usuwania dokumentu'),
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      documentService.sendDocument(id, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] });
      toast.success('Dokument wysłany mailem');
      setSendModalDocId(null);
    },
    onError: () => toast.error('Błąd podczas wysyłania dokumentu'),
  });

  function resetUploadModal() {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadName('');
    setUploadType('ATTACHMENT');
    setUploadNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    if (file && !uploadName) {
      // Pre-fill name from filename (without extension)
      setUploadName(file.name.replace(/\.[^/.]+$/, ''));
    }
  }

  function handleUploadSubmit() {
    if (!uploadFile || !uploadName.trim()) return;
    uploadMutation.mutate({
      file: uploadFile,
      metadata: {
        name: uploadName.trim(),
        type: uploadType,
        notes: uploadNotes.trim() || undefined,
      },
    });
  }

  function openSendModal(doc: StudentDocument) {
    setSendModalDocId(doc.id);
    setSendEmail(studentEmail ?? '');
  }

  function handleSendSubmit() {
    if (!sendModalDocId || !sendEmail.trim()) return;
    sendMutation.mutate({ id: sendModalDocId, email: sendEmail.trim() });
  }

  function handleStatusChange(doc: StudentDocument, status: DocumentStatus) {
    updateMutation.mutate({
      id: doc.id,
      data: {
        status,
        ...(status === 'SIGNED' ? { signedAt: new Date().toISOString() } : {}),
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Dokumenty ucznia</h3>
        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary/90 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Prześlij plik
        </button>
      </div>

      {/* Document list */}
      {!documents || documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
          <FileText className="w-10 h-10 mb-3 text-gray-300" />
          <p className="text-sm font-medium">Brak dokumentów</p>
          <p className="text-xs mt-1">Prześlij pierwszy plik klikając przycisk powyżej.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {/* Icon */}
              <div className="mt-0.5 text-gray-400 flex-shrink-0">
                {TYPE_ICONS[doc.type]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[doc.type]}`}>
                    {TYPE_LABELS[doc.type]}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[doc.status]}`}>
                    {STATUS_LABELS[doc.status]}
                  </span>
                  {doc.file && (
                    <span className="text-xs text-gray-400">
                      {doc.file.fileName} · {formatFileSize(doc.file.fileSize)}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
                </div>
                {doc.notes && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{doc.notes}</p>
                )}
                {doc.sentAt && (
                  <p className="text-xs text-gray-400 mt-0.5">Wysłano: {formatDate(doc.sentAt)}</p>
                )}
                {doc.signedAt && (
                  <p className="text-xs text-green-600 mt-0.5">Podpisano: {formatDate(doc.signedAt)}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {doc.file && (
                  <>
                    <a
                      href={doc.file.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                      title="Podgląd"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <a
                      href={doc.file.publicUrl}
                      download={doc.file.fileName}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                      title="Pobierz"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => openSendModal(doc)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                      title="Wyślij mailem"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </>
                )}
                {doc.status !== 'SIGNED' && doc.status !== 'ARCHIVED' && (
                  <button
                    onClick={() => handleStatusChange(doc, 'SIGNED')}
                    className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 transition-colors"
                    title="Oznacz jako podpisany"
                    disabled={updateMutation.isPending}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {doc.status !== 'ARCHIVED' && (
                  <button
                    onClick={() => handleStatusChange(doc, 'ARCHIVED')}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                    title="Archiwizuj"
                    disabled={updateMutation.isPending}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                {deleteConfirmId === doc.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors text-xs font-medium"
                    >
                      Usuń
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(doc.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                    title="Usuń"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-900">Prześlij dokument</h2>
              <button type="button" onClick={resetUploadModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* File picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plik <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                {uploadFile && (
                  <p className="mt-1 text-xs text-gray-500">
                    {uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nazwa dokumentu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="np. Umowa o naukę 2024"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as StudentDocumentType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="CONTRACT">Umowa</option>
                  <option value="ATTACHMENT">Załącznik</option>
                  <option value="OTHER">Inny</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notatki (opcjonalne)</label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={2}
                  placeholder="Dodatkowe informacje..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetUploadModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleUploadSubmit}
                  disabled={!uploadFile || !uploadName.trim() || uploadMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploadMutation.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Prześlij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send email modal */}
      {sendModalDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-900">Wyślij dokument mailem</h2>
              <button type="button" onClick={() => setSendModalDocId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adres e-mail odbiorcy <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSendModalDocId(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleSendSubmit}
                  disabled={!sendEmail.trim() || sendMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendMutation.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Wyślij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
