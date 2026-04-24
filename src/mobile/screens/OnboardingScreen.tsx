import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme/colors";

export const ONBOARDING_DONE_KEY = "finanzas_onboarding_done";

const { width: W } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "💰",
    accent: "#6366F1",
    title: "Toma el control",
    subtitle:
      "Registra tus ingresos y egresos manualmente y lleva un balance claro de tus finanzas todos los meses.",
  },
  {
    icon: "📊",
    accent: "#22C55E",
    title: "Visualiza tu dinero",
    subtitle:
      "Gráficos simples por categoría, comparativos mensuales y presupuestos para que nunca te sorprendas.",
  },
  {
    icon: "🎯",
    accent: "#F59E0B",
    title: "Cumple tus metas",
    subtitle:
      "Crea metas de ahorro con aportes mensuales. El Pudú te avisa cuando las cosas van bien… o no tan bien.",
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  function goTo(idx: number) {
    scrollRef.current?.scrollTo({ x: idx * W, animated: true });
    setCurrent(idx);
    Animated.timing(progressAnim, {
      toValue: idx / (SLIDES.length - 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }

  async function handleNext() {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, "1");
      onDone();
    }
  }

  const slide = SLIDES[current];

  return (
    <View style={styles.root}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width: W }]}>
            <View style={[styles.iconCircle, { backgroundColor: `${s.accent}1A`, borderColor: `${s.accent}44` }]}>
              <Text style={styles.icon}>{s.icon}</Text>
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.subtitle}>{s.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <Pressable key={i} onPress={() => goTo(i)}>
            <View
              style={[
                styles.dot,
                i === current && { backgroundColor: slide.accent, width: 22 },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* Button */}
      <View style={styles.btnArea}>
        <Pressable
          style={[styles.btn, { backgroundColor: slide.accent }]}
          onPress={handleNext}
        >
          <Text style={styles.btnText}>
            {current < SLIDES.length - 1 ? "Siguiente  →" : "¡Empezar  →"}
          </Text>
        </Pressable>

        {current < SLIDES.length - 1 && (
          <Pressable onPress={async () => {
            await AsyncStorage.setItem(ONBOARDING_DONE_KEY, "1");
            onDone();
          }}>
            <Text style={styles.skip}>Omitir</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 60,
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 56 },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textSub,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  btnArea: {
    width: "100%",
    paddingHorizontal: 32,
    gap: 14,
    alignItems: "center",
  },
  btn: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  skip: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});
