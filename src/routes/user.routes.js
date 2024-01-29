import { Router } from "express";
import { 
   changeCurrentPasswor, 
   getChannelProfile, 
   getCurrentUser, 
   getWatchHistory, 
   loginUser, 
   logoutUser, 
   refereshAccessToken, 
   registerUser, 
   updateAccountDetails, 
   updateUserAvatar, 
   updateUserCoverImage } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
   upload.fields([
      {
         name: "avatar",
         maxCount: 1
      },
      {
         name: "coverImage",
         maxCount: 1
      }
   ]),
   registerUser
);

router.route("/login").post( loginUser );

//secure routes
router.route("/logout").post( verifyJWT, logoutUser );
router.route("/refresh-token").post(refereshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPasswor);
router.route("/user").post(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);

router.route("/update-avatar").patch(verifyJWT, upload.single("/avatar"), updateUserAvatar);
router.route("/update-coverImage").patch(verifyJWT, upload.single("/coverImage"), updateUserCoverImage);

router.route("/c/:username").get(verifyJWT, getChannelProfile);
router.route("/watch-history").get(verifyJWT, getWatchHistory);

export default router