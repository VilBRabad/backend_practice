import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefereshTokens = async(userId) =>{
   try {
       const user = await User.findById(userId)
       console.log("Vilas");
       const accessToken = await user.generateAccessToken()
       const refreshToken = await user.generateRefreshToken()

       user.refreshToken = refreshToken
       await user.save({ validateBeforeSave: false })

       return {accessToken, refreshToken}


   } catch (error) {
       throw new ApiError(500, "Something went wrong while generating referesh and access token")
   }
}


const registerUser = asyncHandler(async (req, res) => {

   const { fullName, email, username, password } = req.body
   // console.log("email: ", email);
   // console.log(req.body);

   if (
      [fullName, email, username, password].some((field) => field?.trim() === "")
   ) {
      throw new ApiError(400, "All fields are required")
   }
  
   const existedUser = await User.findOne({
      $or: [{ username }, { email }]
   })
   
   if (existedUser) {
      throw new ApiError(409, "User with email or username already exists")
   }
   
   const avatarLocalPath = req.files?.avatar[0]?.path;
   // const coverImageLocalPath = req.files?.coverImage[0]?.path;

   let coverImageLocalPath;
   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
      coverImageLocalPath = req.files.coverImage[0].path;
   }

   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is required")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)

   if (!avatar) {
      throw new ApiError(400, "Avatar file is required")
   }

   const user = await User.create({
      fullName,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email, 
      password,
      username: username.toLowerCase()
   })

   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
   )
   // console.log("vilas");
   if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering the user")
   }

   return res.status(201).json(
      new ApiResponse(200, createdUser, "User registered Successfully")
   )

})


const loginUser = asyncHandler( async(req, res)=>{

   const {username, email, password} = req.body;

   if(!(username || email)){
      throw new ApiError(400, "username or email is required!");
   }

   const user = await User.findOne({
      $or: [{username}, {email}]
   })

   if(!user){
      throw new ApiError(404, "User does not exists!");
   }

   const isPasswordValid = await user.isPasswordCorrect(password);
   
   if(!isPasswordValid){
      throw new ApiError(401, "Invalid Credentials!");
   }

   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id);

   const loggedInUser = await User.findOne(user._id).select("-password -refreshToken");

   const options = {
      httpOnly: true,
      secure: true
   };

   return res.status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", refreshToken, options)
   .json(
      new ApiResponse(
         200,
         {
            user: loggedInUser, 
            accessToken, 
            refreshToken
         },
         "User Logged in successfully"
      )
   )

})


const logoutUser = asyncHandler(async(req, res)=>{
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            refreshToken: undefined
         }
      },
      {
         new: true
      }
   )

   const options = {
      httpOnly: true,
      secure: true
   }

   return res.status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json( new ApiResponse(200, {}, "User Logged Out"));
})


const refereshAccessToken = asyncHandler(async(req, res)=>{
   const token = req.cookie.refereshToken || req.body.refreshToken;

   if(!token){
      throw new ApiError(401, "unauthorized access");
   }

   try {
      const decodedToke = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
   
      const user = await User.findById(decodedToke?._id);
   
      if(!user){
         throw new ApiError(40, "Invalid Refresh Token!");
      }
   
      if(token !== user?.refreshToken){
         throw new ApiError(401, "Token is expire or used!");
      }
   
      const options = {
         httpOnly: true,
         secure: true
      }
   
      const {newRefreshToken, accessToken} = await generateAccessAndRefereshTokens(user._id);
   
      return res.status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
         new ApiResponse(
            200, 
            {
               accessToken, 
               refreshToken: newRefreshToken
            },
            "Access Token refresh"
         )
      )

   } catch (error) {
      throw new ApiError(401, error?.message || "Invalid refresh token");
   }


})


const changeCurrentPasswor = asyncHandler(async (req, res)=>{
   const {oldPassword, newPassword} = req.body;

   const user = await User.findById(req.body?._id);
   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

   if(!isPasswordCorrect){
      throw new ApiError(400, "Invalid old password");
   }

   user.password = newPassword;
   await user.save({validateBeforeSave: false});

   return res
   .status(200)
   .json(new ApiResponse(200, {}, "Password changed successfully"));
})


