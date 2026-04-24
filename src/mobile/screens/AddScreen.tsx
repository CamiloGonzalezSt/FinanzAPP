import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";
import { CategoryItem } from "../api/client";
import { useMemo, useState } from "react";

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function formatDateLabel(d: Date): string {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
  const dayStr = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (diff === 0) return `Hoy, ${dayStr}`;
  if (diff === -1) return `Ayer, ${dayStr}`;
  if (diff === -2) return `Anteayer, ${dayStr}`;
  return dayStr;
}

function fmt(v: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);
}

export function AddScreen({
  categories,
  onSave,
  onDone,
}: {
  categories: CategoryItem[];
  onSave: (payload: {
    type: "income" | "expense";
    amountClp: number;
    rawGlosa: string;
    categoryId?: string;
    occurredAt?: string;
    recurring?: boolean;
  }) => Promise<void>;
  onDone?: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amountRaw, setAmountRaw] = useState("");
  const [glosa, setGlosa] = useState("");
  const [parentCatId, setParentCatId] = useState<string | undefined>(undefined);
  const [subCatId, setSubCatId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [txDate, setTxDate] = useState<Date>(startOfDay(new Date()));
  const [recurring, setRecurring] = useState(false);

  const isToday = startOfDay(txDate).getTime() === startOfDay(new Date()).getTime();
  const isFuture = txDate > startOfDay(new Date());

  const amountNum = useMemo(() => {
    const cleaned = amountRaw.replace(/[^0-9]/g, "");
    return cleaned.length > 0 ? Number(cleaned) : 0;
  }, [amountRaw]);

  const selectedParent = useMemo(() => categories.find((c) => c.id === parentCatId), [categories, parentCatId]);
  const effectiveCategoryId = subCatId ?? parentCatId;

  const canSave = amountNum > 0 && glosa.trim().length >= 2 && !saving;

  function handleSelectParent(id: string) {
    if (parentCatId === id) { setParentCatId(undefined); setSubCatId(undefined); return; }
    setParentCatId(id);
    setSubCatId(undefined);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        type,
        amountClp: amountNum,
        rawGlosa: glosa.trim(),
        categoryId: effectiveCategoryId,
        occurredAt: txDate.toISOString(),
        recurring,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmountRaw("");
      setGlosa("");
      setParentCatId(undefined);
      setSubCatId(undefined);
      setDone(true);
      setTimeout(() => { setDone(false); onDone?.(); }, 800);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "No se pudo guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  const isIncome = type === "income";
  const accentColor = isIncome ? colors.success : colors.danger;
  const accentDim = isIncome ? colors.successDim : colors.dangerDim;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Nuevo movimiento</Text>

      {/* Type toggle */}
      <View style={styles.typeRow}>
        <Pressable
          style={[styles.typeBtn, !isIncome && { borderColor: colors.danger, backgroundColor: colors.dangerDim }]}
          onPress={() => setType("expense")}
        >
          <Text style={[styles.typeBtnText, !isIncome && { color: colors.danger }]}>− Egreso</Text>
        </Pressable>
        <Pressable
          style={[styles.typeBtn, isIncome && { borderColor: colors.success, backgroundColor: colors.successDim }]}
          onPress={() => setType("income")}
        >
          <Text style={[styles.typeBtnText, isIncome && { color: colors.success }]}>+ Ingreso</Text>
        </Pressable>
      </View>

      {/* Amount */}
      <View style={[styles.amountCard, { borderColor: accentColor }]}>
        <Text style={[styles.amountCurrency, { color: accentColor }]}>$</Text>
        <TextInput
          style={[styles.amountInput, { color: accentColor }]}
          value={amountRaw}
          onChangeText={setAmountRaw}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={accentDim}
        />
        <Text style={styles.amountCLP}>CLP</Text>
      </View>
      {amountNum > 0 && <Text style={styles.amountFormatted}>{fmt(amountNum)}</Text>}

      {/* Description */}
      <TextInput
        style={styles.input}
        value={glosa}
        onChangeText={setGlosa}
        placeholder="Descripción  (ej: Supermercado Lider)"
        placeholderTextColor={colors.textMuted}
        multiline={false}
        maxLength={120}
      />

      {/* Category picker */}
      <Text style={styles.label}>Categoría</Text>
      <View style={styles.catGrid}>
        {categories.map((cat) => {
          const isSelected = parentCatId === cat.id;
          const catColor = cat.colorHex ?? colors.primary;
          return (
            <Pressable
              key={cat.id}
              onPress={() => handleSelectParent(cat.id)}
              style={[
                styles.catChip,
                isSelected
                  ? { borderColor: catColor, backgroundColor: `${catColor}22` }
                  : { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              {cat.icon ? <Text style={styles.catIcon}>{cat.icon}</Text> : null}
              <Text style={[styles.catName, isSelected && { color: catColor }]}>{cat.name}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Subcategory picker */}
      {selectedParent && (selectedParent.subcategories?.length ?? 0) > 0 && (
        <>
          <Text style={styles.label}>Subcategoría</Text>
          <View style={styles.subRow}>
            {(selectedParent.subcategories ?? []).map((sub) => {
              const isSel = subCatId === sub.id;
              const subColor = sub.colorHex ?? selectedParent.colorHex ?? colors.primary;
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => setSubCatId(isSel ? undefined : sub.id)}
                  style={[
                    styles.subChip,
                    isSel
                      ? { borderColor: subColor, backgroundColor: `${subColor}22` }
                      : { borderColor: colors.border, backgroundColor: colors.surfaceHigh },
                  ]}
                >
                  <Text style={[styles.subName, isSel && { color: subColor }]}>{sub.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Recurring toggle */}
      <Pressable
        style={[styles.recurringRow, recurring && styles.recurringRowActive]}
        onPress={() => { void Haptics.selectionAsync(); setRecurring((v) => !v); }}
      >
        <Text style={[styles.recurringIcon]}>🔁</Text>
        <View style={styles.recurringTextWrap}>
          <Text style={[styles.recurringLabel, recurring && { color: colors.primary }]}>Gasto fijo / recurrente</Text>
          <Text style={styles.recurringHint}>Se marcará con 🔁 en tus movimientos</Text>
        </View>
        <View style={[styles.recurringCheck, recurring && styles.recurringCheckActive]}>
          {recurring && <Text style={styles.recurringCheckMark}>✓</Text>}
        </View>
      </Pressable>

      {/* Date picker */}
      <Text style={styles.label}>Fecha</Text>
      <View style={styles.dateRow}>
        <Pressable
          style={styles.dateArrow}
          onPress={() => { void Haptics.selectionAsync(); setTxDate(addDays(txDate, -1)); }}
        >
          <Text style={styles.dateArrowText}>‹</Text>
        </Pressable>
        <View style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{formatDateLabel(txDate)}</Text>
        </View>
        <Pressable
          style={[styles.dateArrow, isFuture && styles.dateArrowDisabled]}
          onPress={() => {
            if (isFuture) return;
            void Haptics.selectionAsync();
            setTxDate(addDays(txDate, 1));
          }}
        >
          <Text style={[styles.dateArrowText, isFuture && { color: colors.border }]}>›</Text>
        </Pressable>
        {!isToday && (
          <Pressable style={styles.todayChip} onPress={() => { void Haptics.selectionAsync(); setTxDate(startOfDay(new Date())); }}>
            <Text style={styles.todayChipText}>Hoy</Text>
          </Pressable>
        )}
      </View>

      {/* Save button */}
      <Pressable
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled, done && styles.saveBtnDone]}
        onPress={handleSave}
        disabled={!canSave}
      >
        <Text style={styles.saveBtnText}>
          {done ? "✓ Guardado" : saving ? "Guardando…" : `Guardar ${type === "income" ? "ingreso" : "egreso"}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },

  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  typeBtnText: { color: colors.textMuted, fontWeight: "800", fontSize: 15 },

  amountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  amountCurrency: { fontSize: 28, fontWeight: "800" },
  amountInput: { flex: 1, fontSize: 40, fontWeight: "800", paddingVertical: 8 },
  amountCLP: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  amountFormatted: { color: colors.textMuted, fontSize: 13, marginTop: -8, marginLeft: 4 },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },

  label: { color: colors.textSub, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  catIcon: { fontSize: 14 },
  catName: { color: colors.textSub, fontWeight: "600", fontSize: 13 },

  subRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  subName: { color: colors.textSub, fontSize: 13, fontWeight: "600" },

  recurringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  recurringRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  recurringIcon: { fontSize: 20 },
  recurringTextWrap: { flex: 1 },
  recurringLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  recurringHint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  recurringCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  recurringCheckActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  recurringCheckMark: { color: "#fff", fontSize: 12, fontWeight: "800" },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dateArrow: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
  },
  dateArrowDisabled: { opacity: 0.35 },
  dateArrowText: { color: colors.text, fontSize: 20, fontWeight: "600" },
  dateLabelWrap: { flex: 1, alignItems: "center" },
  dateLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  todayChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  todayChipText: { color: colors.primary, fontSize: 12, fontWeight: "700" },

  saveBtn: {
    marginTop: 8,
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 17,
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnDone: { backgroundColor: colors.success },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
