import authMiddleware from "../../middleware/auth"
import { FastifyRequest, FastifyReply, FastifyInstance, RouteShorthandOptions } from "fastify";
import { Parent, Student, Teacher, User } from "@/plugins/db/models/auth.model";
import { auth } from "@/plugins/auth";
import { isAdmin } from "@/middleware/roles";
import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";
import { email } from "zod";

const authClient = createAuthClient({
    baseURL: "http://localhost:3000", // if you also run server
    plugins: [ adminClient() ],
});

const userUpdateSchema: RouteShorthandOptions['schema'] = {
  body: {
    type: 'object',
    
    required: [], 

    properties: {
      name: { type: 'string', minLength: 3 },
      password: { type: 'string', minLength: 8 },
      image: { type: 'string' },
      role: {
        type: 'string',
        enum: ["student", "teacher", "parent", "principal", "hod", "staff", "admin"]
      },
      phone: { type: 'number' },
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      gender: { type: 'string', enum: ["male", "female", "other"] },

      student: {
        type: 'object',
        required: [], 
        properties: {
          adm_number: { type: 'string' },
          adm_year: { type: 'number' },
          candidate_code: { type: 'string' },
          department: { type: 'string', enum: ["CSE", "ECE", "IT"] },
          date_of_birth: { type: 'string', format: 'date' },
        },
        additionalProperties: false,
      },

      teacher: {
        type: 'object',
        required: [], 
        properties: {
          designation: { type: 'string' },
          department: { type: 'string' },
          date_of_joining: { type: 'string', format: 'date' },
        },
        additionalProperties: false,
      },

      parent: {
        type: 'object',
        required: [], 
        properties: {
          relation: { type: 'string', enum: ["mother", "father", "guardian"] },
          childID: { type: 'string' },
        },
        additionalProperties: false,
      },
    },

    if: {
      properties: {
        role: { 
          enum: ["teacher", "principal", "hod", "staff", "admin"] 
        }
      }
    },
    then: {
      required: ["teacher"]
    },
    
  
    if: { required: ["student"] },
    then: { properties: { role: { const: "student" } } },

    if: { required: ["parent"] },
    then: { properties: { role: { const: "parent" } } },

    
    if: {
      properties: {
        role: { 
          enum: ["student", "parent"]
        }
      }
    },
    then: {
      properties: {
        teacher: { not: {} } 
      }
    },
    

    
    additionalProperties: false, 
  },
};
const userCreateSchema: RouteShorthandOptions['schema'] = {
  body: {
    type: 'object',

    required: ['name', 'password', 'email' , 'role', 'first_name', 'last_name', 'gender', 'phone'],

    properties: {
      name: { type: 'string', minLength: 3 },
      password: { type: 'string', minLength: 8 },
      email: { type: 'string'},
      image: { type: 'string' },
      role: {
        type: 'string',
        enum: ["student", "teacher", "parent", "principal", "hod", "staff", "admin"]
      },
      phone: { type: 'number' },
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      gender: { type: 'string', enum: ["male", "female", "other"] },

      student: {
        type: 'object',
        required: ['adm_number', 'adm_year', 'date_of_birth', 'department'],
        properties: {
          adm_number: { type: 'string' },
          adm_year: { type: 'number' },
          candidate_code: { type: 'string' },
          department: { type: 'string', enum: ["CSE", "ECE", "IT"] },
          date_of_birth: { type: 'string', format: 'date' },
        },
        additionalProperties: false,
      },

      teacher: {
        type: 'object',
        required: ['designation', 'date_of_joining'],
        properties: {
          designation: { type: 'string' },
          department: { type: 'string' },
          date_of_joining: { type: 'string', format: 'date' },
        },
        additionalProperties: false,
      },

      parent: {
        type: 'object',
        required: ['relation', 'childID'],
        properties: {
          relation: { type: 'string', enum: ["mother", "father", "guardian"] },
          childID: { type: 'string' },
        },
        additionalProperties: false,
      },
    },

    if: {
      properties: {
        role: { const: "student" }
      },
    },
    then: {
      required: ["student"]
    },

    if: {
      properties: {
        role: { const: "teacher" }
      },
    },
    then: {
      required: ["teacher"]
    },

    if: {
      properties: {
        role: { const: "parent" }
      },
    },
    then: {
      required: ["parent"]
    },

    else: {
      properties: {
        student: { not: {} },
        teacher: { not: {} },
        parent: { not: {} },
      }
    },

    additionalProperties: false,
  },
};

