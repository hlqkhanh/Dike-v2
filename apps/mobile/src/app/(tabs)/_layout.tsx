import { Redirect, Tabs, router } from "expo-router";
import { Fragment } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBarGlass } from "@/components/TabBarGlass";
import { Icon, Text, type IconName } from "@/components/ui";
import { homeTheme as h } from "@/core/home-theme";
import { useSession } from "@/core/session";

export default function TabsLayout() {
  const { loading, session } = useSession();
  const insets = useSafeAreaInsets();
  if (!loading && !session?.authenticated) return <Redirect href="/sign-in" />;
  if (session?.user.nextAction === "REVIEW_CONSENT")
    return <Redirect href="/settings/consent" />;
  if (["SUBMIT_PHONE", "VERIFY_PHONE"].includes(session?.user.nextAction ?? ""))
    return <Redirect href="/onboarding/phone" />;
  return (
    <Tabs
      tabBar={({ state, descriptors, navigation }) => (
        <View
          style={[
            tabStyles.navigation,
            { bottom: Math.max(14, insets.bottom) },
          ]}
        >
          <TabBarGlass />
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const options = descriptors[route.key].options;
            const icons: Record<string, IconName> = {
              index: focused ? "home" : "home-outline",
              trips: "navigate-outline",
              inbox: "chatbubble-ellipses-outline",
              profile: "person-outline",
            };
            return (
              <Fragment key={route.key}>
                {index === 2 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tạo hành trình"
                    onPress={() => router.push("/create-trip")}
                    style={tabStyles.create}
                  >
                    <Icon name="add" size={34} color={h.surface} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel={options.title}
                  accessibilityState={{ selected: focused }}
                  aria-selected={focused}
                  onPress={() => {
                    const event = navigation.emit({
                      type: "tabPress",
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!focused && !event.defaultPrevented)
                      navigation.navigate(route.name);
                  }}
                  onLongPress={() =>
                    navigation.emit({ type: "tabLongPress", target: route.key })
                  }
                  style={[tabStyles.destination, focused && tabStyles.selected]}
                >
                  <Icon
                    name={icons[route.name] ?? "ellipse-outline"}
                    size={26}
                    color={focused ? h.primary : h.muted}
                  />
                </Pressable>
              </Fragment>
            );
          })}
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#087d61",
        tabBarInactiveTintColor: "#527066",
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: "700",
          marginTop: -1,
          marginBottom: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarBackground: () => <TabBarGlass />,
        tabBarStyle: {
          position: "absolute",
          bottom: Math.max(14, insets.bottom),
          marginHorizontal: 16,
          backgroundColor: "transparent",
          borderWidth: 0,
          borderRadius: 40,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
          elevation: 10,
          shadowColor: "#084534",
          shadowOpacity: 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
        },
      }}
    >
      {(
        [
          {
            name: "index",
            title: "Trang chủ",
            activeIcon: "home",
            inactiveIcon: "home-outline",
          },
          {
            name: "trips",
            title: "Chuyến đi",
            activeIcon: "navigate",
            inactiveIcon: "navigate-outline",
          },
          {
            name: "inbox",
            title: "Tin nhắn",
            activeIcon: "chatbubble-ellipses",
            inactiveIcon: "chatbubble-ellipses-outline",
          },
          {
            name: "profile",
            title: "Cá nhân",
            activeIcon: "person",
            inactiveIcon: "person-outline",
          },
        ] as const
      ).map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.title,
            tabBarAccessibilityLabel: item.title,
            tabBarIcon: ({ focused }) => (
              <View
                style={
                  focused
                    ? tabStyles.activeIconPill
                    : tabStyles.inactiveIconPill
                }
              >
                <Icon
                  name={
                    (focused ? item.activeIcon : item.inactiveIcon) as IconName
                  }
                  color={focused ? "#087d61" : "#527066"}
                  size={22}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  navigation: {
    position: "absolute",
    start: 20,
    end: 20,
    minHeight: 64,
    padding: 6,
    borderRadius: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: h.ink,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  destination: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: h.primarySoft },
  label: { fontSize: 10, fontWeight: "600" },
  create: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: h.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
    shadowColor: h.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  activeIconPill: {
    backgroundColor: "#d5f2e3",
    width: 60,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveIconPill: {
    width: 60,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
});
