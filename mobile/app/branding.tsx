import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LoginBackdrop } from '../src/components/LoginBackdrop';
import { SeedGrowthIntro } from '../src/components/SeedGrowthIntro';
import { Card, PrimaryButton, Screen, SectionTitle } from '../src/components/ui';
import { pickAndUploadImage } from '../src/lib/imageUpload';
import { notify } from '../src/lib/confirm';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { colors, fonts, radius, spacing } from '../src/theme';

// Debe coincidir con el default de LoginBackdrop.tsx — este es el fallback
// que ve un admin que nunca guardó un degradado propio.
const DEFAULT_COLORS = ['#3D4A34', '#1A3D33', '#123F37'];
const DEFAULT_LOCATIONS = [0, 0.55, 1];

export default function BrandingScreen() {
  const [gradientColors, setGradientColors] = useState<string[]>(DEFAULT_COLORS);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase!
      .from('login_branding')
      .select('background_image_url, gradient_colors')
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.gradient_colors?.length) setGradientColors(data.gradient_colors);
        setBackgroundImageUrl(data.background_image_url ?? null);
      });
  }, []);

  const save = async () => {
    if (!isSupabaseConfigured) {
      notify('Solo en modo Supabase', 'En este ambiente de pruebas local no hay dónde guardar la apariencia — usa "Ver animación" para previsualizar.');
      return;
    }
    setSaving(true);
    const { error } = await supabase!.rpc('save_login_branding', {
      new_background_image_url: backgroundImageUrl,
      new_gradient_colors: gradientColors,
      new_gradient_locations: DEFAULT_LOCATIONS,
    });
    setSaving(false);
    if (error) {
      notify('No se pudo guardar', error.message);
    } else {
      notify('Guardado', 'La pantalla de login ya usa esta apariencia.');
    }
  };

  const changeBackground = async () => {
    setUploading(true);
    const url = await pickAndUploadImage('branding', 'background.jpg');
    setUploading(false);
    if (url) setBackgroundImageUrl(url);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen>
      <Card>
        <SectionTitle icon="color-wand-outline">Apariencia del login</SectionTitle>
        <Text style={styles.meta}>
          Solo tú puedes cambiar el fondo y los colores que ven todos al abrir Kipo, antes de iniciar sesión.
        </Text>
      </Card>

      <Card>
        <SectionTitle icon="image-outline">Imagen de fondo</SectionTitle>
        <Text style={styles.meta}>
          {backgroundImageUrl ? 'Hay una imagen de fondo activa — reemplaza el degradado de colores.' : 'Sin imagen — se usa el degradado de colores de abajo.'}
        </Text>
        <View style={styles.row}>
          <PrimaryButton label={uploading ? 'Subiendo…' : 'Elegir imagen'} onPress={changeBackground} disabled={uploading} />
          {backgroundImageUrl && (
            <Pressable style={styles.clearButton} onPress={() => setBackgroundImageUrl(null)}>
              <Text style={styles.clearButtonText}>Quitar</Text>
            </Pressable>
          )}
        </View>
      </Card>

      <Card>
        <SectionTitle icon="color-palette-outline">Degradado de colores</SectionTitle>
        <Text style={styles.meta}>5 tonos, de arriba a abajo (código hexadecimal).</Text>
        {gradientColors.map((c, i) => (
          <View key={i} style={styles.colorRow}>
            <View style={[styles.swatch, { backgroundColor: c }]} />
            <TextInput
              style={styles.hexInput}
              value={c}
              autoCapitalize="none"
              onChangeText={(text) =>
                setGradientColors((prev) => prev.map((existing, idx) => (idx === i ? text : existing)))
              }
            />
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.row}>
          <PrimaryButton label={saving ? 'Guardando…' : 'Guardar'} onPress={save} disabled={saving} />
          <Pressable style={styles.previewButton} onPress={() => setPreviewOpen(true)}>
            <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.previewButtonText}>Ver animación</Text>
          </Pressable>
        </View>
      </Card>
      </Screen>

      {previewOpen && (
        // Fuera del <Screen> (un ScrollView) a propósito: absoluteFill ahí
        // adentro se posiciona relativo al contenido scrolleable completo
        // (más alto que la pantalla), no al viewport — la animación se veía
        // mal recortada/desplazada. Como hermano del ScrollView, sí cubre
        // exactamente lo visible.
        <View style={StyleSheet.absoluteFill}>
          <LoginBackdrop />
          <SeedGrowthIntro onDone={() => setPreviewOpen(false)} forcePlay />
          <Pressable style={styles.closePreview} onPress={() => setPreviewOpen(false)} hitSlop={12}>
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clearButton: { paddingVertical: 10, paddingHorizontal: spacing.md },
  clearButtonText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.critical },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  swatch: { width: 28, height: 28, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  hexInput: {
    flex: 1,
    backgroundColor: colors.page,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
    outlineWidth: 0,
  },
  previewButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: spacing.md },
  previewButtonText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.primary },
  closePreview: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
