import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { errorResponse } from '../utils/response';

export interface TokenPayload {
    id: string;
    role?: string;
    organizationId?: string;
    iat?: number;
    exp?: number;
}

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        let token: string | undefined;

        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token) {
            errorResponse(res, 'Unauthorized: No token provided', 401);
            return;
        }

        const secret = process.env.JWT_ACCESS_SECRET as string;
        let decoded: TokenPayload;

        try {
            decoded = jwt.verify(token, secret) as TokenPayload;
        } catch (jwtError: any) {
            if (jwtError.name === 'TokenExpiredError') {
                errorResponse(res, 'Unauthorized: Token expired', 401);
                return;
            }
            errorResponse(res, 'Unauthorized: Invalid token', 401);
            return;
        }

        if (!decoded?.id) {
            errorResponse(res, 'Unauthorized: Malformed token payload', 401);
            return;
        }

        const user = await prisma.user.findFirst({
            where: {
                id: decoded.id,
                deletedAt: null
            },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                        managerId: true
                    }
                },
                organization: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!user) {
            errorResponse(res, 'Unauthorized: User not found or inactive', 401);
            return;
        }

        req.user = user;
        next();
    } catch (error: any) {
        console.error('Authentication middleware error:', error);
        errorResponse(res, 'Internal authentication error', 500);
    }
};
