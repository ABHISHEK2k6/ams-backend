import mongoose from "mongoose";
import { string } from "zod";
import { required } from "zod/mini";


const {Schema , model } = mongoose;


const batchSchema = new Schema(
    {
        name : {type: String, required : true},
        adm_year: { type: Number, required: true },
        department: { 
			type: String, 
			required:true,
			enum: ["CSE", "ECE", "IT"]
		},
        staff_advisor : { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    },
    { collection: "batch" },
);


const subjectSchema = new Schema(
    {
        _id: { type: String },
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