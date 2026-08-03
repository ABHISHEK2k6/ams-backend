import mongoose from "mongoose";


const { Schema, model } = mongoose;

const gradeFieldSchema = new Schema(
    {
        _id : { type: String, default: () => new mongoose.Types.ObjectId().toString() },
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
        type : {
			type: String,
			required:true,
			enum: ["exam", "assignment", "practical" , "attendance", "moderation"]
		},
        name: { type: String, required: true },
        total_mark : {
            type: Number,
            required: function (this: { type: string }) {
                return this.type !== "moderation";
            },
        },
        weightage : { type: Number, required: true },
        // Whether students/parents can see this column and its marks yet —
        // teachers keep working on it privately until they toggle this on.
        published : { type: Boolean, required: true, default: false },
        value : {
            type : String,
            required : false,
        },
        // Only meaningful for type="assignment" — the assignment's brief/instructions.
        description : {
            type : String,
            required : false,
        },
        // Only meaningful for type="assignment" — when marks are due; purely informational,
        // does not gate mark entry (teachers can still enter marks after this date).
        due_date : {
            type : Date,
            required : false,
        },
    },
    { collection: "grade_field" },
);

gradeFieldSchema.pre('save', function(next) {
    if (this.type != "moderation") {
       this.value = "";
    }

    if(this.type === "moderation" && (this.value === null || this.value === undefined || this.value === "")) {
        return next(new Error("Value is required for moderation type"));
    }

    if (this.type != "assignment") {
        this.description = undefined;
        this.due_date = undefined;
    }

    if (this.type === "moderation") {
        this.total_mark = undefined;
        this.weightage = 0;
    }

    next();
});


const gradeEntrySchema = new Schema(
    {
        _id : { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        user : {
            type: mongoose.Schema.Types.ObjectId, 
            ref: "User", 
            required:true,
        },
        grade_field : {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GradeField",
            required:true,
        },
        mark : {type:Number,reuired:true},
        is_absent : {type: Boolean,required:true},
        remarks : { type: String },
        updated_at : { type: Date, required: true },
    },
    { collection: "grade_entry" },
);  


const GradeField = model("GradeField", gradeFieldSchema);
const GradeEntry = model("GradeEntry", gradeEntrySchema);

export { GradeField, GradeEntry };