import React, { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { AppStackParamList } from "../navigation/types";
import { api } from "../api/client";
import { TripListItem } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../utils/currency";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<AppStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<TripListItem[]>("/api/trips");
      setTrips(data);
    } catch {
      // keep last known list on transient errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi, {user?.name?.split(" ")[0]} 👋</Text>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("DeleteAccount")}>
            <Text style={styles.deleteAccountLink}>Delete account</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptySubtitle}>Create your first trip to start splitting costs.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("TripDetail", { tripId: item.id, tripName: item.name })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMembers}>{item.members.length} members</Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardTotal}>
                Total: {formatMoney(item.totalExpense, item.currency)}
              </Text>
              <Text
                style={[
                  styles.cardBalance,
                  { color: item.myBalance >= 0 ? colors.positive : colors.negative },
                ]}
              >
                {item.myBalance >= 0
                  ? `You are owed ${formatMoney(item.myBalance, item.currency)}`
                  : `You owe ${formatMoney(Math.abs(item.myBalance), item.currency)}`}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("CreateTrip")}>
        <Text style={styles.fabText}>+ New Trip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  greeting: { fontSize: 20, fontWeight: "700", color: colors.text },
  logout: { color: colors.primary, fontSize: 14 },
  deleteAccountLink: { color: colors.textMuted, fontSize: 11 },
  listContent: { padding: spacing.lg, paddingBottom: 100, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  cardMembers: { fontSize: 13, color: colors.textMuted },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTotal: { fontSize: 14, color: colors.textMuted },
  cardBalance: { fontSize: 14, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: spacing.xl * 2, gap: spacing.xs },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  fab: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
    left: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  fabText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
