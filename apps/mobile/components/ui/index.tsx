import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { colors, borderRadius, typography } from "../../constants/theme";

// ─── Button ───

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isGhost = variant === "ghost";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        size === "sm" && styles.buttonSm,
        size === "md" && styles.buttonMd,
        isPrimary && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        isDanger && styles.buttonDanger,
        isGhost && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? "#fff" : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary && styles.buttonTextPrimary,
            variant === "secondary" && styles.buttonTextSecondary,
            isDanger && styles.buttonTextDanger,
            isGhost && styles.buttonTextGhost,
            size === "sm" && { fontSize: 14 },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Input ───

interface InputProps {
  placeholder: string;
  value?: string;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  rightIcon?: React.ReactNode;
  error?: string;
  label?: string;
  style?: ViewStyle;
}

export function Input({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  rightIcon,
  error,
  label,
  style,
}: InputProps) {
  return (
    <View style={[styles.inputContainer, style]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View style={[styles.inputWrapper, error && styles.inputError]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
        {rightIcon && <View style={styles.inputIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.inputErrorText}>{error}</Text>}
    </View>
  );
}

// ─── Card ───

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ children, onPress, style }: CardProps) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.card, style]}
    >
      {children}
    </Wrapper>
  );
}

// ─── BalanceCard ───

interface BalanceCardProps {
  label: string;
  amount: string;
  currency: string;
  onCurrencyPress?: () => void;
}

export function BalanceCard({ label, amount, currency, onCurrencyPress }: BalanceCardProps) {
  return (
    <View style={styles.balanceCard}>
      <View>
        <Text style={styles.balanceLabel}>{label}</Text>
        <Text style={styles.balanceAmount}>{amount}</Text>
      </View>
      <TouchableOpacity onPress={onCurrencyPress} style={styles.currencyPill}>
        <Text style={styles.currencyText}>{currency}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── TransactionItem ───

interface TransactionItemProps {
  title: string;
  subtitle: string;
  amount: string;
  positive: boolean;
  onPress?: () => void;
}

export function TransactionItem({
  title,
  subtitle,
  amount,
  positive,
  onPress,
}: TransactionItemProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.txnItem} activeOpacity={0.7}>
      <View
        style={[
          styles.txnIcon,
          { backgroundColor: positive ? colors.successLight : colors.errorLight },
        ]}
      >
        <Text style={{ color: positive ? colors.success : colors.error, fontSize: 16 }}>
          {positive ? "↓" : "↑"}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txnTitle}>{title}</Text>
        <Text style={styles.txnSubtitle}>{subtitle}</Text>
      </View>
      <Text
        style={[styles.txnAmount, { color: positive ? colors.success : colors.text }]}
      >
        {amount}
      </Text>
    </TouchableOpacity>
  );
}

// ─── QuickAction ───

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  onPress: () => void;
}

export function QuickAction({ icon, label, primary = false, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.quickAction} activeOpacity={0.7}>
      <View
        style={[
          styles.quickActionCircle,
          primary && { backgroundColor: colors.primary, borderWidth: 0 },
        ]}
      >
        {icon}
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  // Button
  button: {
    height: 52,
    borderRadius: borderRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSm: { height: 36 },
  buttonMd: { height: 44 },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  buttonDanger: { backgroundColor: colors.error },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  buttonTextPrimary: { color: "#fff" },
  buttonTextSecondary: { color: colors.text },
  buttonTextDanger: { color: "#fff" },
  buttonTextGhost: { color: colors.primary },

  // Input
  inputContainer: { marginBottom: 16 },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    height: 56,
    borderRadius: borderRadius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  inputIcon: { marginLeft: 12 },
  inputError: { borderColor: colors.error },
  inputErrorText: { fontSize: 12, color: colors.error, marginTop: 4, marginLeft: 12 },

  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
  },

  // BalanceCard
  balanceCard: {
    borderRadius: borderRadius.lg,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    overflow: "hidden",
  },
  balanceLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  balanceAmount: { fontSize: 32, fontWeight: "700", color: "#fff", marginTop: 4 },
  currencyPill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currencyText: { color: "#fff", fontSize: 14, fontWeight: "500" },

  // TransactionItem
  txnItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  txnIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  txnTitle: { fontSize: 15, fontWeight: "500", color: colors.text },
  txnSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: "600" },

  // QuickAction
  quickAction: { alignItems: "center", gap: 10 },
  quickActionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "500" },
});
