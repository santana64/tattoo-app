import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { PageWrap, Rule } from '@/components/v5';
import { cartelNumber } from '@/components/v5/studio';
import { PremiumHero } from '@/components/v5/premium';

type Hover = { pressed: boolean; hovered?: boolean };

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

export default function PremiumGuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openChapter, setOpenChapter] = useState<number | null>(1);

  return (
    <View style={styles.container}>
      <THeader title="Guide Premium" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['3xl'] }}
      >
        <PageWrap style={{ paddingTop: Spacing.lg }}>
          <PremiumHero
            kicker="INKR Premium / Le manuel d’atelier"
            title="La pratique"
            emphasis="se cultive."
            body="Huit chapitres pour présenter votre travail et traiter vos demandes sereinement."
          />

          {/* Chapters */}
          <View style={styles.body}>
            <Rule tone="ink" />
            {CHAPTERS.map((chapter) => {
              const isOpen = openChapter === chapter.id;
              return (
                <View key={chapter.id} style={styles.chapter}>
                  <Pressable
                    onPress={() => setOpenChapter(isOpen ? null : chapter.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityLabel={`Chapitre ${chapter.id} : ${chapter.title}`}
                    style={[styles.chapterHeader, Platform.OS === 'web' && ({ cursor: 'pointer' } as object)]}
                  >
                    {(state) => {
                      const lit = (state as Hover).hovered || (state as Hover).pressed;
                      return (
                        <>
                          <TText variant="displayS" tabular style={styles.chapterNum}>{cartelNumber(chapter.id)}</TText>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <TText variant="displayS" style={[styles.chapterTitle, lit && { color: Colors.flameText }]}>{chapter.title}</TText>
                            {!isOpen && (
                              <TText variant="bodySmall" color="secondary" numberOfLines={1} style={{ marginTop: 4 }}>
                                {chapter.summary}
                              </TText>
                            )}
                          </View>
                          <Ionicons name={isOpen ? 'remove' : 'add'} size={18} color={lit ? Colors.flameText : Colors.ink} style={{ marginTop: 6 }} />
                        </>
                      );
                    }}
                  </Pressable>

                  {isOpen && (
                    <View style={styles.chapterBody}>
                      <TText variant="displayS" italic style={styles.chapterSummary}>
                        {chapter.summary}
                      </TText>
                      {chapter.tips.map((tip) => (
                        <View key={tip} style={styles.tipRow}>
                          <View style={styles.tipDash} />
                          <TText variant="body" color="secondary" style={{ flex: 1 }}>{tip}</TText>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={styles.cta}>
              <TButton title="Revenir à mon espace" variant="secondary" fullWidth={false} onPress={() => router.back()} />
            </View>
          </View>
        </PageWrap>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  body: { marginTop: Spacing['2xl'], maxWidth: 860 },
  chapter: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  chapterHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md, minHeight: 64 },
  chapterNum: { width: 44, fontSize: 34, lineHeight: 36, color: Colors.flameText },
  chapterTitle: { fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  chapterBody: { paddingLeft: 44 + Spacing.md, paddingBottom: Spacing.lg },
  chapterSummary: { fontSize: 21, lineHeight: 26, color: Colors.accentGlow, marginBottom: Spacing.sm },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  tipDash: { width: 12, height: 1, backgroundColor: Colors.flame, marginTop: 12 },
  cta: { marginTop: Spacing['2xl'] },
});
