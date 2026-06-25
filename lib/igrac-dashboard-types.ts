export type IgracAttendanceRow = {
  id: number;
  scheduled_at: string;
  topic: string;
  venue: string | null;
  present: boolean;
  marked: boolean;
};

export type IgracFeeRow = {
  id: number;
  period_month: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
};

export type IgracStatRow = {
  id: number;
  match_date: string;
  opponent: string | null;
  points: number;
  rebounds: number;
  assists: number;
};

export type IgracTacticActionRow = {
  id: number;
  name: string;
  description: string | null;
  position: number;
};

export type IgracTacticRow = {
  id: number;
  name: string;
  kind: 'attack' | 'defense';
  description: string | null;
  actions: IgracTacticActionRow[];
};

export type IgracClubContext = {
  club_id: number;
  club_name: string;
  league_id: number | null;
  league_name: string | null;
  region_id: number | null;
  region_name: string | null;
  group_id: number | null;
  group_name: string | null;
};

export type IgracGroupClub = {
  id: number;
  name: string;
};

export type IgracHubUpcoming = {
  id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_club_id: number;
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  side: 'home' | 'away';
};

export type IgracHubPlayed = {
  match_id: number;
  scheduled_at: string;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  side: 'home' | 'away';
  jersey_number: number | null;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  total_points: number;
  result: string;
};

export type IgracHubAgg = {
  games_played: number;
  total_points: number;
  avg_points: number;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  pct_points_ft: number;
  pct_points_2: number;
  pct_points_3: number;
};

export type IgracMatchHub = {
  club_id: number | null;
  league_id: number | null;
  league_name: string | null;
  upcoming: IgracHubUpcoming[];
  played: IgracHubPlayed[];
  season: IgracHubAgg;
  career: IgracHubAgg;
};

export type IgracDashboardPayload = {
  club_context: IgracClubContext | null;
  trainings: IgracAttendanceRow[];
  fees: IgracFeeRow[];
  stats: IgracStatRow[];
  tactics: IgracTacticRow[];
  group_clubs: IgracGroupClub[];
  match_hub: IgracMatchHub | null;
};
