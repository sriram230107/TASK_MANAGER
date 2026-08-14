import { Request, Response, NextFunction } from 'express';

export const authorize = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const role = user.role;

    // RBAC Permissions matrix
    const permissions: Record<string, Record<string, string[]>> = {
      ADMIN: {
        'user': ['create', 'read', 'update', 'delete'],
        'team': ['create', 'read', 'update', 'delete']
      },
      MANAGER: {
        'user': ['read'],
        'team': ['read']
      },
      TEAM_LEAD: {
        'user': ['read'],
        'team': ['read']
      },
      EMPLOYEE: {
        'user': ['read'],
        'team': ['read']
      }
    };

    const allowedActions = permissions[role]?.[resource] || [];

    if (!allowedActions.includes(action)) {
      res.status(403).json({ message: `Forbidden: Cannot ${action} ${resource}` });
      return;
    }

    next();
  };
};
