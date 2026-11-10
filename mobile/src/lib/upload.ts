import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

// entry_pages.page_index allows 0–9.
export const MAX_PAGES = 10;
const LONG_EDGE = 2048;

export type CapturedPage = { key: string; uri: string };

// Long edge at most 2048 px, JPEG at 0.8. Re-encoding also drops the photo's metadata (EXIF,
// including any location).
async function preparePage(uri: string): Promise<ArrayBuffer> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const scale = Math.min(1, LONG_EDGE / Math.max(original.width, original.height));
  const context = ImageManipulator.manipulate(original);
  if (scale < 1) {
    if (original.width >= original.height) context.resize({ width: Math.round(original.width * scale) });
    else context.resize({ height: Math.round(original.height * scale) });
  }
  const image = await context.renderAsync();
  try {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
    if (!saved.base64) throw new Error('The photo could not be encoded');
    return base64ToArrayBuffer(saved.base64);
  } finally {
    image.release();
    original.release();
  }
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// A retried upload finds the photo it already stored.
function alreadyStored(error: unknown): boolean {
  const e = error as { statusCode?: string | number; status?: number; message?: string };
  return String(e.statusCode ?? e.status ?? '') === '409' || /already exists/i.test(e.message ?? '');
}

type UploadArgs = {
  userId: string;
  pages: CapturedPage[];
  promptId: number | null;
  justListen: boolean;
  // Set after a failed attempt with the same pages, so a retry continues that entry.
  entryId: string | null;
  onEntryCreated: (id: string) => void;
  onProgress: (saved: number, total: number) => void;
};

// Creates the entry, stores each page photo and its row, then marks the entry uploaded (which
// numbers it and counts it for the streak). Returns the entry id.
export async function uploadEntry({ userId, pages, promptId, justListen, entryId, onEntryCreated, onProgress }: UploadArgs): Promise<string> {
  let id = entryId;
  if (!id) {
    const { data, error } = await supabase.from('entries').insert({ prompt_id: promptId, just_listen: justListen }).select('id').single();
    if (error) throw error;
    id = data.id;
    onEntryCreated(id);
  }

  onProgress(0, pages.length);
  for (const [index, page] of pages.entries()) {
    const path = `${userId}/${id}/${index}.jpg`;
    const body = await preparePage(page.uri);
    const upload = await supabase.storage.from('pages').upload(path, body, { contentType: 'image/jpeg' });
    if (upload.error && !alreadyStored(upload.error)) throw upload.error;

    const row = await supabase
      .from('entry_pages')
      .upsert({ entry_id: id, page_index: index, storage_path: path }, { onConflict: 'entry_id,page_index', ignoreDuplicates: true });
    if (row.error) throw row.error;
    onProgress(index + 1, pages.length);
  }

  const { error } = await supabase.rpc('complete_entry_upload', { p_entry_id: id });
  if (error) throw error;
  return id;
}

export function uploadErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  if (/fetch|network|timed? ?out/i.test(message)) return 'Couldn’t reach Jourme. Check your connection and try again.';
  return 'Couldn’t save your pages. Please try again.';
}
