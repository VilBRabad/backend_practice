import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema({

   videoFile: {
      type: String, // Cloudinary URL
      required: true
   },
   title: {
      type: String,
      required: true
   },
   description: {
      type: String
   },
   thumbnail: {
      type: String,
      required: true
   },
   onwer: {
      type: Schema.Types.ObjectId,
      ref: "User"
   },
   duration: {
      type: Number,
      default: 0
   },
   views: {
      type: Number,
      default: 0
   },
   isPublished: {
      type: Boolean,
      default: true
   }
}, {timestamps: true});


videoSchema.plugin(mongooseAggregatePaginate());

export const Video = mongoose.model("Video", videoSchema);