import { FastifyReply, FastifyInstance, FastifyRequest } from "fastify";
import { Parent, Student, Teacher, User } from "@/plugins/db/models/auth.model";
import { auth } from "@/plugins/auth";
import { isAdmin } from "@/middleware/roles";
import authMiddleware from "../../middleware/auth"

import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
    baseURL: "http://localhost:3000", // if you also run server
    plugins: [ adminClient() ],
});

export default async function (fastify: FastifyInstance) {
    fastify.addHook("preHandler", authMiddleware);  
    fastify.addHook("preHandler" , isAdmin);
    // ENDPOINT TO DELETE USER BASIC AUTHENTICATION USING BETTER-AUTH (ONLY THE REQUEST WITH THE ROLE ADMIN CAN PERFORM THIS ACTION.)
    fastify.delete("/delete-user/:id", async (request: FastifyRequest, reply: FastifyReply) => {
        const UserID = request.params.id  //ID OF THE USER TO BE DELETED
        try {
            console.log("k");
            
            await authClient.admin.removeUser({userId :UserID})
             console.log("k");
            const user = await User.findById(UserID)
            await User.findByIdAndDelete(UserID)

            if (user?.role == "student") {
                const STID = await Student.findOne({ user: user._id }) // STUDENT ID TO BE TRACKED TO DELETE THE PARENT RECORD.
                await Student.deleteOne({ user: user._id });
                await Parent.deleteOne({ child: STID });
            }
            else if (user?.role == "parent") {
                const ChildID = await Parent.findOne({ user: user._id }) // GETTING THE ID OF THE CHILD TO WHOM PARENT IS CONNECTED WITH.
                await Parent.deleteOne({ user: user._id });
            }
            else if (user?.role === "teacher" || user?.role === "principal" || user?.role === "hod" || user?.role === "admin" || user?.role === "staff") {
                await Teacher.deleteOne({ user: user._id });
            }
            return reply.status(204).send({
                "status_code": 204,
                "message": "Successfully Deleted The User",
                "data": ""
            })
        }
        catch (e) {
            return reply.send({
                "status_code": 404,
                "message": "Can't delete the user",
                "error": e
            })
        }
    })
}
