import { isAdmin } from "@/lib/admin-auth";
import { getMateActivityImage, mateParticipantForRequest } from "@/lib/mate-activity-server";
import { parseRound } from "@/lib/mate";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const round = parseRound(params.get("round"));
    const activity = parseRound(params.get("activity"));
    if (!round || !activity) return new Response(null, { status: 404 });
    let access: Parameters<typeof getMateActivityImage>[2];
    if (params.get("view") === "recruitment") {
      const version = params.get("v");
      if (!version || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(version)) {
        return new Response(null, { status: 404 });
      }
      access = { publicVersion: version };
    } else if (request.headers.has("authorization")) {
      const participant = await mateParticipantForRequest(request);
      if (!participant || participant.round !== round) return new Response(null, { status: 403 });
      access = "participant";
    } else {
      if (!(await isAdmin())) return new Response(null, { status: 403 });
      access = "admin";
    }
    const encoded = await getMateActivityImage(round, activity, access);
    if (!encoded) return new Response(null, { status: 404 });
    return new Response(Uint8Array.from(Buffer.from(encoded, "base64")), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", Vary: "Authorization, Cookie" },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}
