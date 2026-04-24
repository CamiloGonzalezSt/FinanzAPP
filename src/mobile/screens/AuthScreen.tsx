import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme/colors";
import { checkUsernameAvailable, loginManual, registerManual, saveSession } from "../api/client";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (isNew?: boolean) => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");

  // Register fields
  const [fullName, setFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regUsernameState, setRegUsernameState] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared identifier (email/username/name for login; email for register)
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const looksLikeEmail = identifier.includes("@");
  const loginBadge = looksLikeEmail ? "📧 Email" : identifier.trim().includes(" ") ? "👤 Nombre" : identifier.length > 0 ? "@ Usuario" : null;

  // Live username availability check (register)
  useEffect(() => {
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);
    if (regUsername.length < 3) { setRegUsernameState("idle"); return; }

    setRegUsernameState("checking");
    usernameDebounce.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(regUsername).catch(() => ({ available: false, error: undefined as string | undefined }));
      if (result.error) { setRegUsernameState("invalid"); return; }
      setRegUsernameState(result.available ? "ok" : "taken");
    }, 500);
    return () => { if (usernameDebounce.current) clearTimeout(usernameDebounce.current); };
  }, [regUsername]);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleForgotPassword() {
    if (!forgotEmail.includes("@")) { setError("Ingresa un correo válido."); return; }
    setForgotLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      setForgotSent(true);
    } catch {
      setError("No se pudo enviar el correo. Verifica tu conexión.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleManualAuth() {
    setLoading(true);
    setError(null);
    try {
      const payload =
        mode === "register"
          ? await registerManual({
              fullName: fullName.trim(),
              email: identifier.trim(),
              password,
              username: regUsername.trim() || undefined,
            })
          : await loginManual({ identifier: identifier.trim(), password });
      await saveSession(payload.accessToken, payload.refreshToken);
      await onAuthenticated(mode === "register");
    } catch (e) {
      setError(e instanceof Error ? e.message : mode === "register" ? "No se pudo crear la cuenta." : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !loading && identifier.trim().length >= 2 && password.length >= 8 &&
    (mode === "login" || (fullName.trim().length >= 2 && regUsernameState !== "taken" && regUsernameState !== "checking"));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.logoArea}>
        <Text style={styles.logoIcon}>💰</Text>
        <Text style={styles.appName}>Finanzas</Text>
        <Text style={styles.tagline}>Tu dinero, bajo control</Text>
      </View>

      <View style={styles.card}>
        {/* Mode toggle — hidden when in forgot mode */}
        {mode !== "forgot" && (
          <View style={styles.modeRow}>
            <Pressable style={[styles.modeBtn, mode === "login" && styles.modeBtnActive]} onPress={() => { setMode("login"); setError(null); }}>
              <Text style={[styles.modeBtnText, mode === "login" && styles.modeBtnTextActive]}>Iniciar sesión</Text>
            </Pressable>
            <Pressable style={[styles.modeBtn, mode === "register" && styles.modeBtnActive]} onPress={() => { setMode("register"); setError(null); }}>
              <Text style={[styles.modeBtnText, mode === "register" && styles.modeBtnTextActive]}>Registrarse</Text>
            </Pressable>
          </View>
        )}

        {/* ── FORGOT PASSWORD MODE ── */}
        {mode === "forgot" && (
          forgotSent ? (
            <View style={styles.forgotSuccess}>
              <Text style={styles.forgotSuccessIcon}>📬</Text>
              <Text style={styles.forgotSuccessTitle}>¡Correo enviado!</Text>
              <Text style={styles.forgotSuccessText}>
                Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.
              </Text>
              <Pressable style={styles.forgotBackBtn} onPress={() => { setMode("login"); setForgotSent(false); setForgotEmail(""); setError(null); }}>
                <Text style={styles.forgotBackBtnText}>Volver al login</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable onPress={() => { setMode("login"); setError(null); }} style={styles.backBtn}>
                <Text style={styles.backBtnText}>‹ Volver</Text>
              </Pressable>
              <Text style={styles.forgotTitle}>Recuperar contraseña</Text>
              <Text style={styles.forgotSubtitle}>Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.</Text>
              <TextInput
                style={styles.input}
                value={forgotEmail}
                onChangeText={setForgotEmail}
                placeholder="Tu correo electrónico"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable
                style={[styles.primaryBtn, (forgotLoading || !forgotEmail.includes("@")) && styles.disabled]}
                onPress={handleForgotPassword}
                disabled={forgotLoading || !forgotEmail.includes("@")}
              >
                <Text style={styles.primaryBtnText}>{forgotLoading ? "Enviando…" : "Enviar enlace"}</Text>
              </Pressable>
            </>
          )
        )}

        {/* ── REGISTER / LOGIN FIELDS ── */}
        {/* Register: full name */}
        {mode === "register" && (
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nombre completo"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
        )}

        {/* Register: username (optional but recommended) */}
        {mode === "register" && (
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, regUsernameState === "ok" && styles.inputOk, regUsernameState === "taken" && styles.inputError]}
              value={regUsername}
              onChangeText={setRegUsername}
              placeholder="Nombre de usuario  (opcional, ej: carlos92)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.inputBadge}>
              {regUsernameState === "checking" && <ActivityIndicator size="small" color={colors.textMuted} />}
              {regUsernameState === "ok" && <Text style={styles.badgeOk}>✓ disponible</Text>}
              {regUsernameState === "taken" && <Text style={styles.badgeError}>✗ en uso</Text>}
              {regUsernameState === "invalid" && <Text style={styles.badgeError}>✗ inválido</Text>}
            </View>
          </View>
        )}

        {/* Smart identifier field */}
        {mode === "forgot" ? null : <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={mode === "register" ? "Correo electrónico" : "Correo, usuario o nombre completo"}
            placeholderTextColor={colors.textMuted}
            autoCapitalize={looksLikeEmail || mode === "register" ? "none" : "words"}
            keyboardType={looksLikeEmail || mode === "register" ? "email-address" : "default"}
            autoCorrect={false}
          />
          {mode === "login" && loginBadge && (
            <View style={styles.inputBadge}>
              <Text style={styles.badgeMuted}>{loginBadge}</Text>
            </View>
          )}
        </View>}

        {mode !== "forgot" && (
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />
        )}

        {mode !== "forgot" && error ? <Text style={styles.errorText}>{error}</Text> : null}

        {mode === "register" && (
          <Text style={styles.hint}>
            El nombre de usuario es opcional pero te permite iniciar sesión sin usar el correo.
          </Text>
        )}

        {mode !== "forgot" && (
          <>
            <Pressable style={[styles.primaryBtn, !canSubmit && styles.disabled]} onPress={handleManualAuth} disabled={!canSubmit}>
              <Text style={styles.primaryBtnText}>
                {loading ? "Procesando…" : mode === "register" ? "Crear cuenta" : "Entrar"}
              </Text>
            </Pressable>

            {mode === "login" && (
              <Pressable onPress={() => { setMode("forgot"); setError(null); }} style={styles.forgotLink}>
                <Text style={styles.forgotLinkText}>¿Olvidaste tu contraseña?</Text>
              </Pressable>
            )}

          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 24 },
  logoArea: { alignItems: "center", gap: 6 },
  logoIcon: { fontSize: 52 },
  appName: { color: colors.text, fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { color: colors.textMuted, fontSize: 15 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  modeBtnText: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
  modeBtnTextActive: { color: colors.primary },

  inputWrapper: { position: "relative" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    paddingRight: 110,
    color: colors.text,
    fontSize: 15,
  },
  inputOk: { borderColor: colors.success },
  inputError: { borderColor: colors.danger },
  inputBadge: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  badgeOk: { color: colors.success, fontSize: 12, fontWeight: "700" },
  badgeError: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  badgeMuted: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },

  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: -4 },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center" },

  primaryBtn: {
    marginTop: 4,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 15,
    backgroundColor: colors.primary,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  disabled: { opacity: 0.45 },

  forgotLink: { alignItems: "center", paddingVertical: 4 },
  forgotLinkText: { color: colors.primary, fontSize: 13, fontWeight: "600" },

  backBtn: { alignSelf: "flex-start", paddingVertical: 4, marginBottom: 4 },
  backBtnText: { color: colors.textSub, fontSize: 14, fontWeight: "700" },
  forgotTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  forgotSubtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 16 },

  forgotSuccess: { alignItems: "center", gap: 12, paddingVertical: 8 },
  forgotSuccessIcon: { fontSize: 44 },
  forgotSuccessTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  forgotSuccessText: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  forgotBackBtn: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  forgotBackBtnText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
});
