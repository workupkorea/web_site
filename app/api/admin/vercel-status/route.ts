import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOKEN      = process.env.VERCEL_TOKEN!;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID!;

const headers = { Authorization: `Bearer ${TOKEN}` };

async function vFetch(path: string) {
  const res = await fetch(`https://api.vercel.com${path}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Vercel API ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

// POST: 최신 배포 재빌드 트리거
export async function POST(req: Request) {
  try {
    if (!TOKEN || !PROJECT_ID) {
      return NextResponse.json({ error: "환경변수 미설정" }, { status: 500 });
    }

    const { deploymentId, projectName } = await req.json();
    if (!deploymentId) return NextResponse.json({ error: "deploymentId 필요" }, { status: 400 });

    // 프로젝트 이름이 없으면 API에서 가져옴
    let name = projectName;
    if (!name) {
      const proj = await vFetch(`/v9/projects/${PROJECT_ID}`);
      name = proj.name;
    }

    // 기존 배포를 기반으로 새 배포 생성 (Vercel redeploy)
    const res = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name, deploymentId, target: "production" }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || JSON.stringify(json));

    return NextResponse.json({ ok: true, newDeploymentId: json.id, url: json.url });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!TOKEN || !PROJECT_ID) {
      return NextResponse.json({ error: "VERCEL_TOKEN 또는 VERCEL_PROJECT_ID 환경변수 미설정" }, { status: 500 });
    }

    // 1. 최근 배포 목록 (최대 10건)
    const deploymentsData = await vFetch(
      `/v6/deployments?projectId=${PROJECT_ID}&limit=10`
    );
    const deployments = (deploymentsData.deployments ?? []).map((d: Record<string, unknown>) => ({
      uid:       d.uid,
      url:       d.url,
      state:     d.state,        // READY | ERROR | BUILDING | QUEUED | CANCELED
      target:    d.target,       // production | preview | null
      createdAt: d.createdAt,
      buildingAt: d.buildingAt,
      ready:     d.ready,
      meta:      d.meta,         // branch, commit sha, commit message
    }));

    // 2. 가장 최근 배포의 상세 (에러 메시지 포함)
    const latest = deployments[0];
    let errorLogs: string[] = [];

    if (latest?.state === "ERROR") {
      try {
        const events = await vFetch(
          `/v3/deployments/${latest.uid}/events?direction=backward&limit=50`
        );
        errorLogs = (Array.isArray(events) ? events : [])
          .filter((e: Record<string, unknown>) => e.type === "error" || (typeof e.text === "string" && e.text.toLowerCase().includes("error")))
          .map((e: Record<string, unknown>) => e.text as string)
          .filter(Boolean)
          .slice(0, 20);
      } catch {
        errorLogs = ["에러 로그를 가져올 수 없습니다."];
      }
    }

    // 3. 프로젝트 정보 (도메인 등)
    const project = await vFetch(`/v9/projects/${PROJECT_ID}`);

    // 4. Vercel 사용량/비용 — 프로젝트 범위 토큰으로는 user/billing API 접근 불가
    // 프로젝트 정보에서 얻을 수 있는 정보만 사용
    let usage: Record<string, unknown> | null = null;
    const usageError: string | null = null;
    usage = {
      _unavailable: true,
      projectName: project.name,
      framework:   project.framework ?? "—",
      nodeVersion: project.nodeVersion ?? "—",
    };

    // 5. 환경변수 수정 시각 vs 최신 배포 시각 비교 → 재배포 필요 여부 판단
    let needsRedeploy = false;
    let redeployReasons: string[] = [];
    let envCheckAvailable = false; // 환경변수 API 접근 가능 여부
    const latestProdDeployment = deployments.find(
      (d: Record<string, unknown>) => d.target === "production" && d.state === "READY"
    );
    if (latestProdDeployment) {
      const deployedAt = latestProdDeployment.createdAt as number;
      try {
        const envData = await vFetch(`/v9/projects/${PROJECT_ID}/env`);
        const envs: Array<{ key: string; updatedAt?: number; createdAt?: number }> = envData.envs ?? [];
        envCheckAvailable = true;
        const changedEnvs = envs.filter(e => {
          const t = e.updatedAt ?? e.createdAt ?? 0;
          return t > deployedAt;
        });
        if (changedEnvs.length > 0) {
          needsRedeploy = true;
          redeployReasons = changedEnvs.map(e => `환경변수 변경됨: ${e.key}`);
        }
      } catch {
        // 403 등으로 환경변수 목록 조회 불가 → 판단 불가 상태로 처리
        envCheckAvailable = false;
      }
    }

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      project: {
        name:    project.name,
        framework: project.framework,
        domains: (project.alias ?? []).map((a: Record<string, unknown>) => a.domain).slice(0, 3),
        nodeVersion: project.nodeVersion,
        accountId: project.accountId,
      },
      deployments,
      errorLogs,
      usage,
      usageError,
      needsRedeploy,
      redeployReasons,
      envCheckAvailable,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
