import React, { useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card, QuickAction, TransactionItem, BalanceCard } from "../../components/ui";
import { colors, spacing } from "../../constants/theme";
import { useWalletStore } from "../../store/wallet";
import { useAuthStore } from "../../store/auth";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { totalBalanceUsd, balances, transactions, fetchWallet, fetchTransactions } =
    useWalletStore();

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
  }, []);

  const usdBalance = balances.find((b) => b.currency === "USD");

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Home</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => router.push("/notifications")}>
            <Ionicons name="help-circle-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/notifications")}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/profile")}>
            <Ionicons name="person-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* KYC Banner */}
        {user?.profile?.kycTier === "TIER_0" && (
          <Card onPress={() => router.push("/kyc")} style={styles.kycBanner}>
            <View style={styles.kycRow}>
              <View style={styles.kycIcon}>
                <Ionicons name="person-add-outline" size={22} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kycTitle}>Complete Account Verification</Text>
                <Text style={styles.kycSubtitle}>Unlock full features</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
          </Card>
        )}

        {/* Wallet Balance */}
        <View style={styles.balanceCard}>
          <View>
            <Text style={styles.balanceLabel}>Est. Wallet Balance</Text>
            <Text style={styles.balanceAmount}>
              ${totalBalanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/wallet")}
            style={styles.currencyPill}
          >
            <Text style={styles.currencyFlag}>🇺🇸</Text>
            <Text style={styles.currencyCode}>USD</Text>
            <Ionicons name="chevron-down" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <QuickAction
            icon={<Ionicons name="add" size={22} color="#fff" />}
            label="Top-Up"
            primary
            onPress={() => router.push("/topup")}
          />
          <QuickAction
            icon={<Ionicons name="arrow-up" size={22} color={colors.text} />}
            label="Send"
            onPress={() => router.push("/send")}
          />
          <QuickAction
            icon={<Ionicons name="arrow-down" size={22} color={colors.text} />}
            label="Receive"
            onPress={() => router.push("/receive")}
          />
          <QuickAction
            icon={<Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />}
            label="More"
            onPress={() => router.push("/wallet")}
          />
        </View>

        {/* Balance Cards */}
        <View style={styles.balanceCards}>
          <Card onPress={() => router.push("/(tabs)/card")} style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Card Balance</Text>
            <Text style={styles.miniAmount}>$0.00</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Reward Balance</Text>
            <Text style={styles.miniAmount}>0.00 XP</Text>
          </Card>
        </View>

        {/* Recent Transactions */}
        <Text style={styles.sectionTitle}>Recent Transaction</Text>
        {transactions.length > 0 ? (
          transactions.slice(0, 5).map((txn) => (
            <TransactionItem
              key={txn.id}
              title={txn.type.replace("_", " ")}
              subtitle={new Date(txn.createdAt).toLocaleDateString()}
              amount={`${txn.type === "TOPUP" || txn.type === "RECEIVE" ? "+" : "-"}$${Number(txn.amount).toFixed(2)}`}
              positive={txn.type === "TOPUP" || txn.type === "RECEIVE"}
              onPress={() => router.push(`/transaction/${txn.id}`)}
            />
          ))
        ) : (
          <Card style={styles.emptyState}>
            <Ionicons
              name="time-outline"
              size={48}
              color={colors.textTertiary}
              style={{ alignSelf: "center", marginBottom: 12 }}
            />
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start by making a transaction to see it here.
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  headerIcons: { flexDirection: "row", gap: 16 },
  content: { padding: 20, paddingBottom: 40 },

  kycBanner: { marginBottom: 16 },
  kycRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  kycIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
  },
  kycTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  kycSubtitle: { fontSize: 12, color: colors.textSecondary },

  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  balanceAmount: { fontSize: 32, fontWeight: "700", color: "#fff", marginTop: 4 },
  currencyPill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currencyFlag: { fontSize: 16 },
  currencyCode: { fontSize: 14, fontWeight: "500", color: "#fff" },

  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
  },

  balanceCards: { flexDirection: "row", gap: 12, marginBottom: 24 },
  miniLabel: { fontSize: 12, color: colors.textSecondary },
  miniAmount: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 16 },

  emptyState: { alignItems: "center", padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
