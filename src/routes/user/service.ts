import { FastifyRequest, FastifyReply } from "fastify";
import { Parent, Student, Teacher, User } from "@/plugins/db/models/auth.model";
import { auth } from "@/plugins/auth";
import { authClient } from "@/plugins/auth";

export const getUser = async (
  request: FastifyRequest<{ Params: { id?: string } }>,
  reply: FastifyReply
) => {
  try {
    const userId = request.params.id || request.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return reply.status(404).send({
        status_code: 404,
        message: "User not found",
        data: "",
      });
    }

    const userRole = user.role;
    if (userRole === "student") {
      const student_profile = await Student.findOne({
        user: userId,
      }).populate(
        "user",
        "name email image gender first_name last_name role phone createdAt updatedAt"
      );

      // if data is not added to DB, show the signup form in the frontend.
      if (!student_profile)
        return reply.status(422).send({
          status_code: 422,
          message: "Student data need to be added.",
          data: {user},
        });

      return reply.send({
        status_code: 200,
        message: "User profile fetched successfully",
        data: student_profile,
      });
    } else if (
      userRole === "teacher" ||
      userRole === "principal" ||
      userRole === "hod" ||
      userRole === "admin" ||
      userRole === "staff"
    ) {
      const teacher_profile = await Teacher.findOne({
        user: userId,
      }).populate(
        "user",
        "name email image gender first_name last_name role phone createdAt updatedAt"
      );

      if (!teacher_profile)
        return reply.status(422).send({
          status_code: 422,
          message: "Teacher data need to be added.",
          data: {user},
        });

      return reply.send({
        status_code: 200,
        message: "User profile fetched successfully",
        data: teacher_profile,
      });
    } else if (userRole === "parent") {
      const parent_profile = await Parent.findOne({ user: userId })
        .populate(
          "user",
          "name email image gender first_name last_name role phone createdAt updatedAt"
        )
        .populate(
          "child",
          "adm_number adm_year candidate_code department date_of_birth"
        )
        .populate({
          path: "child",
          populate: {
            path: "user",
            select:
              "name email image gender first_name last_name role phone createdAt updatedAt",
          },
        });

      if (!parent_profile)
        return reply.status(422).send({
          status_code: 422,
          message: "Parent data need to be added.",
          data: {user},
        });

      return reply.send({
        status_code: 200,
        message: "User profile fetched successfully",
        data: parent_profile,
      });
    }
  } catch (e) {
    return reply.send({
      status_code: 204,
      error: e,
      data: "",
    });
  }
};

export const createUser = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const {
      name,
      image,
      phone,
      first_name,
      last_name,
      gender,
      student,
      teacher,
      parent,
    } = request.body as {
      name: string;
      email: string;
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
      };
      parent?: {
        relation?: string;
        childID?: string;
      };
    };

    const userId = request.user.id;

    const user_instance = await User.findByIdAndUpdate(
      { _id: userId },
      {
        name,
        phone,
        image,
        gender,
        first_name,
        last_name,
        updatedAt: new Date(),
      }
    );

    if (!user_instance)
      return reply.status(404).send({
        status_code: 404,
        message: "User not found",
        data: "",
      });

    if (user_instance.role == "student") {
      const std_record = new Student({
        user: user_instance._id,
        adm_number: student?.adm_number,
        adm_year: student?.adm_year,
        candidate_code: student?.candidate_code,
        department: student?.department,
        date_of_birth: student?.date_of_birth,
      });

      await std_record.save();
      return reply.status(201).send({
        status_code: 201,
        message: "Student User created successfully",
        data: "",
      });
    } else if (["teacher", "principal", "hod", "admin", "staff"].includes(user_instance.role)) {
      const teacher_record = new Teacher({
        user: user_instance._id,
        designation: teacher?.designation,
        department: teacher?.department,
        date_of_joining: teacher?.date_of_joining,
      });
      await teacher_record.save();

      return reply.status(201).send({
        status_code: 201,
        message: "User created successfully",
        data: "",
      });
    } else if (user_instance.role == "parent") {
      const child_instance = await Student.findById(parent?.childID);
      if (!child_instance)
        return reply.status(404).send({
          status_code: 404,
          message: "Invalid User ID for child. Not found.",
          data: "",
        });

      const parent_record = new Parent({
        user: user_instance._id,
        child: child_instance,
        relation: parent?.relation,
      });

      await parent_record.save();

      return reply.status(201).send({
        status_code: 201,
        message: "User created successfully",
        data: "",
      });
    }

    return reply.status(500).send({
      status_code: 500,
      message: "An error occurred while creating the user",
      data: "",
    });
  } catch (e) {
    return reply.status(500).send(e);
  }
};

