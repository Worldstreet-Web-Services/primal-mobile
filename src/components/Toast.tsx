import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body } from "@/components/ui";
import { C, F } from "@/theme/tokens";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  /** Short headline. Keep it under ~40 chars so it never wraps past two lines. */
  title: string;
  /** Optional second line — the detail, the reason, the next step. */
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds on screen. Errors default to longer, since they carry more to read. */
  duration?: number;
}

interface Toast extends Required<Omit<ToastOptions, "description">> {
  id: number;
  description?: string;
}

interface ToastApi {
  show: (options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Toasts are how every async outcome in the app reports itself — sign-in,
 * PIN creation, biometric enrolment, network failure. One is visible at a
 * time: a new toast replaces the current one rather than stacking, because
 * stacked toasts on a phone cover the very controls the user is reaching for.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const DEFAULT_DURATION = 3200;
const ERROR_DURATION = 4800;

const VARIANTS: Record<
  ToastVariant,
  { accent: string; tint: string; glyph: string; role: "alert" | "status" }
> = {
  // Dollar-green owns "money in" semantics per the PRD, so success borrows the
  // gain token rather than the lime brand color — brand and success stay separate.
  success: { accent: C.up, tint: "rgba(124,231,176,0.12)", glyph: "✓", role: "status" },
  error: { accent: C.down, tint: "rgba(246,165,165,0.12)", glyph: "!", role: "alert" },
  warning: { accent: C.amber, tint: "rgba(245,184,61,0.12)", glyph: "!", role: "alert" },
  info: { accent: C.silver, tint: "rgba(199,204,209,0.12)", glyph: "i", role: "status" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const show = useCallback(
    ({ title, description, variant = "info", duration }: ToastOptions) => {
      clearTimer();
      const ms = duration ?? (variant === "error" ? ERROR_DURATION : DEFAULT_DURATION);
      const id = nextId.current++;
      setToast({ id, title, description, variant, duration: ms });

      // Screen readers get the message even though the toast auto-dismisses.
      AccessibilityInfo.announceForAccessibility?.(
        description ? `${title}. ${description}` : title,
      );

      timer.current = setTimeout(() => setToast(null), ms);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ title, description, variant: "success" }),
      error: (title, description) => show({ title, description, variant: "error" }),
      info: (title, description) => show({ title, description, variant: "info" }),
      warning: (title, description) => show({ title, description, variant: "warning" }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const variant = VARIANTS[toast.variant];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      // Web has no native animated module — asking for it there only earns a
      // warning and the JS fallback it was already going to use.
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        // `pointerEvents` as a prop is deprecated; it belongs in style now.
        pointerEvents: "box-none",
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        right: 16,
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
        ],
      }}
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole={variant.role === "alert" ? "alert" : "text"}
        accessibilityLabel={
          toast.description ? `${toast.title}. ${toast.description}` : toast.title
        }
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 11,
          padding: 13,
          borderRadius: 16,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.border,
          // Separation comes from the border first, the shadow second. On the
          // old near-black ground a wide 0.45 shadow was invisible as a shadow
          // and simply read as "edge"; on charcoal the same pool reads as dirt
          // smeared under the toast. Tighter and fainter, so it lifts the card
          // without staining the screen around it.
          shadowColor: C.ink,
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: variant.tint,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          <Body size={12} color={variant.accent} semibold>
            {variant.glyph}
          </Body>
        </View>

        <View style={{ flex: 1 }}>
          <Body size={13.5} semibold style={{ fontFamily: F.bodySemibold }}>
            {toast.title}
          </Body>
          {toast.description ? (
            <Body size={11.5} color={C.sub} style={{ marginTop: 3, lineHeight: 17 }}>
              {toast.description}
            </Body>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
