import { api, unwrap } from './client';
import type { Media } from './types/media';

/** POST /media/upload — multipart, maydon nomi `file` (masalan, texpasport surati uchun). */
export async function uploadMedia(file: File): Promise<Media> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/media/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<Media>(res);
}
