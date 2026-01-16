import api from '../lib/api';

export interface File {
  id: string;
  organizationId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  publicUrl: string;
  uploadedBy: string;
  relatedToType?: string;
  relatedToId?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  uploader: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface CreateFileData {
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  relatedToType?: string;
  relatedToId?: string;
  isPublic?: boolean;
}

const fileService = {
  async getFiles(filters?: {
    relatedToType?: string;
    relatedToId?: string;
  }): Promise<File[]> {
    const response = await api.get('/files', { params: filters }) as any;
    return response.data.data;
  },

  async getFileById(id: string): Promise<File> {
    const response = await api.get(`/files/${id}`) as any;
    return response.data.data;
  },

  async uploadFile(
    file: globalThis.File,
    metadata?: {
      relatedToType?: string;
      relatedToId?: string;
      isPublic?: boolean;
    }
  ): Promise<File> {
    const formData = new FormData();
    formData.append('file', file);

    if (metadata?.relatedToType) {
      formData.append('relatedToType', metadata.relatedToType);
    }
    if (metadata?.relatedToId) {
      formData.append('relatedToId', metadata.relatedToId);
    }
    if (metadata?.isPublic !== undefined) {
      formData.append('isPublic', String(metadata.isPublic));
    }

    const response = await api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }) as any;
    return response.data.data;
  },

  async createFile(data: CreateFileData): Promise<File> {
    const response = await api.post('/files', data) as any;
    return response.data.data;
  },

  async deleteFile(id: string): Promise<void> {
    await api.delete(`/files/${id}`);
  },
};

export default fileService;
