import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

// Abre el picker nativo/web, sube la imagen elegida a un bucket público de
// Storage en una ruta fija (upsert=true así siempre pisa la anterior) y
// devuelve la URL pública lista para guardar — usado por la foto de familia
// (family.tsx) y el fondo del login (branding.tsx). Devuelve null si el
// usuario canceló o si algo falló.
export async function pickAndUploadImage(bucket: string, path: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  const blob = await response.blob();

  const { error } = await supabase!.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: asset.mimeType ?? blob.type ?? 'image/jpeg',
  });
  if (error) return null;

  const { data } = supabase!.storage.from(bucket).getPublicUrl(path);
  // Rompe la caché del navegador — la ruta es fija (mismo nombre siempre),
  // así que sin esto una foto nueva no se vería hasta un hard-refresh.
  return `${data.publicUrl}?v=${Date.now()}`;
}
