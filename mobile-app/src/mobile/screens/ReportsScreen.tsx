import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "../theme/colors";
import {
  BudgetItem,
  CategoryItem,
  CategorySpendingItem,
  DashboardResponse,
  GoalItem,
  MonthlyComparisonItem,
  TransactionItem,
  upsertBudget,
} from "../api/client";
import { DonutChart, DONUT_COLORS } from "../components/DonutChart";

// ─── Formatters ─────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);
}

function fmtK(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

function monthShort(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString("es-CL", { month: "short" }).replace(".", "");
}

// ─── HTML Export ────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAY_NAMES   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function clpStr(v: number): string {
  const abs = Math.round(Math.abs(v));
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "-$" : "$") + s;
}

function dateStr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

function todayStr(): string {
  const d = new Date();
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

async function exportHTML(
  transactions: TransactionItem[],
  categories: CategoryItem[],
  spendingByCategory: CategorySpendingItem[],
  dashboard: DashboardResponse | null,
  goals: GoalItem[],
  month: string
) {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const catMap = new Map<string, string>(
      categories.flatMap((c) => [
        [c.id, c.name] as [string, string],
        ...(c.subcategories ?? []).map((s) => [s.id, c.name + " > " + s.name] as [string, string]),
      ])
    );

    const income  = dashboard?.incomeTotalClp  ?? 0;
    const expense = dashboard?.expenseTotalClp ?? 0;
    const balance = income - expense;
    const saving  = goals.reduce((s, g) => s + g.currentAmountClp, 0);

    const CAT_COLORS = ["#6366F1","#22C55E","#F59E0B","#EF4444","#3B82F6","#8B5CF6","#EC4899","#14B8A6"];
    const totalCatSpend = Math.max(spendingByCategory.reduce((s, i) => s + i.totalClp, 0), 1);

    const catBars = spendingByCategory.slice(0, 8).map((item, i) => {
      const pct = Math.max((item.totalClp / totalCatSpend) * 100, 2).toFixed(1);
      const color = CAT_COLORS[i % CAT_COLORS.length];
      return (
        '<div class="cat-row">' +
          '<span class="cat-name">' + item.categoryName + "</span>" +
          '<div class="bar-wrap"><div class="bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
          '<span class="cat-amt">' + clpStr(item.totalClp) + "</span>" +
        "</div>"
      );
    }).join("");

    const sorted = transactions.slice().sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    const txRows = sorted.map((tx) => {
      const isIncome = tx.type === "income";
      const color    = isIncome ? "#22C55E" : "#EF4444";
      const cat      = tx.categoryId ? (catMap.get(tx.categoryId) ?? "-") : "-";
      const glosa    = tx.rawGlosa.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return (
        "<tr>" +
          "<td>" + dateStr(tx.occurredAt) + "</td>" +
          '<td><span class="badge" style="background:' + color + '20;color:' + color + '">' + (isIncome ? "Ingreso" : "Egreso") + "</span></td>" +
          '<td class="glosa">' + glosa + "</td>" +
          "<td>" + cat + "</td>" +
          '<td style="color:' + color + ';font-weight:700;text-align:right">' + (isIncome ? "+" : "-") + clpStr(tx.amountClp) + "</td>" +
        "</tr>"
      );
    }).join("");

    const goalRows = goals.map((g) => {
      const pct = g.targetAmountClp > 0 ? Math.min(100, (g.currentAmountClp / g.targetAmountClp) * 100).toFixed(0) : "0";
      return (
        "<tr>" +
          "<td>" + g.name + "</td>" +
          '<td style="color:#22C55E;font-weight:700">' + clpStr(g.currentAmountClp) + "</td>" +
          "<td>" + clpStr(g.targetAmountClp) + "</td>" +
          '<td><div class="bar-wrap"><div class="bar-fill" style="width:' + pct + '%;background:#6366F1"></div></div></td>' +
          '<td style="text-align:right">' + pct + "%</td>" +
        "</tr>"
      );
    }).join("");

    const label = monthLabel(month);

    const parts: string[] = [];
    parts.push('<!DOCTYPE html><html lang="es"><head>');
    parts.push('<meta charset="UTF-8">');
    parts.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
    parts.push("<title>Reporte " + label + "</title>");
    parts.push("<style>");
    parts.push("*{box-sizing:border-box;margin:0;padding:0}");
    parts.push("body{font-family:Helvetica,Arial,sans-serif;background:#fff;color:#1a1a2e;padding:32px;max-width:800px;margin:0 auto;font-size:13px}");
    parts.push("h1{font-size:24px;font-weight:800;color:#1a1a2e;margin-bottom:2px}");
    parts.push(".sub{color:#64748B;font-size:12px;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #6366F1}");
    parts.push(".kpi-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:24px}");
    parts.push(".kpi{border:1.5px solid #e2e8f0;border-radius:10px;padding:14px 12px;background:#f8fafc}");
    parts.push(".kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#64748B;font-weight:700;margin-bottom:6px}");
    parts.push(".kpi-value{font-size:17px;font-weight:800}");
    parts.push(".section{border:1.5px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px;background:#fff;page-break-inside:avoid}");
    parts.push(".section-title{font-size:11px;font-weight:800;margin-bottom:12px;color:#6366F1;text-transform:uppercase;letter-spacing:.7px;padding-bottom:8px;border-bottom:1px solid #e2e8f0}");
    parts.push(".cat-row{display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:12px}");
    parts.push(".cat-name{width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#334155}");
    parts.push(".bar-wrap{flex:1;height:7px;background:#f1f5f9;border-radius:4px;overflow:hidden}");
    parts.push(".bar-fill{height:100%;border-radius:4px}");
    parts.push(".cat-amt{width:80px;text-align:right;font-weight:700;font-size:12px;color:#1a1a2e}");
    parts.push("table{width:100%;border-collapse:collapse;font-size:12px}");
    parts.push("th{text-align:left;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:0 8px 8px;font-weight:700;border-bottom:1.5px solid #e2e8f0}");
    parts.push("td{padding:9px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155}");
    parts.push("tr:last-child td{border-bottom:none}");
    parts.push("tr:nth-child(even) td{background:#f8fafc}");
    parts.push(".badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;white-space:nowrap}");
    parts.push(".glosa{max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#475569}");
    parts.push(".footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0}");
    parts.push("</style></head><body class='pdf'>");
    parts.push("<h1>Reporte financiero</h1>");
    parts.push('<p class="sub">' + label + " &middot; Generado el " + todayStr() + "</p>");
    parts.push('<div class="kpi-grid">');
    parts.push('<div class="kpi"><div class="kpi-label">Ingresos</div><div class="kpi-value" style="color:#22C55E">' + clpStr(income) + "</div></div>");
    parts.push('<div class="kpi"><div class="kpi-label">Egresos</div><div class="kpi-value" style="color:#EF4444">' + clpStr(expense) + "</div></div>");
    parts.push('<div class="kpi"><div class="kpi-label">Saldo</div><div class="kpi-value" style="color:' + (balance >= 0 ? "#22C55E" : "#EF4444") + '">' + clpStr(balance) + "</div></div>");
    parts.push('<div class="kpi"><div class="kpi-label">Ahorro total</div><div class="kpi-value" style="color:#6366F1">' + clpStr(saving) + "</div></div>");
    parts.push("</div>");

    if (spendingByCategory.length > 0) {
      parts.push('<div class="section"><div class="section-title">Gastos por categoria</div>' + catBars + "</div>");
    }
    if (transactions.length > 0) {
      parts.push('<div class="section"><div class="section-title">Movimientos (' + transactions.length + ')</div>');
      parts.push("<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripcion</th><th>Categoria</th><th>Monto</th></tr></thead>");
      parts.push("<tbody>" + txRows + "</tbody></table></div>");
    }
    if (goals.length > 0) {
      parts.push('<div class="section"><div class="section-title">Metas de ahorro</div>');
      parts.push("<table><thead><tr><th>Meta</th><th>Ahorrado</th><th>Objetivo</th><th>Progreso</th><th>%</th></tr></thead>");
      parts.push("<tbody>" + goalRows + "</tbody></table></div>");
    }
    parts.push('<p class="footer">Generado por tu app de finanzas personales</p>');
    parts.push("</body></html>");

    const html = parts.join("");
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } else {
      Alert.alert("No disponible", "Tu dispositivo no soporta compartir archivos.");
    }
  } catch (err) {
    Alert.alert("Error al exportar", err instanceof Error ? err.message : String(err));
  }
}

