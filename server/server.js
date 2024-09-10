const express = require('express');
const app = express();
require('dotenv').config();
const authRoutes=require('./routes/authroute');
const mongoose = require('mongoose');

app.use('/auth',authRoutes);

const connect=async()=>{
    await mongoose.connect(process.env.URL).then(()=>{
    console.log('Connected to MongoDB')}).catch((err)=>{
        console.log("Error while connecting to DB",err)
    })
}



app.listen(3001, () => {
    connect();
  console.log(`Server running on port 3001`);
});
