import {
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../theme/colors";
import { CategoryItem, TransactionItem } from "../api/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function fmt(v: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(v);
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString("es-CL", { month: "long", year: "numeric" });
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  } catch { return ""; }
}

// ─── Swipeable Transaction Row ─────────────────────────────────────────────────

const REVEAL_W = 82;
const AUTO_DELETE_W = 220;

function SwipeRow({
  item,
  catLabel,
  openRowId,
  onSetOpen,
  onDelete,
  onEdit,
  isRecurring = false,
}: {
  item: TransactionItem;
  catLabel: string | null;
  openRowId: string | null;
  onSetOpen: (id: string | null) => void;
  onDelete: () => void;
  onEdit: () => void;
  isRecurring?: boolean;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const txVal = useRef(0);
  const startVal = useRef(0);
  const isDeleting = useRef(false);

  useEffect(() => {
    const id = tx.addListener(({ value }) => { txVal.current = value; });
    return () => tx.removeListener(id);
  }, [tx]);

  // Close when another row opens
  useEffect(() => {
    if (openRowId !== item.id && !isDeleting.current) {
      Animated.spring(tx, { toValue: 0, useNativeDriver: false, tension: 120, friction: 14 }).start();
    }
  }, [openRowId, item.id, tx]);

  function triggerDeleteAnimation() {
    if (isDeleting.current) return;
    isDeleting.current = true;
    Animated.timing(tx, { toValue: -500, useNativeDriver: false, duration: 200 }).start(() => {
      onDelete();
    });
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 1.3,
      onPanResponderGrant: () => {
        startVal.current = txVal.current;
      },
      onPanResponderMove: (_, { dx }) => {
        const clamped = Math.max(-AUTO_DELETE_W, Math.min(REVEAL_W + 20, startVal.current + dx));
        tx.setValue(clamped);
      },
      onPanResponderRelease: (_, { dx }) => {
        const finalVal = startVal.current + dx;
        if (finalVal < -AUTO_DELETE_W * 0.85) {
          onSetOpen(null);
          triggerDeleteAnimation();
        } else if (finalVal < -REVEAL_W * 0.5) {
          onSetOpen(item.id);
          Animated.spring(tx, { toValue: -REVEAL_W, useNativeDriver: false, tension: 130, friction: 14 }).start();
        } else if (finalVal > REVEAL_W * 0.5) {
          onSetOpen(item.id);
          Animated.spring(tx, { toValue: REVEAL_W, useNativeDriver: false, tension: 130, friction: 14 }).start();
        } else {
          onSetOpen(null);
          Animated.spring(tx, { toValue: 0, useNativeDriver: false, tension: 130, friction: 14 }).start();
        }
      },
      onPanResponderTerminate: () => {
        onSetOpen(null);
        Animated.spring(tx, { toValue: 0, useNativeDriver: false }).start();
      },
    })
  ).current;

  const editWidth = tx.interpolate({ inputRange: [0, REVEAL_W + 20], outputRange: [0, REVEAL_W + 20], extrapolate: "clamp" });
  const deleteWidth = tx.interpolate({ inputRange: [-AUTO_DELETE_W, 0], outputRange: [AUTO_DELETE_W, 0], extrapolate: "clamp" });
  const editOpacity = tx.interpolate({ inputRange: [10, REVEAL_W], outputRange: [0, 1], extrapolate: "clamp" });
  const deleteOpacity = tx.interpolate({ inputRange: [-REVEAL_W, -10], outputRange: [1, 0], extrapolate: "clamp" });

  return (
    <View style={swipeStyles.container}>
      {/* Background action areas */}
      <View style={swipeStyles.actionsRow}>
        {/* EDIT – left */}
        <Animated.View style={[swipeStyles.editArea, { width: editWidth, opacity: editOpacity }]}>
          <Pressable style={swipeStyles.editInner} onPress={onEdit}>
            <Text style={swipeStyles.editIcon}>✏️</Text>
            <Text style={swipeStyles.editLabel}>Editar</Text>
          </Pressable>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* DELETE – right */}
        <Animated.View style={[swipeStyles.deleteArea, { width: deleteWidth, opacity: deleteOpacity }]}>
          <Pressable style={swipeStyles.deleteInner} onPress={triggerDeleteAnimation}>
            <Text style={swipeStyles.deleteIcon}>🗑</Text>
            <Text style={swipeStyles.deleteLabel}>Eliminar</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Sliding row */}
      <Animated.View style={[swipeStyles.rowSurface, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <View style={styles.txIcon2Wrap}>
          <View style={[styles.txIcon, { backgroundColor: item.type === "income" ? colors.successDim : colors.dangerDim }]}>
            <Text style={[styles.txIconText, { color: item.type === "income" ? colors.success : colors.danger }]}>
              {item.type === "income" ? "+" : "−"}
            </Text>
          </View>
        </View>
        <View style={styles.txMid}>
          <View style={styles.txGlosaRow}>
            <Text style={styles.txGlosa} numberOfLines={1}>{item.rawGlosa}</Text>
            {isRecurring && <Text style={styles.txRecurring}>🔁</Text>}
          </View>
          <View style={styles.txMeta}>
            {catLabel ? <Text style={styles.txCat}>{catLabel}</Text> : null}
            <Text style={styles.txDate}>{formatDate(item.occurredAt)}</Text>
          </View>
        </View>
        <Text style={[styles.txAmount, { color: item.type === "income" ? colors.success : colors.danger }]}>
          {item.type === "income" ? "+" : "−"}{fmt(item.amountClp)}
        </Text>
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  container: { overflow: "hidden", borderRadius: 14, marginBottom: 8 },
  actionsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  editArea: {
    backgroundColor: colors.primaryDim,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    overflow: "hidden",
  },
  editInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  editIcon: { fontSize: 16 },
  editLabel: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  deleteArea: {
    backgroundColor: colors.dangerDim,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    overflow: "hidden",
  },
  deleteInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  deleteIcon: { fontSize: 16 },
  deleteLabel: { color: colors.danger, fontSize: 11, fontWeight: "700" },
  rowSurface: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
});

