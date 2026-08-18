export interface JwtPayload {
  /** userId, representado por el claim estándar JWT "sub". */
  sub: number;
  email: string;
  role: string;
}
