import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { EASE_OUT, PressableScale, enterUp, fadeIn } from '@/components/motion';

// Practical advice only: no invented statistics or ranking promises.
const CHAPTERS = [
  {
    id: 1,
    title: 'Bien démarrer sur INKR',
    summary: 'Un profil complet donne aux clients ce qu’il faut pour vous écrire.',
    tips: [
      'Choisissez une couverture qui montre une pièce représentative de votre style.',
      'Écrivez une bio courte : votre approche, vos styles, votre ville.',
      'Renseignez tout le profil : styles, budget minimum, conditions et exclusions.',
    ],
  },
  {
    id: 2,
    title: 'Une galerie qui donne envie d’écrire',
    summary: 'Vos premières réalisations visibles sont votre vitrine.',
    tips: [
      'Placez vos meilleures pièces en premier, avant les travaux plus anciens.',
      'Variez les zones et les formats pour montrer l’étendue de votre pratique.',
      'Photographiez en lumière naturelle, sans filtre qui modifie les couleurs de l’encre.',
      'Indiquez deux ou trois styles par publication pour classer votre travail.',
    ],
  },
  {
    id: 3,
    title: 'Gérer les demandes',
    summary: 'Une réponse claire, même négative, construit la confiance.',
    tips: [
      'Répondez rapidement, y compris pour décliner une demande.',
      'Demandez une précision plutôt que de refuser une demande incomplète.',
      'Personnalisez votre message d’acceptation pour lancer l’échange.',
    ],
  },
  {
    id: 4,
    title: 'Tenir votre agenda',
    summary: 'Votre disponibilité indique aux clients s’ils peuvent vous écrire.',
    tips: [
      'Affichez « Prend des projets » uniquement quand vous pouvez en accepter.',
      'Passez en liste d’attente plutôt qu’en complet pour garder le contact.',
      'Précisez vos exclusions : elles évitent les demandes hors de votre pratique.',
    ],
  },
  {
    id: 5,
    title: 'Lire vos statistiques',
    summary: 'Les chiffres servent à décider, pas à se comparer.',
    tips: [
      'Suivez le rapport entre vues du profil et demandes reçues.',
      'Beaucoup de vues et peu de demandes : retravaillez votre bio et vos conditions.',
      'Comparez vos réalisations les plus vues avec celles qui suscitent des demandes.',
    ],
  },
  {
    id: 6,
    title: 'Personnaliser le profil',
    summary: 'Les sections Premium répondent aux questions avant qu’elles arrivent.',
    tips: [
      'La section « Ma méthode » rassure les personnes qui se font tatouer pour la première fois.',
      'Des questions fréquentes bien écrites évitent les échanges répétitifs.',
      'Affichez les sections dans l’ordre qui compte pour votre clientèle.',
    ],
  },
  {
    id: 7,
    title: 'Confiance et réputation',
    summary: 'La régularité compte plus qu’un coup d’éclat.',
    tips: [
      'Honorez vos rendez-vous confirmés et prévenez tôt en cas d’imprévu.',
      'Signalez tout comportement inapproprié depuis le menu d’options.',
      'Un style cohérent dans le temps rend votre travail reconnaissable.',
    ],
  },
  {
    id: 8,
    title: 'Faire grandir l’atelier',
    summary: 'Quelques habitudes simples, tenues dans la durée.',
    tips: [
      'Publiez régulièrement plutôt que beaucoup d’un coup.',
      'Répondez aux messages dans un délai que vous pouvez tenir.',
      'Croisez vos statistiques avec vos réservations réelles pour repérer ce qui fonctionne.',
    ],
  },
];

/** Rare, first-visit moment: a gold wash lights the hero, a rule draws in. */
function GoldLight() {
  const reduced = useReducedMotion();
  const light = useSharedValue(0);
  const rule = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    light.set(withTiming(1, { duration: 1100, easing: EASE_OUT }));
    if (!reduced) rule.set(withDelay(250, withTiming(1, { duration: 900, easing: EASE_OUT })));
  }, [light, rule, reduced]);
  const lightStyle = useAnimatedStyle(() => ({ opacity: light.get() }));
  const ruleStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: rule.get() }] }));
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, lightStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(221,187,130,0.20)', 'rgba(201,164,106,0.06)', 'rgba(11,10,9,0)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.goldRule, ruleStyle]} pointerEvents="none" />
    </>
  );
}

