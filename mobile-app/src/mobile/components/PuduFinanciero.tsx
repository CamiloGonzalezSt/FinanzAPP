import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Ellipse, Line, Rect, Text as SvgText } from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ─── Types & helpers ───────────────────────────────────────────────────────

type PuduState = "platudo" | "alerta" | "hambriento";

function getState(balance: number): PuduState {
  if (balance > 150_000) return "platudo";
  if (balance >= 50_000) return "alerta";
  return "hambriento";
}

function stateProgress(s: PuduState): number {
  return s === "platudo" ? 1 : s === "alerta" ? 0.5 : 0;
}

// ─── Bill animation pool ───────────────────────────────────────────────────

interface BillAnim {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
}

const BILL_COUNT = 7;

function makeBills(): BillAnim[] {
  return Array.from({ length: BILL_COUNT }, (_, i) => ({
    id: i,
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    rotate: new Animated.Value(0),
  }));
}

// ─── Tear animation pool ────────────────────────────────────────────────────

interface TearAnim {
  id: number;
  y: Animated.Value;
  opacity: Animated.Value;
  xOffset: number; // fixed horizontal offset per tear
}

const TEAR_COUNT = 4;

function makeTears(): TearAnim[] {
  // Tears fall from under each eye: 2 left (cx≈47), 2 right (cx≈73)
  return [
    { id: 0, y: new Animated.Value(0), opacity: new Animated.Value(0), xOffset: -23 },
    { id: 1, y: new Animated.Value(0), opacity: new Animated.Value(0), xOffset: -19 },
    { id: 2, y: new Animated.Value(0), opacity: new Animated.Value(0), xOffset: 13 },
    { id: 3, y: new Animated.Value(0), opacity: new Animated.Value(0), xOffset: 17 },
  ];
}

// Layout constants
// Container has 90px top padding to give bills room to fly upward.
// SVG is 130×150 displayed. Body center in display ≈ (65, 119).
// Bill start in container = paddingTop(90) + body_center_y(119) - half_emoji(12) = 197
const CONTAINER_TOP_PAD = 90;
const SVG_DISPLAY_H = 150;
const BODY_CENTER_Y_IN_SVG = 119; // (115/145)*150
const BILL_ABS_TOP = CONTAINER_TOP_PAD + BODY_CENTER_Y_IN_SVG - 12;

// ─── Component ─────────────────────────────────────────────────────────────

