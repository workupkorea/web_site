"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type Store, type StoreProduct, isNewStore } from "@/data/stores";
import KakaoMap from "@/components/KakaoMap";
import { trackStoreEvent } from "@/lib/track";
import { DEFAULT_STORE_PAGE, type StorePageConfig } from "@/lib/store-page";
import { ikSrc } from "@/lib/imageSrc";

const NEARBY_COUNT = 5;
const KAKAO_CHANNEL = "https://pf.kakao.com/_workup"; // 실제 채널 URL로 교체
const SIDO_LIST = ["강원","경기","경남","경북","광주","대구","대전","부산","서울","울산","인천","전남","전북","제주","충남","충북"];

// 주소 첫 토큰이 "경기도"처럼 정식 명칭이어도 드롭다운의 짧은 표기와 매칭되도록 정규화
const PROVINCE_SHORT: Record<string, string> = {
  경상북도: "경북", 경상남도: "경남", 전라북도: "전북", 전라남도: "전남",
  충청북도: "충북", 충청남도: "충남", 경기도: "경기", 강원특별자치도: "강원",
  강원도: "강원", 제주특별자치도: "제주", 제주도: "제주", 서울특별시: "서울",
  부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 광주광역시: "광주",
  대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
};
const normalizeSido = (raw: string) => PROVINCE_SHORT[raw] ?? raw;
const regionOf = (address: string) => {
  const parts = address.split(" ");
  return { sido: normalizeSido(parts[0] ?? ""), sigungu: parts[1] ?? "" };
};

type StoreWithDistance = Store & { distance: number; estimated?: boolean };
type LocStatus = "idle" | "loading" | "success" | "error";

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number, estimated?: boolean) {
  const val = km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
  return estimated ? `~${val}` : val;
}

// 카카오맵 길찾기 버튼 — 위치 없을 때 GPS 자동 요청 후 오픈
function KakaoDirBtn({ store, userCoords: passedCoords }: {
  store: Store;
  userCoords?: { lat: number; lng: number } | null;
}) {
  const [coords, setCoords] = useState(passedCoords ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setCoords(passedCoords ?? null); }, [passedCoords]);

  const openKakao = (c: { lat: number; lng: number } | null) => {
    const dest = `${encodeURIComponent(store.name)},${store.lat},${store.lng}`;
    const url = c
      ? `https://map.kakao.com/link/from/${encodeURIComponent("내 위치")},${c.lat},${c.lng}/to/${dest}`
      : `https://map.kakao.com/link/to/${dest}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleClick = () => {
    trackStoreEvent("directions_kakao", { id: store.id, name: store.name });
    if (coords) { openKakao(coords); return; }
    if (!navigator.geolocation) { openKakao(null); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setLoading(false);
        openKakao(c);
      },
      () => { setLoading(false); openKakao(null); },
      { timeout: 5000, maximumAge: 30000, enableHighAccuracy: true }
    );
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex w-full md:w-auto items-center justify-center gap-1.5 bg-[#FAE100] text-black text-xs px-3 py-2 hover:bg-[#e6cf00] transition-colors disabled:opacity-60"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      {loading ? "확인 중" : "카카오맵"}
    </button>
  );
}

// 네이버맵 길찾기 버튼 — 출발지를 내 위치로 자동 설정 (네이버는 경도,위도 순서)
function NaverDirBtn({ store, userCoords: passedCoords }: {
  store: Store;
  userCoords?: { lat: number; lng: number } | null;
}) {
  const [coords, setCoords] = useState(passedCoords ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setCoords(passedCoords ?? null); }, [passedCoords]);

  const openNaver = (c: { lat: number; lng: number } | null) => {
    const goal = `${store.lng},${store.lat},${encodeURIComponent(store.name)}`;
    const url = c
      ? `https://map.naver.com/p/directions/${c.lng},${c.lat},${encodeURIComponent("내 위치")}/${goal}/-/car`
      : `https://map.naver.com/p/directions/-/${goal}/-/car`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleClick = () => {
    trackStoreEvent("directions_naver", { id: store.id, name: store.name });
    if (coords) { openNaver(coords); return; }
    if (!navigator.geolocation) { openNaver(null); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setLoading(false);
        openNaver(c);
      },
      () => { setLoading(false); openNaver(null); },
      { timeout: 5000, maximumAge: 30000, enableHighAccuracy: true }
    );
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex w-full md:w-auto items-center justify-center gap-1.5 bg-[#03C75A] text-white text-xs px-3 py-2 hover:bg-[#02b350] transition-colors disabled:opacity-60"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      {loading ? "확인 중" : "네이버맵"}
    </button>
  );
}