const getCurrentUser = asyncHandler(async(req, res)=>{
   return res
   .status(200)
   .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
})

//User updatation details endpoints
const updateAccountDetails = asyncHandler(async(req, res)=>{
   const {fullName, email} = req.body;

   if(!fullName && !email){
      throw new ApiError(401, "All fields are required");
   }

   const user = User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            fullName: fullName,
            email: email
         }
      },
      {new: true}
   ).select("-password -refreshToken");

   return res
   .status(200)
   .json(new ApiResponse(200, user, "Account details updated successfully"));
})

const updateUserAvatar = asyncHandler(async(req, res)=>{
   const localFilePath = req.file?.path;

   if(!localFilePath){
      throw new ApiError(401, "Avatar file is missing");
   }

   const avatar = await uploadOnCloudinary(localFilePath);

   if(!avatar.url){
      throw new ApiError(400, "Error while uploading avatar");
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            avatar: avatar.url
         }
      },
      {new: true}
   ).select("-password -refreshToken");


   return res
   .status(200)
   .json(new ApiResponse(200, user, "Avatar image updated successfully"));
})

const updateUserCoverImage = asyncHandler(async(req, res)=>{
   const localFilePath = req.file?.path;

   if(!localFilePath){
      throw new ApiError(401, "Cover file is missing");
   }

   const coverImage = await uploadOnCloudinary(localFilePath);

   if(!coverImage.url){
      throw new ApiError(400, "Error while uploading avatar");
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            coverImage: coverImage.url
         }
      },
      {new: true}
   ).select("-password -refreshToken");


   return res
   .status(200)
   .json(new ApiResponse(200, user, "Cover Image updated successfully"));
})


//Mongodb pipeline:
const getChannelProfile = asyncHandler(async(req, res)=>{
   const username = req.params;

   if(!username?.trim()){
      throw new ApiError(400, "Username is missing");
   }

   const channel = await User.aggregate([
      {
         $match: {
            username: username?.toLowerCase()
         }
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
         }
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
         }
      },
      {
         $addFields: {
            subscribersCount: {
               $size: "$subscribers"
            },
            channelsSubsribedToCount: {
               $size: "$subscribedTo"
            },
            isSubscribed: {
               $cond: {
                  if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                  then: true,
                  else: false
               }
            }
         }
      },
      {
         $project: {
            fullName: 1,
            username: 1,
            email: 1,
            subscribersCount: 1,
            channelsSubsribedToCount: 1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1
         }
      }
   ])

   if(!channel?.length){
      throw new ApiError(400, "Channel does not exists");
   }

   console.log(channel);

   return res
   .status(200)
   .json(new ApiResponse(200, channel[0], "channel fetch successfully"));
})

const getWatchHistory = asyncHandler(async(req, res)=>{
   const user = await User.aggregate([
      {
         $match: {
            _id: mongoose.Types.ObjectId(req.user._id)
         }
      },
      {
         $lookup: {
            from: "videos",
            localField: "watchHistory",
            foreignField: "_id",
            as: "watchHistory",
            pipelie: [
               {
                  $lookup: {
                     from: "users",
                     locaField: "owner",
                     foreignField: "_id",
                     as: "owner",
                     pipelie: [
                        {
                           $project: {
                              fullName: 1,
                              username: 1,
                              avatar: 1
                           }
                        }
                     ]
                  }
               }
            ]
         }
      },
      {
         $addFields: {
            owner: {
               $first: "$owner"
            }
         }
      }
   ])

   return res
   .status(200)
   .json( new ApiResponse(200, user[0].watchHistory, "watchHistory fetched successfully"));
})

export {
   registerUser,
   loginUser,
   logoutUser,
   refereshAccessToken,
   changeCurrentPasswor,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage,
   getChannelProfile,
   getWatchHistory
}