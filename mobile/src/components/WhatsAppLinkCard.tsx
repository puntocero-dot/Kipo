import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../domain/authStore';
import { confirmAction, notify } from '../lib/confirm';
import { supabase } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../theme';
import { Card, PrimaryButton, SectionTitle } from './ui';

// Número de WhatsApp del bot (solo dígitos, con código de país). Sin él la
// tarjeta igual muestra el código, pero no puede armar el enlace directo.
const BOT_NUMBER = (process.env.EXPO_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

interface Link {
  phone: string;
  family_id: string;
}

// "Más → WhatsApp": vincula el teléfono de la persona con Kipobot por
// WhatsApp (api/whatsapp.js). Genera un código de un solo uso que la persona
// manda por WhatsApp para demostrar que el número es suyo.
export function WhatsAppLinkCard() {
  const { activeFamilyId, memberships } = useAuth();
  const [links, setLinks] = useState<Link[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadLinks = useCallback(async () => {
    const { data } = await supabase!.from('whatsapp_links').select('phone, family_id');
    setLinks((data as Link[]) ?? []);
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const generate = async () => {
    if (!activeFamilyId) return;
    setBusy(true);
    const { data, error } = await supabase!.rpc('create_whatsapp_link_code', { target_family_id: activeFamilyId });
    setBusy(false);
    if (error) {
      notify('No se pudo generar el código', error.message);
      return;
    }
    setCode(data as string);
  };

  const unlink = (phone: string) =>
    confirmAction('Desvincular WhatsApp', `¿Dejar de registrar gastos desde +${phone}?`, 'Desvincular', async () => {
      const { error } = await supabase!.from('whatsapp_links').delete().eq('phone', phone);
      if (error) notify('No se pudo desvincular', error.message);
      loadLinks();
    });

  const message = code ? `VINCULAR ${code}` : '';
  const openWhatsApp = () => Linking.openURL(`https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent(message)}`);
  const nameOf = (familyId: string) => memberships.find((m) => m.familyId === familyId)?.familyName ?? 'espacio';

  return (
    <Card>
      <SectionTitle icon="logo-whatsapp">Kipobot en WhatsApp</SectionTitle>
      <Text style={styles.note}>
        Registra gastos escribiéndole a Kipobot por WhatsApp, igual que en el chat de la app. Cada espacio sigue separado: los gastos
        van al espacio que tengas elegido en WhatsApp (escribe "espacio" para cambiarlo).
      </Text>

      {links.map((l) => (
        <View key={l.phone} style={styles.linkRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.phone}>+{l.phone}</Text>
            <Text style={styles.note}>Registra en {nameOf(l.family_id)}</Text>
          </View>
          <Pressable onPress={() => unlink(l.phone)} hitSlop={8}>
            <Text style={styles.unlink}>Desvincular</Text>
          </Pressable>
        </View>
      ))}

      {code ? (
        <View style={styles.codeBox}>
          <Text style={styles.note}>
            Manda este mensaje al WhatsApp de Kipobot{BOT_NUMBER ? ` (+${BOT_NUMBER})` : ''}. Vence en 15 minutos:
          </Text>
          <Text selectable style={styles.code}>{message}</Text>
          {BOT_NUMBER ? <PrimaryButton label="Abrir WhatsApp" onPress={openWhatsApp} /> : null}
        </View>
      ) : (
        <PrimaryButton label={links.length > 0 ? 'Vincular otro número' : 'Vincular mi WhatsApp'} onPress={generate} disabled={busy} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  phone: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textPrimary },
  unlink: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.critical },
  codeBox: { gap: spacing.sm, backgroundColor: colors.page, borderRadius: radius.md, padding: spacing.md },
  code: { fontFamily: fonts.bodyBold, fontSize: 20, letterSpacing: 1, color: colors.textPrimary },
});
