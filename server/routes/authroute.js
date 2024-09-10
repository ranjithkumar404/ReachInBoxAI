const { glogin } = require('../controller/authcontroller');

const router=require('express').Router();

router.get('/test',(req,res)=>{
    res.send('Login')
})

router.post('/google',glogin)

module.exports=router;