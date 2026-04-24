import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as Haptics from "expo-haptics";
import {
  AuthUser,
  BudgetItem,
  CategoryItem,
  CategorySpendingItem,
  DashboardResponse,
  GoalItem,
  MonthlyComparisonItem,
  TransactionItem,
  addGoalContribution,
  clearSession,
  createGoal,
  createTransaction,
  deleteGoal,
  deleteTransaction,
  fetchBudgets,
  fetchCategories,
  fetchDashboard,
  fetchGoals,
  fetchMonthlyComparison,
  fetchSpendingByCategory,
  fetchTransactions,
  getCurrentUser,
  seedDefaultCategories,
  updateGoal,
  updateTransaction,
} from "./src/mobile/api/client";
import { AuthScreen } from "./src/mobile/screens/AuthScreen";
import { DashboardScreen } from "./src/mobile/screens/DashboardScreen";
import { TransactionsScreen } from "./src/mobile/screens/TransactionsScreen";
import { AddScreen } from "./src/mobile/screens/AddScreen";
import { GoalsScreen } from "./src/mobile/screens/GoalsScreen";
import { ReportsScreen } from "./src/mobile/screens/ReportsScreen";
import { OnboardingScreen, ONBOARDING_DONE_KEY } from "./src/mobile/screens/OnboardingScreen";
import { colors } from "./src/mobile/theme/colors";

type Tab = "Inicio" | "Movimientos" | "Agregar" | "Metas" | "Reportes";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "Inicio",      label: "Inicio",      icon: "🏠" },
  { key: "Movimientos", label: "Movimientos",  icon: "💸" },
  { key: "Agregar",     label: "Agregar",      icon: "+" },
  { key: "Metas",       label: "Metas",        icon: "🎯" },
  { key: "Reportes",    label: "Reportes",     icon: "📊" },
];

function currentMonthString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const RECURRING_IDS_KEY = "finanzas_recurring_ids";

function parseMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1);
}
function shiftMonth(m: string, delta: number) {
  const d = parseMonth(m);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Skeleton pulse ──────────────────────────────────────────────────────────

function SkeletonPulse({ style }: { style: object }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={[style, { opacity: anim }]} />;
}

function DashboardSkeleton() {
  return (
    <View style={skStyles.container}>
      <View style={skStyles.header}>
        <View style={skStyles.headerLeft}>
          <SkeletonPulse style={skStyles.greetingBar} />
          <SkeletonPulse style={skStyles.monthBar} />
        </View>
        <SkeletonPulse style={skStyles.avatar} />
      </View>
      <SkeletonPulse style={skStyles.balanceCard} />
      <SkeletonPulse style={skStyles.spendCard} />
    </View>
  );
}

const skStyles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { gap: 8 },
  greetingBar: { width: 160, height: 22, borderRadius: 8, backgroundColor: colors.surfaceHigh },
  monthBar: { width: 110, height: 14, borderRadius: 6, backgroundColor: colors.surfaceHigh },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceHigh },
  balanceCard: { height: 148, borderRadius: 20, backgroundColor: colors.surface },
  spendCard: { height: 80, borderRadius: 16, backgroundColor: colors.surface },
});

// ─── Animated Splash ─────────────────────────────────────────────────────────

