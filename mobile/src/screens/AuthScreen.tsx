import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TermsModal } from '../components/TermsModal';
import { useAuth } from '../domain/authStore';
import { colors, fonts, radius, spacing } from '../theme';

interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

// "Agregar Mayúsculas, Agregar números..." — cada regla se pone verde en
// tiempo real en cuanto el password la cumple, así la persona ve su
// progreso en vez de enterarse del requisito hasta que falla al enviar.
const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'Al menos 8 caracteres', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'Una letra mayúscula', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Una letra minúscula', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'Un número', test: (p) => /[0-9]/.test(p) },
];

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Un solo driver 0→1 para el "lift" del card entero al pasar el cursor —
  // solo dispara en web (onHoverIn/onHoverOut no existen en táctil nativo),
  // así que no hace falta un chequeo de Platform aparte.
  const hover = useRef(new Animated.Value(0)).current;
  const animateHover = (toValue: number) => {
    Animated.timing(hover, { toValue, duration: 180, useNativeDriver: false }).start();
  };
  const cardScale = hover.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });
  const cardTranslateY = hover.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const cardShadowOpacity = hover.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.4] });
  const cardShadowRadius = hover.interpolate({ inputRange: [0, 1], outputRange: [18, 30] });

  const passwordRuleResults = PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) }));
  const passwordMeetsRules = passwordRuleResults.every((r) => r.passed);

  const canSubmit =
    email.includes('@') && (mode === 'sign-in' ? password.length >= 8 : passwordMeetsRules && termsAccepted);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.includes('@')) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (mode === 'sign-up' && !passwordMeetsRules) {
      setError('La contraseña no cumple todos los requisitos de abajo.');
      return;
    }
    if (mode === 'sign-in' && password.length < 8) {
      setError('Ingresa tu contraseña.');
      return;
    }
    if (mode === 'sign-up' && !termsAccepted) {
      setError('Debes aceptar los términos y condiciones para crear tu cuenta.');
      return;
    }
    setBusy(true);
    const err = mode === 'sign-in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password, termsAccepted);
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.heroWordmark}>Kipo</Text>
            <Text style={styles.heroTagline}>El jardín de las finanzas de tu familia</Text>
            <Text style={styles.heroBlurb}>
              Del griego <Text style={styles.heroBlurbEm}>kípos</Text> (jardín) — y también suena a{' '}
              <Text style={styles.heroBlurbEm}>keep</Text> y a <Text style={styles.heroBlurbEm}>equipo</Text>: cuidar el
              dinero, en familia, con paciencia.
            </Text>
          </View>

          <Pressable onHoverIn={() => animateHover(1)} onHoverOut={() => animateHover(0)} style={styles.cardHoverArea}>
            <Animated.View
              style={[
                styles.cardShadowWrap,
                {
                  transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
                  shadowOpacity: cardShadowOpacity,
                  shadowRadius: cardShadowRadius,
                },
              ]}
            >
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
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="rgba(255,255,255,0.85)"
                      />
                    </Pressable>
                  </View>

                  {mode === 'sign-up' && (
                    <View style={styles.rulesBox}>
                      {passwordRuleResults.map((rule) => (
                        <View key={rule.id} style={styles.ruleRow}>
                          <Ionicons
                            name={rule.passed ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={rule.passed ? '#8ff0b0' : 'rgba(255,255,255,0.55)'}
                          />
                          <Text style={[styles.ruleText, rule.passed && styles.ruleTextPassed]}>{rule.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {mode === 'sign-up' && (
                    <Pressable style={styles.termsRow} onPress={() => setTermsAccepted((v) => !v)}>
                      <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                        {termsAccepted && <Ionicons name="checkmark" size={13} color={colors.primaryDeep} />}
                      </View>
                      <Text style={styles.termsText}>
                        Acepto los{' '}
                        <Text style={styles.termsLink} onPress={() => setTermsModalOpen(true)}>
                          términos y condiciones
                        </Text>{' '}
                        y el aviso de privacidad
                      </Text>
                    </Pressable>
                  )}

                  {error && <Text style={styles.error}>{error}</Text>}
                  {info && <Text style={styles.info}>{info}</Text>}

                  <Pressable style={[styles.primaryButton, (!canSubmit || busy) && styles.primaryButtonDisabled]} onPress={submit} disabled={busy || !canSubmit}>
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>{mode === 'sign-in' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}</Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                      setError(null);
                      setInfo(null);
                    }}
                  >
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
            </Animated.View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <TermsModal visible={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.lg },
  hero: { alignItems: 'center', maxWidth: 380, gap: 6 },
  heroWordmark: {
    fontFamily: fonts.displayBlack,
    fontSize: 34,
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroTagline: { fontFamily: fonts.bodySemibold, fontSize: 14, color: 'rgba(255,255,255,0.92)', textAlign: 'center' },
  heroBlurb: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 18, marginTop: 2 },
  heroBlurbEm: { fontFamily: fonts.bodyBold, color: '#fff' },
  cardHoverArea: { width: '100%', maxWidth: 380 },
  cardShadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
  },
  card: {
    width: '100%',
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
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 14, color: '#fff', paddingVertical: 0, outlineWidth: 0 },
  rulesBox: { gap: 4, marginTop: -spacing.xs },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  ruleTextPassed: { color: '#8ff0b0', fontFamily: fonts.bodyMedium },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#8ff0b0', borderColor: '#8ff0b0' },
  termsText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 17 },
  termsLink: { fontFamily: fonts.bodyBold, color: '#fff', textDecorationLine: 'underline' },
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
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: '#fff', fontFamily: fonts.bodyBold, letterSpacing: 1, fontSize: 13 },
  switchText: { fontFamily: fonts.body, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: spacing.xs },
  switchLink: { fontFamily: fonts.bodyBold, color: '#eaf4ff' },
});
