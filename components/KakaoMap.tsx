"use client";
import { useEffect, useRef, useState } from "react";
import { type Store, isNewStore } from "@/data/stores";

declare global {
  // 카카오 맵 SDK는 런타임 스크립트로 로드되어 별도 타입 패키지가 없다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { kakao: any; }
}

interface Props {
  stores: Store[];
  center: { lat: number; lng: number; level: number };
  selectedStore: Store | null;
  userCoords?: { lat: number; lng: number } | null;
  onStoreSelect?: (store: Store) => void;
  onClusterSelect?: (stores: Store[]) => void;
}

// ── 신규오픈 뱃지 (등록 후 2개월, 기준은 isNewStore) ─────────────────────────
function NewBadge() {
  return (
    <span style={{
      position: "absolute", top: -9, right: -14, zIndex: 1,
      padding: "1px 5px", borderRadius: 8, fontSize: 9, fontWeight: 800, lineHeight: 1.4,
      background: "#E5541B", color: "#fff", border: "1px solid #fff", whiteSpace: "nowrap",
    }}>NEW</span>
  );
}

// ── 카드 마커 (레벨 ≤ 8) ───────────────────────────────
function CardMarker({ name, selected, isNew }: { name: string; selected: boolean; isNew?: boolean }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", transform: "translateX(-50%)", cursor: "pointer", position: "relative" }}>
      {isNew && <NewBadge />}
      <div style={{
        padding: "5px 9px", borderRadius: "4px", fontSize: "11px", fontWeight: 700,
        whiteSpace: "nowrap", lineHeight: 1.4,
        background: selected ? "#E5541B" : "#303236",
        color: selected ? "#303236" : "#fff",
        boxShadow: selected ? "0 3px 12px rgba(244,171,28,0.45)" : "0 2px 8px rgba(0,0,0,0.28)",
        transition: "background 0.15s,color 0.15s",
      }}>{name}</div>
      <div style={{
        width: 0, height: 0, marginTop: "-2px",
        borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
        borderTop: `5px solid ${selected ? "#E5541B" : "#303236"}`,
      }} />
    </div>
  );
}

// ── W 핀 마커 (레벨 9) ──────────────────────────────────
function PinMarker({ selected, isNew }: { selected: boolean; isNew?: boolean }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", transform: "translateX(-50%)", cursor: "pointer", position: "relative" }}>
      {isNew && <NewBadge />}
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: selected ? "#303236" : "#E5541B",
        boxShadow: "0 3px 10px rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 900, fontFamily: "sans-serif",
        color: selected ? "#E5541B" : "white",
        transition: "background 0.15s,color 0.15s",
      }}>W</div>
      <div style={{
        width: 0, height: 0, marginTop: "-2px",
        borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
        borderTop: `7px solid ${selected ? "#303236" : "#E5541B"}`,
      }} />
    </div>
  );
}

// ── 클러스터 마커 (레벨 10+) ────────────────────────────
function ClusterMarker({ count }: { count: number }) {
  const size = count >= 20 ? 58 : count >= 10 ? 48 : 40;
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      transform: "translateX(-50%)", cursor: "pointer",
    }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "#E5541B",
        color: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size >= 48 ? 14 : 13, fontWeight: 700,
        boxShadow: "0 3px 10px rgba(0,0,0,0.35)",
      }}>{count}</div>
      <div style={{
        width: 0, height: 0, marginTop: "-2px",
        borderLeft: `${size * 0.18}px solid transparent`,
        borderRight: `${size * 0.18}px solid transparent`,
        borderTop: `${size * 0.22}px solid #E5541B`,
      }} />
    </div>
  );
}

// ── 현재 위치 마커 ───────────────────────────────────────
function UserLocationMarker() {
  return (
    <div style={{ position: "relative", width: 20, height: 20, transform: "translate(-50%,-50%)" }}>
      {/* 파동 효과 */}
      <div className="animate-ping" style={{
        position: "absolute", inset: -6, borderRadius: "50%",
        background: "rgba(66,133,244,0.25)",
      }} />
      {/* 파란 점 */}
      <div style={{
        width: 20, height: 20, borderRadius: "50%",
        background: "#4285F4",
        border: "3px solid white",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }} />
    </div>
  );
}

