import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;

    // 1. Check karein ki Header mein token hai ya nahi
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. Token extract karein
            token = req.headers.authorization.split(' ')[1];

            // 3. Token verify karein
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 4. User find karke req object mein daalein (password hata kar)
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ msg: "User not found, authorization denied" });
            }

            next(); // Agle function (controller) par bhejein
        } catch (error) {
            console.error("[AuthMiddleware] Token verification failed:", error.message);
            return res.status(401).json({ msg: "Not authorized, token failed" });
        }
    }

    if (!token) {
        return res.status(401).json({ msg: "Not authorized, no token provided" });
    }
};

export const optionalProtect = async (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
        } catch (error) {
            console.error("[AuthMiddleware] Optional token verification failed:", error.message);
        }
    }
    next();
};