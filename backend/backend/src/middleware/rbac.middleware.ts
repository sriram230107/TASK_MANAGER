import { Request, Response, NextFunction } from 'express';
import { isAuthorizedForTarget, isAuthorizedForTeam } from '../utils/hierarchy';

export const authorize = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const role = user.role;
    const permissions: Record<string, Record<string, string[]>> = {
      ADMIN: { 'user': ['create', 'read', 'update', 'delete'], 'team': ['create', 'read', 'update', 'delete'], 'organization': ['read'] },
      MANAGER: { 'user': ['read'], 'team': ['read'] },
      TEAM_LEAD: { 'user': ['read'], 'team': ['read', 'create', 'update'] },
      EMPLOYEE: { 'user': ['read'], 'team': ['read'] }
    };

    const allowedActions = permissions[role]?.[resource] || [];

    if (!allowedActions.includes(action)) {
      res.status(403).json({ message: `Forbidden: Cannot ${action} ${resource}` });
      return;
    }

    const targetUserId = req.params.userId || req.body.userId || req.body.employeeId || req.body.assignedToId || req.query.assignedTo;
    const targetTeamId = req.params.teamId || req.body.teamId || req.query.teamId;

    if (targetUserId) {
      const authorized = await isAuthorizedForTarget(user, targetUserId as string);
      if (!authorized) {
        res.status(403).json({ message: 'Forbidden: Missing relational ownership for user' });
        return;
      }
    }

    if (targetTeamId) {
      const authorized = await isAuthorizedForTeam(user, targetTeamId as string);
      if (!authorized) {
        res.status(403).json({ message: 'Forbidden: Missing relational ownership for team' });
        return;
      }
    }

    next();
  };
};
