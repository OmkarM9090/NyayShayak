import User from '../models/User.js';
import { resolveLanguage } from "../config/languages.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Signup Controller
export const signup = async (req, res) => {
    const { name, email, password, preferredLanguage } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "User already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            preferredLanguage: resolveLanguage(preferredLanguage),
        });
        await newUser.save();

        res.status(201).json({ msg: "User registered successfully" });
    } catch (err) {
        res.status(500).json({ msg: "Signup Error", error: err.message });
    }
};

// Login Controller
export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

        const token = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                preferredLanguage: user.preferredLanguage || "en",
            }
        });
    } catch (err) {
        console.error("Detailed Login Error:", err.message);
        res.status(500).json({ msg: "Login Error", error: err.message });
    }
};

export const updateLanguagePreference = async (req, res) => {
    try {
        const { userId, preferredLanguage } = req.body ?? {};
        if (!userId) {
            return res.status(400).json({ msg: "User ID is required" });
        }

        const resolved = resolveLanguage(preferredLanguage);
        const user = await User.findByIdAndUpdate(
            userId,
            { preferredLanguage: resolved },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        return res.status(200).json({
            success: true,
            preferredLanguage: user.preferredLanguage,
        });
    } catch (err) {
        res.status(500).json({ msg: "Update Error", error: err.message });
    }
};