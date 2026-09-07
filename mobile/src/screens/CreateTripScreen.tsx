import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";
import { api, ApiError } from "../api/client";
import { Trip } from "../api/types";
import { CURRENCIES } from "../utils/currency";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<AppStackParamList, "CreateTrip">;

interface InviteRow {
  key: string;
  name: string;
  contact: string;
}

let rowCounter = 0;
const newRow = (): InviteRow => ({ key: `row-${rowCounter++}`, name: "", contact: "" });

export default function CreateTripScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [invites, setInvites] = useState<InviteRow[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateInvite = (key: string, patch: Partial<InviteRow>) => {
    setInvites((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeInvite = (key: string) => {
    setInvites((rows) => rows.filter((r) => r.key !== key));
  };

  const onSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Give your trip a name");
      return;
    }
    const members = invites
      .filter((r) => r.contact.trim())
      .map((r) => {
        const contact = r.contact.trim();
        const isEmail = contact.includes("@");
        return {
          name: r.name.trim() || undefined,
          email: isEmail ? contact : undefined,
          phone: isEmail ? undefined : contact,
        };
      });

    setLoading(true);
    try {
      const trip = await api.post<Trip>("/api/trips", { name: name.trim(), currency, members });
      navigation.replace("TripDetail", { tripId: trip.id, tripName: trip.name });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Trip name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Goa Road Trip"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Currency</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyRow}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
              onPress={() => setCurrency(c)}
            >
              <Text style={[styles.currencyChipText, currency === c && styles.currencyChipTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.inviteHeader}>
          <Text style={styles.label}>Invite members</Text>
          <TouchableOpacity onPress={() => setInvites((rows) => [...rows, newRow()])}>
            <Text style={styles.addLink}>+ Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Add friends by phone number or email. They'll see the trip immediately, and if they don't
          have an account yet, it's ready for them as soon as they sign up.
        </Text>

        {invites.map((row) => (
          <View key={row.key} style={styles.inviteRow}>
            <TextInput
              style={[styles.input, styles.inviteName]}
              value={row.name}
              onChangeText={(v) => updateInvite(row.key, { name: v })}
              placeholder="Name"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.input, styles.inviteContact]}
              value={row.contact}
              onChangeText={(v) => updateInvite(row.key, { contact: v })}
              placeholder="Phone or email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity onPress={() => removeInvite(row.key)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Trip</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 13, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  currencyRow: { marginTop: spacing.xs },
  currencyChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    backgroundColor: colors.card,
  },
  currencyChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  currencyChipText: { color: colors.text, fontWeight: "600" },
  currencyChipTextActive: { color: "#fff" },
  inviteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  addLink: { color: colors.primary, fontWeight: "600" },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  inviteName: { flex: 1 },
  inviteContact: { flex: 1.4 },
  removeBtn: { padding: spacing.sm },
  removeBtnText: { color: colors.textMuted, fontSize: 16 },
  error: { color: colors.danger, marginTop: spacing.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
