import { Request, Response } from 'express';

import * as adminService from '../services/admin.service';

import {
    teamSchema,
    assignRoleSchema,
    addTeamMemberSchema,
    assignTeamLeadSchema
} from '../validators/admin.validator';


/*
============================================================
CREATE TEAM
============================================================
*/

export const createTeam = async (
    req: Request,
    res: Response
): Promise<void> => {

    try {

        const data =
            teamSchema.parse(req.body);

        const team =
            await adminService.createTeam(data);

        res.status(201).json(team);

    } catch (error: any) {

        console.error(
            'Create team error:',
            error
        );

        res.status(400).json({
            message:
                error?.message ||
                'Unable to create team'
        });
    }
};


/*
============================================================
ASSIGN TEAM LEAD
============================================================
*/

export const assignTeamLead = async (
    req: Request,
    res: Response
): Promise<void> => {

    try {

        const data =
            assignTeamLeadSchema.parse(
                req.body
            );

        const team =
            await adminService.assignTeamLead(
                req.params.id as string,
                data
            );

        res.json(team);

    } catch (error: any) {

        console.error(
            'Assign team lead error:',
            error
        );

        res.status(400).json({
            message:
                error?.message ||
                'Unable to assign team lead'
        });
    }
};


/*
============================================================
ADD TEAM MEMBER
============================================================
*/

export const addTeamMember = async (
    req: Request,
    res: Response
): Promise<void> => {

    try {

        const data =
            addTeamMemberSchema.parse(
                req.body
            );

        const member =
            await adminService.addTeamMember(
                req.params.id as string,
                data
            );

        res.status(201).json(member);

    } catch (error: any) {

        console.error(
            'Add team member error:',
            error
        );

        res.status(400).json({
            message:
                error?.message ||
                'Unable to add team member'
        });
    }
};


/*
============================================================
ASSIGN ROLE
============================================================
*/

export const assignRole = async (
    req: Request,
    res: Response
): Promise<void> => {

    try {

        const data =
            assignRoleSchema.parse(
                req.body
            );

        const user =
            await adminService.assignRole(
                req.params.id as string,
                data
            );

        res.json(user);

    } catch (error: any) {

        console.error(
            'Assign role error:',
            error
        );

        res.status(400).json({
            message:
                error?.message ||
                'Unable to assign role'
        });
    }
};


/*
============================================================
ADMIN DASHBOARD
============================================================
*/

export const getDashboard = async (
    req: Request,
    res: Response
): Promise<void> => {

    try {

        const user =
            (req as any).user;

        if (!user) {
            res.status(401).json({
                message:
                    'Unauthorized'
            });

            return;
        }

        const dashboard =
            await adminService.getGlobalDashboard(
                user
            );

        res.json(dashboard);

    } catch (error: any) {

        console.error(
            'Admin dashboard error:',
            error
        );

        res.status(400).json({
            message:
                error?.message ||
                'Unable to load admin dashboard'
        });
    }
};