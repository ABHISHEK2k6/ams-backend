import { FastifyReply, FastifyInstance, FastifyRequest, RouteShorthandOptions } from "fastify";
import { Parent, Student, Teacher, User } from "@/plugins/db/models/auth.model";
import { auth } from "@/plugins/auth";
import { isAdmin } from "@/middleware/roles";





export default async function (fastify: FastifyInstance) {

    // ENDPOINT TO SIGN IN USER BASIC AUTHENTICATION USING BETTER-AUTH (ONLY FOR DEVELOPMENT PURPOSES NOT INCLUDED WITH THE PRODUCTION SYSTEM.)
    fastify.post("/sign-in", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { email, password } = request.body as {
                email: string;
                password: string;
            };

            const responce = await auth.api.signInEmail({
                body: { email, password },
                returnHeaders: true,
            });

            const setCookie = responce.headers.get("set-cookie");
            if (setCookie) {
                reply.header("Set-Cookie", setCookie);
            }

            return reply.status(200).send({
                "status_code" : 200,
                "message" : "Successfully LoggedIN",
                "data" : {
                    "id" : responce.response.user.id,
                    "email" : responce.response.user.email,
                }
            })
        }
        catch (e) {
            return reply.status(500).send({ 
                status_code : 500,
                message : "Some error occured with login",
                error: e
            })
        }
    })


    // ENDPOINT TO CREATE USER WITH ROLE BASED ADDITIONAL DETAILS BASIC AUTHENTICATION USING BETTER-AUTH

}
