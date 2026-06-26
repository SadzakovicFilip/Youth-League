/** Deljeni tipovi za live zapisnik i box score odigranog meča. */

export type MatchScorebookDetailMatchInfo = {
  id: number;
  scheduled_at: string;
  venue: string | null;
  status: 'scheduled' | 'live' | 'finished' | string;
  started_at: string | null;
  ended_at: string | null;
  home_club_id: number;
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  display_status?: string | null;
  league_name?: string | null;
  region_name?: string | null;
};

export type MatchScorebookOfficial = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

export type MatchScorebookRosterPlayer = {
  user_id: string;
  jersey_number: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  license_number?: string | null;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  total_points: number;
};

export type MatchScorebookPayload = {
  match: MatchScorebookDetailMatchInfo;
  is_zapisnicar: boolean;
  can_score: boolean;
  home_roster: MatchScorebookRosterPlayer[];
  away_roster: MatchScorebookRosterPlayer[];
  sudije?: MatchScorebookOfficial[];
};
