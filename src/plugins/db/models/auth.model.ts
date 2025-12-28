import mongoose, { mongo, InferSchemaType } from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
	{
		_id: { type: mongoose.Schema.Types.ObjectId },
		name: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		emailVerified: { type: Boolean, required: true },
		image: { type: String },
		createdAt: { type: Date, required: true },
		updatedAt: { type: Date, required: true },
		first_name: { type: String, required: true },
		last_name: { type: String, required: true },
		role: { 
			type: String, 
			required: true,
			default: "student",
			enum: ["student", "teacher", "parent", "principal", "hod", "staff", "admin"]
		},
		gender: { 
			type: String, 
			required: false,
			enum: ["male", "female", "other"]
		},
		phone : {type: Number, required: true},
		password_hash: { type: String, required: false },
	},
	{ collection: "user" },
);




userSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  // 'this' refers to the document being removed
  try {
	if (this.role == "student"){
    	await Student.deleteOne({ user: this._id });
	}
	else if (this.role == "parent"){
		await Parent.deleteOne({ user: this._id });
	}
	else if (this.role === "teacher" || this.role === "principal" || this.role === "hod" || this.role === "admin" || this.role === "staff") {
		await Teacher.deleteOne({user: this._id});
	}
    next();
  } catch (error) {
    console.error("Cascading delete failed:", error);
    next(new Error("An unknown error occurred during cascading delete.")); // Pass the error to stop the main delete operation
  }
});



const sessionSchema = new Schema(
	{
		_id: { type: String },
		expiresAt: { type: Date, required: true },
		token: { type: String, required: true, unique: true },
		createdAt: { type: Date, required: true },
		updatedAt: { type: Date, required: true },
		ipAddress: { type: String },
		userAgent: { type: String },
		userId: { type: String, ref: "User", required: true },
	},
	{ collection: "session" },
);

const accountSchema = new Schema(
	{
		_id: { type: String },
		accountId: { type: String, required: true },
		providerId: { type: String, required: true },
		userId: { type: String, ref: "User", required: true },
		accessToken: { type: String },
		refreshToken: { type: String },
		idToken: { type: String },
		accessTokenExpiresAt: { type: Date },
		refreshTokenExpiresAt: { type: Date },
		scope: { type: String },
		password: { type: String },
		createdAt: { type: Date, required: true },
		updatedAt: { type: Date, required: true },
	},
	{ collection: "account" },
);

const verificationSchema = new Schema(
	{
		_id: { type: String },
		identifier: { type: String, required: true },
		value: { type: String, required: true },
		expiresAt: { type: Date, required: true },
		createdAt: { type: Date },
		updatedAt: { type: Date },
	},
	{ collection: "verification" },
);

const studentSchema = new Schema(
	{
		// _id: { type: String },
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		adm_number : {type: String, required: true , unique: true },
		adm_year: { type: Number, required: true },
		candidate_code: { type: String, required: true , unique: true },
		department: { 
			type: String, 
			required:true,
			enum: ["CSE", "ECE", "IT"]
		},
		date_of_birth: { type: Date, required: true },
		batch : {type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
	},
	{ collection: "student" },
);

const teacherSchema = new Schema(
	{
		// _id: { type: String },
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		designation : {type: String, required: true},
		department: { type: String, required: true },
		date_of_joining: { type: Date, required: true },
	},
	{ collection: "teacher" },
);

const parentSchema = new Schema(
	{
		// _id: { type: String },
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		child: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
		relation: { 
			type: String, 
			required: true,
			enum: ["mother", "father", "guardian"]
		},
	},
	{ collection: "parent" },
);

const User = model("User", userSchema);
const Session = model("Session", sessionSchema);
const Account = model("Account", accountSchema);
const Verification = model("Verification", verificationSchema);
const Student = model("Student", studentSchema);
const Teacher = model("Teacher", teacherSchema);
const Parent = model("Parent", parentSchema);

export type UserType = InferSchemaType<typeof userSchema>;
export type SessionType = InferSchemaType<typeof sessionSchema>;

export { User, Session, Account, Verification, Student, Teacher, Parent };
