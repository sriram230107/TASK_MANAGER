import { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: PrismaUser & {
        department?: any;
        organization?: any;
      };
      scope?: {
        organizationId: string;
        userWhere: any;
        teamWhere: any;
        departmentWhere: any;
        taskWhere: any;
      };
    }
  }
}

export {};
