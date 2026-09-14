import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../domain/authStore';
import { colors, radius, spacing } from '../theme';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.includes('@') || password.length < 6) {
      setError('Ingresa un correo válido y una contraseña de al menos 6 caracteres.');
      return;
    }
    setBusy(true);
    const err = mode === 'sign-in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
    } else if (mode === 'sign-up') {
      setInfo('Cuenta creada. Si tu proyecto pide confirmar el correo, revisa tu bandeja antes de continuar.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Kipo</Text>
        <Text style={styles.subtitle}>{mode === 'sign-in' ? 'Inicia sesión para ver tu familia' : 'Crea tu cuenta'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput style={styles.input} placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />

        {error && <Text style={styles.error}>{error}</Text>}
        {info && <Text style={styles.info}>{info}</Text>}

        <Pressable style={styles.primaryButton} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{mode === 'sign-in' ? 'Entrar' : 'Crear cuenta'}</Text>}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
          <Text style={styles.switchText}>
            {mode === 'sign-in' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Inicia sesión'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page, justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  input: { backgroundColor: colors.page, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 14 },
  error: { color: colors.critical, fontSize: 12 },
  info: { color: colors.good, fontSize: 12 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: spacing.xs },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  switchText: { textAlign: 'center', color: colors.primary, fontSize: 13, marginTop: spacing.sm },
});