export default async function (fastify: FastifyInstance) {
  
 // api endpoint to view our profile
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
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

  }).addHook("preHandler", authMiddleware);
  // api endpoint to create new user account
  fastify.post("/", { schema: userCreateSchema }, async (request: FastifyRequest, reply: FastifyReply) => {

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
  // api endpoint to update the user account
  fastify.put("/", { schema: userUpdateSchema }, async (Request: FastifyRequest, reply: FastifyReply) => {
    try {
      const updatedBody = Request.body as {
        name?: string;
        password?: string;
        image?: string;
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
      console.log(1);
      
      if (updatedBody?.name || updatedBody?.image) {
        await auth.api.updateUser(Request, {
          body: {
            name: updatedBody.name,
            image: updatedBody.image,
          }
        });
      }
      console.log(2);
      
      const userInstance = await User.findByIdAndUpdate(Request.user.id, updatedBody, {
        new: true
      })

      if (updatedBody?.role == "student") {

        if (!updatedBody.student) {
          reply.status(404).send({
            "status_code": 404,
            "message": "Nothing to Update",
            "data": ""
          })
        }
        const student_record = await Student.findOne({ user: Request.user.id })
        if (!student_record) {
          reply.status(404).send({
            "status_code": 404,
            "message": "Student Record Not Found",
            "data": ""
          })
        }
        const studentInstance = await Teacher.findByIdAndUpdate(student_record?._id, updatedBody.student, {
          new: true
        })
      }
      else if (updatedBody?.role === "teacher" || updatedBody?.role === "principal" || updatedBody?.role === "hod" || updatedBody?.role === "admin" || updatedBody?.role === "staff") {

        if (!updatedBody.teacher) {
          reply.status(404).send({
            "status_code": 404,
            "message": "Nothing to Update",
            "data": ""
          })
        }
        const teacher_record = await Teacher.findOne({ user: Request.user.id })
        if (!teacher_record) {
          reply.status(404).send({
            "status_code": 404,
            "message": "Teacher Record Not Found",
            "data": ""
          })
        }
        const teacherInstance = await Teacher.findByIdAndUpdate(teacher_record?._id, updatedBody.teacher, {
          new: true
        })
      }

      else if (updatedBody?.role == "parent") {

        if (!updatedBody.parent) {
          reply.status(404).send({
            "status_code": 404,
            "message": "Nothing to Update",
            "data": ""
          })
        }
        const parent_record = await Parent.findOne({ user: Request.user.id })
        if (!parent_record) {
          reply.status(404).send({
            "status_code": 404,
            "message": "Teacher Record Not Found",
            "data": ""
          })
        }
        const parentInstance = await Parent.findByIdAndUpdate(parent_record?._id, updatedBody.parent, {
          new: true
        })
      }

      reply.status(200).send({
        "status_code": 200,
        "message": "User Record Updated Successfully",
        "data": ""
      })
    } catch (e) {
      reply.status(404).send({
        "status_code": 404,
        "message": "Some Error Occured",
        "data": e
      })
    }


  })
  // api endpoints for admin controlled (ADMIN ONLY ROUTE)
  fastify.register(async (adminRoutes) => {

    adminRoutes.addHook("preHandler", isAdmin);


    // ADMIN UPDATE USER
    adminRoutes.put("/:id", { schema: userUpdateSchema }, async (Request, reply) => {
   
      try {
        const updatedBody = Request.body as any;

        if (updatedBody?.name || updatedBody?.image) {
          await auth.api.updateUser(Request, {
            body: {
              name: updatedBody.name,
              image: updatedBody.image,
            }
          });
        }

        await User.findByIdAndUpdate(Request.params.id, updatedBody, { new: true });

        reply.status(200).send({
          status_code: 200,
          message: "User Record Updated Successfully",
          data: ""
        });

      } catch (e) {
        reply.status(404).send({
          status_code: 404,
          message: "Some Error Occured",
          data: e
        });
      }
    });


    // ADMIN DELETE USER
    adminRoutes.delete("/:id", async (request, reply) => {
      // SAME LOGIC, only moved here
      try {
        const UserID = request.params.id;

        await authClient.admin.removeUser({ userId: UserID });

        const user = await User.findById(UserID);
        await User.findByIdAndDelete(UserID);

        if (user?.role === "student") {
          const STID = await Student.findOne({ user: user._id });
          await Student.deleteOne({ user: user._id });
          await Parent.deleteOne({ child: STID });
        }

        if (user?.role === "parent") {
          await Parent.deleteOne({ user: user._id });
        }

        if (["teacher", "principal", "hod", "admin", "staff"].includes(user?.role)) {
          await Teacher.deleteOne({ user: user._id });
        }

        return reply.status(204).send({
          status_code: 204,
          message: "Successfully Deleted The User",
          data: ""
        });

      } catch (e) {
        return reply.send({
          status_code: 404,
          message: "Can't delete the user",
          error: e
        });
      }
    });

  });


}