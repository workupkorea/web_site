import { isAdmin } from "@/lib/admin-auth";
import { getMateActivityImage, mateParticipantForRequest } from "@/lib/mate-activity-server";
import { parseRound } from "@/lib/mate";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const round = parseRound(params.get("round"));
    const activity = parseRound(params.get("activity"));
    if (!round || !activity) return new Response(null, { status: 404 });
    const participantRequest = request.headers.has("authorization");
    if (participantRequest) {
      const participant = await mateParticipantForRequest(request);
      if (!participant || participant.round !== round) return new Response(null, { status: 403 });
    } else if (!(await isAdmin())) {
      return new Response(null, { status: 403 });
    }
    const encoded = await getMateActivityImage(round, activity, participantRequest);
    if (!encoded) return new Response(null, { status: 404 });
    return new Response(Uint8Array.from(Buffer.from(encoded, "base64")), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", Vary: "Authorization, Cookie" },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}