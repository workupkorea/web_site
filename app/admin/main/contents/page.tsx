"use client";

import AdminTabs from "@/components/admin/AdminTabs";
import PeopleTab from "../_tabs/PeopleTab";
import StoryTab from "../_tabs/StoryTab";
import PrRoomTab from "../_tabs/PrRoomTab";

// 사이트 관리 › 콘텐츠 — 탭으로 묶은 통합 페이지
const TABS = [
  { key: "people", label: "메이트", Component: PeopleTab },
  { key: "story", label: "스토리", Component: StoryTab },
  { key: "pr-room", label: "공지사항", Component: PrRoomTab },
] as const;

export default function AdminContentsPage() {
  return <AdminTabs basePath="/admin/main/contents" tabs={TABS} />;
}
