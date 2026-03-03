import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { teacherService, Teacher } from '../services/teacherService';
import { Plus, Mail, Phone, BookOpen, Calendar, MoreVertical, Users, Wallet, Trash2, Loader2, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import TeacherModal from '../components/TeacherModal';
import TeacherPayoutsTab from '../components/TeacherPayoutsTab';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Dropdown from '../components/Dropdown';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';

type TabType = 'list' | 'payouts';

const TeachersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'lastName' | 'hourlyRate' | 'createdAt' | 'email'>('lastName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; teacherId: string | null }>({ isOpen: false, teacherId: null });
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Fetch teachers (all filters and sorting server-side)
  const { data: teachersResult, isLoading } = useQuery({
    queryKey: ['teachers', searchTerm, filterValues, sortBy, sortOrder, page, pageSize],
    queryFn: () => teacherService.getTeachers({
      search: searchTerm || undefined,
      isActive: filterValues['isActive'] === 'true' ? true : filterValues['isActive'] === 'false' ? false : undefined,
      contractType: filterValues['contractType'] as 'B2B' | 'EMPLOYMENT' | 'CIVIL' | undefined || undefined,
      language: filterValues['language'] || undefined,
      hourlyRateMin: filterValues['hourlyRateMin'] !== '' && filterValues['hourlyRateMin'] !== undefined ? Number(filterValues['hourlyRateMin']) : undefined,
      hourlyRateMax: filterValues['hourlyRateMax'] !== '' && filterValues['hourlyRateMax'] !== undefined ? Number(filterValues['hourlyRateMax']) : undefined,
      sortBy,
      sortOrder,
      page,
      pageSize,
    }),
    enabled: activeTab === 'list',
  });

  const teachers = teachersResult?.data ?? [];
  const teachersPagination = teachersResult?.pagination;

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => teacherService.bulkDeleteTeachers(ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setSelectedIds(new Set());
      if (result.failed === 0) {
        toast.success(`Usunięto ${result.deleted} lektorów`);
      } else {
        toast.error(`Usunięto ${result.deleted}, błędy: ${result.failed}`);
      }
    },
    onError: () => {
      toast.error('Błąd podczas usuwania lektorów');
    },
  });

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === teachers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(teachers.map((t) => t.id)));
    }
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => teacherService.deleteTeacher(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast.success('Lektor został pomyślnie usunięty');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania lektora');
    },
  });

  const handleEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, teacherId: id });
  };

  const confirmDelete = async () => {
    if (confirmDialog.teacherId) {
      await deleteMutation.mutateAsync(confirmDialog.teacherId);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTeacher(null);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['teachers'] });
    handleCloseModal();
  };

  const getContractTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      B2B: 'bg-blue-100 text-blue-800',
      EMPLOYMENT: 'bg-green-100 text-green-800',
      CIVIL: 'bg-purple-100 text-purple-800',
    };

    const labels: Record<string, string> = {
      B2B: 'B2B',
      EMPLOYMENT: 'Umowa o pracę',
      CIVIL: 'Umowa cywilna',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
        {labels[type] || type}
      </span>
    );
  };

  const tabs = [
    { id: 'list' as TabType, name: 'Lista lektorów', icon: Users },
    { id: 'payouts' as TabType, name: 'Wypłaty', icon: Wallet },
  ];

  const allSelected = teachers.length > 0 && selectedIds.size === teachers.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleSort = (column: 'lastName' | 'hourlyRate' | 'createdAt' | 'email') => {
    if (sortBy === column) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ column }: { column: 'lastName' | 'hourlyRate' | 'createdAt' | 'email' }) => {
    if (sortBy !== column) return <ChevronsUpDown className="inline ml-1 h-3.5 w-3.5 text-gray-400" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="inline ml-1 h-3.5 w-3.5 text-primary" />
      : <ChevronDown className="inline ml-1 h-3.5 w-3.5 text-primary" />;
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lektorzy</h1>
          <p className="mt-2 text-gray-600">
            Zarządzaj lektorami i ich wypłatami
          </p>
        </div>
        {activeTab === 'list' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Dodaj lektora
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'list' && (
        <>
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={(v) => { setSearchTerm(v); setPage(1); }}
            searchPlaceholder="Szukaj lektora po imieniu, nazwisku lub emailu..."
            filters={[
              {
                key: 'isActive',
                label: 'Status',
                type: 'select',
                options: [
                  { value: 'true', label: 'Aktywny' },
                  { value: 'false', label: 'Nieaktywny' },
                ],
              },
              { key: 'contractType', label: 'Typ umowy', type: 'select', options: [
                { value: 'B2B', label: 'B2B' },
                { value: 'EMPLOYMENT', label: 'Umowa o pracę' },
                { value: 'CIVIL', label: 'Umowa cywilna' },
              ]},
              { key: 'language', label: 'Język', type: 'text', placeholder: 'np. angielski' },
              { key: 'hourlyRateMin', label: 'Stawka od (PLN/h)', type: 'number', placeholder: 'np. 50' },
              { key: 'hourlyRateMax', label: 'Stawka do (PLN/h)', type: 'number', placeholder: 'np. 150' },
            ]}
            filterValues={filterValues}
            onFilterChange={(key, value) => { setFilterValues((prev) => ({ ...prev, [key]: value })); setPage(1); }}
            onClearAll={() => { setSearchTerm(''); setFilterValues({}); setSortBy('lastName'); setSortOrder('asc'); setPage(1); }}
            filterCols={5}
          />

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 px-4 py-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-blue-800">
                Zaznaczono {selectedIds.size} {selectedIds.size === 1 ? 'lektora' : selectedIds.size < 5 ? 'lektorów' : 'lektorów'}
              </span>
              <button
                onClick={() => setBulkConfirmOpen(true)}
                disabled={bulkDeleteMutation.isPending}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Usuń zaznaczonych
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-blue-600 hover:underline"
              >
                Odznacz wszystkich
              </button>
            </div>
          )}

          {/* Teachers Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            {isLoading ? (
              <LoadingSpinner message="Ładowanie lektorów..." />
            ) : teachers.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {searchTerm ? 'Nie znaleziono lektorów' : 'Brak lektorów. Dodaj pierwszego lektora!'}
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected; }}
                          onChange={handleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                        onClick={() => handleSort('lastName')}
                      >
                        Lektor <SortIcon column="lastName" />
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                        onClick={() => handleSort('email')}
                      >
                        Kontakt <SortIcon column="email" />
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                        onClick={() => handleSort('hourlyRate')}
                      >
                        Stawka <SortIcon column="hourlyRate" />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Typ umowy
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Języki
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aktywność
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
                    {teachers.map((teacher) => {
                      const isSelected = selectedIds.has(teacher.id);
                      return (
                      <tr key={teacher.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                        <td className="w-10 px-4 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggle(teacher.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold">
                                {teacher.user.firstName[0]}
                                {teacher.user.lastName[0]}
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {teacher.user.firstName} {teacher.user.lastName}
                              </div>
                              {teacher.specializations.length > 0 && (
                                <div className="text-xs text-gray-500">
                                  {teacher.specializations.slice(0, 2).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {teacher.user.email}
                            </div>
                            {teacher.user.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {teacher.user.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="font-medium text-gray-900">{teacher.hourlyRate} PLN/h</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {teacher.contractType != null ? getContractTypeBadge(teacher.contractType) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {teacher.languages.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {teacher.languages.slice(0, 3).map((lang, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                                >
                                  {lang}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {teacher._count ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-gray-600">
                                <BookOpen className="h-3 w-3" />
                                {teacher._count.courses} kursów
                              </div>
                              <div className="flex items-center gap-1 text-gray-600">
                                <Calendar className="h-3 w-3" />
                                {teacher._count.lessons} zajęć
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                teacher.user.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {teacher.user.isActive ? 'Aktywny' : 'Nieaktywny'}
                            </span>
                            {teacher.isAvailableForBooking && (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                Dostępny
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            ref={(el) => {
                              if (el) {
                                dropdownTriggerRefs.current.set(teacher.id, el);
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === teacher.id ? null : teacher.id);
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Więcej opcji"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600" />
                          </button>
                          <Dropdown
                            isOpen={openDropdownId === teacher.id}
                            onClose={() => setOpenDropdownId(null)}
                            triggerRef={{ current: dropdownTriggerRefs.current.get(teacher.id) || null }}
                            items={[
                              {
                                label: 'Edytuj lektora',
                                onClick: () => handleEdit(teacher),
                              },
                              {
                                label: 'Usuń lektora',
                                onClick: () => handleDelete(teacher.id),
                                variant: 'danger',
                              },
                            ]}
                          />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {teachersPagination && teachersPagination.totalPages > 1 && (
                <Pagination
                  page={teachersPagination.page}
                  totalPages={teachersPagination.totalPages}
                  pageSize={teachersPagination.pageSize}
                  total={teachersPagination.total}
                  onPageChange={setPage}
                  onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
                  isLoading={isLoading}
                />
              )}
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'payouts' && <TeacherPayoutsTab />}

      {/* Modal */}
      {isModalOpen && (
        <TeacherModal
          teacher={selectedTeacher}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, teacherId: null })}
        onConfirm={confirmDelete}
        title="Usuń lektora"
        message="Czy na pewno chcesz usunąć tego lektora? Ta operacja jest nieodwracalna."
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />

      {/* Confirm Bulk Delete Dialog */}
      <ConfirmDialog
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        title="Usuń zaznaczonych lektorów"
        message={`Czy na pewno chcesz usunąć ${selectedIds.size} zaznaczonych lektorów? Ta operacja jest nieodwracalna.`}
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />
    </div>
  );
};

export default TeachersPage;
