import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseService } from '../services/courseService';
import { lessonService } from '../services/lessonService';
import materialService from '../services/materialService';
import { FileText, Search, FolderOpen, Download, Trash2, Plus, Video, ExternalLink, BookOpen, GraduationCap } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import UploadMaterialModal from '../components/UploadMaterialModal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

type TabMode = 'course' | 'lesson';

const MaterialsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabMode>('course');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; materialId: string | null; isLesson: boolean }>({
    isOpen: false,
    materialId: null,
    isLesson: false,
  });

  // Fetch courses
  const { data: coursesResult } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseService.getCourses({ isActive: true, pageSize: 200 }),
  });
  const courses = coursesResult?.data ?? [];

  // Fetch all lessons for lesson selector
  const { data: lessonsResult } = useQuery({
    queryKey: ['lessons-all'],
    queryFn: () => lessonService.getLessons({ sortBy: 'scheduledAt', sortOrder: 'desc', pageSize: 500 }),
  });
  const lessons = lessonsResult?.data ?? [];

  // Fetch materials for selected course
  const { data: courseMaterials = [], isLoading: isLoadingCourse } = useQuery({
    queryKey: ['materials', selectedCourseId],
    queryFn: () => materialService.getMaterialsByCourse(selectedCourseId),
    enabled: !!selectedCourseId,
  });

  // Fetch materials for selected lesson
  const { data: lessonMaterials = [], isLoading: isLoadingLesson } = useQuery({
    queryKey: ['lesson-materials', selectedLessonId],
    queryFn: () => materialService.getMaterialsByLesson(selectedLessonId),
    enabled: !!selectedLessonId,
  });

  // Fetch completed lessons with recordings
  const { data: recordingsResult } = useQuery({
    queryKey: ['lessons-recordings'],
    queryFn: () =>
      lessonService.getLessons({
        status: 'COMPLETED',
        sortBy: 'scheduledAt',
        sortOrder: 'desc',
        pageSize: 500,
      }),
  });
  const lessonsWithRecordings = (recordingsResult?.data ?? []).filter((l) => l.recordingUrl);

  // Delete course material mutation
  const deleteCourseMutation = useMutation({
    mutationFn: (id: string) => materialService.deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Materiał został pomyślnie usunięty');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania materiału');
    },
  });

  // Delete lesson material mutation
  const deleteLessonMaterialMutation = useMutation({
    mutationFn: (id: string) => materialService.deleteLessonMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-materials'] });
      toast.success('Materiał został pomyślnie usunięty');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania materiału');
    },
  });

  const handleDelete = (id: string, isLesson: boolean) => {
    setConfirmDialog({ isOpen: true, materialId: id, isLesson });
  };

  const confirmDelete = async () => {
    if (!confirmDialog.materialId) return;
    if (confirmDialog.isLesson) {
      await deleteLessonMaterialMutation.mutateAsync(confirmDialog.materialId);
    } else {
      await deleteCourseMutation.mutateAsync(confirmDialog.materialId);
    }
    setConfirmDialog({ isOpen: false, materialId: null, isLesson: false });
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('video')) return '🎥';
    if (fileType.includes('audio')) return '🎵';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const activeCourseMaterials = courseMaterials.filter(m =>
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeLessonMaterials = lessonMaterials.filter(m =>
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLesson = lessons.find(l => l.id === selectedLessonId);

  const renderMaterialsList = (
    items: typeof courseMaterials,
    isLoading: boolean,
    isLesson: boolean,
    emptyLabel: string
  ) => {
    if (isLoading) return <LoadingSpinner message="Ładowanie materiałów..." />;
    if (items.length === 0) {
      return (
        <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Brak materiałów</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Nie znaleziono materiałów pasujących do wyszukiwania' : emptyLabel}
          </p>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="divide-y divide-gray-200">
          {items.map((material) => (
            <div key={material.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="text-4xl">{getFileIcon(material.file.fileType)}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{material.title}</h3>
                    {material.description && (
                      <p className="text-sm text-gray-600 mb-2">{material.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {material.file.fileName}
                      </span>
                      <span>{formatFileSize(material.file.fileSize)}</span>
                      <span>
                        Dodano przez: {material.file.uploader.firstName} {material.file.uploader.lastName}
                      </span>
                      <span>{new Date(material.createdAt).toLocaleDateString('pl-PL')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <a
                    href={material.file.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Pobierz"
                  >
                    <Download className="h-5 w-5" />
                  </a>
                  <button
                    onClick={() => handleDelete(material.id, isLesson)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Usuń"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Materiały</h1>
        <p className="mt-2 text-gray-600">Zarządzaj materiałami do zajęć</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => { setTab('course'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'course' ? 'bg-white text-secondary shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Materiały kursu
        </button>
        <button
          onClick={() => { setTab('lesson'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'lesson' ? 'bg-white text-secondary shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Materiały lekcji
        </button>
      </div>

      {tab === 'course' ? (
        <>
          {/* Course Selector & Search */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Wybierz kurs</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} - {course.language}
                  </option>
                ))}
              </select>
            </div>
            {selectedCourseId && (
              <>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Szukaj materiałów..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
                >
                  <Plus className="h-5 w-5" />
                  Dodaj materiał
                </button>
              </>
            )}
          </div>

          {!selectedCourseId ? (
            <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
              <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Wybierz kurs</h3>
              <p className="text-gray-600">Wybierz kurs z listy powyżej, aby zobaczyć materiały</p>
            </div>
          ) : (
            renderMaterialsList(activeCourseMaterials, isLoadingCourse, false, 'Ten kurs nie ma jeszcze żadnych materiałów')
          )}
        </>
      ) : (
        <>
          {/* Lesson Selector & Search */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Wybierz lekcję</option>
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title} — {lesson.student.user.firstName} {lesson.student.user.lastName} ({format(new Date(lesson.scheduledAt), 'dd.MM.yyyy', { locale: pl })})
                  </option>
                ))}
              </select>
            </div>
            {selectedLessonId && (
              <>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Szukaj materiałów..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
                >
                  <Plus className="h-5 w-5" />
                  Dodaj materiał
                </button>
              </>
            )}
          </div>

          {!selectedLessonId ? (
            <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
              <GraduationCap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Wybierz lekcję</h3>
              <p className="text-gray-600">Wybierz lekcję z listy powyżej, aby zobaczyć materiały</p>
            </div>
          ) : (
            renderMaterialsList(activeLessonMaterials, isLoadingLesson, true, 'Ta lekcja nie ma jeszcze żadnych materiałów')
          )}
        </>
      )}

      {/* Recordings Section */}
      {lessonsWithRecordings.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Video className="h-5 w-5 text-gray-600" />
            Nagrania z lekcji
          </h2>
          <div className="bg-white rounded-lg shadow border border-gray-200 divide-y divide-gray-200">
            {lessonsWithRecordings.map((lesson) => (
              <div key={lesson.id} className="p-5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{lesson.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {lesson.student.user.firstName} {lesson.student.user.lastName}
                    {' · '}
                    {lesson.teacher.user.firstName} {lesson.teacher.user.lastName}
                    {' · '}
                    {format(new Date(lesson.scheduledAt), 'dd MMM yyyy, HH:mm', { locale: pl })}
                  </div>
                </div>
                <a
                  href={lesson.recordingUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="h-4 w-4" />
                  Obejrzyj
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Material Modal */}
      {isUploadModalOpen && (
        tab === 'course' ? (
          <UploadMaterialModal
            courseId={selectedCourseId}
            courseName={courses.find(c => c.id === selectedCourseId)?.name || ''}
            onClose={() => setIsUploadModalOpen(false)}
            onSuccess={() => {
              setIsUploadModalOpen(false);
              queryClient.invalidateQueries({ queryKey: ['materials'] });
            }}
          />
        ) : (
          <UploadMaterialModal
            lessonId={selectedLessonId}
            lessonTitle={selectedLesson?.title}
            onClose={() => setIsUploadModalOpen(false)}
            onSuccess={() => {
              setIsUploadModalOpen(false);
              queryClient.invalidateQueries({ queryKey: ['lesson-materials'] });
            }}
          />
        )
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Usuń materiał"
        message="Czy na pewno chcesz usunąć ten materiał? Tej operacji nie można cofnąć."
        confirmText="Usuń"
        onConfirm={confirmDelete}
        onClose={() => setConfirmDialog({ isOpen: false, materialId: null, isLesson: false })}
        variant="danger"
      />
    </div>
  );
};

export default MaterialsPage;
