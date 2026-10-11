import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { THeader } from '@/components/ui/THeader';
import { EmptyState } from '@/components/ui/EmptyState';

/** Generic modal route: no content of its own, offers a way back home. */
export default function ModalScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <THeader showBack onBack={() => router.dismissTo('/')} />
      <EmptyState
        icon="albums-outline"
        title="Rien à afficher ici"
        description="Cette fenêtre n’a pas de contenu. Revenez à l’accueil pour continuer."
        ctaLabel="Retour à l’accueil"
        onCta={() => router.dismissTo('/')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
});
