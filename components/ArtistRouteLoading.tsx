import React from 'react';
import { View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';

export function ArtistRouteLoading({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
      <THeader title={title} showBack />
      <View accessibilityLabel="Chargement de l’atelier" style={{ padding: Spacing.xl, gap: Spacing.md }}>
        <TSkeleton width={180} height={28} />
        <TSkeleton height={220} />
        <TSkeleton height={44} />
      </View>
    </View>
  );
}
