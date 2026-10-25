import { router } from "expo-router";
import { View } from "react-native";
import { DetailPage } from "@/components/DetailPage";
import { Badge, Button, Card, Icon, Text, ui } from "@/components/ui";
import { useSession } from "@/core/session";
export default function Verification() {
  const { session, refresh, loading } = useSession();
  const user = session?.user;
  const verified = user?.phoneStatus === "VERIFIED";
  const simulated = user?.accessMode === "SIMULATED";
  const driverEnabled = user?.authorities?.includes("APPROVED_DRIVER") ?? false;
  return (
    <DetailPage
      title="Xác minh tài khoản"
      subtitle="Minh bạch trạng thái, an tâm kết nối"
      onRefresh={() => void refresh()}
      refreshing={loading}
    >
      <View
        style={{
          padding: 22,
          borderRadius: 26,
          backgroundColor: "#e3f4eb",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            backgroundColor: "#fff",
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="shield-checkmark-outline" size={32} />
        </View>
        <Text style={{ fontSize: 25, fontWeight: "800", lineHeight: 34 }}>
          An tâm từ sự rõ ràng
        </Text>
        <Text style={ui.muted}>
          Thông tin xác minh giúp người cùng đường hiểu và tin tưởng nhau hơn.
        </Text>
      </View>
      <Card>
        <Text style={ui.sectionTitle}>Xin chào, {user?.displayName}</Text>
        <Text style={ui.muted}>
          Mức xác minh phản ánh dữ liệu hiện tại của tài khoản.
        </Text>
        {simulated ? (
          <Badge label="Quyền thử nghiệm · Chưa xác minh thật" gold />
        ) : null}
      </Card>
      {[
        {
          title: "Tài khoản Google",
          text: user?.email || "Đăng nhập để xem",
          done: !!user?.email,
        },
        {
          title: "Số điện thoại",
          text: verified
            ? "Đã xác minh bằng OTP"
            : user?.phoneMasked || "Chưa xác minh",
          done: verified,
        },
        {
          title: "Danh tính",
          text:
            user?.verificationEvidence === "REAL"
              ? "Đã xác minh danh tính"
              : user?.verificationEvidence === "SIMULATED"
                ? "Danh tính thử nghiệm · Chưa xác minh thật"
                : "Chưa có bằng chứng xác minh danh tính",
          done: user?.verificationEvidence === "REAL",
        },
        {
          title: "Quyền tài xế",
          text: !driverEnabled
            ? "Chưa được cấp quyền tài xế"
            : user?.driverApprovalEvidence === "REAL"
              ? "Đã được cấp quyền tài xế với bằng chứng duyệt thật"
              : user?.driverApprovalEvidence === "SIMULATED" || simulated
                ? "Đã mở quyền tài xế thử nghiệm · Chưa duyệt thật"
                : "Đã có quyền tài xế · Chưa có bằng chứng duyệt thật",
          done: driverEnabled && user?.driverApprovalEvidence === "REAL",
        },
      ].map((item) => (
        <Card key={item.title}>
          <View style={ui.row}>
            <Icon name={item.done ? "checkmark-circle" : "ellipse-outline"} />
            <Text style={ui.sectionTitle}>{item.title}</Text>
          </View>
          <Text style={ui.muted}>{item.text}</Text>
        </Card>
      ))}
      <Text style={ui.muted}>
        Quyền tài xế không đồng nghĩa phương tiện đã được duyệt. Khả năng tạo
        chuyến phụ thuộc phương tiện và quyền hiện tại do hệ thống kiểm tra.
      </Text>
      {!verified ? (
        <Button
          label="Xác minh số điện thoại"
          onPress={() => router.push("/onboarding/phone")}
        />
      ) : null}
      <Text style={ui.muted}>
        eKYC và duyệt giấy tờ trực tiếp chưa được backend hỗ trợ. Trạng thái thử
        nghiệm không thay thế xác minh danh tính.
      </Text>
    </DetailPage>
  );
}
