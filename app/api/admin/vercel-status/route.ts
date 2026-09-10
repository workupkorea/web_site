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

    // 4. Vercel 사용량/비용 (팀 또는 개인)
    let usage: Record<string, unknown> | null = null;
    try {
      // 개인 계정이면 /v2/user/billing, 팀이면 teamId가 있음
      const teamId = project.accountId ?? null;
      const usagePath = teamId
        ? `/v2/teams/${teamId}/usage`
        : `/v2/user/billing/state`;
      const usageRes = await vFetch(usagePath);
      usage = usageRes ?? null;
    } catch { /* 사용량 조회 실패 시 무시 */ }

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
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
