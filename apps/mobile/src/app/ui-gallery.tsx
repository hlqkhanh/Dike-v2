import { useState } from "react";
import { View } from "react-native";
import { DetailPage } from "@/components/DetailPage";
import { ArtHeader } from "@/components/ArtHeader";
import { JourneyTicket } from "@/components/JourneyTicket";
import { FormSteps } from "@/components/FormSteps";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  HeroArt,
  LoadingCards,
  RouteCard,
  Text,
  ui,
} from "@/components/ui";
export default function Gallery() {
  const [open, setOpen] = useState(false);
  return (
    <DetailPage
      title="Bộ giao diện Dike"
      subtitle="Mint · Emerald · Jakarta Sans"
    >
      <HeroArt />
      <ArtHeader
        title="Mỗi ngày, một kết nối"
        subtitle="Bộ minh họa dùng chung từ web"
        art="route"
        eyebrow="DIKÉ SHARE"
      />
      <FormSteps labels={["Chọn tuyến", "Thông tin", "Xem lại"]} current={1} />
      <JourneyTicket label="Vé hành trình" status="Đã xác nhận" passenger>
        <RouteCard origin="Đại học FPT" destination="Trung tâm thành phố" />
      </JourneyTicket>
      <Card>
        <Text style={ui.sectionTitle}>Cùng nhau đi xanh</Text>
        <Text style={ui.muted}>
          Đây là nội dung tiếng Việt ở cỡ chữ hệ thống.
        </Text>
        <View style={ui.row}>
          <Avatar name="Minh Anh" />
          <Badge label="Đã xác minh" />
          <Badge label="Đi ké" gold />
        </View>
      </Card>
      <RouteCard origin="Đại học FPT" destination="Trung tâm thành phố" />
      <View style={ui.wrap}>
        <Chip label="Tất cả" selected />
        <Chip label="Tôi chở" />
        <Chip label="Tôi đi ké" selected gold />
      </View>
      <Field label="Điểm đến" placeholder="Bạn muốn đi đâu?" />
      <Field label="Điện thoại" error="Vui lòng nhập số hợp lệ" />
      <Button label="Tiếp tục" onPress={() => setOpen(true)} />
      <Button label="Đang xử lý" pending onPress={() => {}} />
      <Button label="Chưa đủ thông tin" disabled onPress={() => {}} />
      <EmptyState
        title="Chưa có hành trình"
        description="Những kết nối mới đang chờ bạn."
      />
      <LoadingCards />
      <BottomSheet
        visible={open}
        title="Xác nhận hành trình"
        onClose={() => setOpen(false)}
      >
        <Text style={ui.muted}>
          Các hành động quan trọng cần được xác nhận.
        </Text>
        <Button label="Đã hiểu" onPress={() => setOpen(false)} />
      </BottomSheet>
    </DetailPage>
  );
}
