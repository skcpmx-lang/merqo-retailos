/**
 * Session management — stored in RAM only, not on disk
 * Single user at a time for V1 (desktop POS)
 */

import { Id } from '@core/domain/Id';
import { DateTime } from '@core/domain/DateTime';

export interface SessionUser {
  userId: string;
  businessId: string;
  name: string;
  phone: string;
  isOwner: boolean;
  roleIds: string[];
  permissions: string[];
}

export interface Session {
  sessionId: string;
  user: SessionUser;
  loginAt: number;
  lastActivityAt: number;
  shiftId?: string;
  ip?: string;
}

class SessionManager {
  private currentSession: Session | null = null;
  private timeoutMs = 30 * 60 * 1000; // 30 minutes
  private timer: NodeJS.Timeout | null = null;

  createSession(user: SessionUser, shiftId?: string): Session {
    const session: Session = {
      sessionId: Id.generate(),
      user,
      loginAt: DateTime.nowMs(),
      lastActivityAt: DateTime.nowMs(),
      shiftId,
    };
    this.currentSession = session;
    this.startTimeoutCheck();
    return session;
  }

  getSession(): Session | null {
    return this.currentSession;
  }

  getCurrentUser(): SessionUser | null {
    return this.currentSession?.user || null;
  }

  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.isOwner) return true; // Owner has all
    return user.permissions.includes(permission);
  }

  requirePermission(permission: string): void {
    if (!this.hasPermission(permission)) {
      throw new Error(`Permission denied: ${permission}`);
    }
  }

  updateActivity() {
    if (this.currentSession) {
      this.currentSession.lastActivityAt = DateTime.nowMs();
    }
  }

  clearSession(): void {
    this.currentSession = null;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isExpired(): boolean {
    if (!this.currentSession) return true;
    return DateTime.nowMs() - this.currentSession.lastActivityAt > this.timeoutMs;
  }

  setTimeoutMs(ms: number) {
    this.timeoutMs = ms;
  }

  private startTimeoutCheck() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.isExpired()) {
        this.clearSession();
      }
    }, 60 * 1000); // Check every minute
  }

  isLoggedIn(): boolean {
    return this.currentSession !== null && !this.isExpired();
  }
}

export const sessionManager = new SessionManager();