// ── 화면 좌표 클러스터링 ─────────────────────────────────
type XYStore = { store: Store; x: number; y: number };
type Cluster = { stores: Store[]; x: number; y: number };

function clusterByScreen(pts: XYStore[], gridSize: number): Cluster[] {
  const used = new Set<number>();
  const result: Cluster[] = [];
  pts.forEach((p, i) => {
    if (used.has(i)) return;
    const group = [p];
    used.add(i);
    pts.forEach((q, j) => {
      if (used.has(j)) return;
      if (Math.hypot(p.x - q.x, p.y - q.y) < gridSize) { group.push(q); used.add(j); }
    });
    result.push({
      stores: group.map(g => g.store),
      x: group.reduce((s, g) => s + g.x, 0) / group.length,
      y: group.reduce((s, g) => s + g.y, 0) / group.length,
    });
  });
  return result;
}

export default function KakaoMap({ stores, center, selectedStore, userCoords, onStoreSelect, onClusterSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const onStoreSelectRef = useRef(onStoreSelect);
  useEffect(() => { onStoreSelectRef.current = onStoreSelect; }, [onStoreSelect]);
  const onClusterSelectRef = useRef(onClusterSelect);
  useEffect(() => { onClusterSelectRef.current = onClusterSelect; }, [onClusterSelect]);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const [positions, setPositions] = useState<XYStore[]>([]);
  const [zoom, setZoom] = useState(center.level);
  const [userScreenPos, setUserScreenPos] = useState<{ x: number; y: number } | null>(null);

  const userCoordsRef = useRef(userCoords);
  useEffect(() => { userCoordsRef.current = userCoords; }, [userCoords]);

  const updatePositions = () => {
    if (!mountedRef.current || !mapRef.current || !window.kakao?.maps) return;
    const map = mapRef.current;
    const proj = map.getProjection();
    const pts = stores.map(store => {
      const pt = proj.containerPointFromCoords(new window.kakao.maps.LatLng(store.lat, store.lng));
      return { store, x: pt.x, y: pt.y };
    });
    setPositions(pts);
    setZoom(map.getLevel());
    // 현재 위치 마커
    const uc = userCoordsRef.current;
    if (uc) {
      const upt = proj.containerPointFromCoords(new window.kakao.maps.LatLng(uc.lat, uc.lng));
      setUserScreenPos({ x: upt.x, y: upt.y });
    } else {
      setUserScreenPos(null);
    }
  };

  const scheduleUpdate = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; updatePositions(); });
  };

  // 지도 초기화
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key || initializedRef.current) return;

    let resizeObs: ResizeObserver | null = null;
    const init = () => {
      if (!containerRef.current) return;
      window.kakao.maps.load(() => {
        const map = new window.kakao.maps.Map(containerRef.current!, {
          center: new window.kakao.maps.LatLng(center.lat, center.lng),
          level: center.level,
        });
        mapRef.current = map;
        initializedRef.current = true;

        window.kakao.maps.event.addListener(map, "center_changed", scheduleUpdate);
        window.kakao.maps.event.addListener(map, "zoom_changed", updatePositions);
        window.kakao.maps.event.addListener(map, "idle", updatePositions);

        setTimeout(updatePositions, 300);

        // 컨테이너 크기가 바뀌면(레이아웃 확정·창 크기 변경) 지도 크기를 다시 계산해
        // 타일이 일부만 그려지거나 마커 위치가 어긋나는 문제를 막는다.
        if (typeof ResizeObserver !== "undefined") {
          resizeObs = new ResizeObserver(() => { map.relayout(); scheduleUpdate(); });
          resizeObs.observe(containerRef.current!);
        }
      });
    };

    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) {
      if (window.kakao?.maps) init();
      else existing.addEventListener("load", init);
    } else {
      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
      script.onload = init;
      document.head.appendChild(script);
    }
    return () => resizeObs?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 중심/레벨 업데이트
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    const map = mapRef.current;
    map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
    map.setLevel(center.level, { animate: true });
  }, [center.lat, center.lng, center.level]);

  // userCoords 변경 시 마커 즉시 갱신
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    if (!userCoords) { setUserScreenPos(null); return; }
    const proj = mapRef.current.getProjection();
    const pt = proj.containerPointFromCoords(new window.kakao.maps.LatLng(userCoords.lat, userCoords.lng));
    setUserScreenPos({ x: pt.x, y: pt.y });
  }, [userCoords]);

  // 컨테이너 크기 (화면 밖 마커 컬링용)
  const w = containerRef.current?.clientWidth ?? 9999;
  const h = containerRef.current?.clientHeight ?? 9999;
  const inBounds = (x: number, y: number, pad = 60) =>
    x > -pad && x < w + pad && y > -pad && y < h + pad;

  // 줌 레벨별 마커 계산
  const clusters = zoom >= 10 ? clusterByScreen(positions, 65) : null;

  return (
    // isolation: isolate → mix-blend-mode가 이 영역 안에서만 적용됨
    <div
      className="relative w-full h-full bg-[#FAFAF8]"
      style={{ isolation: "isolate", overscrollBehavior: "contain" }}
    >

      {/* 지도 타일 — 완전 흑백 대신 채도를 낮춰 은은한 컬러감을 남김 */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ zIndex: 1, filter: "grayscale(0.8)", touchAction: "none" }}
      />

      {/* 컬러 마커 레이어 — 흑백 효과 밖에 위치 */}
      <div className="absolute inset-0" style={{ zIndex: 10, pointerEvents: "none" }}>

        {/* 현재 위치 마커 */}
        {userScreenPos && inBounds(userScreenPos.x, userScreenPos.y) && (
          <div style={{ position: "absolute", left: userScreenPos.x, top: userScreenPos.y }}>
            <UserLocationMarker />
          </div>
        )}

        {zoom >= 10 && clusters ? (
          // 클러스터 마커
          clusters
            .filter(c => inBounds(c.x, c.y))
            .map((c, i) => (
              <div
                key={i}
                style={{ position: "absolute", left: c.x, top: c.y, pointerEvents: "auto" }}
                onClick={() => {
                  if (c.stores.length === 1) {
                    onStoreSelectRef.current?.(c.stores[0]);
                  } else {
                    onClusterSelectRef.current?.(c.stores);
                    if (window.kakao?.maps && mapRef.current) {
                      const bounds = new window.kakao.maps.LatLngBounds();
                      c.stores.forEach(s => bounds.extend(new window.kakao.maps.LatLng(s.lat, s.lng)));
                      mapRef.current.setBounds(bounds);
                    }
                  }
                }}
              >
                <ClusterMarker count={c.stores.length} />
              </div>
            ))
        ) : zoom === 9 ? (
          // W 핀 마커
          positions
            .filter(p => inBounds(p.x, p.y))
            .map(({ store, x, y }) => (
              <div
                key={store.id}
                style={{ position: "absolute", left: x, top: y, pointerEvents: "auto" }}
                onClick={() => onStoreSelectRef.current?.(store)}
              >
                <PinMarker selected={selectedStore?.id === store.id} isNew={isNewStore(store)} />
              </div>
            ))
        ) : (
          // 매장명 카드 마커
          positions
            .filter(p => inBounds(p.x, p.y))
            .map(({ store, x, y }) => (
              <div
                key={store.id}
                style={{ position: "absolute", left: x, top: y, pointerEvents: "auto" }}
                onClick={() => onStoreSelectRef.current?.(store)}
              >
                <CardMarker name={store.name} selected={selectedStore?.id === store.id} isNew={isNewStore(store)} />
              </div>
            ))
        )}
      </div>
    </div>
  );
}
