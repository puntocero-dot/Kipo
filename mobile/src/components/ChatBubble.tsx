import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccentColor } from '../domain/accentStore';
import { colors, fonts, radius, shadow, spacing } from '../theme';
import { ChatPanel } from './ChatPanel';

// Burbuja flotante de Kipobot, disponible desde cualquier pestaña. El panel
// no es un <Modal> a propósito: un Modal desmonta su contenido al cerrarse y
// se perdería la conversación a medias (p.ej. cuando Kipobot preguntó el
// monto); aquí solo se oculta, así el chat sigue donde lo dejaste.
export function ChatBubble({ bottomOffset }: { bottomOffset: number }) {
  const accent = useAccentColor();
  const [open, setOpen] = useState(false);

  return (
    <>
      <View
        style={[styles.overlay, !open && { display: 'none' }]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Registrar gasto</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Cerrar chat">
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
          <ChatPanel />
        </View>
      </View>

      {!open && (
        <Pressable
          accessibilityLabel="Registrar gasto con Kipobot"
          style={({ pressed }) => [styles.fab, { backgroundColor: accent, bottom: bottomOffset + spacing.md }, pressed && { opacity: 0.85 }]}
          onPress={() => setOpen(true)}
        >
          <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    height: '82%',
    backgroundColor: colors.page,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary },
});
