import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TBadge } from '@/components/ui/TBadge';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';

type Appointment = Tables<'appointments'>;

const STATUS_BADGE: Record<string, any> = {
  proposed: { label: 'Proposé', variant: 'warning' },
  confirmed: { label: 'Confirmé', variant: 'success' },
  completed: { label: 'Terminé', variant: 'default' },
  canceled: { label: 'Annulé', variant: 'error' },
};

export default function AppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('appointments').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setAppointment(data);
    });
  }, [id]);

  const updateStatus = async (status: Appointment['status']) => {
    if (!appointment) return;
    setLoading(true);
    const { error } = await supabase.from('appointments').update({ status }).eq('id', appointment.id);
    setLoading(false);
    if (error) { Toast.error('Erreur lors de la mise à jour.'); return; }
    setAppointment((prev) => prev ? { ...prev, status } : prev);
    Toast.success(status === 'confirmed' ? 'RDV confirmé !' : status === 'completed' ? 'RDV marqué comme terminé !' : 'RDV annulé.');
    if (status === 'completed') {
      router.push(`/review/new?appointmentId=${appointment.id}&artistId=${appointment.artist_id}&artistName=Artiste`);
    }
  };

  const handleCancel = () => {
    Alert.alert('Annuler le RDV ?', 'Cette action est irréversible.', [
      { text: 'Non', style: 'cancel' },
      { text: 'Annuler le RDV', style: 'destructive', onPress: () => updateStatus('canceled') },
    ]);
  };

  if (!appointment) return null;

  const badge = STATUS_BADGE[appointment.status];
  const starts = new Date(appointment.starts_at);
  const ends = new Date(appointment.ends_at);
  const isArtist = user?.artistId === appointment.artist_id;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Rendez-vous</TText>
        <View style={{ width: 44 }} />
      </View>

      <Animated.View entering={FadeInDown.delay(100)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <TText variant="title2" weight="bold">
              {format(starts, "EEEE d MMMM", { locale: fr })}
            </TText>
            <TText variant="bodySmall" color="secondary" style={{ marginTop: 2 }}>
              {format(starts, 'HH:mm')} → {format(ends, 'HH:mm')}
            </TText>
          </View>
          <TBadge label={badge.label} variant={badge.variant} />
        </View>

        {appointment.body_zone && (
          <View style={styles.row}>
            <Ionicons name="body-outline" size={16} color={Colors.textTertiary} />
            <TText variant="bodySmall" color="secondary" style={{ marginLeft: 8 }}>{appointment.body_zone}</TText>
          </View>
        )}
        {appointment.deposit_paid && (
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <TText variant="bodySmall" color="secondary" style={{ marginLeft: 8 }}>Acompte réglé</TText>
          </View>
        )}
        {appointment.notes && (
          <View style={styles.notesBox}>
            <TText variant="caption" color="tertiary" style={{ marginBottom: 4 }}>NOTES</TText>
            <TText variant="bodySmall" color="secondary">{appointment.notes}</TText>
          </View>
        )}
      </Animated.View>

      {/* Actions */}
      {appointment.status === 'proposed' && (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.actions}>
          <TButton title="Confirmer le RDV" onPress={() => updateStatus('confirmed')} loading={loading} />
          <TButton title="Annuler" variant="destructive" onPress={handleCancel} />
        </Animated.View>
      )}
      {appointment.status === 'confirmed' && isArtist && (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.actions}>
          <TButton title="Marquer comme terminé" onPress={() => updateStatus('completed')} loading={loading} />
          <TButton title="Annuler" variant="ghost" onPress={handleCancel} />
        </Animated.View>
      )}

      {appointment.status === 'completed' && (
        <Animated.View entering={FadeInDown.delay(300)} style={styles.actions}>
          <TButton
            title="Laisser un avis"
            variant="secondary"
            onPress={() => router.push(`/review/new?appointmentId=${appointment.id}&artistId=${appointment.artist_id}&artistName=Artiste`)}
          />
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'],
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: {
    margin: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  notesBox: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.sm,
    padding: Spacing['2xs'],
    marginTop: 4,
  },
  actions: { paddingHorizontal: Spacing.sm, gap: 10, marginTop: Spacing.sm },
});
