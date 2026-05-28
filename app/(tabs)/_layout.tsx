import React, { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { StyleSheet, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming,
} from 'react-native-reanimated';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Colors, Radius, Spacing, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';

function TabIcon({ name, color, focused, badge }: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  badge?: number;
}) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 300 }),
        withSpring(1.05, { damping: 12 }),
      );
      glowOpacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withSpring(1, { damping: 14 });
      glowOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [focused]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <View style={styles.iconContainer}>
      <Animated.View style={[styles.iconGlow, glowStyle]} />
      <Animated.View style={[styles.iconWrap, animStyle]}>
        <Ionicons
          name={focused ? name : (`${name}-outline` as any)}
          size={24}
          color={focused ? Colors.accentWarm : color}
        />
        {focused && <View style={styles.activeDot} />}
        {!!badge && badge > 0 && (
          <View style={styles.badge}>
            <TText variant="micro" color="inverse" style={{ fontSize: 9, lineHeight: 13 }}>
              {badge > 9 ? '9+' : badge}
            </TText>
          </View>
        )}
      </Animated.View>
    </View>
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

  const TAB_H = 68 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: TAB_H,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['rgba(3,3,5,0)', 'rgba(3,3,5,0.92)', 'rgba(3,3,5,0.98)']}
              locations={[0, 0.2, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.tabBarBorder} />
          </View>
        ),
        tabBarActiveTintColor: Colors.accentWarm,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.2,
          marginTop: -4,
        },
        tabBarItemStyle: { paddingTop: 8 },
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
  iconContainer: {
    width: 48, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.glowAmber,
  },
  iconWrap: {
    width: 44, height: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: -6,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.accentWarm,
  },
  tabBarBorder: {
    position: 'absolute',
    top: 0, left: Spacing.lg, right: Spacing.lg,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
  },
  badge: {
    position: 'absolute',
    top: -3, right: -2,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.bgPrimary,
  },
});
