import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../domain/authStore';
import { colors, fonts, radius, spacing } from '../theme';

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
    if (!email.includes('@') || password.length < 8) {
      setError('Ingresa un correo válido y una contraseña de al menos 8 caracteres.');
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
    <View style={styles.container}>
      <LinearGradient
        colors={['#7a3018', '#c9552b', '#e29255', '#cfc2a8', '#8fa6ad']}
        locations={[0, 0.28, 0.5, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BlurView intensity={40} tint="light" style={styles.card}>
          <View style={styles.cardOverlay}>
            <Text style={styles.title}>{mode === 'sign-in' ? 'LOGIN' : 'CREAR CUENTA'}</Text>
            <Text style={styles.subtitle}>Kipo · Finanzas familiares</Text>

            <View style={styles.field}>
              <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.85)" />
              <TextInput
                style={styles.input}
                placeholder="Correo electrónico"
                placeholderTextColor="rgba(255,255,255,0.75)"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.85)" />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor="rgba(255,255,255,0.75)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
            {info && <Text style={styles.info}>{info}</Text>}

            <Pressable style={styles.primaryButton} onPress={submit} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{mode === 'sign-in' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}</Text>
              )}
            </Pressable>

            <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
              <Text style={styles.switchText}>
                {mode === 'sign-in' ? (
                  <>
                    ¿Nuevo aquí? <Text style={styles.switchLink}>Crear cuenta</Text>
                  </>
                ) : (
                  <>
                    ¿Ya tienes cuenta? <Text style={styles.switchLink}>Inicia sesión</Text>
                  </>
                )}
              </Text>
            </Pressable>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg + 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  cardOverlay: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 27,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    paddingBottom: 8,
  },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 14, color: '#fff', paddingVertical: 4, outlineWidth: 0 },
  error: { color: '#ffe1d6', fontFamily: fonts.bodyMedium, fontSize: 12, backgroundColor: 'rgba(184,69,47,0.4)', padding: spacing.sm, borderRadius: radius.sm },
  info: { color: '#eafff0', fontFamily: fonts.bodyMedium, fontSize: 12, backgroundColor: 'rgba(60,139,74,0.4)', padding: spacing.sm, borderRadius: radius.sm },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  primaryButtonText: { color: '#fff', fontFamily: fonts.bodyBold, letterSpacing: 1, fontSize: 13 },
  switchText: { fontFamily: fonts.body, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: spacing.xs },
  switchLink: { fontFamily: fonts.bodyBold, color: '#eaf4ff' },
});
