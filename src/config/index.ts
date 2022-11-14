import dotenv from 'dotenv';

dotenv.config();


const config = {
    PORT: process.env.PORT || 8001,                         // port the server listens on
    NODE_ENV: process.env.NODE_ENV || 'development',        // mode to run the server in, 'production' or 'development'
};

export default config;