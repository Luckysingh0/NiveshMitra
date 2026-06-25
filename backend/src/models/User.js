import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Friend" },
    email: { type: String, default: null },
    // Set when the user signs in with Google (the Google account "sub" id).
    googleId: { type: String, default: null, index: true },
    picture: { type: String, default: null },
    // Basic details collected via the post-login form.
    age: { type: Number, default: null },
    city: { type: String, default: null },
    occupation: { type: String, default: null },
    phone: { type: String, default: null },
    basicInfoComplete: { type: Boolean, default: false },
    // Anonymous session id from the frontend so we can demo without auth.
    sessionId: { type: String, required: true, unique: true, index: true },
    onboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
