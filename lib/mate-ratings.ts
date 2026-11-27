export const MATE_RATING_MAX = 5;

export type MateRating = { activity_no: number; application_id: string; score: number };

export const MATE_COMMENT_MAX = 500;

export type MateComment = { activity_no: number; application_id: string; comment: string };

export function mateRatingKey(activity: number, applicationId: string) {
  return `${activity}:${applicationId}`;
}

export function validMateRating(score: unknown): score is number | null {
  return score === null || (Number.isInteger(score) && (score as number) >= 1 && (score as number) <= MATE_RATING_MAX);
}

export type MateResultRecord = {
  id: string; name: string; sns_id: string; scores: Record<string, number>; expires_on: string;
};

export function mateResultRatings(records: MateResultRecord[]): MateRating[] {
  return records.flatMap((record) => Object.entries(record.scores)
    .map(([activity, score]) => ({ activity_no: Number(activity), application_id: record.id, score })));
}

/** 메이트별 총점을 높은 순으로 정렬한다. 동점은 같은 순위, 평가가 없으면 순위가 없다. */
export function rankMateRatings<Mate extends { id: string; name: string }>(mates: Mate[], ratings: MateRating[]) {
  const rows = mates.map((mate) => {
    const own = ratings.filter((rating) => rating.application_id === mate.id);
    return {
      mate,
      scores: new Map(own.map((rating) => [rating.activity_no, rating.score])),
      total: own.reduce((sum, rating) => sum + rating.score, 0),
    };
  }).sort((a, b) => b.total - a.total || a.mate.name.localeCompare(b.mate.name, "ko"));
  return rows.map((row) => ({
    ...row,
    rank: row.scores.size ? rows.findIndex((other) => other.total === row.total) + 1 : null,
  }));
}
