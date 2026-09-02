import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CategoryPickerModal } from '../../src/components/CategoryPickerModal';
import { ConfirmCaptureCard } from '../../src/components/ConfirmCaptureCard';
import { findCategory } from '../../src/domain/categories';
import { useKipo } from '../../src/domain/store';
import { colors, radius, spacing } from '../../src/theme';

const EXAMPLES = [
  'Almuerzo con mi esposa en restaurante $35',
  'Gasolina carro $40',
  'Salida familiar al parque con niños $25 helados',
  'Cervezas con amigos $20',
];

export default function ChatScreen() {
  const { state, addTransactionFromText, confirmTransaction, deleteTransaction, correctCategory } = useKipo();
  const [input, setInput] = useState('');
  const [messageIds, setMessageIds] = useState<string[]>([]);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tx = addTransactionFromText(trimmed);
    setMessageIds((prev) => [...prev, tx.id]);
    setInput('');
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
      >
        {messageIds.length === 0 && (
          <View style={styles.hint}>
            <Text style={styles.hintTitle}>Escribe un gasto como lo dirías en voz alta</Text>
            <Text style={styles.hintBody}>El parser detecta el monto, la categoría y el contexto social automáticamente.</Text>
            <View style={styles.examples}>
              {EXAMPLES.map((ex) => (
                <Pressable key={ex} style={styles.exampleChip} onPress={() => send(ex)}>
                  <Text style={styles.exampleText}>{ex}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messageIds.map((id) => {
          const tx = state.transactions.find((t) => t.id === id);
          if (!tx) return null;

          if (tx.status === 'pendiente') {
            return (
              <ConfirmCaptureCard
                key={id}
                transaction={tx}
                onConfirm={(patch) => confirmTransaction(id, patch)}
                onDiscard={() => deleteTransaction(id)}
              />
            );
          }

          const category = findCategory(tx.groupSlug, tx.subSlug);
          return (
            <View key={id} style={styles.confirmedBubble}>
              <Text style={styles.confirmedText}>
                ✅ ${tx.amount.toFixed(2)} · {category?.label ?? 'Sin categorizar'}
              </Text>
              <Text style={styles.confirmedDesc}>{tx.description}</Text>
              <Pressable onPress={() => setCorrectingId(id)}>
                <Text style={styles.correctLink}>¿No es correcto? Corregir categoría</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder='Ej: "Cervezas con amigos $20"'
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
        />
        <Pressable style={styles.sendButton} onPress={() => send(input)}>
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>

      <CategoryPickerModal
        visible={!!correctingId}
        onClose={() => setCorrectingId(null)}
        onSelect={(option) => {
          if (correctingId) {
            correctCategory(correctingId, option.groupSlug, option.subSlug);
            Alert.alert('Categoría corregida', 'Kipo recordará esto para la próxima vez.');
          }
          setCorrectingId(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.page },
  hint: { padding: spacing.md, gap: spacing.sm },
  hintTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  hintBody: { fontSize: 13, color: colors.muted },
  examples: { gap: spacing.xs, marginTop: spacing.sm },
  exampleChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  exampleText: { color: colors.primary, fontSize: 13 },
  confirmedBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#e9f2fd',
    borderRadius: radius.lg,
    padding: spacing.md,
    maxWidth: '85%',
    gap: 4,
  },
  confirmedText: { fontWeight: '700', color: colors.textPrimary },
  confirmedDesc: { color: colors.textSecondary, fontSize: 13 },
  correctLink: { color: colors.primary, fontSize: 12, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.page,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 16 },
});
