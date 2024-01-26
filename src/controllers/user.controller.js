import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

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

export {
   registerUser,
   loginUser,
   logoutUser,
   refereshAccessToken
}