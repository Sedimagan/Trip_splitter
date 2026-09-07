import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";
import { api, ApiError, resolveAssetUrl } from "../api/client";
import { SplitType, TripDetail } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { CURRENCIES } from "../utils/currency";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<AppStackParamList, "AddEditExpense">;

const SPLIT_OPTIONS: { value: SplitType; label: string; hint: string }[] = [
  { value: "SELF", label: "Just me", hint: "Personal cost, not shared with the group" },
  { value: "EQUAL", label: "Split equally", hint: "Divided equally among everyone in the trip" },
  { value: "CUSTOM", label: "Split with select people", hint: "Choose who shares this cost" },
];

export default function AddEditExpenseScreen({ route, navigation }: Props) {
  const { tripId, expenseId } = route.params;
  const { user } = useAuth();

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paidById, setPaidById] = useState<string>("");
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [receiptLocalUri, setReceiptLocalUri] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<TripDetail>(`/api/trips/${tripId}`);
        setTrip(data);
        setCurrency(data.currency);
        setPaidById(user!.id);
        setParticipantIds(data.members.map((m) => m.userId));

        if (expenseId) {
          const existing = data.expenses.find((e) => e.id === expenseId);
          if (existing) {
            setTitle(existing.title);
            setDescription(existing.description || "");
            setAmount(String(existing.amount));
            setCurrency(existing.currency);
            setPaidById(existing.paidById);
            setSplitType(existing.splitType);
            setParticipantIds(existing.splits.map((s) => s.userId));
            setReceiptUrl(existing.receiptUrl);
          }
        }
      } catch {
        setError("Couldn't load trip details");
      } finally {
        setLoadingTrip(false);
      }
    })();
  }, [tripId, expenseId, user]);

  const toggleParticipant = (userId: string) => {
    setParticipantIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  };

  const pickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo library access to attach a receipt");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptLocalUri(result.assets[0].uri);
    }
  };

  const previewUri = receiptLocalUri || resolveAssetUrl(receiptUrl);

  const onSubmit = async () => {
    setError(null);
    const parsedAmount = parseFloat(amount);
    if (!title.trim()) {
      setError("Give this expense a title");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (splitType === "CUSTOM" && participantIds.length === 0) {
      setError("Pick at least one person to split with");
      return;
    }

    setSubmitting(true);
    try {
      let uploadedUrl = receiptUrl;
      if (receiptLocalUri) {
        const fileName = receiptLocalUri.split("/").pop() || "receipt.jpg";
        const ext = fileName.split(".").pop()?.toLowerCase();
        const mimeType = ext === "png" ? "image/png" : "image/jpeg";
        const res = await api.uploadReceipt(receiptLocalUri, fileName, mimeType);
        uploadedUrl = res.url;
      }

      const payload = {
        tripId,
        title: title.trim(),
        description: description.trim() || undefined,
        amount: parsedAmount,
        currency,
        splitType,
        paidById,
        participantUserIds: splitType === "CUSTOM" ? participantIds : undefined,
        receiptUrl: uploadedUrl,
      };

      if (expenseId) {
        await api.put(`/api/expenses/${expenseId}`, payload);
      } else {
        await api.post("/api/expenses", payload);
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTrip || !trip) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Dinner at the beach shack"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Add a note"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Amount</Text>
        <View style={styles.amountRow}>
          <TextInput
            style={[styles.input, styles.amountInput]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
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
        </View>

        <Text style={styles.label}>Paid by</Text>
        <View style={styles.chipWrap}>
          {trip.members.map((m) => (
            <TouchableOpacity
              key={m.userId}
              style={[styles.memberChip, paidById === m.userId && styles.memberChipActive]}
              onPress={() => setPaidById(m.userId)}
            >
              <Text
                style={[styles.memberChipText, paidById === m.userId && styles.memberChipTextActive]}
              >
                {m.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>How should this be split?</Text>
        {SPLIT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.splitOption, splitType === opt.value && styles.splitOptionActive]}
            onPress={() => setSplitType(opt.value)}
          >
            <View style={styles.splitOptionText}>
              <Text style={styles.splitOptionLabel}>{opt.label}</Text>
              <Text style={styles.splitOptionHint}>{opt.hint}</Text>
            </View>
            <View style={[styles.radio, splitType === opt.value && styles.radioActive]} />
          </TouchableOpacity>
        ))}

        {splitType === "CUSTOM" && (
          <View style={styles.chipWrap}>
            {trip.members.map((m) => {
              const selected = participantIds.includes(m.userId);
              return (
                <TouchableOpacity
                  key={m.userId}
                  style={[styles.memberChip, selected && styles.memberChipActive]}
                  onPress={() => toggleParticipant(m.userId)}
                >
                  <Text style={[styles.memberChipText, selected && styles.memberChipTextActive]}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Receipt (optional)</Text>
        <TouchableOpacity style={styles.receiptPicker} onPress={pickReceipt}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.receiptPreview} />
          ) : (
            <Text style={styles.receiptPickerText}>Tap to upload a photo</Text>
          )}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{expenseId ? "Save Changes" : "Submit Expense"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 13, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
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
  amountRow: { gap: spacing.sm },
  amountInput: { fontSize: 20, fontWeight: "700" },
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
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  memberChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  memberChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  memberChipText: { color: colors.text, fontWeight: "500" },
  memberChipTextActive: { color: "#fff" },
  splitOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  splitOptionActive: { borderColor: colors.primary },
  splitOptionText: { flex: 1, paddingRight: spacing.sm },
  splitOptionLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  splitOptionHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  receiptPicker: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  receiptPickerText: { color: colors.textMuted },
  receiptPreview: { width: "100%", height: "100%" },
  error: { color: colors.danger, marginTop: spacing.md },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
