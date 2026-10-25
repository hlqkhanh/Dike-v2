// Shared with the web app; Metro bundles these files for offline display.
import homeLandscape from "../../../web/public/images/dike_top_banner.png";
import homeBanner from "../../assets/art/banner-home-v2.jpg";
import driver from "../../../web/public/images/green ride duck.png";
import passenger from "../../../web/public/images/yellow waiting duck.png";
import journey from "../../../web/public/images/Bản đồ xanh giữa đồi sương mint.png";
import logo from "../../../web/public/images/logo.png";
import leaves from "../../../web/public/images/botanical_leaves.png";

export const homeAssets = {
  homeBanner,
  homeLandscape,
  driver,
  passenger,
  journey,
  logo,
  leaves,
};

import routeCover from "../../../web/public/images/background-home.png";
import ticket from "../../../web/public/images/Vé xanh giữa cảnh đường ven hồ.png";
import schedule from "../../../web/public/images/Minh họa lịch trình du lịch xanh.png";
import conversation from "../../../web/public/images/Bong bóng trò chuyện giữa thiên nhiên.png";

export const pageAssets = {
  route: routeCover,
  ticket,
  schedule,
  conversation,
  journey,
};
export type PageArt = keyof typeof pageAssets;

import journeySchedule from "../../../web/public/images/card_1.png";
import journeyProposal from "../../../web/public/images/card_2.png";
import journeyBooking from "../../../web/public/images/card_3.png";

export const journeyHubAssets = {
  schedule: journeySchedule,
  proposal: journeyProposal,
  booking: journeyBooking,
};
