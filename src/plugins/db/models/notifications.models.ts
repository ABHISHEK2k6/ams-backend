import mongoose, { mongo, InferSchemaType } from "mongoose";

const { Schema, model } = mongoose;


const notificationSchema = new Schema(
    {
        targetID : {
            type: String, 
            null:true
        },
        targetUsers : [{
            type:String, 
            null:true 
        }],
        targetGroup : {
            type: String,
            enum: [ "college", "year", "batch", "department"]
        },
        title : {
            type:String
        },
        message : {
            type:String
        },
        priorityLevel : {
            type:String, 
            enum: [ "High", "Medium","Low",]
        },
        Notificationtype : {
            type : String,
            enum : [ "announcement", "info", "results"]
        }
    },
    { collection: "notification" },
)

const Notification = model("Notification", notificationSchema);

export {Notification}