export default function StoreLocator({
  id,
  stores,
  header = DEFAULT_STORE_PAGE,
}: {
  id?: string;
  stores: Store[];
  header?: StorePageConfig;
}) {
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [locError, setLocError] = useState("");
  const [nearbyStores, setNearbyStores] = useState<StoreWithDistance[]>([]);
  const [allSorted, setAllSorted] = useState<StoreWithDistance[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showNew, setShowNew] = useState(false); // 신규 오픈 매장만 보기
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [onlineExpanded, setOnlineExpanded] = useState(false);
  const [selectedSido, setSelectedSido] = useState("");
  const [selectedSigungu, setSelectedSigungu] = useState("");
  // 매장 목록을 한 번에 다 그리면(150개+) 무겁고 스크롤이 길어져서, "더보기"로 점진적으로 늘려 보여준다.
  const STORE_PAGE_SIZE = 30;
  const [visibleStoreCount, setVisibleStoreCount] = useState(STORE_PAGE_SIZE);

  // 지도 중심 (선택된 매장 or 기본값) — level은 카카오맵 기준 (작을수록 확대)
  const [mapCenter, setMapCenter] = useState({ lat: 37.3205, lng: 127.0423, level: 9 });
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  // 스토어 베스트 제품 클릭 시 미리보기 팝업
  const [popupProduct, setPopupProduct] = useState<StoreProduct | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // 리스트 각 항목의 DOM 참조 — 지도에서 매장을 고르면 해당 항목으로 스크롤하기 위함
  const itemRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  // 지도 클릭으로 선택했을 때만 리스트를 해당 항목으로 스크롤하도록 하는 대기 플래그
  // (리스트 항목 클릭은 반대로 지도로 스크롤하므로 서로 간섭하지 않게 구분)
  const pendingListScrollId = useRef<number | null>(null);

  // ?store=<id> 딥링크 — 마이페이지 "가까운 매장" 등에서 리스트 내 특정 매장으로 바로 스크롤
  const searchParams = useSearchParams();
  const didApplyDeepLink = useRef(false);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocError("이 브라우저는 위치 서비스를 지원하지 않습니다.");
      setLocStatus("error");
      return;
    }
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserCoords({ lat, lng });

        // 1단계: 직선거리로 초기 정렬
        const sorted = stores
          .map((s) => ({ ...s, distance: haversine(lat, lng, s.lat, s.lng), estimated: true }))
          .sort((a, b) => a.distance - b.distance);
        setAllSorted(sorted);
        setNearbyStores(sorted.slice(0, NEARBY_COUNT));
        setLocStatus("success");
        setShowAll(false);
        setShowNew(false);
        setSearch("");
        setExpanded(null);
        setSelectedSido("");
        setSelectedSigungu("");
        setMapCenter({ lat, lng, level: 7 });

        // 2단계: 실제 이동거리로 업데이트 (50km 이내 최대 20개)
        const candidates = sorted.filter((s) => s.distance <= 50).slice(0, 20);
        if (candidates.length > 0) {
          fetch("/api/route-distance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: { lat, lng },
              destinations: candidates.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng })),
            }),
          })
            .then((r) => r.json())
            .then(({ results }: { results: { id: number; distance: number; estimated: boolean }[] }) => {
              const distMap = new Map(results.map((r) => [r.id, r]));
              const updated = sorted
                .map((s) => {
                  const r = distMap.get(s.id);
                  return r ? { ...s, distance: r.distance, estimated: r.estimated } : s;
                })
                .sort((a, b) => a.distance - b.distance);
              setAllSorted(updated);
              setNearbyStores(updated.slice(0, NEARBY_COUNT));
            })
            .catch(() => { /* 실패 시 직선거리 유지 */ });
        }
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "위치 접근 권한을 허용해 주세요. 브라우저 주소창 왼쪽 자물쇠 아이콘을 클릭해 위치 권한을 허용하세요."
            : err.code === err.TIMEOUT
            ? "위치 요청 시간이 초과됐습니다. 다시 시도해 주세요."
            : "위치를 가져올 수 없습니다. 기기 위치 서비스를 켜고 다시 시도해 주세요.";
        setLocError(msg);
        setLocStatus("error");
      },
      { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
    );
  };

  // 페이지 진입 시 자동 위치 요청
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { handleLocate(); }, []);

  // ?store=<id> 딥링크 처리 — handleLocate가 상태를 초기화하므로, 그게 끝난 뒤(성공/실패 확정 후) 1회만 적용한다.
  useEffect(() => {
    if (didApplyDeepLink.current) return;
    if (locStatus === "idle" || locStatus === "loading") return;
    didApplyDeepLink.current = true;

    // ?q=<검색어> 딥링크 — 메인 페이지 매장 검색창에서 넘어온 키워드를 그대로 적용
    const qParam = searchParams.get("q")?.trim();
    if (qParam) {
      setShowAll(false);
      setShowNew(false);
      setSelectedSido("");
      setSelectedSigungu("");
      setSearch(qParam);
      const searchPool = allSorted.length > 0 ? allSorted : stores;
      const matches = searchPool.filter((s) => s.name.includes(qParam) || s.address.includes(qParam));
      if (matches.length === 1) {
        setMapCenter({ lat: matches[0].lat, lng: matches[0].lng, level: 3 });
        setSelectedStore(matches[0]);
      } else if (matches.length > 1) {
        const lat = matches.reduce((sum, s) => sum + s.lat, 0) / matches.length;
        const lng = matches.reduce((sum, s) => sum + s.lng, 0) / matches.length;
        setMapCenter({ lat, lng, level: 9 });
      }
      setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      return;
    }

    const idParam = searchParams.get("store");
    if (!idParam) return;
    const target = stores.find((s) => String(s.id) === idParam);
    if (!target) return;

    setShowAll(true);
    setSearch("");
    setSelectedSido("");
    setSelectedSigungu("");
    setExpanded(target.id);
    setSelectedStore(target);
    setMapCenter({ lat: target.lat, lng: target.lng, level: 5 });
    setTimeout(() => {
      document.getElementById(`store-row-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [locStatus, searchParams, stores]);

  // 지도에서 보기 — 지도 중심 이동 + 스크롤
  const handleShowOnMap = (store: Store) => {
    setSelectedStore(store);
    setMapCenter({ lat: store.lat, lng: store.lng, level: 3 });
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const isSearching = search.trim().length > 0;
  const baseList: StoreWithDistance[] = allSorted.length > 0
    ? allSorted
    : stores.map((s) => ({ ...s, distance: -1 }));
  const hasLocated = locStatus === "success";
  const showNearby = hasLocated && !isSearching && !showAll && nearbyStores.length > 0;

  // 매장이 실제로 존재하는 시/도만 지역 드롭다운에 노출 (SIDO_LIST 순서 유지)
  const availableSidos = SIDO_LIST.filter((sido) =>
    stores.some((s) => regionOf(s.address).sido === sido)
  );

  // 지역(시/도, 시/군/구) 선택 시 하단 지도를 해당 지역 매장들의 평균 좌표로 이동
  const moveToRegion = (sido: string, sigungu: string) => {
    if (!sido) return;
    const matches = stores.filter((s) => {
      const parts = regionOf(s.address);
      if (parts.sido !== sido) return false;
      if (sigungu && parts.sigungu !== sigungu) return false;
      return true;
    });
    if (matches.length === 0) return;
    const lat = matches.reduce((sum, s) => sum + s.lat, 0) / matches.length;
    const lng = matches.reduce((sum, s) => sum + s.lng, 0) / matches.length;
    setMapCenter({ lat, lng, level: sigungu ? 7 : 9 });
    setSelectedStore(null);
  };

  // 지도에서 매장 핀/카드를 클릭하면: 해당 지역으로 리스트 필터 + 매장 선택/펼침 +
  // 그 항목으로 리스트를 스크롤해 지도와 목록이 확실히 연동되도록 한다.
  const selectStoreFromMap = (store: Store) => {
    trackStoreEvent("list_click", { id: store.id, name: store.name });
    setSelectedStore(store);
    setExpanded(store.id);
    setMapCenter({ lat: store.lat, lng: store.lng, level: 5 });
    const { sido, sigungu } = regionOf(store.address);
    if (SIDO_LIST.includes(sido)) {
      setSelectedSido(sido);
      setSelectedSigungu(sigungu);
    }
    pendingListScrollId.current = store.id;
  };

  // 지도에서 여러 매장이 묶인 클러스터(숫자) 클릭 시 해당 지역으로 리스트 필터 후
  // 리스트 영역으로 스크롤해 어떤 지역이 열렸는지 바로 보이게 한다.
  const selectClusterFromMap = (clusterStores: Store[]) => {
    if (clusterStores.length === 0) return;
    const { sido } = regionOf(clusterStores[0].address);
    if (!SIDO_LIST.includes(sido)) return;
    const sigungus = new Set(clusterStores.map((s) => regionOf(s.address).sigungu));
    setSelectedStore(null);
    setExpanded(null);
    setSelectedSido(sido);
    setSelectedSigungu(sigungus.size === 1 ? [...sigungus][0] : "");
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  // 검색어 입력 시 지도도 결과 위치로 이동 — 결과가 1개면 그 매장으로, 여러 개면 평균 위치로
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (value.trim()) setShowNew(false);
    const q = value.trim();
    if (!q) return;
    const matches = baseList.filter((s) => s.name.includes(q) || s.address.includes(q));
    if (matches.length === 0) return;
    if (matches.length === 1) {
      setMapCenter({ lat: matches[0].lat, lng: matches[0].lng, level: 3 });
      setSelectedStore(matches[0]);
    } else {
      const lat = matches.reduce((sum, s) => sum + s.lat, 0) / matches.length;
      const lng = matches.reduce((sum, s) => sum + s.lng, 0) / matches.length;
      setMapCenter({ lat, lng, level: 9 });
      setSelectedStore(null);
    }
  };

  const applyRegionFilter = (list: StoreWithDistance[]) => {
    if (!selectedSido) return list;
    return list.filter((s) => {
      const parts = regionOf(s.address);
      if (parts.sido !== selectedSido) return false;
      if (selectedSigungu && parts.sigungu !== selectedSigungu) return false;
      return true;
    });
  };

  // 신규 오픈 매장 — 등록 후 2개월 이내, 최신 등록순. 없으면 버튼 자체를 숨긴다.
  const newStores = baseList
    .filter((s) => isNewStore(s))
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  const showNewList = showNew && newStores.length > 0;

  const displayList = applyRegionFilter(
    showNewList && !isSearching
      ? newStores
      : isSearching
      ? baseList.filter((s) => s.name.includes(search.trim()) || s.address.includes(search.trim()))
      : selectedSido
      // 지역을 선택하면 "가장 가까운 5개"로 좁혀진 목록이 아니라 전체 목록에서 필터링해야
      // 내 위치와 먼 지역을 선택했을 때도 결과가 정상적으로 보인다.
      ? (hasLocated ? allSorted : baseList)
      : showNearby
      ? nearbyStores
      : hasLocated && !isSearching
      ? allSorted
      : baseList
  );

  // 검색어·지역·전체보기 여부가 바뀌면 노출 개수를 초기값으로 되돌린다.
  useEffect(() => {
    setVisibleStoreCount(STORE_PAGE_SIZE);
  }, [search, selectedSido, selectedSigungu, showAll]);

  // 지도 클릭으로 매장이 선택되면(대기 플래그 존재) 리스트가 재정렬/필터된 뒤
  // 해당 항목을 화면 중앙으로 스크롤한다. 아직 "더보기"로 안 펼쳐진 뒤쪽 순번이면 먼저 펼친다.
  useEffect(() => {
    const id = pendingListScrollId.current;
    if (id == null) return;
    const idx = displayList.findIndex((s) => s.id === id);
    if (idx >= visibleStoreCount) {
      setVisibleStoreCount(idx + 1);
      return; // 리렌더 후 이 effect가 다시 돌면서 스크롤을 마저 처리한다.
    }
    const el = itemRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingListScrollId.current = null;
    }
  }, [displayList, selectedStore, visibleStoreCount]);

  // 검색 초기화 — 검색어·지역필터·전체보기 상태 초기화 후 지도 복귀
  const resetSearch = () => {
    setSearch("");
    setSelectedSido("");
    setSelectedSigungu("");
    setShowAll(false);
    setShowNew(false);
    setExpanded(null);
    setSelectedStore(null);
    if (userCoords) setMapCenter({ lat: userCoords.lat, lng: userCoords.lng, level: 7 });
    else setMapCenter({ lat: 37.3205, lng: 127.0423, level: 9 });
  };

  // 신규 오픈 매장 보기 — 신규 매장만 리스트에 노출하고 지도를 해당 위치로 이동
  const showNewStores = () => {
    if (newStores.length === 0) return;
    setShowNew(true);
    setShowAll(false);
    setSearch("");
    setSelectedSido("");
    setSelectedSigungu("");
    setExpanded(null);
    setSelectedStore(null);
    const lats = newStores.map((s) => s.lat);
    const lngs = newStores.map((s) => s.lng);
    const spread = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
    setMapCenter({
      lat: (Math.max(...lats) + Math.min(...lats)) / 2,
      lng: (Math.max(...lngs) + Math.min(...lngs)) / 2,
      level: newStores.length === 1 ? 5 : spread > 1.5 ? 12 : spread > 0.3 ? 9 : 7,
    });
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  // 전체 매장 보기 — 지역/검색 필터 해제 후 전국 매장을 지도에 축소 노출
  const showAllStores = () => {
    setShowNew(false);
    setShowAll(true);
    setSearch("");
    setSelectedSido("");
    setSelectedSigungu("");
    setExpanded(null);
    setSelectedStore(null);
    setMapCenter({ lat: 36.4, lng: 127.8, level: 12 });
  };

  return (
    <section id={id} className="bg-[#FAFAF8]">

      {/* ── 페이지 타이틀 ── */}
      <div className="bg-white pt-10 pb-3 md:pt-12 md:pb-6 border-b border-gray-100">
        <div className="px-[15px] md:px-[70px]">
          <h1 className="text-[26px] md:text-[42px] font-[700] md:font-[500] text-[#303236] leading-tight mb-3">
            {header.title}
          </h1>
          {header.description && (
            <p className="text-[13px] md:text-[17px] text-gray-500 leading-relaxed mb-2 md:mb-5 whitespace-pre-line">
              {header.description
                .replace(/\{count\}/g, String(stores.length))
                /* 관리자가 숫자를 직접 입력해 저장한 경우에도 실제 매장 수로 자동 치환 */
                .replace(/\d[\d,]*(?=\s*개\s*매장)/g, String(stores.length))}
            </p>
          )}
          {/* 방문 안내 */}
          {header.bullets.length > 0 && (
            <ul className="flex flex-col gap-2">
              {header.bullets.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-gray-500">
                  <span className="text-[#E5541B] font-bold flex-shrink-0 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="px-[15px] md:px-[70px] pt-3 pb-10 md:pt-6">

        {/* ── 컨트롤 바 (무지 스타일: 지역선택·검색 / 검색초기화·전체·가까운 매장) ── */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">

          {/* 지역 선택 + 검색 */}
          <div className="flex flex-row gap-2 sm:gap-2.5 md:flex-1 md:max-w-2xl">
            <select
              value={selectedSido}
              onChange={(e) => { const v = e.target.value; setSelectedSido(v); setSelectedSigungu(""); setShowAll(false); setShowNew(false); moveToRegion(v, ""); }}
              className="border border-gray-300 bg-white text-sm text-[#303236] px-3 py-2.5 focus:outline-none focus:border-[#303236] w-28 sm:w-36 flex-shrink-0"
            >
              <option value="">지역 전체</option>
              {availableSidos.map((sido) => (
                <option key={sido} value={sido}>{sido}</option>
              ))}
            </select>

            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="매장명 또는 지역 검색"
                className="w-full pl-9 pr-8 py-2.5 border border-gray-300 bg-white text-sm text-[#303236] placeholder-gray-400 focus:outline-none focus:border-[#303236]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
              )}
            </div>
          </div>

          {/* 검색 초기화(위) + 액션 버튼(아래) */}
          <div className="flex flex-col gap-2 md:items-end md:flex-shrink-0">
            <button
              onClick={resetSearch}
              className="self-end inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#303236] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.5 9a7 7 0 0111.9-2.1L20 9M18.5 15a7 7 0 01-11.9 2.1L4 15" />
              </svg>
              검색 초기화
            </button>
            <div className="grid grid-cols-2 gap-2 md:flex">
              <button
                onClick={showAllStores}
                className="inline-flex items-center justify-center border border-[#303236] text-[#303236] text-sm px-5 py-2.5 hover:bg-[#303236] hover:text-white transition-colors whitespace-nowrap"
              >
                전체 매장 보기
              </button>
              {newStores.length > 0 && (
                <button
                  onClick={showNewStores}
                  className={`col-span-2 md:col-span-1 inline-flex items-center justify-center gap-1.5 border border-[#E5541B] text-sm px-5 py-2.5 transition-colors whitespace-nowrap ${
                    showNewList ? "bg-[#E5541B] text-white" : "text-[#E5541B] hover:bg-[#E5541B] hover:text-white"
                  }`}
                >
                  신규 오픈 매장
                  <span className="text-[11px] font-bold">{newStores.length}</span>
                </button>
              )}
              <button
                onClick={handleLocate}
                disabled={locStatus === "loading"}
                className="inline-flex items-center justify-center gap-1.5 bg-[#303236] text-white text-sm px-5 py-2.5 hover:bg-[#243d5e] transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {locStatus === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    위치 확인 중
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    가까운 매장 찾기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {locStatus === "error" && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 px-4 py-3">
            <p className="text-sm font-semibold text-red-700 mb-0.5">위치를 확인할 수 없습니다</p>
            <p className="text-xs text-red-500 leading-relaxed">{locError}</p>
          </div>
        )}

        {/* ── 지도 (카카오맵) ── */}
        <div ref={mapRef} className="relative mb-6">
          <div className="w-full overflow-hidden border border-gray-200 h-[360px] md:h-[520px]">
            <KakaoMap
              stores={stores}
              center={mapCenter}
              selectedStore={selectedStore}
              userCoords={userCoords}
              onStoreSelect={selectStoreFromMap}
              onClusterSelect={selectClusterFromMap}
            />
          </div>

          {/* 선택된 매장 — 전체 매장으로 돌아가기 버튼 */}
          {selectedStore && (
            <button
              onClick={() => {
                setSelectedStore(null);
                if (userCoords) {
                  setMapCenter({ lat: userCoords.lat, lng: userCoords.lng, level: 9 });
                } else {
                  setMapCenter({ lat: 37.3205, lng: 127.0423, level: 9 });
                }
                setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
              className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white text-[#303236] text-xs font-semibold px-3 py-2 shadow-md hover:bg-[#303236] hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              전체 매장 보기
            </button>
          )}

          {/* 선택된 매장 오버레이 */}
          {selectedStore && (
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#4a4d53]/85 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-4">
              {/* PC: 지점명 | 주소 한 줄 / 모바일: 2줄 */}
              <div className="hidden md:flex items-center gap-2 min-w-0">
                <p className="text-white font-bold text-sm flex-shrink-0">{selectedStore.name}</p>
                <span className="text-white/40 flex-shrink-0">|</span>
                <p className="text-gray-200 text-xs truncate">{selectedStore.address}</p>
              </div>
              <div className="md:hidden min-w-0">
                <p className="text-white font-bold text-sm truncate">{selectedStore.name}</p>
                <p className="text-gray-200 text-xs mt-0.5 truncate">{selectedStore.address}</p>
              </div>
              <button
                onClick={() => setSelectedStore(null)}
                className="text-gray-400 hover:text-white flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ── 매장 목록 ── */}
        <div ref={listRef} className="space-y-2 scroll-mt-4">

          {/* ── 온라인 스토어 (위치 무관, 항상 최상단 고정) ── */}
          <div className="bg-white overflow-hidden border border-gray-200">
            <button
              className="w-full text-left px-4 py-4 flex items-center justify-between transition-colors hover:bg-gray-50"
              onClick={() => setOnlineExpanded((v) => !v)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0 bg-[#4b4e53] text-white">
                  1
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm md:text-[15px] text-[#303236]">워크업 브랜드 스토어</span>
                    <span className="text-[10px] px-2 py-0.5 font-semibold flex-shrink-0 border border-[#03C75A] text-[#03C75A]">온라인</span>
                  </div>
                  <p className="text-xs md:text-[13px] mt-0.5 truncate pr-2 text-gray-500">brand.naver.com/workup_offcial</p>
                </div>
              </div>
              <svg
                className={`w-4 h-4 flex-shrink-0 transition-transform text-gray-400 ${onlineExpanded ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {onlineExpanded && (
              <div className="border-t border-gray-100 px-4 py-4">
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 mb-4">
                  <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span>https://brand.naver.com/workup_offcial</span>
                </div>
                <a
                  href="https://brand.naver.com/workup_offcial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full md:w-auto items-center justify-center gap-1.5 bg-[#03C75A] text-white text-xs px-3 py-2 hover:bg-[#02b350] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  네이버 브랜드스토어 방문
                </a>
              </div>
            )}
          </div>

          {displayList.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
          ) : (
            displayList.slice(0, visibleStoreCount).map((store, index) => {
              const isOpen = expanded === store.id;
              const hasStorePage = store.pageActive !== false;
              const isSelected = selectedStore?.id === store.id;
              return (
                <div
                  key={store.id}
                  id={`store-row-${store.id}`}
                  ref={(el) => { itemRefs.current.set(store.id, el); }}
                  className={`bg-white overflow-hidden transition-colors scroll-mt-4 ${
                    isSelected ? "border-2 border-[#303236]" : "border border-gray-200"
                  }`}
                >

                  {/* 헤더 — 가장 가까운 매장은 주황 배지 대신 지점명 섹션에 옅은 음영 */}
                  <button
                    className={`w-full text-left px-4 py-4 flex items-center justify-between transition-colors ${
                      index === 0 && showNearby ? "bg-[#f4f1ec]" : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      const next = isOpen ? null : store.id;
                      setExpanded(next);
                      if (!isOpen) {
                        trackStoreEvent("list_click", { id: store.id, name: store.name });
                        setSelectedStore(store);
                        setMapCenter({ lat: store.lat, lng: store.lng, level: 5 });
                        mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0 bg-[#4b4e53] text-white">
                        {index + 2}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isNewStore(store) && (
                            <span className="text-[10px] md:text-[11px] px-1.5 py-0.5 font-bold flex-shrink-0 bg-[#E5541B] text-white">NEW</span>
                          )}
                          <span className="font-bold text-sm md:text-[15px] text-[#303236]">{store.name}</span>
                          {store.distance >= 0 && (
                            <span className="text-xs md:text-[13px] px-2 py-0.5 font-medium flex-shrink-0 border border-gray-300 text-gray-600">
                              {formatDist(store.distance, store.estimated)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs md:text-[13px] mt-0.5 truncate pr-2 text-gray-500">{store.address}</p>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 flex-shrink-0 transition-transform text-gray-400 ${isOpen ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 상세 정보 */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 py-4">
                      {/* 주소 + 운영시간 + 판매제품 */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 mb-4">
                        <div className="space-y-1.5">
                          {/* 주소는 리스트 헤더로 이동 — 여기선 시간·전화만 (PC 한 줄 / 모바일 2줄) */}
                          <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-5">
                            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{store.hours}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              <span>{store.phone}</span>
                            </div>
                          </div>
                        </div>

                        {/* 판매제품 — PC: 라벨 | 박스 가로 / 모바일: 라벨 위, 번호 세로 리스트 */}
                        {store.products && store.products.length > 0 && (
                          <div className="md:flex-1 md:min-w-0 md:flex md:justify-end md:pr-4">
                            {/* 모바일: 라벨~3위 전체 영역을 그레이 음영 패널로. PC: 투명 가로 레이아웃 */}
                            <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2 bg-gray-100 md:bg-transparent p-3 md:p-0 md:overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                              {/* 라벨 — 모바일: 그레이 패널 위 평문 / PC: 차콜 박스 */}
                              <span className="self-start md:self-auto flex-shrink-0 text-[10px] tracking-wider font-semibold mb-1 md:mb-0 text-gray-500 md:text-white md:bg-[#303236] md:px-2 md:py-1">스토어 베스트 제품</span>
                              <span className="hidden md:inline flex-shrink-0 text-gray-300 mr-0.5">|</span>
                              {store.products.map((p, i) => (
                                <button
                                  key={p.id}
                                  onClick={() => setPopupProduct(p)}
                                  className="flex items-center gap-2 text-left text-xs md:text-[13px] text-[#303236] transition-colors py-0.5 md:flex-shrink-0 md:border md:border-gray-300 md:px-2.5 md:py-1 md:hover:border-[#303236]"
                                >
                                  <span className="md:hidden flex-shrink-0 w-3.5 text-gray-400 tabular-nums">{i + 1}</span>
                                  <span className="md:whitespace-nowrap">{p.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 액션 버튼 — 모바일 그리드(매장소개 유무에 따라 2x2 또는 1열 3개), 데스크탑 한 줄 */}
                      <div className={`grid ${hasStorePage ? "grid-cols-2" : "grid-cols-3"} gap-2 md:flex`}>

                        {/* 전화하기 */}
                        <a
                          href={`tel:${store.phone.replace(/-/g, "")}`}
                          onClick={() => trackStoreEvent("call", { id: store.id, name: store.name })}
                          className="flex w-full md:w-auto items-center justify-center gap-1.5 bg-[#303236] text-white text-xs px-3 py-2 hover:bg-[#243d5e] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          전화하기
                        </a>

                        {/* 카카오맵 길찾기 */}
                        <KakaoDirBtn store={store} userCoords={userCoords} />

                        {/* 네이버맵 길찾기 */}
                        <NaverDirBtn store={store} userCoords={userCoords} />

                        {/* 매장 소개 페이지 */}
                        {hasStorePage && (
                          <Link
                            href={`/store/${store.id}`}
                            onClick={() => trackStoreEvent("list_click", { id: store.id, name: store.name })}
                            className="flex w-full md:w-auto items-center justify-center gap-1.5 border border-[#303236] text-[#303236] text-xs px-3 py-2 hover:bg-[#303236] hover:text-white transition-colors"
                          >
                            매장소개
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {visibleStoreCount < displayList.length && (
            <button
              onClick={() => setVisibleStoreCount((v) => Math.min(v + STORE_PAGE_SIZE, displayList.length))}
              className="w-full py-3 border border-gray-300 text-[13px] font-semibold text-gray-600 hover:border-[#303236] hover:text-[#303236] transition-colors"
            >
              더보기 ({visibleStoreCount} / {displayList.length})
            </button>
          )}
        </div>

        {/* 리스트 정보 — 하단으로 이동 (건수·거리순 + 추정거리 안내). 여백은 기존 mb-3과 동일하게 mt-3 유지 */}
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            {isSearching
              ? `"${search.trim()}" 검색 결과 ${displayList.length}개`
              : showNearby
              ? `가장 가까운 ${NEARBY_COUNT}개 매장 — 거리순`
              : hasLocated
              ? `전체 ${displayList.length}개 매장 — 거리순`
              : `전체 ${displayList.length}개 매장`}
          </p>
          {hasLocated && (
            <p className="text-xs text-gray-400">~표시는 추정 거리, 그 외는 실제 이동거리</p>
          )}
        </div>
      </div>

      {/* 스토어 베스트 제품 미리보기 팝업 */}
      {popupProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setPopupProduct(null)}
            aria-label="닫기"
          />
          <div className="relative bg-white w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setPopupProduct(null)}
              className="absolute top-2.5 right-2.5 z-10 w-8 h-8 flex items-center justify-center bg-white/90 text-gray-500 hover:text-[#303236] transition-colors"
              aria-label="닫기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
              {popupProduct.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ikSrc(popupProduct.image_url, 600)} alt={popupProduct.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-300 text-2xl font-black select-none">WU</span>
              )}
            </div>
            <div className="p-5">
              <p className="text-[15px] text-[#303236] leading-snug mb-4">{popupProduct.name}</p>
              <Link
                href={`/products/${popupProduct.id}`}
                onClick={() => trackStoreEvent("list_click", { name: popupProduct.name })}
                className="block text-center bg-[#303236] text-white text-sm py-3 hover:bg-[#243d5e] transition-colors"
              >
                제품 상세 보기
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
