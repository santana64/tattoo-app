import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Colors, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';

function TabBarIcon({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) {
  return (
    <Ionicons name={focused ? name : (`${name}-outline` as any)} size={24} color={color} />
  );
}

function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <TText variant="label" color="inverse" style={{ fontSize: 9 }}>
        {count > 9 ? '9+' : count}
      </TText>
    </View>
  );
}

export default function TabLayout() {
  const { user, isAuthenticated } = useAuthStore();
  const { requests } = useAppStore();
  const insets = useSafeAreaInsets();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  const isArtist = user?.role === 'artist';
  const newRequestsCount = isArtist
    ? requests.filter((r) => r.status === 'submitted' && r.artistId === user?.artistId).length
    : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgElevated,
          borderTopColor: Colors.borderSubtle,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.accentAction,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: FontSize.label,
          fontWeight: '500',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="search" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: isArtist ? 'Inbox' : 'Demandes',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <TabBarIcon name={isArtist ? 'mail' : 'document-text'} color={color} focused={focused} />
              <NotificationBadge count={newRequestsCount} />
            </View>
          ),
        }}
      />
      {isArtist && (
        <Tabs.Screen
          name="agenda"
          options={{
            title: 'Agenda',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="calendar" color={color} focused={focused} />
            ),
          }}
        />
      )}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.bgElevated,
  },
});
