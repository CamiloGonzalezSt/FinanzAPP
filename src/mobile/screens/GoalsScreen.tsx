import React, { useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";
import { GoalItem } from "../api/client";

function fmt(v: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);
}

// ─── Goal Management Modal ───────────────────────────────────────────────────

type ManageTab = "add" | "withdraw" | "edit";

function GoalManageModal({
  goal,
  onClose,
  onContribute,
  onUpdate,
  onDelete,
}: {
  goal: GoalItem;
  onClose: () => void;
  onContribute: (goalId: string, amountClp: number) => Promise<void>;
  onUpdate: (goalId: string, payload: { name?: string; targetAmountClp?: number; monthlyContributionClp?: number }) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<ManageTab>("add");
  const [amount, setAmount] = useState("");
  const [editName, setEditName] = useState(goal.name);
  const [editTarget, setEditTarget] = useState(String(goal.targetAmountClp));
  const [editMonthly, setEditMonthly] = useState(String(goal.monthlyContributionClp));
  const [loading, setLoading] = useState(false);

  const amountNum = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const canAdd = amountNum > 0;
  const canWithdraw = amountNum > 0 && amountNum <= goal.currentAmountClp;
  const canEdit =
    editName.trim().length >= 2 &&
    Number(editTarget) > 0 &&
    Number(editMonthly) > 0 &&
    (editName.trim() !== goal.name ||
      Number(editTarget) !== goal.targetAmountClp ||
      Number(editMonthly) !== goal.monthlyContributionClp);

  async function handleAdd() {
    if (!canAdd) return;
    setLoading(true);
    try {
      await onContribute(goal.id, amountNum);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert("Error", "No se pudo registrar el aporte.");
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    if (!canWithdraw) return;
    setLoading(true);
    try {
      await onContribute(goal.id, -amountNum);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onClose();
    } catch {
      Alert.alert("Error", "No se pudo registrar el retiro.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit() {
    if (!canEdit) return;
    setLoading(true);
    try {
      await onUpdate(goal.id, {
        name: editName.trim(),
        targetAmountClp: Number(editTarget),
        monthlyContributionClp: Number(editMonthly),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert("Error", "No se pudo actualizar la meta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { Keyboard.dismiss(); onClose(); }}>
      <KeyboardAvoidingView
        style={mStyles.kavContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Tap outside to close */}
        <Pressable style={mStyles.overlay} onPress={() => { Keyboard.dismiss(); onClose(); }} />

        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />

          {/* Header — always visible */}
          <Text style={mStyles.goalName} numberOfLines={1}>{goal.name}</Text>
          <Text style={mStyles.goalBalance}>
            Ahorrado: <Text style={{ color: colors.success }}>{fmt(goal.currentAmountClp)}</Text>
            {"  /  "}
            <Text style={{ color: colors.textSub }}>{fmt(goal.targetAmountClp)}</Text>
          </Text>

          {/* Tabs */}
          <View style={mStyles.tabs}>
            {(["add", "withdraw", "edit"] as ManageTab[]).map((t) => (
              <Pressable
                key={t}
                style={[mStyles.tab, tab === t && mStyles.tabActive]}
                onPress={() => { Keyboard.dismiss(); setTab(t); setAmount(""); }}
              >
                <Text style={[mStyles.tabText, tab === t && mStyles.tabTextActive]}>
                  {t === "add" ? "➕ Aportar" : t === "withdraw" ? "➖ Retirar" : "✏️ Editar"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Scrollable content — prevents button going under keyboard */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={mStyles.scrollContent}
          >
            {/* ── Add tab ──────────────────────────────── */}
            {tab === "add" && (
              <View style={mStyles.tabContent}>
                <Text style={mStyles.label}>Monto a aportar</Text>
                <View style={mStyles.amountRow}>
                  <Text style={mStyles.currencySign}>$</Text>
                  <TextInput
                    style={mStyles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={handleAdd}
                  />
                  <Text style={mStyles.clpLabel}>CLP</Text>
                </View>
                {amountNum > 0 && <Text style={mStyles.amountHint}>{fmt(amountNum)}</Text>}

                <View style={mStyles.quickRow}>
                  {[goal.monthlyContributionClp, Math.round(goal.monthlyContributionClp / 2), goal.monthlyContributionClp * 2].map((v) => (
                    <Pressable key={v} style={mStyles.quickChip} onPress={() => { Keyboard.dismiss(); setAmount(String(v)); }}>
                      <Text style={mStyles.quickChipText}>{fmtShort(v)}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={[mStyles.actionBtn, mStyles.addBtn, !canAdd && { opacity: 0.4 }]}
                  onPress={() => { Keyboard.dismiss(); void handleAdd(); }}
                >
                  <Text style={mStyles.actionBtnText}>
                    {loading ? "Guardando…" : canAdd ? `Aportar ${fmt(amountNum)}` : "Ingresa un monto"}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ── Withdraw tab ─────────────────────────── */}
            {tab === "withdraw" && (
              <View style={mStyles.tabContent}>
                {goal.currentAmountClp === 0 ? (
                  <View style={mStyles.emptyState}>
                    <Text style={mStyles.emptyStateIcon}>🪹</Text>
                    <Text style={mStyles.emptyStateText}>Esta meta no tiene fondos para retirar.</Text>
                    <Text style={mStyles.emptyStateSub}>Usa la tab ➕ Aportar para agregar dinero primero.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={mStyles.label}>Monto a retirar</Text>
                    <View style={mStyles.amountRow}>
                      <Text style={[mStyles.currencySign, { color: colors.danger }]}>$</Text>
                      <TextInput
                        style={[mStyles.amountInput, { color: colors.danger }]}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="done"
                        onSubmitEditing={handleWithdraw}
                      />
                      <Text style={mStyles.clpLabel}>CLP</Text>
                    </View>
                    {amountNum > 0 && <Text style={mStyles.amountHint}>{fmt(amountNum)}</Text>}
                    {amountNum > goal.currentAmountClp && amountNum > 0 && (
                      <Text style={mStyles.errorHint}>⚠ Máximo disponible: {fmt(goal.currentAmountClp)}</Text>
                    )}

                    <View style={mStyles.quickRow}>
                      {[
                        Math.round(goal.currentAmountClp * 0.25),
                        Math.round(goal.currentAmountClp * 0.5),
                        goal.currentAmountClp,
                      ]
                        .filter((v) => v > 0)
                        .map((v, i) => (
                          <Pressable
                            key={i}
                            style={[mStyles.quickChip, { borderColor: `${colors.danger}55`, backgroundColor: `${colors.danger}12` }]}
                            onPress={() => { Keyboard.dismiss(); setAmount(String(v)); }}
                          >
                            <Text style={[mStyles.quickChipText, { color: colors.danger }]}>
                              {i === 0 ? "25%" : i === 1 ? "50%" : "Todo"}
                            </Text>
                          </Pressable>
                        ))}
                    </View>

                    <Pressable
                      style={[mStyles.actionBtn, mStyles.withdrawBtn, !canWithdraw && { opacity: 0.4 }]}
                      onPress={() => { Keyboard.dismiss(); void handleWithdraw(); }}
                    >
                      <Text style={mStyles.actionBtnText}>
                        {loading ? "Retirando…" : canWithdraw ? `Retirar ${fmt(amountNum)}` : "Ingresa un monto válido"}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            {/* ── Edit tab ─────────────────────────────── */}
            {tab === "edit" && (
              <View style={mStyles.tabContent}>
                <Text style={mStyles.label}>Nombre de la meta</Text>
                <TextInput
                  style={mStyles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nombre"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                />
                <Text style={mStyles.label}>Objetivo total (CLP)</Text>
                <TextInput
                  style={mStyles.input}
                  value={editTarget}
                  onChangeText={setEditTarget}
                  keyboardType="numeric"
                  placeholder="Ej: 1000000"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                />
                <Text style={mStyles.label}>Aporte mensual (CLP)</Text>
                <TextInput
                  style={mStyles.input}
                  value={editMonthly}
                  onChangeText={setEditMonthly}
                  keyboardType="numeric"
                  placeholder="Ej: 100000"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={handleEdit}
                />
                <Pressable
                  style={[mStyles.actionBtn, mStyles.editBtn, !canEdit && { opacity: 0.4 }]}
                  onPress={() => { Keyboard.dismiss(); void handleEdit(); }}
                >
                  <Text style={mStyles.actionBtnText}>{loading ? "Guardando…" : "Guardar cambios"}</Text>
                </Pressable>

                <Pressable
                  style={mStyles.deleteBtn}
                  onPress={() => {
                    Keyboard.dismiss();
                    Alert.alert(
                      "Eliminar meta",
                      `¿Seguro que quieres eliminar "${goal.name}"? Se perderán todos los aportes registrados.`,
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Eliminar",
                          style: "destructive",
                          onPress: async () => {
                            setLoading(true);
                            try {
                              await onDelete(goal.id);
                              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                              onClose();
                            } catch {
                              Alert.alert("Error", "No se pudo eliminar la meta.");
                            } finally {
                              setLoading(false);
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={mStyles.deleteBtnText}>🗑 Eliminar meta</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function fmtShort(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

const mStyles = StyleSheet.create({
  // Full-screen KAV wrapper
  kavContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  // Tap-to-close overlay (fills space above sheet)
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    // No fixed paddingBottom — ScrollView handles it
    maxHeight: "85%",
    gap: 12,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 6 },
  goalName: { color: colors.text, fontSize: 20, fontWeight: "800" },
  goalBalance: { color: colors.textMuted, fontSize: 13 },

  tabs: { flexDirection: "row", gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surfaceHigh,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: colors.primary },

  tabContent: { gap: 10 },
  label: { color: colors.textSub, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  currencySign: { color: colors.success, fontSize: 24, fontWeight: "800" },
  amountInput: { flex: 1, fontSize: 32, fontWeight: "800", color: colors.success, paddingVertical: 6 },
  clpLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  amountHint: { color: colors.textMuted, fontSize: 12, marginTop: -4 },
  errorHint: { color: colors.danger, fontSize: 12, fontWeight: "700" },

  quickRow: { flexDirection: "row", gap: 8 },
  quickChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${colors.primary}55`,
    alignItems: "center",
    backgroundColor: colors.primaryDim,
  },
  quickChipText: { color: colors.primary, fontSize: 12, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },

  actionBtn: { borderRadius: 14, alignItems: "center", paddingVertical: 15, marginTop: 4 },
  addBtn: { backgroundColor: colors.success },
  withdrawBtn: { backgroundColor: colors.danger },
  editBtn: { backgroundColor: colors.primary },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  deleteBtn: { borderRadius: 14, alignItems: "center", paddingVertical: 14, marginTop: 4, borderWidth: 1, borderColor: colors.danger, backgroundColor: `${colors.danger}15` },
  deleteBtnText: { color: colors.danger, fontWeight: "700", fontSize: 14 },

  emptyState: { alignItems: "center", gap: 10, paddingVertical: 20 },
  emptyStateIcon: { fontSize: 40 },
  emptyStateText: { color: colors.text, fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptyStateSub: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
});

// ─── Goals Screen ────────────────────────────────────────────────────────────

export function GoalsScreen({
  goals,
  onCreateGoal,
  onContribute,
  onUpdateGoal,
  onDeleteGoal,
  refreshing,
  onRefresh,
}: {
  goals: GoalItem[];
  onCreateGoal: (p: { name: string; targetAmountClp: number; monthlyContributionClp: number }) => Promise<void>;
  onContribute: (goalId: string, amountClp: number) => Promise<void>;
  onUpdateGoal: (goalId: string, payload: { name?: string; targetAmountClp?: number; monthlyContributionClp?: number }) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [monthly, setMonthly] = useState("");
  const [saving, setSaving] = useState(false);
  const [managingGoal, setManagingGoal] = useState<GoalItem | null>(null);

  const canSave = name.trim().length > 2 && Number(target) > 0 && Number(monthly) > 0 && !saving;

  async function handleCreate() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onCreateGoal({ name: name.trim(), targetAmountClp: Number(target), monthlyContributionClp: Number(monthly) });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName(""); setTarget(""); setMonthly(""); setShowForm(false);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "No se pudo crear la meta.");
    } finally { setSaving(false); }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Metas de ahorro</Text>
        <Pressable onPress={() => { void Haptics.selectionAsync(); setShowForm(!showForm); }} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{showForm ? "✕" : "+"}</Text>
        </Pressable>
      </View>

      {/* Create form */}
      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Nueva meta</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nombre  (ej: Fondo de emergencia)"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={styles.input}
            value={target}
            onChangeText={setTarget}
            keyboardType="numeric"
            placeholder="Objetivo en CLP  (ej: 1000000)"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={styles.input}
            value={monthly}
            onChangeText={setMonthly}
            keyboardType="numeric"
            placeholder="Aporte mensual CLP  (ej: 100000)"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={[styles.createBtn, !canSave && styles.disabled]} disabled={!canSave} onPress={handleCreate}>
            <Text style={styles.createBtnText}>{saving ? "Guardando…" : "Crear meta"}</Text>
          </Pressable>
        </View>
      )}

      {/* Goals list */}
      {goals.length === 0 && !showForm && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyTitle}>Sin metas aún</Text>
          <Text style={styles.emptyHint}>Toca + para crear tu primera meta de ahorro</Text>
        </View>
      )}

      {goals.map((goal) => {
        const pct = goal.targetAmountClp > 0 ? Math.min(1, goal.currentAmountClp / goal.targetAmountClp) : 0;
        const remaining = goal.targetAmountClp - goal.currentAmountClp;
        const months = goal.monthlyContributionClp > 0 && remaining > 0
          ? Math.ceil(remaining / goal.monthlyContributionClp)
          : null;
        const isCompleted = goal.status === "completed" || pct >= 1;

        return (
          <Pressable
            key={goal.id}
            style={[styles.goalCard, isCompleted && styles.goalCardCompleted]}
            onPress={() => { void Haptics.selectionAsync(); setManagingGoal(goal); }}
          >
            <View style={styles.goalHeader}>
              <View style={styles.goalTitleRow}>
                <Text style={styles.goalEmoji}>{isCompleted ? "✅" : "🎯"}</Text>
                <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
              </View>
              <View style={styles.goalHeaderRight}>
                <View style={[styles.statusBadge, isCompleted ? styles.statusBadgeDone : styles.statusBadgeActive]}>
                  <Text style={[styles.statusText, isCompleted ? styles.statusTextDone : styles.statusTextActive]}>
                    {isCompleted ? "Completada" : "Activa"}
                  </Text>
                </View>
                <Text style={styles.editHint}>✎</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(pct * 100, 3)}%` as `${number}%`,
                    backgroundColor: isCompleted ? colors.success : pct > 0.75 ? colors.warning : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressPct}>{Math.round(pct * 100)}% completado</Text>

            <View style={styles.goalStats}>
              <View style={styles.goalStat}>
                <Text style={styles.statLabel}>Ahorrado</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>{fmt(goal.currentAmountClp)}</Text>
              </View>
              <View style={styles.goalStat}>
                <Text style={styles.statLabel}>Objetivo</Text>
                <Text style={styles.statValue}>{fmt(goal.targetAmountClp)}</Text>
              </View>
              <View style={styles.goalStat}>
                <Text style={styles.statLabel}>Faltan</Text>
                <Text style={[styles.statValue, { color: isCompleted ? colors.success : colors.textSub }]}>
                  {isCompleted ? "¡Listo!" : fmt(Math.max(0, remaining))}
                </Text>
              </View>
            </View>

            {!isCompleted && (
              <Text style={styles.monthlyText}>
                Aporte mensual: <Text style={{ color: colors.primary }}>{fmt(goal.monthlyContributionClp)}</Text>
                {months !== null ? `  ·  ~${months} mes${months !== 1 ? "es" : ""}` : ""}
              </Text>
            )}

            <View style={styles.cardHint}>
              <Text style={styles.cardHintText}>Toca para aportar, retirar o editar →</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Management modal */}
      {managingGoal && (
        <GoalManageModal
          goal={managingGoal}
          onClose={() => setManagingGoal(null)}
          onContribute={async (id, amt) => { await onContribute(id, amt); onRefresh?.(); }}
          onUpdate={async (id, payload) => { await onUpdateGoal(id, payload); onRefresh?.(); }}
          onDelete={async (id) => { await onDeleteGoal(id); onRefresh?.(); setManagingGoal(null); }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontSize: 22, fontWeight: "300", lineHeight: 26 },

  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  formTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  createBtn: { marginTop: 4, backgroundColor: colors.primary, borderRadius: 12, alignItems: "center", paddingVertical: 14 },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.45 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 36,
    alignItems: "center",
    gap: 10,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { color: colors.text, fontWeight: "700", fontSize: 16 },
  emptyHint: { color: colors.textMuted, fontSize: 13, textAlign: "center" },

  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  goalCardCompleted: { borderColor: colors.success, backgroundColor: colors.successDim },

  goalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  goalEmoji: { fontSize: 20 },
  goalName: { color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 },
  goalHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  editHint: { color: colors.textMuted, fontSize: 16 },

  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusBadgeActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  statusBadgeDone: { borderColor: colors.success, backgroundColor: colors.successDim },
  statusText: { fontSize: 11, fontWeight: "700" },
  statusTextActive: { color: colors.primary },
  statusTextDone: { color: colors.success },

  progressTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5 },
  progressPct: { color: colors.textMuted, fontSize: 11, fontWeight: "600", marginTop: -4 },

  goalStats: { flexDirection: "row", gap: 4 },
  goalStat: { flex: 1, alignItems: "center", gap: 2 },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  statValue: { color: colors.text, fontSize: 13, fontWeight: "700" },

  monthlyText: { color: colors.textMuted, fontSize: 12 },

  cardHint: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 2 },
  cardHintText: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
});
