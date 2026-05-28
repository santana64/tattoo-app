import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { GlassCard } from '@/components/ui/GlassCard';
import { Logo } from '@/components/ui/Logo';

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Aurora orbs */}
      <View style={styles.auroraViolet} pointerEvents="none" />
      <View style={styles.auroraAmber} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="semibold">Guide Premium</TText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* ── Hero section ─────────────────────────────── */}
        <Animated.View entering={FadeIn.delay(60).duration(600)} style={styles.heroSection}>
          {/* Premium badge */}
          <View style={styles.premiumBadgeWrap}>
            <LinearGradient
              colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumBadge}
            >
              <TText variant="caption" weight="semibold" style={styles.premiumBadgeText}>
                ARTISTE PRO
              </TText>
            </LinearGradient>
          </View>

          <Logo variant="mark" size="xl" animate />

          <TText variant="displayL" weight="bold" style={styles.heroTitle}>
            INKR Premium
          </TText>
          <TText variant="bodySmall" style={styles.heroSubtitle}>
            8 chapitres pour maximiser ta présence et tes revenus sur INKR.
          </TText>
        </Animated.View>

        {/* ── Chapters ─────────────────────────────────── */}
        {CHAPTERS.map((chapter, idx) => {
          const isOpen = openChapter === chapter.id;
          return (
            <Animated.View
              key={chapter.id}
              entering={FadeInDown.delay(100 + idx * 60).springify()}
            >
              <GlassCard variant="elevated" style={styles.chapterCard} padding={0}>
                {/* Chapter number badge */}
                <View style={styles.chapterNumBadge}>
                  <TText variant="caption" style={{ color: Colors.textTertiary, fontSize: 10 }}>
                    {String(chapter.id).padStart(2, '0')}
                  </TText>
                </View>

                {/* Chapter header row */}
                <TouchableOpacity
                  style={styles.chapterHeader}
                  onPress={() => setOpenChapter(isOpen ? null : chapter.id)}
                  activeOpacity={0.8}
                >
                  {/* Icon */}
                  <View style={styles.chapterIcon}>
                    <Ionicons name={chapter.icon} size={22} color={Colors.accentWarm} />
                  </View>

                  {/* Title + summary */}
                  <View style={styles.chapterMeta}>
                    <TText variant="body" weight="semibold">{chapter.title}</TText>
                    {!isOpen && (
                      <TText
                        variant="bodySmall"
                        style={{ color: Colors.textSecondary, marginTop: 3 }}
                        numberOfLines={1}
                      >
                        {chapter.summary}
                      </TText>
                    )}
                  </View>

                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.textTertiary}
                    style={{ flexShrink: 0 }}
                  />
                </TouchableOpacity>

                {/* Expanded tips */}
                {isOpen && (
                  <View style={styles.chapterBody}>
                    <View style={styles.chapterBodyDivider} />
                    <TText variant="bodySmall" style={styles.chapterSummary}>
                      {chapter.summary}
                    </TText>
                    {chapter.tips.map((tip, i) => (
                      <View key={i} style={styles.tipRow}>
                        <View style={styles.tipBullet} />
                        <TText variant="bodySmall" style={styles.tipText}>{tip}</TText>
                      </View>
                    ))}
                  </View>
                )}
              </GlassCard>
            </Animated.View>
          );
        })}

        {/* ── Bottom CTA ────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.ctaSection}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.back()} style={styles.ctaBtn}>
            <LinearGradient
              colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <TText variant="body" weight="semibold" style={{ color: Colors.textInverse, letterSpacing: 0.5 }}>
              Commencer à optimiser
            </TText>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  auroraViolet: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.violet,
    opacity: 0.055,
  },
  auroraAmber: {
    position: 'absolute',
    bottom: 80,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.accentWarm,
    opacity: 0.045,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.lg,
    gap: Spacing.xs,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  premiumBadgeWrap: {
    marginBottom: Spacing['2xs'],
  },
  premiumBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  premiumBadgeText: {
    color: Colors.textInverse,
    letterSpacing: 2,
    fontSize: 11,
  },
  heroTitle: {
    color: Colors.textPrimary,
    letterSpacing: -1,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  chapterCard: {
    marginBottom: Spacing['2xs'],
    position: 'relative',
  },
  chapterNumBadge: {
    position: 'absolute',
    top: Spacing['2xs'],
    right: Spacing.sm,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  chapterIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.glassAmber,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chapterMeta: {
    flex: 1,
  },
  chapterBody: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  chapterBodyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
    marginBottom: Spacing.sm,
  },
  chapterSummary: {
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
  },
  ctaSection: {
    marginTop: Spacing.md,
  },
  ctaBtn: {
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amberStrong,
  },
});
