import { User as PrismaUser } from '@prisma/client';

export type SafeUser = PrismaUser & {
  department?: any;
  organization?: any;
};

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      organizationId?: string;
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
