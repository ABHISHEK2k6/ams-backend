import { FastifyReply, FastifyInstance, FastifyRequest } from "fastify";
import { Parent, Student, Teacher, User } from "@/plugins/db/models/auth.model";
import { auth } from "@/plugins/auth";
import { isAdmin } from "@/middleware/roles";

export default async function (fastify: FastifyInstance) {

    // ENDPOINT TO SIGN IN USER BASIC AUTHENTICATION USING BETTER-AUTH (ONLY FOR DEVELOPMENT PURPOSES NOT INCLUDED WITH THE PRODUCTION SYSTEM.)
    fastify.post("/v1/api/sign-in/", async (request: FastifyRequest, reply: FastifyReply) => {
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
    fastify.post("/v1/api/create-user/", async (request : FastifyRequest, reply : FastifyReply) => {

        try {
            const { name, email, password, image, role, phone, first_name, last_name, gender, student, teacher, parent } = request.body as {
                name: string;
                email: string;
                password: string;
                image?: string;
                role: string;
                phone: number;
                first_name: string;
                last_name: string;
                gender: string;
                student?: {
                    adm_number?: string;
                    adm_year?: number;
                    candidate_code?: string;
                    department?: string;
                    date_of_birth?: Date;
                };
                teacher?: {
                    designation?: string;
                    department?: string;
                    date_of_joining?: Date;
                }
                parent?: {
                    relation?: string;
                    childID?: string;
                }
            };

            const responce = await auth.api.signUpEmail({
                body: { name, email, password, image, role },
                returnHeaders: true,
            });

            const setCookie = responce.headers.get("set-cookie");
            if (setCookie) {
                reply.header("Set-Cookie", setCookie);
            }

            const userId = responce.response.user.id;
            const user_instance = new User({
                _id: userId,
                name: responce.response.user.name,
                email: responce.response.user.email,
                image: responce.response.user.image,
                emailVerified: responce.response.user.emailVerified,
                createdAt: responce.response.user.createdAt,
                updatedAt: responce.response.user.updatedAt,
                role: role,
                phone: phone,
                first_name: first_name,
                last_name: last_name,

            })

            await user_instance.save();

            if (role == "student") {
                const std_record = new Student({
                    user: user_instance._id,
                    gender: gender,
                    adm_number: student?.adm_number,
                    adm_year: student?.adm_year,
                    candidate_code: student?.candidate_code,
                    department: student?.department,
                    date_of_birth: student?.date_of_birth,
                })

                await std_record.save();
                return reply.status(201).send({
                    "status_code": 201,
                    "message": "Student User created successfully",
                    "data": ""
                })
            }

            else if (role === "teacher" || role === "principal" || role === "hod" || role === "admin" || role === "staff") {
                const teacher_record = new Teacher({
                    user: user_instance._id,
                    designation: teacher?.designation,
                    department: teacher?.department,
                    date_of_joining: teacher?.date_of_joining,
                })
                await teacher_record.save();

                return reply.status(201).send({
                    "status_code": 201,
                    "message": "Teacher User created successfully",
                    "data": ""
                })
            }

            else if (role == "parent") {

                const child_instance = await Student.findById(parent?.childID)
                const parent_record = new Parent({
                    user: user_instance._id,
                    child: child_instance,
                    relation: parent?.relation,
                })

                await parent_record.save();

                return reply.status(201).send({
                    "status_code": 201,
                    "message": "Parent User created successfully",
                    "data": ""
                })

            }
        }
        catch (e) {
            return reply.status(500).send(e)
        }
    })

    // ENDPOINT TO DELETE USER BASIC AUTHENTICATION USING BETTER-AUTH (ONLY THE REQUEST WITH THE ROLE ADMIN CAN PERFORM THIS ACTION.)
    fastify.delete("/api/delete-user/:id" , async (request: FastifyRequest, reply: FastifyReply) => {
       fastify.addHook("preHandler", isAdmin);
        return reply.send({ message: "User deleted successfully" })
        
    })
}
