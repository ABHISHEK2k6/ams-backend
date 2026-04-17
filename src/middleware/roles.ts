import { FastifyRequest, FastifyReply } from "fastify";

export const checkRoles = (roles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user && roles.includes(request.user.role)) {
      return;
    }

    reply.code(403).send({ 
      status: 403,
      error: 'Forbidden',
      message: `This route requires one of the following roles: ${roles.join(', ')}` 
    });
  };
};

// Role middleware for each user type
export const isAdmin = checkRoles(['admin']);
export const isStudent = checkRoles(['student']);
export const isTeacher = checkRoles(['teacher']);
export const isParent = checkRoles(['parent']);
export const isPrincipal = checkRoles(['principal']);
export const isHOD = checkRoles(['hod']);
export const isStaff = checkRoles(['staff']);

// Combined role middlewares for common scenarios
export const isAnyStaff = checkRoles(['teacher', 'hod', 'principal', 'staff', 'admin']);
export const isAnyStaffOrStudent = checkRoles(['teacher', 'hod', 'principal', 'staff', 'admin', 'student']);