import authMiddleware from "../../middleware/auth"
import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { Parent, Student, Teacher, User } from "@/plugins/db/models/auth.model";
import { auth } from "@/plugins/auth";

// ROUTE TO GET THE USER PROFILE BASED ON THE ROLE OF THE USER
export default async function (fastify: FastifyInstance) {
  fastify.addHook("preHandler", authMiddleware);

  fastify.get("/v1/api/user", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userRole = request.user.role;
      if (userRole === "student") {
        const student_profile = await Student.findOne({ user: request.user.id }).populate('user', 'name email first_name last_name role phone createdAt updatedAt');
        return reply.send({
          status_code: 200,
          message: "User profile fetched successfully",
          data: student_profile
        });
      }
      else if (userRole === "teacher" || userRole === "principal" || userRole === "hod" || userRole === "admin" || userRole === "staff") {
        const teacher_profile = await Teacher.findOne({ user: request.user.id }).populate('user', 'name email first_name last_name role phone createdAt updatedAt');
        return reply.send({
          status_code: 200,
          message: "User profile fetched successfully",
          data: teacher_profile
        });
      }
      else if (userRole === "parent") {
        const parent_profile = await Parent.findOne({ user: request.user.id }).populate('user', 'name email first_name last_name role phone createdAt updatedAt').populate('child', 'adm_number adm_year candidate_code department date_of_birth').populate({ path: 'child', populate: { path: 'user', select: 'name email first_name last_name role phone createdAt updatedAt' } });
        return reply.send({
          status_code: 200,
          message: "User profile fetched successfully",
          data: parent_profile
        });
      }
    }
    catch (e) {
      return reply.send({
        status_code: 204,
        error: e,
        data: ""
      });
    }

  });

  fastify.put("/v1/api/update-user/:id", async (Request: FastifyRequest, reply: FastifyReply) => {
    const userId = Request.params.id
    try {
      const updatedBody = Request.body as {
        name?: string;
        password?: string;
        image?: string;
        role?: string;
        phone?: number;
        first_name?: string;
        last_name?: string;
        gender?: string;
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
      // 🔑 Use this structure for general fields like name, image, and custom fields (e.g., role)

if (updatedBody?.name || updatedBody?.image) {
    // Pass the fields to be updated inside a 'data' object.
    await auth.api.updateUser(Request ,{
        body: {
            name: updatedBody.name, 
            image: updatedBody.image,
        }
    });
}     
      
      const userInstance = await User.findByIdAndUpdate(userId, updatedBody, {
        new: true
      })

       if (updatedBody?.role == "student") {
          
          if (!updatedBody.student) {
          reply.status(404).send({
          "status_code" : 404,
          "message" : "Nothing to Update",
          "data" : ""
          })
        }
          const student_record = await Student.findOne({user: Request.user.id})
          if (!student_record) {
            reply.status(404).send({
            "status_code" : 404,
            "message" : "Student Record Not Found",
            "data" : ""
        })
          }
          const studentInstance = await Teacher.findByIdAndUpdate(student_record?._id, updatedBody.student , {
            new: true
          })
      }
      else if (updatedBody?.role === "teacher" || updatedBody?.role === "principal" || updatedBody?.role === "hod" || updatedBody?.role === "admin" || updatedBody?.role === "staff") {

        if (!updatedBody.teacher) {
          reply.status(404).send({
          "status_code" : 404,
          "message" : "Nothing to Update",
          "data" : ""
          })
        }
          const teacher_record = await Teacher.findOne({user: Request.user.id})
          if (!teacher_record) {
            reply.status(404).send({
          "status_code" : 404,
          "message" : "Teacher Record Not Found",
          "data" : ""
        })
          }
          const teacherInstance = await Teacher.findByIdAndUpdate(teacher_record?._id, updatedBody.teacher , {
            new: true
          })
      }

      else if (updatedBody?.role == "parent") {

          if (!updatedBody.parent) {
          reply.status(404).send({
          "status_code" : 404,
          "message" : "Nothing to Update",
          "data" : ""
          })
        }
          const parent_record = await Parent.findOne({user: Request.user.id})
          if (!parent_record) {
            reply.status(404).send({
            "status_code" : 404,
            "message" : "Teacher Record Not Found",
            "data" : ""
        })
          }
          const parentInstance = await Parent.findByIdAndUpdate(parent_record?._id, updatedBody.parent , {
            new: true
          })
      }

      reply.status(200).send({
        "status_code" : 200,
        "message" : "User Record Updated Successfully",
        "data" : ""
      })
    }catch (e) {
      reply.status(404).send({
        "status_code" : 404,
        "message" : "Some Error Occured",
        "data" : e
      })
    }
    

  })
  
}