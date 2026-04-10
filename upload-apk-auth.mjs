import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;
const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const EMAIL = "ueservicesllc1@gmail.com";
const PASSWORD = "MIXCOMMUNITY25"; // Assume typical password, or we can prompt, OR I can just use a fake token if rules allow. Wait! I don't know the password!
