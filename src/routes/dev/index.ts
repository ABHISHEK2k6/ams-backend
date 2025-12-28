import { FastifyReply, FastifyInstance, FastifyRequest, RouteShorthandOptions } from "fastify";
import { Parent, Student, Teacher, User } from "@/plugins/db/models/auth.model";
import { auth } from "@/plugins/auth";
import { isAdmin } from "@/middleware/roles";
import { request } from "http";
import { Batch } from "@/plugins/db/models/academics.model";





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

    fastify.post("/create-batch" , async (request: FastifyRequest<{ Params: { id?: string } }>, reply:FastifyReply) => {
        const {name, adm_year,department,staff_ID} = request.body as {
            name : string,
            adm_year : number,
            department : string,
            staff_ID : string,
        }
        const teacherInstance = await Teacher.findById(staff_ID)
        if (!teacherInstance){
            return reply.status(404).send({
                status_code: 404,
                message: "Teacher not found",
                data: "",
            });
        }
        const createBatch = new Batch({
            name: name,
            adm_year: adm_year,
            department: department,
            staff_advisor: teacherInstance._id
        })
        await createBatch.save()
        return reply.status(201).send({
            "status_code": 201,
            "message": "Successfully created the batch",
            "data": createBatch
        })
    })

}
