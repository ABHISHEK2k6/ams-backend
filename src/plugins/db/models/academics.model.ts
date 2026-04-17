import mongoose from "mongoose";


const {Schema , model } = mongoose;


const batchSchema = new Schema(
    {
        name : {type: String, required : true},
        id: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
            match: [/^[0-9]{2}[A-Z]{2,3}[0-9]*$/, "Invalid batch id format"],
        },
        adm_year: { type: Number, required: true },
        department: { 
			type: String, 
			required:true,
			enum: ["CSE", "ECE", "IT"]
		},
        staff_advisor : { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    },
    { collection: "batch" },
);


const subjectSchema = new Schema(
    {
        name: { type: String, required: true },
        sem : {type: String, required : true},
        subject_code: { type: String, required: true },
        type: { 
			type: String, 
			required:true,
			enum: ["Theory", "Practical"]
		},
        total_marks: {type: Number, required: true},
        pass_mark: {type: Number, required: true},
        faculty_in_charge : [{type:String, required:true}], // using this for storing array of teahers names.
    },
    { collection: "subject" },
);


const Batch = model("Batch", batchSchema);
const Subject = model("Subject", subjectSchema);

export { Batch, Subject };