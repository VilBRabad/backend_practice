import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema({
   username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
   },
   email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
   },
   fullName: {
      type: String,
      required: true,
      trim: true,
      index: true
   },
   avatar: {
      type: String, // Cloudinary url
      required: true
   },
   coverImage: {
      type: String
   },
   password: {
      type: String,
      required: [true, "Password is required"]
   },
   refreshToken: {
      type: String
   },
   watchHistory: [
      {
         type: Schema.Types.ObjectId,
         ref: "Video"
      }
   ]
}, {timestamps: true})


export const User = mongoose.model("User", userSchema);