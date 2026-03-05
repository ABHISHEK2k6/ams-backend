import mongoose from "mongoose";
import { string } from "zod";
import { required } from "zod/mini";


const { Schema, model } = mongoose;

const attendanceSessionSchema  = new Schema(
    {
        batch : {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
            required:true,
        },
        subject : {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
            required:true,
        },
        created_by : { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Teacher", 
            required: true 
        },
        start_time : { type: Date, required: true },
        end_time : { type: Date, required: true },
        hours_taken : { type: Number, required: true },
        session_type : { 
			type: String, 
			required:true,
			enum: ["regular", "extra", "practical"]
		},
        createdAt: { type: Date, required: true },
		updatedAt: { type: Date, required: true },

    },
    {
        collection : "attendance_session"
    }
) 


const attendanceRecordSchema  = new Schema(
    {
        student : {
            type: mongoose.Schema.Types.ObjectId,
            ref:"Student",
            required:true,
        },
        session : {
            type: mongoose.Schema.Types.ObjectId,
            ref:"AttendanceSession",
            required:true,
        },
        marked_by : {
            type: mongoose.Schema.Types.ObjectId,
            ref:"Teacher",
            required:true,
        },
        status: {
			type: String, 
			required:true,
			enum: ["present", "absent", "late", "excused"]
		},
        remarks : { type: String },
        marked_at: { type: Date, required: true },
    },
    {
        collection : "attendance_record"
    },
)


const AttendanceSession = model("AttendanceSession", attendanceSessionSchema);
const AttendanceRecord = model("AttendanceRecord", attendanceRecordSchema);

export { AttendanceSession, AttendanceRecord };