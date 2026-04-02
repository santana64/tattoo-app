import React, { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { StyleSheet, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';

function TabIcon({ name, color, focused, badge }: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  badge?: number;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.15, { damping: 10, stiffness: 250 }, () => {
        scale.value = withSpring(1, { damping: 12 });
      });
    }
  }, [focused]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.iconWrap, animStyle]}>
      {focused && <View style={styles.iconGlow} />}
      <Ionicons
        name={focused ? name : (`${name}-outline` as any)}
        size={24}
        color={focused ? Colors.accentWarm : color}
      />
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <TText variant="micro" color="inverse" style={{ fontSize: 9 }}>
            {badge > 9 ? '9+' : badge}
          </TText>
        </View>
      )}
    </Animated.View>
  );
}

export default function TabLayout() {
  const { user, isAuthenticated } = useAuthStore();
  const { requests } = useAppStore();
  const insets = useSafeAreaInsets();

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;

  const isArtist = user?.role === 'artist';
  const newRequests = isArtist
    ? requests.filter((r) => r.status === 'submitted' && r.artistId === user?.artistId).length
    : 0;

  const TAB_H = 64 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: TAB_H,
          backgroundColor: 'rgba(5,5,8,0.85)',
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
          paddingBottom: insets.bottom,
          paddingTop: 10,
          // Frosted glass effect via elevated background
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.6,
              shadowRadius: 24,
            },
            android: { elevation: 20 },
          }),
        },
        tabBarActiveTintColor: Colors.accentWarm,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.3,
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="search" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: isArtist ? 'Inbox' : 'Demandes',
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
      {isArtist && (
        <Tabs.Screen
          name="agenda"
          options={{
            title: 'Agenda',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="calendar" color={color} focused={focused} />
            ),
          }}
        />
      )}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(200,168,130,0.12)',
  },
  badge: {
    position: 'absolute',
    top: -2, right: 0,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.bgPrimary,
  },
});
