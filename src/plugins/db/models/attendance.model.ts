import mongoose from "mongoose";


const { Schema, model } = mongoose;

const attendanceRecordSubSchema = new Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: ["present", "absent", "late", "excused"]
        },
        remarks: { type: String },
        marked_at: { type: Date, required: true },
    },
    { _id: true }
);

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
            ref: "User", 
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
        records: [attendanceRecordSubSchema],
        sem: { type: String, required: true },
        archived: { type: Boolean, default: false },
        createdAt: { type: Date, required: true },
		updatedAt: { type: Date, required: true },

    },
    {
        collection : "attendance_session"
    }
)

// Covers the "student attendance summary" query.
attendanceSessionSchema.index({ "records.student": 1, subject: 1, batch: 1 });

// Covers session listing queries filtered by batch/subject with time-based sort.
attendanceSessionSchema.index({ archived: 1, batch: 1, subject: 1, start_time: -1 });

// Covers the teacher dashboard "recent sessions" query (getRecentSessions).
attendanceSessionSchema.index({ archived: 1, created_by: 1, start_time: -1 });

// Covers the archive-trigger bulk update in advanceSemHandler (batch + sem lookup).
attendanceSessionSchema.index({ batch: 1, sem: 1 });

const AttendanceSession = model("AttendanceSession", attendanceSessionSchema);

export { AttendanceSession };