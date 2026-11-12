import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShell } from '@/hooks/useContentDimensions';
import Animated, {
  useSharedValue, useAnimatedStyle,
} from 'react-native-reanimated';
import { useAuthStore } from '@/store/auth-store';
import { useRequestStore } from '@/store/request-store';
import { Colors, Fonts } from '@/constants/theme';
import { TText } from '@/components/ui/TText';

function TabIcon({ name, color, focused, badge }: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  badge?: number;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    // Tabs are peers used constantly: no transition on the marker.
    progress.value = focused ? 1 : 0;
  }, [focused, progress]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.4 + progress.value * 0.6 }],
  }));

  return (
    <View style={styles.iconContainer}>
      <Ionicons
        name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)}
        size={22}
        color={focused ? '#FFFFFF' : color}
      />
      <Animated.View style={[styles.activeBar, dotStyle]} />
      {!!badge && badge > 0 && (
        <View style={styles.badge} accessibilityLabel={`${badge} nouvelles demandes`}>
          <TText variant="micro" tabular style={{ fontSize: 9, lineHeight: 12, color: '#FFFFFF', letterSpacing: 0 }}>
            {badge > 9 ? '9+' : badge}
          </TText>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const user = useAuthStore((s) => s.user);
  // Artist requests are already scoped to the signed-in artist by the store.
  const requests = useRequestStore((s) => s.requests);
  const insets = useSafeAreaInsets();

  // Visitors may browse Découvrir/Rechercher; the root layout's authRedirect
  // sends private tabs to sign-in, so no blanket redirect here.
  const isArtist = user?.role === 'artist';
  // A visitor sees what they can use, plus one clear way in. Private tabs would
  // only bounce them to the sign-in screen. Wait for the session check so a
  // signed-in user never sees the visitor bar flash.
  const isVisitor = useAuthStore((s) => !s.isAuthenticated && !s.isLoading);
  const newRequests = isArtist
    ? requests.filter((r) => r.status === 'submitted').length
    : 0;

  const TAB_H = 62 + insets.bottom;
  const { hasSidebar } = useShell();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: hasSidebar ? { display: 'none' } : {
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: TAB_H,
          backgroundColor: Colors.inkPanel,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.inkPanel }]}>
            <View style={styles.tabBarBorder} />
          </View>
        ),
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: Colors.onInkMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontFamily: Fonts.sansMedium,
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Découvrir',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Rechercher',
          // Artists get Messages + Agenda instead: keep the bar at five tabs.
          href: isArtist ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="search" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: isArtist ? 'Demandes' : 'Projets',
          href: isVisitor ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={isArtist ? 'mail' : 'document-text'}
              color={color}
              focused={focused}
              badge={newRequests}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          href: isVisitor ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubbles" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          // Route files always register as tabs; hide it for clients and visitors.
          href: isArtist ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isVisitor ? 'Se connecter' : 'Compte',
          tabBarAccessibilityLabel: isVisitor ? 'Se connecter ou créer un compte' : 'Compte',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={isVisitor ? 'log-in' : 'person'} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 48, height: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  activeBar: {
    position: 'absolute',
    top: -8,
    width: 22, height: 2,
    backgroundColor: Colors.flame,
  },
  tabBarBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: Colors.onInkLine,
  },
  badge: {
    position: 'absolute',
    top: -2, right: 6,
    backgroundColor: Colors.flame,
    borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.inkPanel,
  },
});