// mode="loading"  → entrance animation, stays visible, no fade-out
// mode="fadeout"  → plays entrance quickly then fades out to reveal main app
function AnimatedSplash({ mode }: { mode: "loading" | "fadeout" }) {
  const scale       = useRef(new Animated.Value(0.6)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const wrapOpacity = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (mode === "loading") {
      // Full entrance, stays visible
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 55, friction: 7 }),
          Animated.timing(iconOpacity, { toValue: 1, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        ]),
        Animated.timing(textOpacity, { toValue: 1, duration: 280, delay: 80, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]).start();
    } else {
      // Quick entrance then fade out — gives sense of transition into the app
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 55, friction: 7 }),
          Animated.timing(iconOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(textOpacity, { toValue: 1, duration: 250, delay: 100, useNativeDriver: true }),
        ]),
        Animated.timing(wrapOpacity, {
          toValue: 0,
          duration: 420,
          delay: 350,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
      ]).start(() => setVisible(false));
    }
  }, [mode]);

  if (!visible) return null;

  return (
    <Animated.View style={[splashStyles.container, { opacity: wrapOpacity }]} pointerEvents="none">
      <Animated.View style={{ transform: [{ scale }], opacity: iconOpacity }}>
        <View style={splashStyles.iconWrap}>
          <Text style={splashStyles.icon}>💰</Text>
        </View>
      </Animated.View>
      <Animated.View style={[splashStyles.textWrap, { opacity: textOpacity }]}>
        <Text style={splashStyles.title}>Finanzas</Text>
        <Text style={splashStyles.sub}>Tu dinero, bajo control</Text>
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    zIndex: 99,
  },
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: 30,
    backgroundColor: colors.primaryDim,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 54 },
  textWrap: { alignItems: "center", gap: 6 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: colors.textMuted, fontSize: 14 },
});

// ─── Biometric lock screen ───────────────────────────────────────────────────

function BiometricLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [error, setError] = useState(false);

  async function tryAuth() {
    setError(false);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Verifica tu identidad para acceder",
        disableDeviceFallback: false,
        fallbackLabel: "Usar contraseña del dispositivo",
      });
      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onUnlock();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  }

  useEffect(() => { void tryAuth(); }, []);

  return (
    <View style={lockStyles.container}>
      <Text style={lockStyles.icon}>🔒</Text>
      <Text style={lockStyles.title}>Acceso protegido</Text>
      <Text style={lockStyles.sub}>Usa tu huella o Face ID para continuar</Text>
      {error && (
        <>
          <Text style={lockStyles.error}>Autenticación fallida</Text>
          <Pressable style={lockStyles.retryBtn} onPress={tryAuth}>
            <Text style={lockStyles.retryText}>Reintentar</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const lockStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  icon: { fontSize: 56 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  sub: { color: colors.textSub, fontSize: 15, textAlign: "center" },
  error: { color: colors.danger, fontSize: 14, fontWeight: "600" },
  retryBtn: { borderRadius: 14, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 14 },
  retryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [authLoading, setAuthLoading]   = useState(true);
  const [user, setUser]                 = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab]       = useState<Tab>("Inicio");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const tabFade = useRef(new Animated.Value(1)).current;
  const [refreshing, setRefreshing]     = useState(false);

  const [dashboard, setDashboard]               = useState<DashboardResponse | null>(null);
  const [transactions, setTransactions]          = useState<TransactionItem[]>([]);
  const [goals, setGoals]                        = useState<GoalItem[]>([]);
  const [categories, setCategories]              = useState<CategoryItem[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyComparisonItem[]>([]);
  const [spendingByCategory, setSpendingByCategory] = useState<CategorySpendingItem[]>([]);
  const [budgets, setBudgets]                    = useState<BudgetItem[]>([]);
  const [transactionsMonth, setTransactionsMonth] = useState(currentMonthString());
  const [recurringIds, setRecurringIds]          = useState<Set<string>>(new Set());

  const loadedRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [dash, txns, gls, cats, comp, catSpend, buds] = await Promise.allSettled([
        fetchDashboard(),
        fetchTransactions({ month: transactionsMonth }),
        fetchGoals(),
        fetchCategories(),
        fetchMonthlyComparison(),
        fetchSpendingByCategory(),
        fetchBudgets(currentMonthString()),
      ]);
      if (dash.status === "fulfilled") setDashboard(dash.value);
      if (txns.status === "fulfilled") setTransactions(txns.value);
      if (gls.status === "fulfilled") setGoals(gls.value);
      if (cats.status === "fulfilled") {
        setCategories(cats.value);
        if (cats.value.length === 0 && !loadedRef.current) {
          await seedDefaultCategories();
          const fresh = await fetchCategories().catch(() => []);
          setCategories(fresh);
        }
      }
      if (comp.status === "fulfilled") setMonthlyComparison(comp.value);
      if (catSpend.status === "fulfilled") setSpendingByCategory(catSpend.value);
      if (buds.status === "fulfilled") setBudgets(buds.value);
      loadedRef.current = true;
    } catch { /* fail silently */ }
  }, [transactionsMonth]);

  // ── Startup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const u = await getCurrentUser();
        if (u) {
          setUser(u);
          await loadData();
          // Biometric
          await checkBiometric();
          // Onboarding
          const done = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
          if (!done) setShowOnboarding(true);
          // Recurring IDs
          try {
            const stored = await AsyncStorage.getItem(RECURRING_IDS_KEY);
            if (stored) setRecurringIds(new Set(JSON.parse(stored) as string[]));
          } catch { /* no-op */ }
        }
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [loadData]);

  useEffect(() => {
    if (user) loadData();
  }, [transactionsMonth, user, loadData]);

  async function checkBiometric() {
    try {
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHW && enrolled) setBiometricLocked(true);
    } catch { /* no-op */ }
  }

  // ── Auth handlers ────────────────────────────────────────────────────────
  async function handleAuthenticated(isNew = false) {
    const u = await getCurrentUser();
    setUser(u);
    await loadData();
    if (isNew) {
      const done = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
      if (!done) setShowOnboarding(true);
    }
  }

  async function handleLogout() {
    await clearSession();
    setUser(null);
    setDashboard(null);
    setTransactions([]);
    setGoals([]);
    setCategories([]);
    setBiometricLocked(false);
    loadedRef.current = false;
  }

  // ── Pull-to-refresh ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Tab navigation with haptics + fade ───────────────────────────────────
  function handleTabPress(tab: Tab) {
    if (tab === activeTab) return;
    void Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(tabFade, { toValue: 0, duration: 80, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
    ]).start(() => {
      setActiveTab(tab);
      Animated.timing(tabFade, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
    });
  }

  // ── Transaction handlers ─────────────────────────────────────────────────
  const handleCreateTransaction = useCallback(async (payload: {
    type: "income" | "expense";
    amountClp: number;
    rawGlosa: string;
    categoryId?: string;
    occurredAt?: string;
    recurring?: boolean;
  }) => {
    const tx = await createTransaction({ ...payload, occurredAt: payload.occurredAt ?? new Date().toISOString() });
    if (payload.recurring && tx?.id) {
      setRecurringIds((prev) => {
        const next = new Set([...prev, tx.id]);
        void AsyncStorage.setItem(RECURRING_IDS_KEY, JSON.stringify([...next]));
        return next;
      });
    }
    await loadData();
    setActiveTab("Movimientos");
  }, [loadData]);

  const handleCreateGoal = useCallback(async (payload: { name: string; targetAmountClp: number; monthlyContributionClp: number }) => {
    await createGoal(payload);
    await loadData();
  }, [loadData]);

  const handleContributeGoal = useCallback(async (goalId: string, amountClp: number) => {
    await addGoalContribution(goalId, amountClp);
    await loadData();
  }, [loadData]);

  const handleUpdateGoal = useCallback(async (
    goalId: string,
    payload: { name?: string; targetAmountClp?: number; monthlyContributionClp?: number }
  ) => {
    await updateGoal(goalId, payload);
    await loadData();
  }, [loadData]);

  const handleDeleteGoal = useCallback(async (goalId: string) => {
    await deleteGoal(goalId);
    await loadData();
  }, [loadData]);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    await deleteTransaction(id);
    await loadData();
  }, [loadData]);

  const handleUpdateTransaction = useCallback(async (
    id: string,
    payload: { type?: "income" | "expense"; amountClp?: number; rawGlosa?: string; categoryId?: string | null }
  ) => {
    await updateTransaction(id, payload);
    await loadData();
  }, [loadData]);

  // ── Render guards ────────────────────────────────────────────────────────
  if (authLoading) {
    return <AnimatedSplash mode="loading" />;
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.root}>
          <StatusBar barStyle="light-content" backgroundColor={colors.background} />
          <AuthScreen onAuthenticated={handleAuthenticated} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (biometricLocked) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.root}>
          <StatusBar barStyle="light-content" backgroundColor={colors.background} />
          <BiometricLockScreen onUnlock={() => setBiometricLocked(false)} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (showOnboarding) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.root}>
          <StatusBar barStyle="light-content" backgroundColor={colors.background} />
          <OnboardingScreen onDone={() => setShowOnboarding(false)} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ── Screen renderer ──────────────────────────────────────────────────────
  function renderScreen() {
    switch (activeTab) {
      case "Inicio":
        return dashboard === null && !loadedRef.current ? (
          <DashboardSkeleton />
        ) : (
          <DashboardScreen
            dashboard={dashboard}
            transactions={transactions}
            goals={goals}
            monthlyComparison={monthlyComparison}
            recurringIds={recurringIds}
            user={user!}
            onLogout={handleLogout}
            onUserUpdated={(u) => setUser(u)}
          />
        );
      case "Movimientos":
        return (
          <TransactionsScreen
            transactions={transactions}
            categories={categories}
            month={transactionsMonth}
            onMonthChange={setTransactionsMonth}
            shiftMonth={shiftMonth}
            onDelete={handleDeleteTransaction}
            onUpdate={handleUpdateTransaction}
            recurringIds={recurringIds}
          />
        );
      case "Agregar":
        return <AddScreen categories={categories} onSave={handleCreateTransaction} onDone={() => setActiveTab("Movimientos")} />;
      case "Metas":
        return (
          <GoalsScreen
            goals={goals}
            onCreateGoal={handleCreateGoal}
            onContribute={handleContributeGoal}
            onUpdateGoal={handleUpdateGoal}
            onDeleteGoal={handleDeleteGoal}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
      case "Reportes":
        return (
          <ReportsScreen
            dashboard={dashboard}
            transactions={transactions}
            goals={goals}
            monthlyComparison={monthlyComparison}
            spendingByCategory={spendingByCategory}
            budgets={budgets}
            categories={categories}
            month={transactionsMonth}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
      default:
        return null;
    }
  }

  // Dashboard uses the outer ScrollView for pull-to-refresh (since it's a View internally)
  const isDashboard = activeTab === "Inicio";

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView style={styles.root}>
        <AnimatedSplash mode="fadeout" />
        <Animated.View style={[styles.contentArea, { opacity: tabFade }]}>
        <ScrollView
          style={styles.contentArea}
          contentContainerStyle={isDashboard ? styles.contentContainerGrow : styles.contentContainerFill}
          showsVerticalScrollIndicator={false}
          scrollEnabled={isDashboard}
          refreshControl={
            isDashboard ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
        >
          {renderScreen()}
        </ScrollView>
        </Animated.View>

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const isAdd = tab.key === "Agregar";
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabItem, isAdd && styles.tabItemAdd]}
                onPress={() => handleTabPress(tab.key)}
              >
                {isAdd ? (
                  <View style={[styles.addBtn, isActive && styles.addBtnActive]}>
                    <Text style={styles.addBtnIcon}>+</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                    {isActive && <View style={styles.tabDot} />}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  contentArea: { flex: 1 },
  contentContainerGrow: { flexGrow: 1 },
  contentContainerFill: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    height: 72,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 8 },
  tabItemAdd: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingTop: 0, marginTop: -20 },
  tabIcon: { fontSize: 20 },
  tabIconActive: {},
  tabLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  tabLabelActive: { color: colors.primary },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  addBtnIcon: { color: colors.text, fontSize: 26, fontWeight: "300", lineHeight: 30 },
});
