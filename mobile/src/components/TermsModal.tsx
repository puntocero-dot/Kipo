import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Versión condensada de los términos y condiciones / aviso de privacidad
// (los documentos completos redactados en la auditoría legal viven fuera
// del código de la app) — suficiente para que la aceptación en el registro
// sea informada, no un checkbox ciego.
export function TermsModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Términos y privacidad</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Qué es Kipo</Text>
          <Text style={styles.body}>
            Kipo es una app para llevar las finanzas de tu familia o equipo: registrar gastos e ingresos, presupuestos,
            recordatorios de pago y metas de ahorro. Los datos que registras (montos, categorías, cuentas) son tuyos y
            de las personas con quienes compartes tu espacio de trabajo.
          </Text>
          <Text style={styles.sectionTitle}>Tu cuenta</Text>
          <Text style={styles.body}>
            Eres responsable de mantener tu contraseña segura y de la actividad registrada bajo tu cuenta. Puedes
            solicitar la eliminación de tu cuenta y tus datos en cualquier momento.
          </Text>
          <Text style={styles.sectionTitle}>Privacidad de tus datos</Text>
          <Text style={styles.body}>
            No vendemos tus datos financieros a terceros. La información se usa únicamente para operar la app
            (mostrarte tu historial, calcular tus resúmenes, enviarte recordatorios) y se protege con controles de
            acceso a nivel de base de datos, de modo que solo tú y los miembros de tu espacio de trabajo pueden verla.
          </Text>
          <Text style={styles.sectionTitle}>Uso aceptable</Text>
          <Text style={styles.body}>
            Kipo es para uso personal o familiar de control de gastos. No debe usarse para almacenar información de
            terceros sin su consentimiento ni para actividades ilegales.
          </Text>
          <Text style={styles.footnote}>
            Este resumen no sustituye el contrato de licencia, los términos y condiciones completos ni el aviso de
            privacidad — disponibles bajo solicitud. Al crear tu cuenta confirmas que los entiendes y los aceptas.
          </Text>
        </ScrollView>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Entendido</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(35,31,26,0.5)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.raised,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textPrimary, marginTop: spacing.sm },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 4 },
  footnote: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, lineHeight: 16, marginTop: spacing.md, marginBottom: spacing.sm, fontStyle: 'italic' },
  closeButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: spacing.xs },
  closeButtonText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 14 },
});
