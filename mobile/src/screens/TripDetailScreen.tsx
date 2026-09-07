import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { AppStackParamList } from "../navigation/types";
import { api } from "../api/client";
import { Expense, TripDetail } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";
import SummaryCard from "../components/SummaryCard";
import ExpenseRow from "../components/ExpenseRow";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<AppStackParamList, "TripDetail">;

export default function TripDetailScreen({ route, navigation }: Props) {
  const { tripId } = route.params;
  const { user, token } = useAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<TripDetail>(`/api/trips/${tripId}`);
      setTrip(data);
    } catch {
      // keep last known data on transient errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Live updates: anything a trip member submits appears for everyone immediately.
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit("join-trip", tripId);

    const onExpenseChange = (expense: Expense) => {
      if (expense.tripId !== tripId) return;
      load();
    };
    const onMemberAdded = (payload: { tripId: string }) => {
      if (payload.tripId !== tripId) return;
      load();
    };

    socket.on("trip:expense-created", onExpenseChange);
    socket.on("trip:expense-updated", onExpenseChange);
    socket.on("trip:member-added", onMemberAdded);

    return () => {
      socket.emit("leave-trip", tripId);
      socket.off("trip:expense-created", onExpenseChange);
      socket.off("trip:expense-updated", onExpenseChange);
      socket.off("trip:member-added", onMemberAdded);
    };
  }, [tripId, token, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (!trip) {
    return (
      <View style={styles.container}>
        {!loading && <Text style={styles.errorText}>Couldn't load this trip.</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trip.expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            <SummaryCard summary={trip.summary} currency={trip.currency} currentUserId={user!.id} />
            <View style={styles.membersRow}>
              {trip.members.map((m) => (
                <View key={m.id} style={styles.memberChip}>
                  <Text style={styles.memberChipText}>
                    {m.name}
                    {m.pending ? " (pending)" : ""}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.expensesTitle}>Expenses</Text>
          </>
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>No expenses yet. Add the first one!</Text> : null
        }
        renderItem={({ item }) => (
          <ExpenseRow
            expense={item}
            onPress={() => navigation.navigate("AddEditExpense", { tripId, expenseId: item.id })}
          />
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddEditExpense", { tripId })}
      >
        <Text style={styles.fabText}>+ Add Expense</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: 100 },
  membersRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  memberChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  memberChipText: { fontSize: 12, color: colors.textMuted },
  expensesTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  emptyText: { textAlign: "center", color: colors.textMuted, marginTop: spacing.lg },
  errorText: { textAlign: "center", color: colors.textMuted, marginTop: spacing.lg },
  fab: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
    left: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  fabText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
