import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CategoryPickerModal } from '../../src/components/CategoryPickerModal';
import { ConfirmCaptureCard } from '../../src/components/ConfirmCaptureCard';
import { TabScreenGuard } from '../../src/components/TabScreenGuard';
import { CATEGORY_OPTIONS, findCategory } from '../../src/domain/categories';
import { useKipo } from '../../src/domain/store';
import { parseExpenseWithAI, type AiChatTurn } from '../../src/lib/aiExpense';
import { notify } from '../../src/lib/confirm';
import { colors, fonts, radius, spacing } from '../../src/theme';

const EXAMPLES = [
  'Almuerzo con mi esposa en restaurante $35',
  'Gasolina carro $40',
  'Salida familiar al parque con niños $25 helados',
  'Cervezas con amigos $20',
];

// Un mensaje de la conversación en pantalla — no todos son transacciones:
// una pregunta de aclaración del bot ("¿cuánto fue?") no tiene una fila de
// gasto propia hasta que el draft esté completo.
type ChatMessage =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'bot-question'; id: string; text: string }
  | { kind: 'bot-note'; id: string; text: string }
  | { kind: 'transaction'; id: string; transactionId: string };

export default function ChatScreen() {
  const { state, currentUserId, addTransactionFromText, addTransactionFromDraft, confirmTransaction, deleteTransaction, correctCategory } =
    useKipo();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Contexto acumulado SOLO mientras Kipobot está a medio interpretar un
  // gasto (te hizo una pregunta y espera tu respuesta) — se vacía apenas se
  // guarda la transacción, para que el siguiente mensaje empiece de cero en
  // vez de arrastrar la conversación del gasto anterior.
  const draftHistoryRef = useRef<AiChatTurn[]>([]);

  const transactionById = useMemo(() => {
    const map = new Map<string, (typeof state.transactions)[number]>();
    for (const t of state.transactions) map.set(t.id, t);
    return map;
  }, [state.transactions]);

  const allCategories = useMemo(
    () =>
      [...CATEGORY_OPTIONS, ...state.customCategories].map((c) => ({
        groupSlug: c.groupSlug,
        subSlug: c.subSlug,
        label: c.label,
        kind: c.kind,
      })),
    [state.customCategories],
  );

  const scrollToEnd = () => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const pushMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    scrollToEnd();
  };

  const finalizeWithLocalParser = (text: string) => {
    const tx = addTransactionFromText(text);
    pushMessage({ kind: 'transaction', id: `tx-${tx.id}`, transactionId: tx.id });
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');
    pushMessage({ kind: 'user', id: `u-${Date.now()}`, text: trimmed });
    setSending(true);

    const history = draftHistoryRef.current;
    const result = await parseExpenseWithAI(trimmed, history, allCategories);

    if (result.status === 'ready') {
      draftHistoryRef.current = [];
      const now = new Date().toISOString();
      const tx = addTransactionFromDraft(
        {
          type: result.draft.type,
          amount: result.draft.amount,
          merchant: result.draft.merchant,
          description: result.draft.description,
          occurredAt: now,
          groupSlug: result.draft.groupSlug,
          subSlug: result.draft.subSlug,
          confidence: result.draft.confidence,
          needsReview: result.draft.confidence !== 'high',
          rawText: [...history.map((h) => h.text), trimmed].join(' · '),
        },
        currentUserId,
      );
      pushMessage({ kind: 'transaction', id: `tx-${tx.id}`, transactionId: tx.id });
    } else if (result.status === 'needs_clarification') {
      draftHistoryRef.current = [...history, { role: 'user', text: trimmed }, { role: 'bot', text: result.question }];
      pushMessage({ kind: 'bot-question', id: `q-${Date.now()}`, text: result.question });
    } else {
      // Sin conexión, la API todavía no tiene GEMINI_API_KEY configurada, o
      // cualquier otro error — nunca se deja a la persona sin poder registrar
      // su gasto: se resuelve al toque con el parser local por reglas, con
      // el texto completo de la conversación hasta ahora.
      draftHistoryRef.current = [];
      const fullText = [...history.map((h) => h.text), trimmed].join(' ');
      pushMessage({ kind: 'bot-note', id: `n-${Date.now()}`, text: 'No pude conectarme al asistente inteligente — lo registré con el modo rápido, revisa la categoría.' });
      finalizeWithLocalParser(fullText);
    }
    setSending(false);
  };

  return (
    <TabScreenGuard>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
      >
        {messages.length === 0 && (
          <View style={styles.hint}>
            <Text style={styles.hintTitle}>Cuéntale un gasto a Kipo, como lo dirías en voz alta</Text>
            <Text style={styles.hintBody}>
              Kipobot detecta el monto y la categoría solo — y si falta algo, te pregunta antes de adivinar.
            </Text>
            <View style={styles.examples}>
              {EXAMPLES.map((ex) => (
                <Pressable key={ex} style={styles.exampleChip} onPress={() => send(ex)}>
                  <Text style={styles.exampleText}>{ex}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg) => {
          if (msg.kind === 'user') {
            return (
              <View key={msg.id} style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{msg.text}</Text>
              </View>
            );
          }

          if (msg.kind === 'bot-question') {
            return (
              <View key={msg.id} style={styles.botBubble}>
                <Ionicons name="leaf-outline" size={14} color={colors.primary} style={{ marginBottom: 2 }} />
                <Text style={styles.botBubbleText}>{msg.text}</Text>
              </View>
            );
          }

          if (msg.kind === 'bot-note') {
            return (
              <View key={msg.id} style={styles.noteBubble}>
                <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
                <Text style={styles.noteBubbleText}>{msg.text}</Text>
              </View>
            );
          }

          const tx = transactionById.get(msg.transactionId);
          if (!tx) return null;

          if (tx.status === 'pendiente') {
            return (
              <ConfirmCaptureCard
                key={msg.id}
                transaction={tx}
                onConfirm={(patch) => confirmTransaction(tx.id, patch)}
                onDiscard={() => deleteTransaction(tx.id)}
              />
            );
          }

          const isIncome = tx.type === 'ingreso';
          const category = findCategory(tx.groupSlug, tx.subSlug);
          return (
            <View key={msg.id} style={styles.confirmedBubble}>
              <View style={styles.confirmedHeader}>
                <Ionicons name="checkmark-circle" size={15} color={colors.good} />
                <Text style={styles.confirmedText}>
                  {isIncome ? '+' : ''}${tx.amount.toFixed(2)} · {category?.label ?? (isIncome ? 'Ingreso' : 'Sin categorizar')}
                </Text>
              </View>
              <Text style={styles.confirmedDesc}>{tx.description}</Text>
              <Pressable onPress={() => setCorrectingId(tx.id)}>
                <Text style={styles.correctLink}>¿No es correcto? Corregir categoría</Text>
              </Pressable>
            </View>
          );
        })}

        {sending && (
          <View style={styles.typingBubble}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.typingText}>Kipobot está pensando...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder='Ej: "Cervezas con amigos $20"'
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          maxLength={500}
          editable={!sending}
        />
        <Pressable style={[styles.sendButton, sending && { opacity: 0.5 }]} onPress={() => send(input)} disabled={sending}>
          <Ionicons name="send" size={17} color="#fff" style={{ marginLeft: -2 }} />
        </Pressable>
      </View>

      <CategoryPickerModal
        visible={!!correctingId}
        onClose={() => setCorrectingId(null)}
        kind={(correctingId ? transactionById.get(correctingId) : undefined)?.type === 'ingreso' ? 'ingreso' : 'gasto'}
        onSelect={(option) => {
          if (correctingId) {
            correctCategory(correctingId, option.groupSlug, option.subSlug);
            notify('Categoría corregida', 'Kipo recordará esto para la próxima vez.');
          }
          setCorrectingId(null);
        }}
      />
    </KeyboardAvoidingView>
    </TabScreenGuard>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.page },
  hint: { padding: spacing.md, gap: spacing.sm },
  hintTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.textPrimary },
  hintBody: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 19 },
  examples: { gap: spacing.xs, marginTop: spacing.sm },
  exampleChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  exampleText: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 13 },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  userBubbleText: { color: '#fff', fontFamily: fonts.bodyMedium, fontSize: 14 },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    maxWidth: '85%',
    gap: 2,
  },
  botBubbleText: { color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 14 },
  noteBubble: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    maxWidth: '95%',
  },
  noteBubbleText: { color: colors.warning, fontFamily: fonts.bodyMedium, fontSize: 12, flexShrink: 1 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: spacing.sm },
  typingText: { color: colors.muted, fontFamily: fonts.body, fontSize: 12.5 },
  confirmedBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    maxWidth: '85%',
    gap: 4,
  },
  confirmedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmedText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textPrimary },
  confirmedDesc: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: 13 },
  correctLink: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 4 },
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
    minWidth: 0,
    backgroundColor: colors.page,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    outlineWidth: 0,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
