import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const CWD = process.cwd();

function exec(cmd: string) {
  return execSync(cmd, { encoding: "utf8", cwd: CWD }).trim();
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  try {
    const branch  = exec("git branch --show-current");
    const status  = exec("git status --porcelain");
    const ahead   = exec("git rev-list @{u}..HEAD --count").trim();
    const lastLog = exec("git log --oneline -1");
    return NextResponse.json({ ok: true, branch, status, ahead: Number(ahead), lastLog });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  try {
    const { message } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "커밋 메시지를 입력하세요" }, { status: 400 });
    }

    const status = exec("git status --porcelain");
    let committed = false;

    if (status) {
      exec("git add .");
      exec(`git commit -m "${message.replace(/"/g, '\\"')}"`);
      committed = true;
    }

    exec("git push");

    const lastLog = exec("git log --oneline -1");
    return NextResponse.json({ ok: true, committed, lastLog });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
