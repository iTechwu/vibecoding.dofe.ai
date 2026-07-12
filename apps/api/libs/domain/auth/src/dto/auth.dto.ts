export interface AuthClientSession {
  userId: string;
  access: string;
  accessExpire: number;
  refresh: string;
  expire: number;
  isAnonymity: boolean;
}
