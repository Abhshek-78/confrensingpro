import mongoose, { Schema } from "mongoose";
const meetingSchema= new Schema(
    {
        user_Id:{
            type:String,
            
        },
        meetingid:{
            type:String,
            require:true
        },
        date:{
            type:Date,
            default:Date.now ,
            require:true,
        }
    }
)
const Meeting =mongoose.model("Meeting",meetingSchema);
export {Meeting}; //it use becuse we take many thing so we not use export default