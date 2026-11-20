import { mateParticipantPath } from "@/lib/mate-participant-token";
import { seoulDate, type MateApplication } from "@/lib/mate";
import MateParticipantLinkControls from "./MateParticipantLinkControls";

type LinkApplication = Pick<MateApplication, "round" | "id" | "link_version" | "link_first_issued_at" | "link_issued_at" | "retain_through">;

export function issuedMateParticipantPath(application: LinkApplication) {
  return application.link_issued_at && application.retain_through >= seoulDate()
    ? mateParticipantPath(application.id, application.link_version ?? 0) : null;
}

export default function MateParticipantLink({ application, showOpenLink = true }: { application: LinkApplication; showOpenLink?: boolean }) {
  const version = application.link_version ?? 0;
  const expired = application.retain_through < seoulDate();
  const issued = application.link_issued_at ?? null;
  return <MateParticipantLinkControls round={application.round} id={application.id} version={version}
    firstIssuedAt={application.link_first_issued_at ?? null} issuedAt={issued} expired={expired}
    path={showOpenLink ? issuedMateParticipantPath(application) : null} />;
}