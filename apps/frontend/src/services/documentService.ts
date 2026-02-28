import api from '../lib/api';

export type StudentDocumentType = 'CONTRACT' | 'ATTACHMENT' | 'OTHER';
export type DocumentStatus = 'PENDING' | 'SENT' | 'SIGNED' | 'ARCHIVED';

export interface StudentDocumentFile {
  id: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface StudentDocument {
  id: string;
  organizationId: string;
  studentId: string;
  fileId: string | null;
  name: string;
  type: StudentDocumentType;
  status: DocumentStatus;
  notes: string | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
  file: StudentDocumentFile | null;
}

export interface UploadDocumentData {
  name: string;
  type?: StudentDocumentType;
  notes?: string;
}

export interface UpdateDocumentData {
  status?: DocumentStatus;
  notes?: string;
  signedAt?: string | null;
}

const documentService = {
  async getStudentDocuments(studentId: string): Promise<StudentDocument[]> {
    const response = await api.get(`/documents/student/${studentId}`) as any;
    return response.data.data;
  },

  async uploadDocument(
    studentId: string,
    file: File,
    metadata: UploadDocumentData
  ): Promise<StudentDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', metadata.name);
    if (metadata.type) formData.append('type', metadata.type);
    if (metadata.notes) formData.append('notes', metadata.notes);

    const response = await api.post(`/documents/student/${studentId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }) as any;
    return response.data.data;
  },

  async updateDocument(id: string, data: UpdateDocumentData): Promise<StudentDocument> {
    const response = await api.patch(`/documents/${id}`, data) as any;
    return response.data.data;
  },

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },

  async sendDocument(id: string, email: string): Promise<StudentDocument> {
    const response = await api.post(`/documents/${id}/send`, { email }) as any;
    return response.data.data;
  },
};

export default documentService;
