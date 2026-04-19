import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';

const base64ToArrayBuffer = (base64: string) => {
  const binaryString =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

export async function pickLicensePdf(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

export async function uploadLicensePdf(
  userId: string,
  picked: DocumentPicker.DocumentPickerAsset
): Promise<{ path: string | null; error: string | null }> {
  const path = `${userId}/current.pdf`;
  try {
    const base64 = await FileSystem.readAsStringAsync(picked.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = base64ToArrayBuffer(base64);
    const { error } = await supabase.storage
      .from('licenses')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
    if (error) return { path: null, error: error.message };
    return { path, error: null };
  } catch (err) {
    return {
      path: null,
      error: err instanceof Error ? err.message : 'Upload nije uspeo.',
    };
  }
}

export async function saveUserLicense(params: {
  userId: string;
  validUntil: string | null;
  licenseFilePath: string | null;
  licenseNumber: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('upsert_user_license', {
    p_user_id: params.userId,
    p_valid_until: params.validUntil,
    p_license_file_path: params.licenseFilePath,
    p_license_number: params.licenseNumber,
  });
  if (!error) return { error: null };

  const payload: Record<string, unknown> = {
    user_id: params.userId,
    valid_until: params.validUntil,
    license_file_path: params.licenseFilePath,
  };
  if (params.licenseNumber != null) payload.license_number = params.licenseNumber;

  const { error: fallbackErr } = await supabase
    .from('user_licenses')
    .upsert(payload, { onConflict: 'user_id' });
  return { error: fallbackErr?.message ?? null };
}
