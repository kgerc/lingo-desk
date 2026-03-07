import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase credentials not configured. File upload will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const STORAGE_BUCKET = 'course-materials';
export const LOGOS_BUCKET = 'org-logos';

/**
 * Initialize Supabase storage bucket if it doesn't exist
 */
export async function initializeStorage() {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    const bucketExists = buckets?.some(bucket => bucket.name === STORAGE_BUCKET);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/webm',
          'audio/mpeg',
          'audio/wav',
          'application/zip',
          'text/plain',
        ],
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
      } else {
        console.log('✅ Supabase storage bucket created successfully');
      }
    } else {
      console.log('✅ Supabase storage bucket already exists');
    }
  } catch (error) {
    console.error('Error initializing Supabase storage:', error);
  }
}

/**
 * Initialize org-logos bucket (public)
 */
export async function initializeLogosBucket() {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) return;
    const exists = buckets?.some(b => b.name === LOGOS_BUCKET);
    if (!exists) {
      await supabase.storage.createBucket(LOGOS_BUCKET, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
      });
      console.log('✅ Supabase org-logos bucket created');
    }
  } catch (error) {
    console.error('Error initializing org-logos bucket:', error);
  }
}

/**
 * Upload organization logo to Supabase Storage
 */
export async function uploadOrgLogo(
  file: Buffer,
  organizationId: string,
  contentType: string
): Promise<{ path: string; publicUrl: string }> {
  const ext = contentType.split('/')[1] || 'png';
  const filePath = `${organizationId}/logo.${ext}`;

  const { error } = await supabase.storage
    .from(LOGOS_BUCKET)
    .upload(filePath, file, { contentType, upsert: true });

  if (error) throw new Error(`Logo upload failed: ${error.message}`);

  const { data } = supabase.storage.from(LOGOS_BUCKET).getPublicUrl(filePath);
  return { path: filePath, publicUrl: `${data.publicUrl}?t=${Date.now()}` };
}

/**
 * Delete organization logo from Supabase Storage
 */
export async function deleteOrgLogo(filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(LOGOS_BUCKET).remove([filePath]);
  if (error) throw new Error(`Logo delete failed: ${error.message}`);
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  file: Buffer,
  fileName: string,
  organizationId: string,
  contentType: string
): Promise<{ path: string; publicUrl: string }> {
  const filePath = `${organizationId}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: data.publicUrl,
  };
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([filePath]);

  if (error) {
    console.error('Error deleting file from Supabase:', error);
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Get signed URL for private file access
 */
export async function getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}
