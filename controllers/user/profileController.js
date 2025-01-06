const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
require("dotenv").config();
const session = require("express-session");
const {generatevoice} = require('../../utils/invoiceUtils');
const STATUS_CODES = require("../../constants/statusCodes");

function generateOtp(){
    const digits="1234567890";
    let otp="";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];
    }
    return otp;
}

const sendVerificationEmail = async (email,otp)=>{
try {
    const transporter = nodemailer.createTransport({
     service:"gmail",
     port:587,
     secure:false,
     requireTLS:true,
     auth:{
        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD,
     }
    })
    const mailOptions ={
        from:process.env.NODEMAILER_EMAIL,
        to:email,
        subject:"Your OTP for password reset",
        text:`Your otp is ${otp}`,
        html:`<b><h4>Your OTP: ${otp}</h4></b>`
    }
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:",info.messageId);
    return true;
    
} catch (error) {
    console.error("Error in sending email",error);
    return false;
}
}


const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;
    } catch (error) {
        
    }
}



const getForgotPassPage= async (req,res)=>{
    try {
        res.render('forgot-password');
    } catch (error) {
        res.send("pageerror");
    }
}

const forgotEmailValid = async (req,res)=>{
    try {
        const {email} =req.body;
        const findUser = await User.findOne({email:email});
        if(findUser){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp=otp;
                req.session.email=email;
                res.render('forgotPass-otp');
                console.log("OTP:",otp);
                
            }else{
                res.json({success:false,message:"Failed to send otp"})
            }
        }else{
            res.render("forgot-password",{message:"User with this email does not exist"});
        }
    } catch (error) {
        res.send("pageerror");
    }
}

const verifyForgotPassOtp = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"});
        }else{
            res.json({success:false,message:"OTP doesn't matches"});
        }
    } catch (error) {
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false,message:"An error occured"})
    }
}

const getResetPassPage = async (req,res)=>{
    try {
        res.render('reset-password')
    } catch (error) {
        res.send('pageerror');
    }
}

const resendOtp = async(req,res)=>{
    try {
        const otp = generateOtp();
        req.session.userOtp=otp;
        const email = req.session.email;
        console.log("Resent OTP to email:",email);
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resent OTP:",otp);
            res.status(STATUS_CODES.OK).json({success:true,message:"Resend OTP successful"})
        }
        
    } catch (error) {
        console.error("Error in resend OTP",error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false,message:"Internal server error"});
    }
}


const postNewPassword = async (req,res)=>{
    try {
        const {newPass1,newPass2}=req.body;
        const email= req.session.email;
        if(newPass1 === newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
            res.redirect('/login');
        }else{
            res.render("reset-password",{message:"Passwords do not match"})
        }
    } catch (error) {
        res.send("pageerror")
    }
}

const userProfile = async (req,res)=>{
    try {
        const userId = req.session.user._id || req.session.user;
        const userData = await User.findById(userId).populate('walletHistory');
        const addressData = await Address.findOne({userId:userId});
        const page =  parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        // const userId = req.session.user._id; 
        const totalOrders = await Order.countDocuments({ userId });

        const orders = await Order.find({ userId }) 
            .populate('cartData.productId') 
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
         
        const totalPages = Math.ceil(totalOrders / limit);

      
        const totalReferralEarnings = userData.walletHistory
        .filter(transaction => transaction.description === 'Referral Bonus')
        .reduce((total, transaction) => total + transaction.amount, 0);
            //  console.log("totalreferralearnings",totalReferralEarnings);
             
        res.render("user-profile",{
            user:userData,
            userAddress:addressData,
            orders,
            currentPage: page,  
            totalPages: totalPages, 
            totalReferralEarnings,
          

        })
    } catch (error) {
        console.error('Error in retrieving profile data ',error);
        res.render("page-404");
    }
}

const getEditProfile = async (req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        res.render("edit-profile",{
            user:userData
        })
    } catch (error) {
        console.error('Error in retrieving edit profile page ',error);
        res.send("pageerror")
    }
}

const updateProfile = async(req,res)=>{
   try {
    const userId = req.session.user;
    const {name,email,phone} = req.body;

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        {name,email,phone},
        {new:true}
    );
     
    if(!updatedUser){
        return res.status(STATUS_CODES.NOT_FOUND).send('User not found')
    }
     
    res.redirect('/userProfile');
   } catch (error) {
     console.error(error);
     res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Error updating profile')
   }
    };


    const addAddress = async (req,res)=>{
        try {
            const user =  req.session.user;
            res.render("add-address",{user:user});
        } catch (error) {
            res.send("page not found");
        }
    }


    const postAddAddress = async(req,res)=>{
        try {
            const userId = req.session.user;
            const userData = await User.findOne({_id:userId});
            const {addressType,name,city,landMark,state,pincode,phone,altPhone}= req.body;

            const userAddress = await Address.findOne({userId:userData._id});
            if(!userAddress){
                const newAddress = new Address({
                    userId:userData._id,
                    address : [{addressType,name,city,landMark,state,pincode,phone,altPhone}]
                })
                await newAddress.save();
            }else{
                userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone})
                await userAddress.save();
            }
            
           res.redirect('/userProfile')
        } catch (error) {
            console.error("Error adding address",error);
            res.send("page not found");
        }
    }

const editAddress = async (req,res)=>{
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            "address._id":addressId,

        });
        if(!currAddress){
            return res.send("page not found");
        }
        const addressData = currAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString();
        })
        if(!addressData){
            return res.send("page not found");
        }

        res.render("edit-address",{address:addressData,user:user})
    } catch (error) {
        console.error("Error in editing address",error);
        res.send("page not found")
    }
}


const postEditAddress = async (req,res)=>{
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({"address._id":addressId});
        if(!findAddress){
            res.send("page not found");
        }
        await Address.updateOne(
            {"address._id":addressId},
            {$set:{
                "address.$":{
                    _id:addressId,
                    addressType:data.addressType,
                    name:data.name,
                    city:data.city,
                    landMark:data.landMark,
                    state:data.state,
                    pincode:data.pincode,
                    phone:data.phone,
                    altPhone:data.altPhone,
                }
            }}
        )
        res.redirect('/userProfile');
    } catch (error) {
        console.error("Error in editinfg address",error);
        res.send("page not found");
    }
}


const deleteAddress = async (req,res)=>{
    try{
     const addressId = req.query.id;
     const findAddress = await Address.findOne({"address._id":addressId});
     if(!findAddress){
        return res.status(STATUS_CODES.NOT_FOUND).send("Address not found")
     }

     await Address.updateOne({
        "address._id":addressId
     },
     {
       $pull : {
        address : {
            _id:addressId,
        }
       }
     }
    )

      res.redirect("/userProfile")

    }catch(error){
        console.error("Error in deleting address",error);
        res.send("page not found");
    }
}


const invoiceDownload = async(req,res)=>{
    try {
        const orderData = await Order.findOne({_id:req.params.id})
            .populate('userId')
            .populate('addressChosen')  // Make sure this field name matches your schema
            .populate({
                path: 'cartData.productId',
                populate: {
                    path: 'category'
                }
            });

        if (!orderData) {
            return res.status(STATUS_CODES.NOT_REQUEST).send('Order not found');
        }

        const stream = res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment;filename=invoice_${orderData.orderNumber}.pdf`
        });

        generatevoice(
            (chunk) => stream.write(chunk),
            () => stream.end(),
            orderData
        );

    } catch (error) {
        console.error('Invoice download error:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Error generating invoice');
    }
};

module.exports ={
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    updateProfile,
    getEditProfile,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    invoiceDownload,
}