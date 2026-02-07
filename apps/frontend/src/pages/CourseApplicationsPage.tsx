import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import courseApplicationService, { CourseApplication } from '../services/courseApplicationService';
import { useAuthStore } from '../stores/authStore';
import { Search, MoreVertical, Link2, ClipboardList } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Dropdown from '../components/Dropdown';
import ApplicationDetailsModal from '../components/ApplicationDetailsModal';

type StatusFilter = 'NEW' | 'ACCEPTED' | 'REJECTED' | 'ALL';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Nowe', value: 'NEW' },
  { label: 'Zaakceptowane', value: 'ACCEPTED' },
  { label: 'Odrzucone', value: 'REJECTED' },
  { label: 'Wszystkie', value: 'ALL' },
];

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

const CourseApplicationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('NEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<CourseApplication | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ isOpen: boolean; applicationId: string | null }>({ isOpen: false, applicationId: null });
  const [acceptDialog, setAcceptDialog] = useState<{ isOpen: boolean; applicationId: string | null }>({ isOpen: false, applicationId: null });
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const orgSlug = user?.organization?.slug;

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications', statusFilter === 'ALL' ? undefined : statusFilter, searchTerm],
    queryFn: () =>
      courseApplicationService.getApplications({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchTerm || undefined,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, internalNotes }: { id: string; status: string; internalNotes?: string }) =>
      courseApplicationService.updateStatus(id, status, internalNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  const handleCopyLink = () => {
    if (!orgSlug) {
      toast.error('Brak slug organizacji');
      return;
    }
    const url = `${window.location.origin}/apply/${orgSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link do formularza skopiowany!');
    });
  };

  const handleAccept = (id: string) => {
    setAcceptDialog({ isOpen: true, applicationId: id });
  };

  const confirmAccept = async () => {
    if (acceptDialog.applicationId) {
      await updateStatusMutation.mutateAsync({ id: acceptDialog.applicationId, status: 'ACCEPTED' });
      toast.success('Zgłoszenie zaakceptowane');
    }
  };

  const handleReject = (id: string) => {
    setRejectDialog({ isOpen: true, applicationId: id });
  };

  const confirmReject = async () => {
    if (rejectDialog.applicationId) {
      await updateStatusMutation.mutateAsync({ id: rejectDialog.applicationId, status: 'REJECTED' });
      toast.success('Zgłoszenie odrzucone');
    }
  };

  const handleViewDetails = (application: CourseApplication) => {
    setSelectedApplication(application);
    setIsDetailsOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Zgłoszenia na kursy</h1>
          <p className="mt-2 text-gray-600">
            Zarządzaj zgłoszeniami z formularza zapisu ({applications.length})
          </p>
        </div>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm"
        >
          <Link2 className="h-5 w-5" />
          Kopiuj link formularza
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-6">
        {/* Status tabs */}
        <div className="flex gap-2 mb-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === tab.value
                  ? 'bg-secondary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj po imieniu lub emailu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Ładowanie zgłoszeń..." />
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            {searchTerm ? 'Nie znaleziono zgłoszeń' : 'Brak zgłoszeń w tej kategorii'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imię i nazwisko
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kontakt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kurs / Preferencje
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{app.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{app.email}</div>
                      {app.phone && <div className="text-gray-400">{app.phone}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {app.course ? (
                        <span className="font-medium text-gray-700">
                          {app.course.name} ({app.course.level})
                        </span>
                      ) : app.preferences ? (
                        <span className="italic">{app.preferences}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(app.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_BADGE[app.status]}`}
                      >
                        {STATUS_LABEL[app.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        ref={(el) => {
                          if (el) {
                            dropdownTriggerRefs.current.set(app.id, el);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === app.id ? null : app.id);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Akcje"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-600" />
                      </button>
                      <Dropdown
                        isOpen={openDropdownId === app.id}
                        onClose={() => setOpenDropdownId(null)}
                        triggerRef={{ current: dropdownTriggerRefs.current.get(app.id) || null }}
                        items={[
                          {
                            label: 'Podgląd',
                            onClick: () => handleViewDetails(app),
                          },
                          ...(app.status === 'NEW'
                            ? [
                                {
                                  label: 'Zaakceptuj',
                                  onClick: () => handleAccept(app.id),
                                },
                                {
                                  label: 'Odrzuć',
                                  onClick: () => handleReject(app.id),
                                  variant: 'danger' as const,
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Accept Confirm Dialog */}
      <ConfirmDialog
        isOpen={acceptDialog.isOpen}
        onClose={() => setAcceptDialog({ isOpen: false, applicationId: null })}
        onConfirm={confirmAccept}
        title="Zaakceptuj zgłoszenie"
        message="Czy na pewno chcesz zaakceptować to zgłoszenie?"
        confirmText="Zaakceptuj"
        cancelText="Anuluj"
        variant="info"
      />

      {/* Reject Confirm Dialog */}
      <ConfirmDialog
        isOpen={rejectDialog.isOpen}
        onClose={() => setRejectDialog({ isOpen: false, applicationId: null })}
        onConfirm={confirmReject}
        title="Odrzuć zgłoszenie"
        message="Czy na pewno chcesz odrzucić to zgłoszenie?"
        confirmText="Odrzuć"
        cancelText="Anuluj"
        variant="danger"
      />

      {/* Details Modal */}
      {isDetailsOpen && selectedApplication && (
        <ApplicationDetailsModal
          application={selectedApplication}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedApplication(null);
          }}
          onStatusChange={() => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
          }}
        />
      )}
    </div>
  );
};

export default CourseApplicationsPage;
