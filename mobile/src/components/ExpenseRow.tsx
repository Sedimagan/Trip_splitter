import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Expense } from "../api/types";
import { formatMoney } from "../utils/currency";
import { resolveAssetUrl } from "../api/client";
import { colors, radius, spacing } from "../theme";

const SPLIT_LABEL: Record<Expense["splitType"], string> = {
  SELF: "Personal (not split)",
  EQUAL: "Split equally",
  CUSTOM: "Split with select members",
};

export default function ExpenseRow({ expense, onPress }: { expense: Expense; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      {expense.receiptUrl ? (
        <Image source={{ uri: resolveAssetUrl(expense.receiptUrl)! }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbPlaceholderText}>🧾</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.title}
        </Text>
        {expense.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {expense.description}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          Paid by {expense.paidByName} · {SPLIT_LABEL[expense.splitType]}
        </Text>
      </View>
      <Text style={styles.amount}>{formatMoney(expense.amount, expense.currency)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.background },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  thumbPlaceholderText: { fontSize: 18 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: colors.text },
  description: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "700", color: colors.text },
});
