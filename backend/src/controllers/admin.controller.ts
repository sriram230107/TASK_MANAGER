import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';
import { teamSchema, assignRoleSchema, addTeamMemberSchema, assignTeamLeadSchema } from '../validators/admin.validator';

export const createTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = teamSchema.parse(req.body);
        const team = await adminService.createTeam(data);
        res.status(201).json(team);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const assignTeamLead = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = assignTeamLeadSchema.parse(req.body);
        const team = await adminService.assignTeamLead(req.params.id as string, data);
        res.json(team);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const addTeamMember = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = addTeamMemberSchema.parse(req.body);
        const member = await adminService.addTeamMember(req.params.id as string, data);
        res.status(201).json(member);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const assignRole = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = assignRoleSchema.parse(req.body);
        const user = await adminService.assignRole(req.params.id as string, data);
        res.json(user);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};
