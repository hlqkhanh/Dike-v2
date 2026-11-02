import { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { MyProfileResponse, RidePostPage } from "@dike/api-client-ts";
import { Screen } from "@/components/Screen";
import { ResourceState } from "@/components/ResourceState";
import { RidePostCard, RidePostFeed } from "@/components/RidePostCard";
import { Avatar, Badge, Button, Card, Icon, Text } from "@/components/ui";
import { pageAssets } from "@/core/assets";
import { useMobileApi, useResource } from "@/core/hooks";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

export default function Profile() {
  const { session } = useSession();
  const api = useMobileApi();
  const user = session?.user;
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const profile = useResource<MyProfileResponse>("my-profile", "/me/profile");
  const posts = useInfiniteQuery({
    queryKey: ["mobile-profile-posts"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.call<RidePostPage>(
        `/ride-posts?tab=mine${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (page) => page.nextCursor || undefined,
  });

  useFocusEffect(
    useCallback(() => {
      void profile.refetch();
      void posts.refetch();
    }, [profile.refetch, posts.refetch]),
  );

  const ownPosts = (
    posts.data?.pages.flatMap((page) => page.items) ?? []
  ).filter((post) => !hiddenPostIds.includes(post.id));
  const displayName = profile.data?.displayName || user?.displayName;
  const avatar = profile.data?.avatarUrl || user?.avatarUrl;
  const refresh = () => {
    void profile.refetch();
    void posts.refetch();
  };

  return (
    <Screen
      title=""
      hideHeader
      onRefresh={refresh}
      refreshing={profile.isRefetching || posts.isRefetching}
    >
      <View style={styles.profileShell}>
        <View style={styles.cover}>
          <Image
            source={pageAssets.route}
            resizeMode="cover"
            style={styles.coverImage}
          />
          <LinearGradient
            colors={["rgba(5,91,69,.08)", "rgba(5,91,69,.52)"]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở cài đặt trang cá nhân"
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="settings-outline" color={theme.colors.ink} />
          </Pressable>
        </View>

        <View style={styles.identity}>
          <View style={styles.avatarRing}>
            <Avatar name={displayName} uri={avatar} size={104} />
          </View>
          <Text accessibilityRole="header" style={styles.name}>
            {displayName || "Thành viên Diké"}
          </Text>
          <Text style={styles.bio}>
            {profile.data?.bio ||
              "Cùng cộng đồng tạo nên những hành trình xanh hơn."}
          </Text>
          <View style={styles.badges}>
            <Badge
              label={
                user?.phoneStatus === "VERIFIED"
                  ? "Đã xác minh điện thoại"
                  : "Thành viên Diké"
              }
            />
            {user?.accessMode === "SIMULATED" ? (
              <Badge label="Quyền thử nghiệm" gold />
            ) : null}
          </View>
        </View>

        <View style={styles.quickInfo}>
          <ProfileFact
            icon="location-outline"
            text={
              profile.data?.localityName ||
              profile.data?.provinceName ||
              "Chưa cập nhật khu vực"
            }
          />
          <ProfileFact
            icon="mail-outline"
            text={
              profile.data?.contactEmail || user?.email || "Chưa cập nhật email"
            }
          />
          <ProfileFact
            icon="call-outline"
            text={
              profile.data?.contactPhone ||
              user?.phoneMasked ||
              "Chưa cập nhật số điện thoại"
            }
          />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>HÀNH TRÌNH CỦA BẠN</Text>
          <Text style={styles.sectionTitle}>Chuyến đi đã đăng</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đăng chuyến đi"
          onPress={() => router.push("/create-trip")}
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="add" color="#fff" size={20} />
          <Text style={styles.createButtonText}>Đăng chuyến</Text>
        </Pressable>
      </View>

      <ResourceState query={posts}>
        {ownPosts.length ? (
          <RidePostFeed inset={20}>
            {ownPosts.map((post) => (
              <RidePostCard
                key={post.id}
                fullWidth
                post={post}
                viewerId={user?.id}
                onChanged={() =>
                  setHiddenPostIds((current) =>
                    current.includes(post.id) ? current : [...current, post.id],
                  )
                }
              />
            ))}
          </RidePostFeed>
        ) : (
          <Card style={styles.emptyCard}>
            <Icon name="map-outline" size={30} />
            <Text style={styles.emptyTitle}>Chưa có chuyến đi</Text>
            <Text style={styles.emptyText}>
              Các chuyến bạn đăng hoặc lưu nháp sẽ xuất hiện tại đây.
            </Text>
            <Button
              label="Tạo chuyến đầu tiên"
              onPress={() => router.push("/create-trip")}
            />
          </Card>
        )}
      </ResourceState>
      {posts.hasNextPage ? (
        <Button
          label="Xem thêm chuyến đi"
          variant="secondary"
          pending={posts.isFetchingNextPage}
          onPress={() => void posts.fetchNextPage()}
        />
      ) : null}
    </Screen>
  );
}

type FactIcon = "location-outline" | "mail-outline" | "call-outline";
function ProfileFact({ icon, text }: { icon: FactIcon; text: string }) {
  return (
    <View style={styles.factRow}>
      <Icon name={icon} size={19} color={theme.colors.inkMuted} />
      <Text numberOfLines={1} style={styles.factText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileShell: {
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cover: { height: 142, backgroundColor: "#d9efe6" },
  coverImage: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  settingsButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.95)",
  },
  identity: { alignItems: "center", paddingHorizontal: 22, paddingBottom: 18 },
  avatarRing: {
    marginTop: -52,
    padding: 5,
    backgroundColor: "#fff",
    borderRadius: 60,
  },
  name: {
    marginTop: 8,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "900",
    color: theme.colors.ink,
    textAlign: "center",
  },
  bio: {
    marginTop: 5,
    color: theme.colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  badges: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  quickInfo: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 16,
    gap: 11,
  },
  factRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  factText: { flex: 1, color: theme.colors.inkMuted, fontSize: 13 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 5,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "900",
  },
  createButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  createButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  emptyCard: { alignItems: "center", paddingVertical: 28 },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyText: {
    color: theme.colors.inkMuted,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 8,
  },
  tripCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 14,
    gap: 13,
    ...theme.shadow.card,
  },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  postIdentity: { flex: 1, gap: 2 },
  ownerName: { color: theme.colors.ink, fontSize: 15, fontWeight: "800" },
  ownerMeta: { color: theme.colors.inkMuted, fontSize: 11 },
  moreButton: {
    width: 42,
    height: 42,
    marginRight: -7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  tripTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tripBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tripBadgeText: { fontSize: 12, fontWeight: "800" },
  tripDate: {
    marginLeft: "auto",
    flexShrink: 1,
    color: theme.colors.inkMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },
  tripBody: { gap: 12, backgroundColor: "#fff" },
  tripRoute: { position: "relative", gap: 14 },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "#fff",
    zIndex: 1,
  },
  stopIcon: {
    width: 22,
    alignItems: "center",
    paddingTop: 1,
    backgroundColor: "#fff",
  },
  stopLine: {
    position: "absolute",
    left: 23,
    top: 20,
    bottom: 20,
    width: 2,
    opacity: 0.4,
  },
  stopText: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  tripMap: { width: "100%", height: 180, borderRadius: 16 },
  tripFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tripMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  tripMetaText: { color: theme.colors.inkMuted, fontSize: 11 },
  status: { marginLeft: "auto", fontSize: 11, fontWeight: "800" },
  deleteHint: { color: theme.colors.inkMuted, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.78 },
});