export default function PremiumGuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openChapter, setOpenChapter] = useState<number | null>(1);

  return (
    <View style={styles.container}>
      <THeader title="Guide Premium" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['2xl'] }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <GoldLight />
          <View style={styles.heroInner}>
            <Animated.View entering={enterUp(0, 200)}>
              <TText variant="label" color="accentWarm" uppercase>INKR Premium</TText>
            </Animated.View>
            <Animated.View entering={enterUp(1, 200)}>
              <TText variant="displayL" style={styles.heroTitle} accessibilityRole="header">
                Le guide <TText variant="displayL" italic color="accentGlow">de l’atelier</TText>
              </TText>
            </Animated.View>
            <Animated.View entering={enterUp(2, 200)}>
              <TText variant="body" color="secondary" style={styles.heroSubtitle}>
                Huit chapitres pour présenter votre travail et traiter vos demandes sereinement.
              </TText>
            </Animated.View>
          </View>
        </View>

        {/* Chapters */}
        <View style={styles.body}>
          <View style={styles.list}>
            {CHAPTERS.map((chapter, idx) => {
              const isOpen = openChapter === chapter.id;
              return (
                <React.Fragment key={chapter.id}>
                  {idx > 0 && <TDivider tone="default" />}
                  <PressableScale
                    onPress={() => setOpenChapter(isOpen ? null : chapter.id)}
                    pressedScale={0.985}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityLabel={`Chapitre ${chapter.id} : ${chapter.title}`}
                    style={styles.chapterHeader}
                  >
                    <TText variant="bodySmall" color="accentWarm" tabular style={styles.chapterNum}>
                      {String(chapter.id).padStart(2, '0')}
                    </TText>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <TText variant="title2" serif style={styles.chapterTitle}>{chapter.title}</TText>
                      {!isOpen && (
                        <TText variant="bodySmall" color="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
                          {chapter.summary}
                        </TText>
                      )}
                    </View>
                    <Ionicons name={isOpen ? 'remove' : 'add'} size={18} color={Colors.textSecondary} />
                  </PressableScale>

                  {isOpen && (
                    <Animated.View entering={fadeIn()} style={styles.chapterBody}>
                      <TText variant="body" color="secondary" serif italic style={styles.chapterSummary}>
                        {chapter.summary}
                      </TText>
                      {chapter.tips.map((tip) => (
                        <View key={tip} style={styles.tipRow}>
                          <View style={styles.tipDash} />
                          <TText variant="body" color="secondary" style={{ flex: 1 }}>{tip}</TText>
                        </View>
                      ))}
                    </Animated.View>
                  )}
                </React.Fragment>
              );
            })}
          </View>

          <View style={styles.cta}>
            <TButton title="Revenir à mon espace" variant="secondary" onPress={() => router.back()} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  hero: { overflow: 'hidden' },
  heroInner: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing['2xl'], paddingBottom: Spacing['2xl'],
  },
  heroTitle: { marginTop: Spacing.xs },
  heroSubtitle: { marginTop: Spacing.sm, maxWidth: 460 },
  goldRule: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 1,
    backgroundColor: Colors.borderGlow, transformOrigin: 'left',
  },

  body: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg,
  },
  list: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault },
  chapterHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, minHeight: 64 },
  chapterNum: { width: 24 },
  chapterTitle: { fontSize: 22, lineHeight: 26 },
  chapterBody: { paddingLeft: 24 + Spacing.sm, paddingBottom: Spacing.md },
  chapterSummary: { fontSize: 18, lineHeight: 24, marginBottom: Spacing.xs },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 5 },
  tipDash: { width: 12, height: 1, backgroundColor: Colors.accentWarm, marginTop: 12 },
  cta: { marginTop: Spacing['2xl'] },
});
