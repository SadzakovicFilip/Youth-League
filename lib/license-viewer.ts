import { Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { supabase } from '@/lib/supabase';

function stringifyError(err: unknown): string {
  if (!err) return 'null';
  if (err instanceof Error) {
    return JSON.stringify(
      {
        name: err.name,
        message: err.message,
      },
      null,
      2
    );
  }
  try {
    return JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2);
  } catch {
    return String(err);
  }
}

function localFileName(filePath: string): string {
  const slug = filePath.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `license_${slug}.pdf`;
}

async function requestSignedUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('get-license-signed-url', {
    body: { file_path: filePath },
  });
  if (error) {
    Alert.alert('Greska', `Nije moguce otvoriti PDF.\n\nRAW:\n${stringifyError(error)}`);
    return null;
  }
  const url = (data as { signed_url?: string } | null)?.signed_url;
  if (!url) {
    Alert.alert('Greska', 'Server nije vratio link za PDF.');
    return null;
  }
  return url;
}

export async function openLicensePdf(filePath: string | null | undefined) {
  if (!filePath) {
    Alert.alert('Licenca', 'PDF nije uploadovan za ovog korisnika.');
    return;
  }

  try {
    const signedUrl = await requestSignedUrl(filePath);
    if (!signedUrl) return;

    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      await fallbackToBrowser(signedUrl);
      return;
    }

    const targetPath = `${cacheDir}${localFileName(filePath)}`;

    try {
      const info = await FileSystem.getInfoAsync(targetPath);
      if (info.exists) {
        await FileSystem.deleteAsync(targetPath, { idempotent: true });
      }
    } catch {
      // ignore cleanup errors
    }

    const download = await FileSystem.downloadAsync(signedUrl, targetPath);
    if (download.status !== 200) {
      Alert.alert('Greska', `Download PDF-a nije uspeo (status ${download.status}).`);
      return;
    }

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(download.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Otvori licencu',
        UTI: 'com.adobe.pdf',
      });
      return;
    }

    await fallbackToBrowser(signedUrl);
  } catch (err) {
    Alert.alert('Greska', stringifyError(err));
  }
}

async function fallbackToBrowser(url: string) {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Greska', 'Uredjaj ne moze da otvori ovaj link.');
      return;
    }
    await Linking.openURL(url);
  } catch (err) {
    Alert.alert('Greska', stringifyError(err));
  }
}
