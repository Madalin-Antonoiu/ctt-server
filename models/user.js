//Definition of what a user is to tell Mongoose
import mongoose, { Schema } from "mongoose";
const schema = mongoose.Schema;

// Define our model
const userSchema = new Schema({
  email: { type: String, unique: true, lowercase: true },
  password: String,
});

// Create the model class
const ModelClass = mongoose.model("user", userSchema);

// Export the model
export default ModelClass;
