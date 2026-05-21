import { supabase } from "@/lib/supabase";

const CHUNK = 120;

function chunkIds<T>(ids: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export type TrenerTeamPlayerStats = {
  trainingPresent: number;
  trainingTotal: number;
  gamesPlayed: number;
  avgPointsPerGame: number;
  pointsFrom1: number;
  pointsFrom2: number;
  pointsFrom3: number;
};

const emptyStats = (): TrenerTeamPlayerStats => ({
  trainingPresent: 0,
  trainingTotal: 0,
  gamesPlayed: 0,
  avgPointsPerGame: 0,
  pointsFrom1: 0,
  pointsFrom2: 0,
  pointsFrom3: 0,
});

/**
 * Za trenerov tim: prisustvo na prošlim treninzima, broj završenih utakmica sa sastava,
 * prosek poena i zbir poena po tipu šuta (1 / 2 / 3) iz match_events.
 */
export async function fetchTrenerTeamPlayerStats(
  clubId: number,
  playerIds: string[],
): Promise<Record<string, TrenerTeamPlayerStats>> {
  const out: Record<string, TrenerTeamPlayerStats> = {};
  for (const id of playerIds) out[id] = emptyStats();
  if (!playerIds.length) return out;

  const nowIso = new Date().toISOString();

  const { data: trainingRows, error: trErr } = await supabase
    .from("trainings")
    .select("id")
    .eq("club_id", clubId)
    .lte("scheduled_at", nowIso);

  if (trErr) {
    return out;
  }

  const trainingIds = (trainingRows ?? []).map((r) => r.id as number);
  const trainingTotal = trainingIds.length;
  for (const id of playerIds) {
    out[id].trainingTotal = trainingTotal;
  }

  if (trainingIds.length > 0) {
    for (const tChunk of chunkIds(trainingIds, CHUNK)) {
      const { data: att, error: aErr } = await supabase
        .from("training_attendance")
        .select("player_id, present")
        .in("training_id", tChunk)
        .in("player_id", playerIds);
      if (aErr) continue;
      for (const row of att ?? []) {
        const pid = row.player_id as string;
        if (!out[pid]) out[pid] = emptyStats();
        out[pid].trainingTotal = trainingTotal;
        if (row.present === true) out[pid].trainingPresent += 1;
      }
    }
  }

  const { data: rosterRows, error: rErr } = await supabase
    .from("match_rosters")
    .select("match_id, user_id")
    .eq("club_id", clubId)
    .in("user_id", playerIds);

  if (rErr || !rosterRows?.length) {
    return out;
  }

  const rosterMatchIds = [
    ...new Set(rosterRows.map((r) => r.match_id as number)),
  ];
  if (!rosterMatchIds.length) return out;

  const finishedIds = new Set<number>();
  for (const mChunk of chunkIds(rosterMatchIds, CHUNK)) {
    const { data: mrows, error: mErr } = await supabase
      .from("matches")
      .select("id")
      .in("id", mChunk)
      .eq("status", "finished");
    if (mErr) continue;
    for (const m of mrows ?? []) finishedIds.add(m.id as number);
  }

  const gamesByPlayer = new Map<string, Set<number>>();
  for (const pid of playerIds) gamesByPlayer.set(pid, new Set());
  for (const row of rosterRows) {
    const mid = row.match_id as number;
    if (!finishedIds.has(mid)) continue;
    const uid = row.user_id as string;
    gamesByPlayer.get(uid)?.add(mid);
  }
  for (const pid of playerIds) {
    out[pid].gamesPlayed = gamesByPlayer.get(pid)?.size ?? 0;
  }

  const finishedMatchList = [...finishedIds];
  if (!finishedMatchList.length) return out;

  const totalsByPlayer: Record<
    string,
    { p1: number; p2: number; p3: number; total: number }
  > = {};
  for (const pid of playerIds) {
    totalsByPlayer[pid] = { p1: 0, p2: 0, p3: 0, total: 0 };
  }

  for (const mChunk of chunkIds(finishedMatchList, CHUNK)) {
    for (const pChunk of chunkIds(playerIds, CHUNK)) {
      const { data: evs, error: eErr } = await supabase
        .from("match_events")
        .select("user_id, event_type, points")
        .eq("club_id", clubId)
        .in("match_id", mChunk)
        .in("user_id", pChunk);
      if (eErr) continue;
      for (const ev of evs ?? []) {
        const uid = ev.user_id as string;
        if (!totalsByPlayer[uid]) continue;
        const et = ev.event_type as string;
        const pts = Number(ev.points ?? 0);
        if (et === "free_throw") totalsByPlayer[uid].p1 += pts;
        else if (et === "field") totalsByPlayer[uid].p2 += pts;
        else if (et === "three") totalsByPlayer[uid].p3 += pts;
        if (et !== "foul") totalsByPlayer[uid].total += pts;
      }
    }
  }

  for (const pid of playerIds) {
    const t = totalsByPlayer[pid];
    const gp = out[pid].gamesPlayed;
    out[pid].pointsFrom1 = t.p1;
    out[pid].pointsFrom2 = t.p2;
    out[pid].pointsFrom3 = t.p3;
    out[pid].avgPointsPerGame =
      gp > 0 ? Math.round((t.total / gp) * 10) / 10 : 0;
  }

  return out;
}