export const updateUser = async (
  request: FastifyRequest<{ Params: { id?: string } }>,
  reply: FastifyReply
) => {
  try {
    const userId = request.params.id || request.user.id;

    const updatedBody = request.body as {
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
      };
      parent?: {
        relation?: string;
        childID?: string;
      };
    };

    if (updatedBody?.name || updatedBody?.image) {
      await auth.api.updateUser({
        body: {
          name: updatedBody.name,
          image: updatedBody.image,
        },
        headers: request.headers,
      });
    }

    await User.findByIdAndUpdate(userId, updatedBody, {
      new: true,
    });

    if (updatedBody?.role == "student") {
      if (!updatedBody.student) {
        reply.status(404).send({
          status_code: 404,
          message: "Nothing to Update",
          data: "",
        });
      }
      const student_record = await Student.findOneAndUpdate(
        { user: userId },
        updatedBody.student,
        { new: true }
      );
      if (!student_record)
        reply.status(404).send({
          status_code: 404,
          message: "Student Record Not Found",
          data: "",
        });
    } else if (
      updatedBody?.role === "teacher" ||
      updatedBody?.role === "principal" ||
      updatedBody?.role === "hod" ||
      updatedBody?.role === "admin" ||
      updatedBody?.role === "staff"
    ) {
      if (!updatedBody.teacher) {
        reply.status(404).send({
          status_code: 404,
          message: "Nothing to Update",
          data: "",
        });
      }
      const teacher_record = await Teacher.findOne({
        user: userId,
      });
      if (!teacher_record) {
        reply.status(404).send({
          status_code: 404,
          message: "Teacher Record Not Found",
          data: "",
        });
      }
      const teacherInstance = await Teacher.findByIdAndUpdate(
        teacher_record?._id,
        updatedBody.teacher,
        {
          new: true,
        }
      );
    } else if (updatedBody?.role == "parent") {
      if (!updatedBody.parent) {
        reply.status(404).send({
          status_code: 404,
          message: "Nothing to Update",
          data: "",
        });
      }
      const parent_record = await Parent.findOne({ user: userId });
      if (!parent_record) {
        reply.status(404).send({
          status_code: 404,
          message: "Teacher Record Not Found",
          data: "",
        });
      }
      const parentInstance = await Parent.findByIdAndUpdate(
        parent_record?._id,
        updatedBody.parent,
        {
          new: true,
        }
      );
    }

    reply.status(200).send({
      status_code: 200,
      message: "User Record Updated Successfully",
      data: "",
    });
  } catch (e) {
    reply.status(404).send({
      status_code: 404,
      message: "Some Error Occured",
      data: e,
    });
  }
};

export const deleteUser = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
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

    if (
      user?.role &&
      ["teacher", "principal", "hod", "admin", "staff"].includes(user.role)
    ) {
      await Teacher.deleteOne({ user: user._id });
    }

    return reply.status(204).send({
      status_code: 204,
      message: "Successfully Deleted The User",
      data: "",
    });
  } catch (e) {
    return reply.send({
      status_code: 404,
      message: "Can't delete the user",
      error: e,
    });
  }
};
