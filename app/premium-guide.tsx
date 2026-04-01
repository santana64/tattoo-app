import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TBadge } from '@/components/ui/TBadge';
import { TDivider } from '@/components/ui/TDivider';

const CHAPTERS = [
  {
    id: 1,
    icon: 'rocket-outline' as const,
    title: 'Bien démarrer sur TATTOO',
    summary: 'Configure ton profil pour maximiser ta visibilité dès le premier jour.',
    tips: [
      'Utilise une photo de couverture en 16:9 qui représente ton style.',
      'Rédige une bio courte (2-3 phrases) qui te différencie.',
      'Complète 100% des infos de profil : les profils complets reçoivent 3× plus de vues.',
    ],
  },
  {
    id: 2,
    icon: 'images-outline' as const,
    title: 'Construire une galerie qui convertit',
    summary: 'Les 9 premiers posts sont ton vitrine. Choisis-les avec soin.',
    tips: [
      'Publie tes 9 meilleurs travaux avant tout contenu récent.',
      'Varie les zones corporelles et formats pour montrer ta polyvalence.',
      'Les photos en lumière naturelle obtiennent 40% de likes en plus.',
      'Ajoute 2-3 tags de style par post — ça alimente l\'algo de recommandation.',
    ],
  },
  {
    id: 3,
    icon: 'funnel-outline' as const,
    title: 'Gérer les demandes efficacement',
    summary: 'Un bon taux de réponse booste ton classement dans l\'explore.',
    tips: [
      'Réponds dans les 24h : ton taux de réponse est visible des clients.',
      'Utilise "Demander une précision" plutôt que refuser prématurément.',
      'Les demandes avec budget > 300€ sont 2× plus susceptibles d\'être converties.',
      'Personnalise ton message d\'acceptation pour créer un lien dès le départ.',
    ],
  },
  {
    id: 4,
    icon: 'calendar-outline' as const,
    title: 'Optimiser ton agenda',
    summary: 'Gère ta disponibilité pour ne jamais manquer une opportunité.',
    tips: [
      'Mets ton statut sur "Ouvert" uniquement quand tu peux vraiment prendre des projets.',
      'Les artistes avec statut "Ouvert" apparaissent en priorité dans l\'explore.',
      'Configure tes exclusions clairement — ça filtre les demandes non pertinentes.',
    ],
  },
  {
    id: 5,
    icon: 'trending-up-outline' as const,
    title: 'Comprendre tes analytics',
    summary: 'Les données pour prendre les bonnes décisions créatives et business.',
    tips: [
      'Surveille le ratio Vues profil / Demandes : en dessous de 1%, retravaille ta bio.',
      'Les pics de vues arrivent jeudi-samedi — publie en début de semaine pour capter l\'élan.',
      'Le funnel de conversion te montre où tu perds les clients potentiels.',
      'Compare tes posts les plus vus à ceux qui génèrent le plus de demandes — ce n\'est pas toujours les mêmes.',
    ],
  },
  {
    id: 6,
    icon: 'star-outline' as const,
    title: 'Personnaliser son profil Premium',
    summary: 'Tire parti des sections exclusives pour te démarquer.',
    tips: [
      'La section "Mon process" rassure les primo-tattoo et réduit les questions répétitives.',
      'Une FAQ personnalisée qualifie les clients en amont : moins de demandes hors-scope.',
      'Le preset visuel "Warm" performe mieux pour les styles traditionnels et japonais.',
      'Réorganise tes sections selon ton audience : bio en premier pour les nouveaux clients.',
    ],
  },
  {
    id: 7,
    icon: 'shield-checkmark-outline' as const,
    title: 'Confiance et réputation',
    summary: 'Construire une réputation solide sur le long terme.',
    tips: [
      'Chaque RDV confirmé améliore ton score de confiance (visible en interne).',
      'Évite les annulations de dernière minute : elles impactent ton classement.',
      'Signale immédiatement tout comportement inapproprié via le menu ···.',
      'La cohérence de ton style sur la durée renforce ta reconnaissance de marque.',
    ],
  },
  {
    id: 8,
    icon: 'diamond-outline' as const,
    title: 'Stratégie de croissance',
    summary: 'Passer de tatoueur à référence dans ta ville.',
    tips: [
      'Vise 1 post/semaine minimum pour rester visible dans l\'algo.',
      'Engage tes abonnés : réponds aux commentaires dans les 2h post-publication.',
      'Les artistes dans le top 10% de leur ville ont en moyenne 4,2 posts/mois.',
      'Croise tes données analytics avec tes vraies réservations pour identifier les styles qui convertissent le mieux.',
    ],
  },
];

export default function PremiumGuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openChapter, setOpenChapter] = useState<number | null>(1);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Manuel Premium</TText>
        <TBadge label="Premium" variant="premium" />
      </View>

      <View style={styles.intro}>
        <TText variant="body" color="secondary" style={{ lineHeight: 24 }}>
          8 chapitres pour maximiser ta présence et tes revenus sur TATTOO.
        </TText>
      </View>

      <TDivider style={styles.divider} />

      {CHAPTERS.map((chapter, idx) => {
        const isOpen = openChapter === chapter.id;
        return (
          <View key={chapter.id}>
            <TouchableOpacity
              style={styles.chapterHeader}
              onPress={() => setOpenChapter(isOpen ? null : chapter.id)}
              activeOpacity={0.8}
            >
              <View style={styles.chapterIcon}>
                <Ionicons name={chapter.icon} size={20} color={Colors.accentWarm} />
              </View>
              <View style={styles.chapterMeta}>
                <TText variant="caption" color="tertiary">Chapitre {chapter.id}</TText>
                <TText variant="bodySmall" weight="semibold">{chapter.title}</TText>
                {!isOpen && (
                  <TText variant="caption" color="tertiary" style={{ marginTop: 2 }} numberOfLines={1}>
                    {chapter.summary}
                  </TText>
                )}
              </View>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.chapterBody}>
                <TText variant="bodySmall" color="secondary" style={styles.chapterSummary}>
                  {chapter.summary}
                </TText>
                {chapter.tips.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <View style={styles.tipBullet} />
                    <TText variant="bodySmall" color="secondary" style={styles.tipText}>
                      {tip}
                    </TText>
                  </View>
                ))}
              </View>
            )}

            {idx < CHAPTERS.length - 1 && <TDivider style={styles.divider} />}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  intro: {
    padding: Spacing.sm,
    paddingBottom: 0,
  },
  divider: { marginHorizontal: Spacing.sm, marginVertical: Spacing['3xs'] },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
    gap: Spacing.sm,
  },
  chapterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(200,168,130,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chapterMeta: { flex: 1 },
  chapterBody: {
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing['2xs'],
    padding: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  chapterSummary: {
    marginBottom: Spacing['2xs'],
    lineHeight: 22,
    fontStyle: 'italic',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: 10,
  },
  tipBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.accentWarm,
    marginTop: 7,
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    lineHeight: 20,
  },
});
