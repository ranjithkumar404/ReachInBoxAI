const { oauth2Client } = require('../utils/gconfig');
const axios = require('axios');
const UserModel = require('../models/usermodel');
const jwt = require('jsonwebtoken');

const glogin = async (req, res) => {
    try {
        const { code } = req.query;
        const gres = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(gres.tokens);

        // Destructure tokens
        const { access_token, refresh_token } = gres.tokens;

        // Fetch user info
        const ures = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`);
        const { email, name, picture } = ures.data;

        // Find or create user
        let user = await UserModel.findOne({ email });
        if (!user) {
            user = await UserModel.create({ name, email, image: picture, access_token, refresh_token });
        } else {
            // Update tokens if user exists
            user.access_token = access_token;
            user.refresh_token = refresh_token;
            await user.save();
        }

        // Generate JWT token
        const { _id } = user;
        const token = jwt.sign({ id: _id, email }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_TIMEOUT
        });

        return res.status(200).json({
            message: 'success',
            token,
            user
        });
    } catch (error) {
        console.error('Error in Google login:', error);
        res.status(500).json({
            message: 'Internal Server Error'
        });
    }
};

module.exports = { glogin };
