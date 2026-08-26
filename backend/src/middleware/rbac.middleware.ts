import { Request, Response, NextFunction } from 'express';
import {
    isAuthorizedForTarget,
    isAuthorizedForTeam
} from '../utils/hierarchy';

export const authorize = (
    resource: string,
    action: string
) => {
    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {

        try {
            const user = (req as any).user;

            if (!user) {
                res.status(401).json({
                    message: 'Unauthorized'
                });
                return;
            }

            /*
             * =====================================================
             * ROLE-BASED PERMISSIONS
             * =====================================================
             *
             * Organization hierarchy:
             *
             * ADMIN
             *   └── MANAGER
             *        └── TEAM_LEAD
             *             └── EMPLOYEE
             *
             * Task assignment:
             *
             * ADMIN      -> employee / team lead / manager
             * MANAGER    -> team lead / employee in managed teams
             * TEAM_LEAD  -> employees in own teams
             * EMPLOYEE   -> cannot assign tasks
             */

            const permissions: Record<
                string,
                Record<string, string[]>
            > = {

                ADMIN: {
                    user: [
                        'create',
                        'read',
                        'update',
                        'delete'
                    ],

                    team: [
                        'create',
                        'read',
                        'update',
                        'delete'
                    ],

                    task: [
                        'create',
                        'read',
                        'update',
                        'delete',
                        'assign'
                    ],

                    organization: [
                        'read',
                        'update'
                    ]
                },

                MANAGER: {
                    user: [
                        'read'
                    ],

                    team: [
                        'read'
                    ],

                    task: [
                        'create',
                        'read',
                        'update',
                        'assign'
                    ]
                },

                TEAM_LEAD: {
                    user: [
                        'read'
                    ],

                    team: [
                        'read',
                        'create',
                        'update'
                    ],

                    task: [
                        'create',
                        'read',
                        'update',
                        'assign'
                    ]
                },

                EMPLOYEE: {
                    user: [
                        'read'
                    ],

                    team: [
                        'read'
                    ],

                    task: [
                        'read'
                    ]
                }
            };

            const allowedActions =
                permissions[user.role]?.[resource] || [];

            if (!allowedActions.includes(action)) {
                res.status(403).json({
                    message:
                        `Forbidden: Cannot ${action} ${resource}`
                });

                return;
            }

            /*
             * =====================================================
             * TARGET USER AUTHORIZATION
             * =====================================================
             *
             * Examples:
             *
             * assignedToId
             * userId
             * employeeId
             *
             * These are checked against the user's hierarchy.
             */

            const targetUserId =
                req.params.userId ||
                req.body.userId ||
                req.body.employeeId ||
                req.body.assignedToId ||
                req.query.assignedTo;

            if (targetUserId) {

                const authorized =
                    await isAuthorizedForTarget(
                        user,
                        targetUserId as string
                    );

                if (!authorized) {
                    res.status(403).json({
                        message:
                            'Forbidden: User is outside your organizational scope'
                    });

                    return;
                }
            }

            /*
             * =====================================================
             * TARGET TEAM AUTHORIZATION
             * =====================================================
             *
             * Examples:
             *
             * teamId
             * /teams/:teamId
             */

            const targetTeamId =
                req.params.teamId ||
                req.body.teamId ||
                req.query.teamId;

            if (targetTeamId) {

                const authorized =
                    await isAuthorizedForTeam(
                        user,
                        targetTeamId as string
                    );

                if (!authorized) {
                    res.status(403).json({
                        message:
                            'Forbidden: Team is outside your organizational scope'
                    });

                    return;
                }
            }

            /*
             * =====================================================
             * TASK ASSIGNMENT RULE
             * =====================================================
             *
             * The RBAC middleware gives the role permission to
             * perform the action.
             *
             * task.service.ts performs the deeper validation:
             *
             * - organization
             * - team
             * - membership
             * - manager hierarchy
             * - team lead hierarchy
             *
             * Therefore we do not duplicate those database rules
             * here.
             */

            next();

        } catch (error: any) {

            console.error(
                'RBAC authorization error:',
                error
            );

            res.status(500).json({
                message:
                    'Authorization check failed'
            });
        }
    };
};