// ─── Edit Modal ─────────────────────────────────────────────────────────────────

function EditModal({
  item,
  categories,
  onSave,
  onClose,
}: {
  item: TransactionItem;
  categories: CategoryItem[];
  onSave: (payload: { type: "income" | "expense"; amountClp: number; rawGlosa: string; categoryId?: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">(item.type);
  const [amountRaw, setAmountRaw] = useState(String(item.amountClp));
  const [glosa, setGlosa] = useState(item.rawGlosa);
  const [parentCatId, setParentCatId] = useState<string | undefined>(() => {
    if (!item.categoryId) return undefined;
    const isParent = categories.some((c) => c.id === item.categoryId);
    if (isParent) return item.categoryId;
    for (const c of categories) {
      if (c.subcategories?.some((s) => s.id === item.categoryId)) return c.id;
    }
    return undefined;
  });
  const [subCatId, setSubCatId] = useState<string | undefined>(() => {
    if (!item.categoryId) return undefined;
    return categories.some((c) => c.id === item.categoryId) ? undefined : item.categoryId;
  });
  const [saving, setSaving] = useState(false);

  const amountNum = useMemo(() => {
    const n = parseInt(amountRaw.replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }, [amountRaw]);

  const selectedParent = categories.find((c) => c.id === parentCatId);
  const effectiveCategoryId = subCatId ?? parentCatId ?? null;
  const canSave = amountNum > 0 && glosa.trim().length >= 2 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ type, amountClp: amountNum, rawGlosa: glosa.trim(), categoryId: effectiveCategoryId });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const isIncome = type === "income";
  const accentColor = isIncome ? colors.success : colors.danger;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={editStyles.overlay} onPress={onClose} />
      <View style={editStyles.sheet}>
        <View style={editStyles.handle} />
        <View style={editStyles.header}>
          <Text style={editStyles.title}>Editar movimiento</Text>
          <Pressable onPress={onClose} style={editStyles.closeBtn}>
            <Text style={editStyles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Type toggle */}
          <View style={editStyles.typeRow}>
            <Pressable
              style={[editStyles.typeBtn, !isIncome && { borderColor: colors.danger, backgroundColor: colors.dangerDim }]}
              onPress={() => setType("expense")}
            >
              <Text style={[editStyles.typeBtnText, !isIncome && { color: colors.danger }]}>− Egreso</Text>
            </Pressable>
            <Pressable
              style={[editStyles.typeBtn, isIncome && { borderColor: colors.success, backgroundColor: colors.successDim }]}
              onPress={() => setType("income")}
            >
              <Text style={[editStyles.typeBtnText, isIncome && { color: colors.success }]}>+ Ingreso</Text>
            </Pressable>
          </View>

          {/* Amount */}
          <View style={[editStyles.amountCard, { borderColor: accentColor }]}>
            <Text style={[editStyles.amountPrefix, { color: accentColor }]}>$</Text>
            <TextInput
              style={[editStyles.amountInput, { color: accentColor }]}
              value={amountRaw}
              onChangeText={setAmountRaw}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={editStyles.amountSuffix}>CLP</Text>
          </View>

          {/* Description */}
          <TextInput
            style={editStyles.input}
            value={glosa}
            onChangeText={setGlosa}
            placeholder="Descripción"
            placeholderTextColor={colors.textMuted}
          />

          {/* Category */}
          <Text style={editStyles.label}>Categoría</Text>
          <View style={editStyles.catGrid}>
            {categories.map((cat) => {
              const isSel = parentCatId === cat.id;
              const cc = cat.colorHex ?? colors.primary;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => { setParentCatId(isSel ? undefined : cat.id); setSubCatId(undefined); }}
                  style={[
                    editStyles.catChip,
                    isSel ? { borderColor: cc, backgroundColor: `${cc}22` } : { borderColor: colors.border },
                  ]}
                >
                  {cat.icon ? <Text style={editStyles.catIcon}>{cat.icon}</Text> : null}
                  <Text style={[editStyles.catName, isSel && { color: cc }]}>{cat.name}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Subcategory */}
          {selectedParent && (selectedParent.subcategories?.length ?? 0) > 0 && (
            <>
              <Text style={editStyles.label}>Subcategoría</Text>
              <View style={editStyles.subRow}>
                {(selectedParent.subcategories ?? []).map((sub) => {
                  const isSel = subCatId === sub.id;
                  const sc = sub.colorHex ?? selectedParent.colorHex ?? colors.primary;
                  return (
                    <Pressable
                      key={sub.id}
                      onPress={() => setSubCatId(isSel ? undefined : sub.id)}
                      style={[
                        editStyles.subChip,
                        isSel ? { borderColor: sc, backgroundColor: `${sc}22` } : { borderColor: colors.border },
                      ]}
                    >
                      <Text style={[editStyles.subName, isSel && { color: sc }]}>{sub.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Pressable
            style={[editStyles.saveBtn, !canSave && editStyles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={editStyles.saveBtnText}>{saving ? "Guardando…" : "Guardar cambios"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: 20,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceHigh, alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  typeBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: colors.surfaceHigh,
  },
  typeBtnText: { color: colors.textMuted, fontWeight: "800", fontSize: 14 },
  amountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
  },
  amountPrefix: { fontSize: 22, fontWeight: "800" },
  amountInput: { flex: 1, fontSize: 32, fontWeight: "800", paddingVertical: 8 },
  amountSuffix: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    marginBottom: 12,
  },
  label: { color: colors.textSub, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surfaceHigh,
  },
  catIcon: { fontSize: 13 },
  catName: { color: colors.textSub, fontSize: 12, fontWeight: "600" },
  subRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  subChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceHigh,
  },
  subName: { color: colors.textSub, fontSize: 12, fontWeight: "600" },
  saveBtn: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 15,
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

// ─── Main Screen ────────────────────────────────────────────────────────────────

export function TransactionsScreen({
  transactions,
  categories,
  month,
  onMonthChange,
  shiftMonth,
  onDelete,
  onUpdate,
  recurringIds = new Set<string>(),
}: {
  transactions: TransactionItem[];
  categories: CategoryItem[];
  month: string;
  onMonthChange: (m: string) => void;
  shiftMonth: (m: string, d: number) => string;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (
    id: string,
    payload: { type?: "income" | "expense"; amountClp?: number; rawGlosa?: string; categoryId?: string | null }
  ) => Promise<void>;
  recurringIds?: Set<string>;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Build a map: parent category id → all child ids (including itself)
  const catChildIds = useMemo<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>();
    for (const cat of categories) {
      const ids = new Set<string>([cat.id]);
      for (const sub of cat.subcategories ?? []) ids.add(sub.id);
      map.set(cat.id, ids);
    }
    return map;
  }, [categories]);

  const flatCategories = useMemo<{ id: string; name: string }[]>(() => {
    const result: { id: string; name: string }[] = [{ id: "all", name: "Todas" }];
    for (const cat of categories) result.push({ id: cat.id, name: cat.name });
    return result;
  }, [categories]);

  const filtered = useMemo(
    () =>
      transactions.filter((item) => {
        if (typeFilter !== "all" && item.type !== typeFilter) return false;
        if (categoryFilter !== "all") {
          const ids = catChildIds.get(categoryFilter);
          if (!ids || !item.categoryId || !ids.has(item.categoryId)) return false;
        }
        if (search.trim()) {
          if (!item.rawGlosa.toLowerCase().includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [catChildIds, categoryFilter, transactions, typeFilter, search]
  );

  const incomeTotal = useMemo(
    () => filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amountClp, 0),
    [filtered]
  );
  const expenseTotal = useMemo(
    () => filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amountClp, 0),
    [filtered]
  );

  const handleSetOpen = useCallback((id: string | null) => setOpenRowId(id), []);

  function getCatLabel(item: TransactionItem): string | null {
    if (!item.categoryId) return null;
    const parent = categories.find((c) => c.id === item.categoryId);
    if (parent) return parent.name;
    for (const c of categories) {
      const sub = c.subcategories?.find((s) => s.id === item.categoryId);
      if (sub) return `${c.name} · ${sub.name}`;
    }
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Movimientos</Text>
        <Pressable
          onPress={() => { setShowSearch((v) => !v); if (showSearch) setSearch(""); }}
          style={[styles.searchToggleBtn, showSearch && styles.searchToggleBtnActive]}
        >
          <Text style={styles.searchToggleIcon}>{showSearch ? "✕" : "🔍"}</Text>
        </Pressable>
      </View>

      {showSearch && (
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar movimiento..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoFocus
          returnKeyType="search"
        />
      )}

      {/* Month selector */}
      <View style={styles.monthRow}>
        <Pressable onPress={() => onMonthChange(shiftMonth(month, -1))} style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <Pressable onPress={() => onMonthChange(shiftMonth(month, 1))} style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>›</Text>
        </Pressable>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryChip, { backgroundColor: colors.successDim, borderColor: colors.success }]}>
          <Text style={[styles.summaryLabel, { color: colors.success }]}>Ingresos</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{fmt(incomeTotal)}</Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: colors.dangerDim, borderColor: colors.danger }]}>
          <Text style={[styles.summaryLabel, { color: colors.danger }]}>Egresos</Text>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{fmt(expenseTotal)}</Text>
        </View>
      </View>

      {/* Type filter */}
      <View style={styles.typeRow}>
        {(["all", "income", "expense"] as const).map((type) => (
          <Pressable
            key={type}
            style={[styles.typeChip, typeFilter === type && styles.typeChipActive]}
            onPress={() => setTypeFilter(type)}
          >
            <Text style={[styles.typeText, typeFilter === type && styles.typeTextActive]}>
              {type === "all" ? "Todos" : type === "income" ? "Ingresos" : "Egresos"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Category filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={flatCategories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.catRow}
        style={styles.catList}
        renderItem={({ item: cat }) => (
          <Pressable
            style={[styles.catChip, categoryFilter === cat.id && styles.catChipActive]}
            onPress={() => setCategoryFilter(cat.id)}
          >
            <Text style={[styles.catText, categoryFilter === cat.id && styles.catTextActive]}>{cat.name}</Text>
          </Pressable>
        )}
      />

      {/* Hint */}
      {filtered.length > 0 && (
        <Text style={styles.hint}>← Desliza para eliminar  ·  Desliza → para editar</Text>
      )}

      {/* Transaction list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <SwipeRow
            item={item}
            catLabel={getCatLabel(item)}
            openRowId={openRowId}
            onSetOpen={handleSetOpen}
            onDelete={() => onDelete(item.id)}
            onEdit={() => { setOpenRowId(null); setEditingTx(item); }}
            isRecurring={recurringIds.has(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Sin movimientos en este mes</Text>
            <Text style={styles.emptyHint}>Toca + para agregar uno</Text>
          </View>
        }
      />

      {/* Edit modal */}
      {editingTx && (
        <EditModal
          item={editingTx}
          categories={categories}
          onClose={() => setEditingTx(null)}
          onSave={(payload) => onUpdate(editingTx.id, payload)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  searchToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  searchToggleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  searchToggleIcon: { fontSize: 16 },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },

  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  monthBtnText: { color: colors.text, fontSize: 22, fontWeight: "700" },
  monthLabel: { color: colors.text, fontSize: 16, fontWeight: "700", textTransform: "capitalize" },

  summaryRow: { flexDirection: "row", gap: 10 },
  summaryChip: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  summaryLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { fontSize: 17, fontWeight: "800" },

  typeRow: { flexDirection: "row", gap: 8 },
  typeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  typeText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  typeTextActive: { color: colors.primary },

  catList: { maxHeight: 46, flexGrow: 0 },
  catRow: { gap: 8, paddingRight: 8 },
  catChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  catChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  catText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  catTextActive: { color: colors.primary },

  hint: { color: colors.textMuted, fontSize: 11, textAlign: "center" },

  txIcon2Wrap: {},
  txIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  txIconText: { fontSize: 18, fontWeight: "800" },
  txMid: { flex: 1, gap: 3 },
  txGlosaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  txGlosa: { color: colors.text, fontWeight: "600", fontSize: 14, flexShrink: 1 },
  txRecurring: { fontSize: 11 },
  txMeta: { flexDirection: "row", gap: 8, alignItems: "center" },
  txCat: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  txDate: { color: colors.textMuted, fontSize: 11 },
  txAmount: { fontSize: 15, fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: colors.text, fontWeight: "700", fontSize: 15 },
  emptyHint: { color: colors.textMuted, fontSize: 13 },
});