// ─── Budget Modal ────────────────────────────────────────────────────────────

function BudgetModal({
  category,
  existing,
  month,
  onSaved,
  onClose,
}: {
  category: CategoryItem;
  existing?: BudgetItem;
  month: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(existing ? String(existing.amountLimitClp) : "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const val = Number(amount.replace(/[^0-9]/g, ""));
    if (!val) return;
    setSaving(true);
    try {
      const [y, m] = month.split("-").map(Number);
      await upsertBudget({ categoryId: category.id, year: y, month: m, amountLimitClp: val });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch {
      Alert.alert("Error", "No se pudo guardar el presupuesto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={bStyles.overlay} onPress={onClose} />
      <View style={bStyles.sheet}>
        <Text style={bStyles.title}>
          {existing ? "Editar" : "Asignar"} presupuesto
        </Text>
        <Text style={bStyles.catName}>
          {category.icon ? `${category.icon}  ` : ""}{category.name}
        </Text>
        <TextInput
          style={bStyles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Límite mensual en CLP"
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
        <View style={bStyles.row}>
          <Pressable style={bStyles.cancelBtn} onPress={onClose}>
            <Text style={bStyles.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[bStyles.saveBtn, !amount && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={!amount || saving}
          >
            <Text style={bStyles.saveText}>{saving ? "Guardando…" : "Guardar"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const bStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 14,
    paddingBottom: 36,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  catName: { color: colors.textSub, fontSize: 15, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  row: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  cancelText: { color: colors.textMuted, fontWeight: "700", fontSize: 15 },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

// ─── Reports Screen ─────────────────────────────────────────────────────────

export function ReportsScreen({
  dashboard,
  transactions,
  goals,
  monthlyComparison,
  spendingByCategory,
  budgets,
  categories,
  month,
  refreshing,
  onRefresh,
}: {
  dashboard: DashboardResponse | null;
  transactions: TransactionItem[];
  goals: GoalItem[];
  monthlyComparison: MonthlyComparisonItem[];
  spendingByCategory: CategorySpendingItem[];
  budgets: BudgetItem[];
  categories: CategoryItem[];
  month: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const [budgetModal, setBudgetModal] = useState<CategoryItem | null>(null);

  const income = dashboard?.incomeTotalClp ?? 0;
  const expense = dashboard?.expenseTotalClp ?? 0;
  // Savings = total accumulated in goals (not balance difference)
  const saving = goals.reduce((sum, g) => sum + g.currentAmountClp, 0);
  const balance = income - expense;

  const maxBar = Math.max(...monthlyComparison.flatMap((i) => [i.incomeTotalClp, i.expenseTotalClp]), 1);

  // Build donut data with colors
  const donutData = spendingByCategory.slice(0, 8).map((item, i) => {
    const cat = categories.find((c) => c.name === item.categoryName);
    return {
      label: item.categoryName,
      value: item.totalClp,
      color: cat?.colorHex ?? DONUT_COLORS[i % DONUT_COLORS.length],
    };
  });

  const existingBudget = (cat: CategoryItem) =>
    budgets.find((b) => b.categoryId === cat.id);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
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
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Reportes</Text>
        {transactions.length > 0 && (
          <Pressable
            style={styles.exportBtn}
            onPress={() => exportHTML(transactions, categories, spendingByCategory, dashboard, goals, month)}
          >
            <Text style={styles.exportIcon}>↓</Text>
            <Text style={styles.exportLabel}>Reporte</Text>
          </Pressable>
        )}
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpi, { borderColor: `${colors.success}55` }]}>
          <Text style={styles.kpiLabel}>Ingresos</Text>
          <Text style={[styles.kpiValue, { color: colors.success }]}>{fmt(income)}</Text>
        </View>
        <View style={[styles.kpi, { borderColor: `${colors.danger}55` }]}>
          <Text style={styles.kpiLabel}>Egresos</Text>
          <Text style={[styles.kpiValue, { color: colors.danger }]}>{fmt(expense)}</Text>
        </View>
        <View style={[styles.kpi, { borderColor: `${colors.primary}55` }]}>
          <Text style={styles.kpiLabel}>Ahorro total</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>{fmt(saving)}</Text>
        </View>
        <View style={[styles.kpi, { borderColor: (balance >= 0 ? colors.success : colors.danger) + "55" }]}>
          <Text style={styles.kpiLabel}>Saldo</Text>
          <Text style={[styles.kpiValue, { color: balance >= 0 ? colors.success : colors.danger }]}>{fmt(balance)}</Text>
        </View>
      </View>

      {/* Activity summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actividad del mes</Text>
        <View style={styles.actRow}>
          <View style={styles.actItem}>
            <Text style={styles.actNumber}>{transactions.filter((t) => t.type === "income").length}</Text>
            <Text style={styles.actLabel}>ingresos</Text>
          </View>
          <View style={styles.actDivider} />
          <View style={styles.actItem}>
            <Text style={styles.actNumber}>{transactions.filter((t) => t.type === "expense").length}</Text>
            <Text style={styles.actLabel}>egresos</Text>
          </View>
          <View style={styles.actDivider} />
          <View style={styles.actItem}>
            <Text style={[styles.actNumber, { color: (dashboard?.overspendPercent ?? 0) > 80 ? colors.danger : colors.warning }]}>
              {dashboard?.overspendPercent ?? 0}%
            </Text>
            <Text style={styles.actLabel}>del ingreso</Text>
          </View>
        </View>
      </View>

      {/* Donut chart + category spending */}
      {spendingByCategory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gastos por categoría</Text>
          <DonutChart
            data={donutData}
            size={170}
            centerLabel={fmtK(expense)}
            centerSub="Gastos"
          />
          {/* Bar list */}
          <View style={styles.catList}>
            {spendingByCategory.slice(0, 8).map((item, idx) => {
              const total = spendingByCategory.reduce((s, i) => s + i.totalClp, 1);
              const cat = categories.find((c) => c.name === item.categoryName);
              const barColor = cat?.colorHex ?? DONUT_COLORS[idx % DONUT_COLORS.length];
              return (
                <View key={item.categoryName} style={styles.catRow}>
                  <View style={styles.catLeft}>
                    <Text style={styles.catRank}>#{idx + 1}</Text>
                    <Text style={styles.catName} numberOfLines={1}>{item.categoryName}</Text>
                  </View>
                  <View style={styles.catBarWrap}>
                    <View
                      style={[
                        styles.catBar,
                        {
                          width: `${Math.max((item.totalClp / total) * 100, 4)}%` as `${number}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.catAmount}>{fmtK(item.totalClp)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Monthly comparison */}
      {monthlyComparison.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comparativo mensual</Text>
          <View style={styles.chartArea}>
            {monthlyComparison.slice(-6).map((item) => {
              const incH = Math.max((item.incomeTotalClp / maxBar) * 80, 4);
              const expH = Math.max((item.expenseTotalClp / maxBar) * 80, 4);
              return (
                <View key={item.month} style={styles.barGroup}>
                  <View style={styles.barPair}>
                    <View style={[styles.bar, { height: incH, backgroundColor: colors.success }]} />
                    <View style={[styles.bar, { height: expH, backgroundColor: colors.danger }]} />
                  </View>
                  <Text style={styles.barLabel}>{monthShort(item.month)}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Ingresos</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
              <Text style={styles.legendText}>Egresos</Text>
            </View>
          </View>
        </View>
      )}

      {/* Budgets */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Presupuestos</Text>
          <Text style={styles.cardHint}>Toca una categoría para asignar</Text>
        </View>

        {categories.filter((c) => !c.subcategories?.length || budgets.some((b) => b.categoryId === c.id)).length === 0 && budgets.length === 0 ? (
          <Text style={styles.budgetEmpty}>Aún no tienes presupuestos configurados.</Text>
        ) : null}

        {/* Categories with budgets */}
        {budgets.map((budget) => {
          const cat = categories.find((c) => c.id === budget.categoryId);
          if (!cat) return null;
          const spent = spendingByCategory.find((s) => s.categoryName === cat.name)?.totalClp ?? 0;
          const pct = budget.amountLimitClp > 0 ? Math.min(1, spent / budget.amountLimitClp) : 0;
          const over = pct >= 1;
          return (
            <Pressable
              key={budget.id}
              style={styles.budgetRow}
              onPress={() => setBudgetModal(cat)}
            >
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetCat}>{cat.icon ? `${cat.icon}  ` : ""}{cat.name}</Text>
                <Text style={[styles.budgetValues, over && { color: colors.danger }]}>
                  {fmt(spent)} / {fmt(budget.amountLimitClp)}
                </Text>
              </View>
              <View style={styles.budgetTrack}>
                <View
                  style={[
                    styles.budgetFill,
                    {
                      width: `${Math.max(pct * 100, 3)}%` as `${number}%`,
                      backgroundColor: over ? colors.danger : pct > 0.8 ? colors.warning : colors.primary,
                    },
                  ]}
                />
              </View>
              {over && (
                <Text style={styles.overBudgetAlert}>⚠ Superaste el límite en {fmt(spent - budget.amountLimitClp)}</Text>
              )}
            </Pressable>
          );
        })}

        {/* Add budget for category without one */}
        <Text style={styles.budgetSubtitle}>Agregar límite a categoría:</Text>
        <View style={styles.catChips}>
          {categories
            .filter((c) => !budgets.some((b) => b.categoryId === c.id))
            .slice(0, 6)
            .map((cat) => (
              <Pressable
                key={cat.id}
                style={styles.catChip}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setBudgetModal(cat);
                }}
              >
                {cat.icon ? <Text style={styles.chipIcon}>{cat.icon}</Text> : null}
                <Text style={styles.chipLabel}>{cat.name}</Text>
                <Text style={styles.chipPlus}>+</Text>
              </Pressable>
            ))}
        </View>
      </View>

      {/* Budget modal */}
      {budgetModal && (
        <BudgetModal
          category={budgetModal}
          existing={existingBudget(budgetModal)}
          month={month}
          onSaved={onRefresh ?? (() => undefined)}
          onClose={() => setBudgetModal(null)}
        />
      )}
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 40 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  exportIcon: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  exportLabel: { color: colors.primary, fontSize: 13, fontWeight: "700" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  kpiLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 17, fontWeight: "800" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 15 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardHint: { color: colors.textMuted, fontSize: 11 },

  actRow: { flexDirection: "row", alignItems: "center" },
  actItem: { flex: 1, alignItems: "center", gap: 4 },
  actDivider: { width: 1, height: 40, backgroundColor: colors.border },
  actNumber: { color: colors.text, fontSize: 26, fontWeight: "800" },
  actLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },

  catList: { gap: 8 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  catLeft: { flexDirection: "row", alignItems: "center", gap: 5, width: 110 },
  catRank: { color: colors.textMuted, fontSize: 11, fontWeight: "700", width: 22 },
  catName: { color: colors.textSub, fontSize: 12, fontWeight: "600", flex: 1 },
  catBarWrap: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: "hidden" },
  catBar: { height: "100%", borderRadius: 4 },
  catAmount: { color: colors.text, fontSize: 12, fontWeight: "700", width: 46, textAlign: "right" },

  chartArea: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: 100 },
  barGroup: { alignItems: "center", gap: 6, flex: 1 },
  barPair: { flexDirection: "row", gap: 3, alignItems: "flex-end" },
  bar: { width: 12, borderRadius: 3 },
  barLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  legend: { flexDirection: "row", justifyContent: "center", gap: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },

  budgetEmpty: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 8 },
  budgetSubtitle: { color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  budgetRow: { gap: 6 },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetCat: { color: colors.text, fontSize: 13, fontWeight: "600" },
  budgetValues: { color: colors.textMuted, fontSize: 12 },
  budgetTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: "hidden" },
  budgetFill: { height: "100%", borderRadius: 4 },
  overBudgetAlert: { color: colors.danger, fontSize: 11, fontWeight: "700" },

  catChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surfaceHigh,
  },
  chipIcon: { fontSize: 13 },
  chipLabel: { color: colors.textSub, fontSize: 12, fontWeight: "600" },
  chipPlus: { color: colors.primary, fontSize: 14, fontWeight: "800" },
});
