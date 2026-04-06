export interface KickResult {
  ok: boolean;
  code?: number;
  message?: string;
}

export interface JoinResult {
  ok: boolean;
  code?: number;
  message?: string;
  users?: string[];
  you?: { id: string; alias: string };
}
