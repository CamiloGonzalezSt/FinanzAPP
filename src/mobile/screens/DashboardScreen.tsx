import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AuthUser, DashboardResponse, GoalItem, MonthlyComparisonItem, TransactionItem, checkUsernameAvailable, updateProfile } from "../api/client";
import { colors } from "../theme/colors";
import { useEffect, useRef, useState } from "react";
import { PuduFinanciero } from "../components/PuduFinanciero";

function fmt(v: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);
}

function todayLabel(date: Date) {
  const day = date.getDate();
  const month = date.toLocaleString("es-CL", { month: "long" });
  const year = date.getFullYear();
  return `${day} de ${month} ${year}`;
}

// ─── Profile Modal ──────────────────────────────────────────────────────────────

function ProfileModal({
  user,
  onClose,
  onLogout,
  onProfileUpdated,
}: {
  user: AuthUser;
  onClose: () => void;
  onLogout: () => void;
  onProfileUpdated: (u: AuthUser) => void;
}) {
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "ok" | "taken" | "invalid" | "same">("idle");
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const initial = (user.fullName ?? user.email)[0].toUpperCase();

  const nameChanged = fullName.trim().length >= 2 && fullName.trim() !== (user.fullName ?? "");
  const usernameChanged = username.trim() !== (user.username ?? "");
  const hasPwdChange = currentPwd.length >= 8 && newPwd.length >= 8;
  const usernameOk = !usernameChanged || usernameState === "ok" || usernameState === "same" || username.trim() === "";
  const canSave = (nameChanged || (usernameChanged && usernameOk) || hasPwdChange) && !saving && usernameState !== "checking" && usernameState !== "taken";

  // Live username check
  useEffect(() => {
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);
    const trimmed = username.trim();
    if (!usernameChanged || trimmed === "") { setUsernameState("idle"); return; }
    if (trimmed === (user.username ?? "")) { setUsernameState("same"); return; }
    if (trimmed.length < 3) { setUsernameState("idle"); return; }
    setUsernameState("checking");
    usernameDebounce.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(trimmed).catch(() => ({ available: false, error: undefined as string | undefined }));
      if (result.error) { setUsernameState("invalid"); return; }
      setUsernameState(result.available ? "ok" : "taken");
    }, 500);
    return () => { if (usernameDebounce.current) clearTimeout(usernameDebounce.current); };
  }, [username, usernameChanged, user.username]);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Parameters<typeof updateProfile>[0] = {};
      if (nameChanged) payload.fullName = fullName.trim();
      if (usernameChanged) payload.username = username.trim() || null;
      if (hasPwdChange) { payload.currentPassword = currentPwd; payload.newPassword = newPwd; }
      const updated = await updateProfile(payload);
      onProfileUpdated(updated);
      setCurrentPwd(""); setNewPwd("");
      setUsernameState("idle");
      setSuccess("Perfil actualizado correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={profileStyles.overlay} onPress={onClose} />
      <View style={profileStyles.sheet}>
        <View style={profileStyles.handle} />

        {/* Avatar + user info */}
        <View style={profileStyles.avatarSection}>
          <View style={profileStyles.avatarLarge}>
            <Text style={profileStyles.avatarLargeText}>{initial}</Text>
          </View>
          <Text style={profileStyles.profileName}>{user.fullName ?? "Usuario"}</Text>
          {user.username ? (
            <Text style={profileStyles.profileUsername}>@{user.username}</Text>
          ) : null}
          <Text style={profileStyles.profileEmail}>{user.email}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <Text style={profileStyles.label}>Nombre completo</Text>
          <TextInput
            style={profileStyles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Tu nombre completo"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />

          {/* Username */}
          <Text style={profileStyles.label}>
            {user.username ? "Nombre de usuario" : "Crear nombre de usuario"}
          </Text>
          <View style={profileStyles.inputWrapper}>
            <View style={profileStyles.usernamePrefix}>
              <Text style={profileStyles.usernamePrefixText}>@</Text>
            </View>
            <TextInput
              style={[
                profileStyles.input,
                profileStyles.inputWithPrefix,
                usernameState === "ok" && profileStyles.inputOk,
                usernameState === "taken" && profileStyles.inputError,
              ]}
              value={username}
              onChangeText={setUsername}
              placeholder={user.username ?? "ej: carlosg92"}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={profileStyles.inputBadge}>
              {usernameState === "checking" && <ActivityIndicator size="small" color={colors.textMuted} />}
              {usernameState === "ok" && <Text style={profileStyles.badgeOk}>✓ disponible</Text>}
              {usernameState === "taken" && <Text style={profileStyles.badgeError}>✗ en uso</Text>}
              {usernameState === "invalid" && <Text style={profileStyles.badgeError}>✗ inválido</Text>}
              {usernameState === "same" && <Text style={profileStyles.badgeOk}>✓ actual</Text>}
            </View>
          </View>
          <Text style={profileStyles.fieldHint}>
            Solo letras, números, puntos, guiones y guiones bajos. Sin espacios.
          </Text>

          {/* Password change */}
          <Text style={profileStyles.label}>Cambiar contraseña</Text>
          <TextInput
            style={profileStyles.input}
            value={currentPwd}
            onChangeText={setCurrentPwd}
            placeholder="Contraseña actual"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />
          <TextInput
            style={profileStyles.input}
            value={newPwd}
            onChangeText={setNewPwd}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          {error ? <Text style={profileStyles.errorText}>{error}</Text> : null}
          {success ? <Text style={profileStyles.successText}>{success}</Text> : null}

          <Pressable
            style={[profileStyles.saveBtn, !canSave && profileStyles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={profileStyles.saveBtnText}>{saving ? "Guardando…" : "Guardar cambios"}</Text>
          </Pressable>

          <View style={profileStyles.divider} />

          <Pressable style={profileStyles.logoutBtn} onPress={onLogout}>
            <Text style={profileStyles.logoutIcon}>⎋</Text>
            <Text style={profileStyles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const profileStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: "88%",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 },

  avatarSection: { alignItems: "center", gap: 6, marginBottom: 24 },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryDim,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeText: { color: colors.primary, fontWeight: "800", fontSize: 30 },
  profileName: { color: colors.text, fontSize: 20, fontWeight: "800" },
  profileUsername: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  profileEmail: { color: colors.textMuted, fontSize: 14 },

  label: { color: colors.textSub, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  fieldHint: { color: colors.textMuted, fontSize: 11, marginTop: -8, marginBottom: 10 },

  inputWrapper: { position: "relative", flexDirection: "row", alignItems: "center" },
  usernamePrefix: {
    position: "absolute",
    left: 14,
    zIndex: 1,
    justifyContent: "center",
  },
  usernamePrefixText: { color: colors.primary, fontWeight: "800", fontSize: 16 },
  inputWithPrefix: { paddingLeft: 28 },
  inputOk: { borderColor: colors.success },
  inputError: { borderColor: colors.danger },
  inputBadge: { position: "absolute", right: 12, justifyContent: "center" },
  badgeOk: { color: colors.success, fontSize: 12, fontWeight: "700" },
  badgeError: { color: colors.danger, fontSize: 12, fontWeight: "700" },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    paddingRight: 100,
    color: colors.text,
    fontSize: 15,
    marginBottom: 12,
  },
  errorText: { color: colors.danger, fontSize: 13, marginBottom: 8, textAlign: "center" },
  successText: { color: colors.success, fontSize: 13, marginBottom: 8, textAlign: "center" },

  saveBtn: { borderRadius: 14, alignItems: "center", paddingVertical: 15, backgroundColor: colors.primary, marginTop: 4 },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerDim,
  },
  logoutIcon: { fontSize: 18, color: colors.danger },
  logoutText: { color: colors.danger, fontWeight: "800", fontSize: 15 },
});

// ─── Dashboard Screen ───────────────────────────────────────────────────────────

export function DashboardScreen({
  dashboard,
  transactions,
  goals,
  monthlyComparison,
  recurringIds = new Set<string>(),
  user,
  onLogout,
  onUserUpdated,
}: {
  dashboard: DashboardResponse | null;
  transactions: TransactionItem[];
  goals: GoalItem[];
  monthlyComparison: MonthlyComparisonItem[];
  recurringIds: Set<string>;
  user: AuthUser;
  onLogout: () => void;
  onUserUpdated: (u: AuthUser) => void;
}) {
  const [showProfile, setShowProfile] = useState(false);

  const income = dashboard?.incomeTotalClp ?? 0;
  const expense = dashboard?.expenseTotalClp ?? 0;
  const saving = goals.reduce((sum, g) => sum + g.currentAmountClp, 0);
  const balance = income - expense;
  const overspend = income > 0 ? Math.round((expense / income) * 100) : 0;
  const recent = transactions.slice(0, 6);
  const today = new Date();

  const initial = (user.fullName ?? user.email)[0]?.toUpperCase() ?? "?";
  const fullDisplayName = user.fullName && user.fullName.trim().length > 0 ? user.fullName.trim() : user.email.split("@")[0];
  const displayName = fullDisplayName.split(" ")[0];

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Buenos días" : hour >= 12 && hour < 20 ? "Buenas tardes" : "Buenas noches";

  const sorted = [...monthlyComparison].sort((a, b) => a.month.localeCompare(b.month));
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const curr = sorted.length >= 1 ? sorted[sorted.length - 1] : null;
  const expDiff = curr && prev ? curr.expenseTotalClp - prev.expenseTotalClp : null;
  const incDiff = curr && prev ? curr.incomeTotalClp - prev.incomeTotalClp : null;

  const recurringTxs = transactions.filter((t) => recurringIds.has(t.id) && t.type === "expense");
  const recurringTotal = recurringTxs.reduce((s, t) => s + t.amountClp, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, {displayName}</Text>
          <Text style={styles.monthLabel}>{todayLabel(today)}</Text>
        </View>
        <Pressable onPress={() => setShowProfile(true)} style={styles.avatarBtn}>
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance disponible</Text>
        <Text style={[styles.balanceAmount, balance < 0 && styles.amountNeg]}>{fmt(balance)}</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <View>
              <Text style={styles.balanceItemLabel}>Ingresos</Text>
              <Text style={[styles.balanceItemAmount, { color: colors.success }]}>{fmt(income)}</Text>
            </View>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceItem}>
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <View>
              <Text style={styles.balanceItemLabel}>Egresos</Text>
              <Text style={[styles.balanceItemAmount, { color: colors.danger }]}>{fmt(expense)}</Text>
            </View>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceItem}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <View>
              <Text style={styles.balanceItemLabel}>Ahorro</Text>
              <Text style={[styles.balanceItemAmount, { color: colors.primary }]}>{fmt(saving)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Pudú Financiero — reacts to current balance */}
      <PuduFinanciero balance={balance} />

      {/* Over-spend indicator */}
      <View style={styles.spendCard}>
        <View style={styles.spendCardLeft}>
          <Text style={styles.spendLabel}>Porcentaje gastado</Text>
          <Text style={[styles.spendValue, overspend > 80 && { color: colors.danger }]}>
            {overspend}%
          </Text>
        </View>
        <View style={styles.progressOuter}>
          <View
            style={[
              styles.progressInner,
              { width: `${Math.min(overspend, 100)}%` as `${number}%` },
              overspend > 100 ? { backgroundColor: colors.danger } : overspend > 80 ? { backgroundColor: colors.warning } : null,
            ]}
          />
        </View>
      </View>

      {/* Gastos fijos */}
      {recurringTxs.length > 0 && (
        <View style={styles.compCard}>
          <Text style={styles.compTitle}>🔁 Gastos fijos este mes</Text>
          {recurringTxs.slice(0, 3).map((t) => (
            <View key={t.id} style={styles.fixedRow}>
              <Text style={styles.fixedGlosa} numberOfLines={1}>{t.rawGlosa}</Text>
              <Text style={styles.fixedAmount}>{fmt(t.amountClp)}</Text>
            </View>
          ))}
          {recurringTxs.length > 3 && (
            <Text style={styles.fixedMore}>+{recurringTxs.length - 3} más</Text>
          )}
          <View style={styles.fixedTotal}>
            <Text style={styles.fixedTotalLabel}>Total fijos</Text>
            <Text style={[styles.fixedTotalValue, { color: colors.danger }]}>{fmt(recurringTotal)}</Text>
          </View>
        </View>
      )}

      {/* Comparativo mes anterior */}
      {expDiff !== null && incDiff !== null && (
        <View style={styles.compCard}>
          <Text style={styles.compTitle}>Vs. mes anterior</Text>
          <View style={styles.compRow}>
            <View style={styles.compItem}>
              <Text style={styles.compLabel}>Ingresos</Text>
              <Text style={[styles.compValue, { color: incDiff >= 0 ? colors.success : colors.danger }]}>
                {incDiff >= 0 ? "▲" : "▼"} {fmt(Math.abs(incDiff))}
              </Text>
            </View>
            <View style={styles.compDivider} />
            <View style={styles.compItem}>
              <Text style={styles.compLabel}>Egresos</Text>
              <Text style={[styles.compValue, { color: expDiff <= 0 ? colors.success : colors.danger }]}>
                {expDiff > 0 ? "▲" : "▼"} {fmt(Math.abs(expDiff))}
              </Text>
            </View>
          </View>
          <Text style={styles.compHint}>
            {expDiff <= 0
              ? `Gastaste ${fmt(Math.abs(expDiff))} menos que el mes pasado`
              : `Gastaste ${fmt(expDiff)} más que el mes pasado`}
          </Text>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Últimos movimientos</Text>
      </View>

      {recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>💸</Text>
          <Text style={styles.emptyTitle}>Sin movimientos aún</Text>
          <Text style={styles.emptySubtitle}>Toca el botón + para registrar tu primer movimiento</Text>
        </View>
      ) : (
        recent.map((tx) => (
          <View key={tx.id} style={styles.txRow}>
            <View style={[styles.txDot, { backgroundColor: tx.type === "income" ? colors.successDim : colors.dangerDim }]}>
              <Text style={styles.txDotIcon}>{tx.type === "income" ? "+" : "−"}</Text>
            </View>
            <View style={styles.txBody}>
              <Text style={styles.txGlosa} numberOfLines={1}>{tx.rawGlosa}</Text>
              <Text style={styles.txDate}>{new Date(tx.occurredAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</Text>
            </View>
            <Text style={[styles.txAmount, { color: tx.type === "income" ? colors.success : colors.danger }]}>
              {tx.type === "income" ? "+" : "−"}{fmt(tx.amountClp)}
            </Text>
          </View>
        ))
      )}

      {/* Profile modal */}
      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={() => { setShowProfile(false); onLogout(); }}
          onProfileUpdated={(u) => { onUserUpdated(u); setShowProfile(false); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  greeting: { color: colors.text, fontSize: 22, fontWeight: "800" },
  monthLabel: { color: colors.textMuted, fontSize: 13, marginTop: 2, textTransform: "capitalize" },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontWeight: "800", fontSize: 17 },

  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 4,
  },
  balanceLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  balanceAmount: { color: colors.text, fontSize: 40, fontWeight: "800", letterSpacing: -1, marginVertical: 4 },
  amountNeg: { color: colors.danger },
  balanceRow: { flexDirection: "row", marginTop: 16, gap: 0 },
  balanceItem: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  balanceDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  balanceItemLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  balanceItemAmount: { fontSize: 14, fontWeight: "700", marginTop: 2 },

  spendCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  spendCardLeft: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  spendLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  spendValue: { color: colors.warning, fontSize: 18, fontWeight: "800" },
  progressOuter: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  progressInner: { height: "100%", borderRadius: 4, backgroundColor: colors.success },

  fixedRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  fixedGlosa: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1, marginRight: 8 },
  fixedAmount: { color: colors.danger, fontSize: 13, fontWeight: "700" },
  fixedMore: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
  fixedTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 },
  fixedTotalLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  fixedTotalValue: { fontSize: 14, fontWeight: "800" },

  compCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  compTitle: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  compRow: { flexDirection: "row", alignItems: "center" },
  compItem: { flex: 1, gap: 4 },
  compDivider: { width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: 12 },
  compLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  compValue: { fontSize: 15, fontWeight: "800" },
  compHint: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },

  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { color: colors.text, fontWeight: "700", fontSize: 16 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, textAlign: "center" },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  txDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txDotIcon: { fontWeight: "800", fontSize: 18, color: colors.text },
  txBody: { flex: 1, gap: 2 },
  txGlosa: { color: colors.text, fontWeight: "600", fontSize: 14 },
  txDate: { color: colors.textMuted, fontSize: 12 },
  txAmount: { fontSize: 14, fontWeight: "700" },
});
