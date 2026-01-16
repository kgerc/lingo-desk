import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseService, Course } from '../services/courseService';
import { Plus, Search, Users, BookOpen, Calendar, MapPin, Wifi, Home } from 'lucide-react';
import CourseModal from '../components/CourseModal';
//import EnrollStudentModal from '../components/EnrollStudentModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
//import Dropdown from '../components/Dropdown';

const GroupsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Course | null>(null);
  //const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  //const [groupForEnrollment, setGroupForEnrollment] = useState<Course | null>(null);
  //const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; groupId: string | null }>({ isOpen: false, groupId: null });
  //const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Fetch only group courses
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups', searchTerm],
    queryFn: async () => {
      const allCourses = await courseService.getCourses({ search: searchTerm });
      // Filter only GROUP format courses
      return allCourses.filter((course) => course.courseType.format === 'GROUP');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => courseService.deleteCourse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Grupa została pomyślnie usunięta');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania grupy');
    },
  });

  // const handleEdit = (group: Course) => {
  //   setSelectedGroup(group);
  //   setIsModalOpen(true);
  // };

  // const handleDelete = (id: string) => {
  //   setConfirmDialog({ isOpen: true, groupId: id });
  // };

  const confirmDelete = async () => {
    if (confirmDialog.groupId) {
      await deleteMutation.mutateAsync(confirmDialog.groupId);
      setConfirmDialog({ isOpen: false, groupId: null });
    }
  };

  // const handleManageStudents = (group: Course) => {
  //   //setGroupForEnrollment(group);
  //   //setIsEnrollModalOpen(true);
  // };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedGroup(null);
  };

  // const handleCloseEnrollModal = () => {
  //   //setIsEnrollModalOpen(false);
  //   //setGroupForEnrollment(null);
  // };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
    handleCloseModal();
  };

  const getLanguageLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      A1: 'bg-green-100 text-green-800',
      A2: 'bg-green-200 text-green-900',
      B1: 'bg-blue-100 text-blue-800',
      B2: 'bg-blue-200 text-blue-900',
      C1: 'bg-purple-100 text-purple-800',
      C2: 'bg-purple-200 text-purple-900',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[level] || 'bg-gray-100 text-gray-800'}`}>
        {level}
      </span>
    );
  };

  const getDeliveryModeIcon = (mode: string) => {
    switch (mode) {
      case 'ONLINE':
        return <Wifi className="h-4 w-4 text-blue-600" />;
      case 'IN_PERSON':
        return <Home className="h-4 w-4 text-green-600" />;
      case 'BOTH':
        return <MapPin className="h-4 w-4 text-purple-600" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Ładowanie grup..." />;
  }

  const filteredGroups = groups;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Grupy</h1>
        <p className="mt-2 text-gray-600">Zarządzaj grupami zajęciowymi</p>
      </div>

      {/* Filters and Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj grup..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Add Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="h-5 w-5" />
          Dodaj grupę
        </button>
      </div>

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Brak grup</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? 'Nie znaleziono grup pasujących do wyszukiwania' : 'Zacznij od utworzenia pierwszej grupy'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Dodaj grupę
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-lg shadow border border-gray-200 hover:shadow-lg transition-shadow p-6"
            >
              {/* Header with dropdown */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{group.name}</h3>
                  <p className="text-sm text-gray-600">{group.courseType.name}</p>
                </div>

                {/* Dropdown */}
                {/* <Dropdown
                  isOpen={openDropdownId === group.id}
                  onOpenChange={(isOpen: any) => setOpenDropdownId(isOpen ? group.id : null)}
                  trigger={
                    <button
                      ref={(el) => {
                        if (el) dropdownTriggerRefs.current.set(group.id, el);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  }
                  triggerRef={dropdownTriggerRefs.current.get(group.id) || null}
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleEdit(group);
                        setOpenDropdownId(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                      <Edit className="h-4 w-4" />
                      Edytuj
                    </button>
                    <button
                      onClick={() => {
                        handleManageStudents(group);
                        setOpenDropdownId(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                      <UserPlus className="h-4 w-4" />
                      Zarządzaj uczniami
                    </button>
                    <button
                      onClick={() => {
                        handleDelete(group.id);
                        setOpenDropdownId(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <Trash2 className="h-4 w-4" />
                      Usuń
                    </button>
                  </div>
                </Dropdown> */}
              </div>

              {/* Course Details */}
              <div className="space-y-3 mb-4">
                {/* Language & Level */}
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{group.courseType.language}</span>
                  {getLanguageLevelBadge(group.courseType.level)}
                </div>

                {/* Teacher */}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {group.teacher.user.firstName} {group.teacher.user.lastName}
                  </span>
                </div>

                {/* Students count */}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {group.currentStudentsCount} / {group.maxStudents || '∞'} uczniów
                  </span>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {new Date(group.startDate).toLocaleDateString('pl-PL')}
                    {group.endDate && ` - ${new Date(group.endDate).toLocaleDateString('pl-PL')}`}
                  </span>
                </div>

                {/* Delivery Mode */}
                <div className="flex items-center gap-2">
                  {getDeliveryModeIcon(group.courseType.deliveryMode)}
                  <span className="text-sm text-gray-600">
                    {group.courseType.deliveryMode === 'ONLINE'
                      ? 'Online'
                      : group.courseType.deliveryMode === 'IN_PERSON'
                      ? 'Stacjonarnie'
                      : 'Hybrydowo'}
                  </span>
                </div>

                {/* Location */}
                {/* {group.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{group.location.name}</span>
                  </div>
                )} */}
              </div>

              {/* Status Badge */}
              <div className="pt-3 border-t border-gray-200">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    group.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {group.isActive ? 'Aktywna' : 'Nieaktywna'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Course Modal */}
      {isModalOpen && (
        <CourseModal
          course={selectedGroup}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}

      {/* Enroll Student Modal */}
      {/* {isEnrollModalOpen && groupForEnrollment && (
        <EnrollStudentModal
          course={groupForEnrollment}
          onClose={handleCloseEnrollModal}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            handleCloseEnrollModal();
          }}
        />
      )} */}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Usuń grupę"
        message="Czy na pewno chcesz usunąć tę grupę? Tej operacji nie można cofnąć."
        confirmText="Usuń"
        onConfirm={confirmDelete}
        onClose={() => setConfirmDialog({ isOpen: false, groupId: null })}
        variant="danger"
      />
    </div>
  );
};

export default GroupsPage;
