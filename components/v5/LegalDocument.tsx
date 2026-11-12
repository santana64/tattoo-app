// INKR v5 — reading layout for legal documents. Typography only: the caller
// passes the text verbatim; nothing here rewrites it.
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { THeader } from '@/components/ui/THeader';
import { EditorialTitle, Kicker, Rule } from '@/components/v5';
import { useContentDimensions } from '@/hooks/useContentDimensions';

export interface LegalSection {
  title: string;
  body: string;
}

interface LegalDocumentProps {
  /** Breadcrumb of the stacked header. */
  headerTitle: string;
  kicker: string;
  title: string;
  emphasis: string;
  /** "Dernière mise à jour : …", shown as written. */
  updated: string;
  sections: LegalSection[];
}

/** Masthead, then numbered ruled sections: number and serif heading at the left, prose at reading width. */
export function LegalDocument({ headerTitle, kicker, title, emphasis, updated, sections }: LegalDocumentProps) {
  const insets = useSafeAreaInsets();
  const { isWide, gutter } = useContentDimensions();

  return (
    <View style={styles.container}>
      <THeader title={headerTitle} showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + Spacing['4xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.head, isWide && styles.headWide]}>
          <Kicker tone="flame" style={styles.kicker}>{kicker}</Kicker>
          <EditorialTitle emphasis={emphasis}>{title}</EditorialTitle>
          <TText variant="caption" color="secondary" tabular style={styles.updated}>{updated}</TText>
        </View>
        <Rule tone="ink" />

        {sections.map((section, index) => (
          <View key={section.title} style={[styles.section, isWide && styles.sectionWide]}>
            <View style={isWide ? styles.asideWide : styles.aside}>
              <Kicker tone="flame" style={styles.number}>{String(index + 1).padStart(2, '0')}</Kicker>
              <TText variant="displayS" style={styles.sectionTitle} accessibilityRole="header">
                {section.title}
              </TText>
            </View>
            <TText variant="body" selectable style={[styles.sectionBody, isWide && styles.sectionBodyWide]}>
              {section.body}
            </TText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center' },

  head: { paddingTop: Spacing.xl, paddingBottom: Spacing.lg },
  headWide: { paddingTop: Spacing['3xl'], paddingBottom: Spacing.xl },
  kicker: { marginBottom: Spacing.sm },
  updated: { marginTop: Spacing.md },

  section: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  sectionWide: { flexDirection: 'row', gap: Spacing['2xl'], paddingVertical: Spacing.xl },
  aside: { marginBottom: Spacing.xs },
  asideWide: { width: 280 },
  number: { marginBottom: 8 },
  sectionTitle: { fontSize: 26, lineHeight: 29, letterSpacing: -0.5 },
  sectionBody: { color: Colors.textPrimary, lineHeight: 27, maxWidth: Layout.maxReading },
  sectionBodyWide: { flex: 1, minWidth: 0, paddingTop: 22 },
});
