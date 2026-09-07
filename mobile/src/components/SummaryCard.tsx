import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { TripSummary } from "../api/types";
import { formatMoney } from "../utils/currency";
import { colors, radius, spacing } from "../theme";

export default function SummaryCard({
  summary,
  currency,
  currentUserId,
}: {
  summary: TripSummary;
  currency: string;
  currentUserId: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Trip summary</Text>
      <Text style={styles.total}>{formatMoney(summary.totalExpense, currency)}</Text>
      <Text style={styles.totalLabel}>Total spent so far</Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Who spent what</Text>
      {summary.balances.map((b) => (
        <View key={b.userId} style={styles.row}>
          <Text style={[styles.name, b.userId === currentUserId && styles.you]}>
            {b.name}
            {b.userId === currentUserId ? " (you)" : ""}
          </Text>
          <View style={styles.rowRight}>
            <Text style={styles.paid}>paid {formatMoney(b.totalPaid, currency)}</Text>
            <Text style={[styles.net, { color: b.net >= 0 ? colors.positive : colors.negative }]}>
              {b.net >= 0
                ? `is owed ${formatMoney(b.net, currency)}`
                : `owes ${formatMoney(Math.abs(b.net), currency)}`}
            </Text>
          </View>
        </View>
      ))}

      {summary.settlements.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Settle up</Text>
          {summary.settlements.map((s, i) => (
            <Text key={i} style={styles.settlement}>
              <Text style={styles.settlementName}>{s.fromName}</Text> pays{" "}
              <Text style={styles.settlementName}>{s.toName}</Text>{" "}
              <Text style={styles.settlementAmount}>{formatMoney(s.amount, currency)}</Text>
            </Text>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  total: { fontSize: 32, fontWeight: "700", color: colors.text, marginTop: spacing.xs },
  totalLabel: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  rowRight: { alignItems: "flex-end" },
  name: { fontSize: 15, color: colors.text },
  you: { fontWeight: "700" },
  paid: { fontSize: 12, color: colors.textMuted },
  net: { fontSize: 13, fontWeight: "600" },
  settlement: { fontSize: 14, color: colors.text, paddingVertical: spacing.xs },
  settlementName: { fontWeight: "700" },
  settlementAmount: { fontWeight: "700", color: colors.primary },
});
