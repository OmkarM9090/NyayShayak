import jwt from "jsonwebtoken";
import User from "../../models/User.js";

export async function createUserAndToken() {
  const unique = Date.now();
  const user = await User.create({
    name: `Test User ${unique}`,
    email: `user${unique}@example.com`,
    password: "hashed_password",
    preferredLanguage: "en",
  });

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { user, token };
}