export function PuduFinanciero({ balance }: { balance: number }) {
  const state = getState(balance);
  const progress = useRef(new Animated.Value(stateProgress(state))).current;

  // Breathing: slow scale pulse — always active
  const breathAnim = useRef(new Animated.Value(0)).current;

  // Press bounce scale
  const pressScale = useRef(new Animated.Value(1)).current;

  // Tooltip shake (hambriento)
  const shakeX = useRef(new Animated.Value(0)).current;

  // Particle pools
  const bills = useRef(makeBills()).current;
  const tears = useRef(makeTears()).current;

  // Combined scale = breathing × press
  const combinedScale = useRef(
    Animated.multiply(
      breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }),
      pressScale
    )
  ).current;

  // Auto-fire timer ref
  const autoFireRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── State transition ────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(progress, {
      toValue: stateProgress(state),
      duration: 600,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [state, progress]);

  // ── Breathing loop ──────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1, duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0, duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathAnim]);

  // ── Tooltip shake ───────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== "hambriento") {
      shakeX.stopAnimation();
      shakeX.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 7, duration: 65, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -7, duration: 65, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 6, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -6, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
        Animated.delay(2200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, shakeX]);

  // ── Tear loop (hambriento) ──────────────────────────────────────────────
  useEffect(() => {
    if (state !== "hambriento") {
      tears.forEach((t) => { t.y.setValue(0); t.opacity.setValue(0); });
      return;
    }
    const anims = tears.map((tear, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.parallel([
            Animated.sequence([
              Animated.timing(tear.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
              Animated.timing(tear.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
            ]),
            Animated.timing(tear.y, { toValue: 28, duration: 800, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(tear.y, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(tear.opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
          Animated.delay(800 + Math.random() * 400),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [state, tears]);

  // ── Bill explosion ──────────────────────────────────────────────────────
  const fireBills = useCallback(() => {
    bills.forEach((bill, i) => {
      const xDir = (Math.random() - 0.5) * 100;
      const yDir = -(55 + Math.random() * 90);
      const rot = (Math.random() - 0.5) * 720;
      const delay = i * 75;

      bill.x.setValue(0);
      bill.y.setValue(0);
      bill.opacity.setValue(0);
      bill.rotate.setValue(0);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(bill.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(bill.x, { toValue: xDir, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(bill.y, { toValue: yDir, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(bill.rotate, { toValue: rot, duration: 900, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(450),
            Animated.timing(bill.opacity, { toValue: 0, duration: 450, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });
  }, [bills]);

  // ── Auto-fire for platudo ───────────────────────────────────────────────
  useEffect(() => {
    if (autoFireRef.current) { clearInterval(autoFireRef.current); autoFireRef.current = null; }
    if (state === "platudo") {
      // Initial burst after short delay
      const initial = setTimeout(fireBills, 800);
      autoFireRef.current = setInterval(fireBills, 4500);
      return () => { clearTimeout(initial); clearInterval(autoFireRef.current!); };
    }
    return undefined;
  }, [state, fireBills]);

  // ── Press handler ───────────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    void Haptics.impactAsync(
      state === "platudo"
        ? Haptics.ImpactFeedbackStyle.Heavy
        : state === "alerta"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );
    Animated.sequence([
      Animated.timing(pressScale, { toValue: 0.82, duration: 90, useNativeDriver: true }),
      Animated.spring(pressScale, { toValue: 1.14, friction: 3, tension: 220, useNativeDriver: true }),
      Animated.spring(pressScale, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
    ]).start();
    fireBills();
  }, [pressScale, fireBills, state]);

  // ── Animated SVG interpolations ─────────────────────────────────────────
  const bodyWidth = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [34, 56, 76] });
  const bodyX     = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [43, 32, 22] });
  const bodyFill  = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["rgb(120,100,85)", "rgb(124,79,42)", "rgb(175,118,40)"],
  });
  const headFill  = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["rgb(150,132,116)", "rgb(160,96,48)", "rgb(205,150,65)"],
  });
  const earOuterY = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [37, 26, 22] });
  const earInnerY = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [41, 30, 26] });
  const legLeftX  = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [43, 37, 27] });
  const legRightX = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [63, 69, 79] });

  // ── Labels ──────────────────────────────────────────────────────────────
  const stateLabel =
    state === "platudo"   ? "Pudú Platudo  🤑" :
    state === "alerta"    ? "Pudú Alerta  😐" :
                            "Pudú Hambriento  😭";

  const labelColor =
    state === "platudo"   ? "#D4A05A" :
    state === "alerta"    ? "#B07040" :
                            "#9A8878";

  // Card glow for platudo
  const cardStyle = state === "platudo"
    ? styles.cardPlatudo
    : state === "hambriento"
    ? styles.cardHambriento
    : styles.cardAlerta;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.outerCard, cardStyle]}>
      <Pressable onPress={handlePress}>
        {/* Tall container = top padding (bill room) + SVG */}
        <View style={styles.pudúContainer}>

          {/* Flying bills — absolutely positioned at body center */}
          {bills.map((bill) => {
            const rotateDeg = bill.rotate.interpolate({
              inputRange: [-720, 720],
              outputRange: ["-720deg", "720deg"],
            });
            return (
              <Animated.View
                key={bill.id}
                style={[styles.billItem, {
                  transform: [
                    { translateX: bill.x },
                    { translateY: bill.y },
                    { rotate: rotateDeg },
                  ],
                  opacity: bill.opacity,
                }]}
              >
                <Text style={styles.billEmoji}>💸</Text>
              </Animated.View>
            );
          })}

          {/* Tear drops — absolutely positioned at eye level */}
          {tears.map((tear) => (
            <Animated.View
              key={tear.id}
              style={[styles.tearItem, {
                marginLeft: tear.xOffset,
                transform: [{ translateY: tear.y }],
                opacity: tear.opacity,
              }]}
            />
          ))}

          {/* Breathing + press scale wrapper */}
          <Animated.View style={{ transform: [{ scale: combinedScale }] }}>
            <Svg width={130} height={SVG_DISPLAY_H} viewBox="0 0 120 145">

              {/* Antlers */}
              <Line x1="36" y1="30" x2="24" y2="10" stroke="#5A3010" strokeWidth="3.5" strokeLinecap="round" />
              <Line x1="24" y1="10" x2="16" y2="4"  stroke="#5A3010" strokeWidth="2.5" strokeLinecap="round" />
              <Line x1="84" y1="30" x2="96" y2="10" stroke="#5A3010" strokeWidth="3.5" strokeLinecap="round" />
              <Line x1="96" y1="10" x2="104" y2="4" stroke="#5A3010" strokeWidth="2.5" strokeLinecap="round" />

              {/* Ears outer — animated y (droop when hambriento) */}
              <AnimatedRect x={27} y={earOuterY} width={18} height={26} rx={9} fill={headFill} />
              <AnimatedRect x={75} y={earOuterY} width={18} height={26} rx={9} fill={headFill} />
              {/* Ears inner pink */}
              <AnimatedRect x={30} y={earInnerY} width={10} height={18} rx={5} fill="rgb(212,149,106)" opacity={0.75} />
              <AnimatedRect x={78} y={earInnerY} width={10} height={18} rx={5} fill="rgb(212,149,106)" opacity={0.75} />

              {/* Head block */}
              <AnimatedRect x={34} y={38} width={52} height={52} rx={20} fill={headFill} />

              {/* Cheek blush — platudo only */}
              {state === "platudo" && (
                <>
                  <Ellipse cx={43} cy={70} rx={8} ry={5} fill="rgba(255,180,120,0.45)" />
                  <Ellipse cx={77} cy={70} rx={8} ry={5} fill="rgba(255,180,120,0.45)" />
                </>
              )}

              {/* Eyes */}
              <Circle cx={50} cy={62} r={7} fill="#120C06" />
              <Circle cx={70} cy={62} r={7} fill="#120C06" />
              {/* Eye shine */}
              <Circle cx={52} cy={60} r={2.5} fill="white" />
              <Circle cx={72} cy={60} r={2.5} fill="white" />

              {/* $ pupils — platudo */}
              {state === "platudo" && (
                <>
                  <SvgText x="50" y="66" textAnchor="middle" fill="#FFD700" fontSize="9" fontWeight="bold">$</SvgText>
                  <SvgText x="70" y="66" textAnchor="middle" fill="#FFD700" fontSize="9" fontWeight="bold">$</SvgText>
                </>
              )}

              {/* Eye bags + small X pupils — hambriento */}
              {state === "hambriento" && (
                <>
                  <Rect x={44} y={68} width={12} height={4} rx={2} fill="#9A7060" opacity={0.6} />
                  <Rect x={64} y={68} width={12} height={4} rx={2} fill="#9A7060" opacity={0.6} />
                  <SvgText x="50" y="65" textAnchor="middle" fill="rgba(255,120,120,0.8)" fontSize="9" fontWeight="bold">x</SvgText>
                  <SvgText x="70" y="65" textAnchor="middle" fill="rgba(255,120,120,0.8)" fontSize="9" fontWeight="bold">x</SvgText>
                </>
              )}

              {/* Nose */}
              <Rect x={55} y={72} width={10} height={7} rx={3.5} fill="#3A1A08" />

              {/* Body — animated width + fill */}
              <AnimatedRect x={bodyX} y={93} width={bodyWidth} height={44} rx={22} fill={bodyFill} />

              {/* Belly highlight — platudo */}
              {state === "platudo" && (
                <Ellipse cx={60} cy={108} rx={22} ry={11} fill="rgba(255,215,140,0.2)" />
              )}

              {/* Legs */}
              <AnimatedRect x={legLeftX} y={127} width={14} height={14} rx={6} fill={bodyFill} />
              <AnimatedRect x={legRightX} y={127} width={14} height={14} rx={6} fill={bodyFill} />
            </Svg>
          </Animated.View>
        </View>
      </Pressable>

      {/* Tap hint */}
      <Text style={styles.tapHint}>toca para interactuar</Text>

      {/* Shake tooltip — hambriento */}
      {state === "hambriento" && (
        <Animated.View style={[styles.tooltip, { transform: [{ translateX: shakeX }] }]}>
          <Text style={styles.tooltipText}>¡¿CUÁNDO PAGAN?! 💸😭</Text>
        </Animated.View>
      )}

      {/* State badge */}
      <Text style={[styles.badge, { color: labelColor }]}>{stateLabel}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerCard: {
    alignItems: "center",
    gap: 6,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  cardPlatudo: {
    borderColor: "rgba(212,160,90,0.5)",
    shadowColor: "#D4A05A",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    shadowOpacity: 0.4,
    elevation: 8,
    backgroundColor: "rgba(175,118,40,0.05)",
  },
  cardAlerta: {
    borderColor: "rgba(140,90,40,0.3)",
    backgroundColor: "rgba(124,79,42,0.04)",
  },
  cardHambriento: {
    borderColor: "rgba(150,120,100,0.25)",
    backgroundColor: "rgba(100,80,65,0.04)",
  },

  // Fixed-height container so bills have room to fly upward
  pudúContainer: {
    height: CONTAINER_TOP_PAD + SVG_DISPLAY_H,
    alignItems: "center",
    justifyContent: "flex-end",
  },

  billItem: {
    position: "absolute",
    top: BILL_ABS_TOP,
    alignSelf: "center",
  },
  billEmoji: {
    fontSize: 20,
  },

  // Tears: absolute near the eye area
  // Eye y in SVG ≈ 62, tear starts at 69. In display: (69/145)*150 ≈ 71px from SVG top.
  // In container: paddingTop(90) + 71 = 161 from container top.
  tearItem: {
    position: "absolute",
    top: CONTAINER_TOP_PAD + 71,
    alignSelf: "center",
    width: 5,
    height: 8,
    borderRadius: 3,
    backgroundColor: "rgba(100,180,255,0.8)",
  },

  tapHint: {
    fontSize: 10,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: 0.6,
    marginTop: -4,
  },
  tooltip: {
    backgroundColor: "rgba(255,60,60,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.35)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tooltipText: {
    color: "#FF6060",
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  badge: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
