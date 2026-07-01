export interface AuthUser {
  userId: number;
  username: string;
}

// Augment Express.Request so `request.user` is strongly typed everywhere.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends AuthUser {}
  }
}
