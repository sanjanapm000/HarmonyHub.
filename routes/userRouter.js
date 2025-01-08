const express=require('express');
const userController = require('../controllers/user/userController');
const cartController = require('../controllers/user/cartController');
const passport = require('passport');
const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema");
const profileController = require('../controllers/user/profileController');
const orderDetController = require('../controllers/user/orderDetController.js');
const wishlistController = require('../controllers/user/wishlistController.js')
const { userAuth } = require('../middlewares/auth');
const blockedUserCheck = require("../middlewares/blockUserCheck.js");
const router = express.Router();


router.get('/contact',(req,res)=>{
    res.render('contactus');
})
router.get('/pageNotFound',userController.pageNotFound);
router.get('/',userController.loadHomePage);
router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOTP);
router.post('/resend-otp',userController.resendOTP);



router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),  (req,res)=>{
    req.session.user = {_id:req.user._id,name:req.user.name,email:req.user.email};
    res.redirect('/');

});


router.get('/login',userController.loadLogin);
router.post('/login',userController.login);

router.get('/logout',userController.logout);
router.get('/product/:productId',userController.getProductDetails);
router.post('/product/:productId/submit-review', userController.submitReview);
router.get('/product/:productId/reviews',userController.getProductReviews);
router.get('/products',userAuth,userController.getAllProducts);
router.post('/products',userAuth,userController.getAllProducts);
router.get("/filter",userController.filterProduct)



//profile management

router.get("/forgot-password",profileController.getForgotPassPage);
router.post('/forgot-email-valid',profileController.forgotEmailValid);
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp);
router.get('/reset-password',profileController.getResetPassPage);
router.post('/resend-forgot-otp',profileController.resendOtp);
router.post('/reset-password',profileController.postNewPassword);
router.get('/userProfile',userAuth,profileController.userProfile);
router.get('/edit-profile',userAuth,profileController.getEditProfile);
router.post('/update-profile',userAuth,profileController.updateProfile);
//invoice
router.get('/profile/downloadInvoice/:id',blockedUserCheck,userAuth,profileController.invoiceDownload)

//Addrees Management 

router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get('/editAddress',userAuth,profileController.editAddress);
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress);


//cart management

router.get("/mycart",blockedUserCheck,userAuth,cartController.getMyCart);
router.post('/mycart/:id',blockedUserCheck,userAuth,cartController.addToCart);
router.delete('/removeFromCart/:id',blockedUserCheck, userAuth,cartController.deleteFromCart);
router.put('/decQty/:id', blockedUserCheck,userAuth,cartController.decQty);
router.put('/incQty/:id', blockedUserCheck,userAuth,cartController.incQty);
router.get('/validate-stock', userAuth, cartController.validateStock);

//checkout
router.get("/checkout",blockedUserCheck,userAuth,cartController.checkoutPage);
router.post("/checkout",blockedUserCheck,userAuth,cartController.processOrder);
router.all("/orderSucess", blockedUserCheck, userAuth, cartController.orderPlaced);
router.get("/checkout/orderPlacedEnd", blockedUserCheck, userAuth, cartController.orderPlacedEnd);

router.post("/checkout/orderPlacedEnd", blockedUserCheck, userAuth, cartController.orderPlacedEnd);
router.post("/checkout/applyCoupon", blockedUserCheck, userAuth, cartController.applyCoupon);
router.post('/create-razorpay-order',blockedUserCheck, userAuth, cartController.createRazorpayOrder);
router.post('/verify-payment',blockedUserCheck, userAuth, cartController.verifyPayment);
router.post('/remove-coupon',userAuth, cartController.removeCoupon);
router.get('/checkout/processPayment',userAuth,cartController.processWalletPayment);

//order management

router.get("/order",blockedUserCheck,userAuth,orderDetController.getUserOrders);
router.post('/order/cancel/:id', orderDetController.cancelOrder);
router.get('/orderManagement/orderStatus/:id', orderDetController.orderStatusPage);
router.post('/order/return/:orderId', orderDetController.returnOrder);
router.post("/order/cancelProduct/:id/:orderId",orderDetController.cancelProduct);
router.post('/order/returnProduct/:productId/:orderId',orderDetController.returnProduct)




//wishlist
router.get('/wishlist',blockedUserCheck,userAuth,wishlistController.loadWishlist);
router.post('/toggleWishlist',blockedUserCheck,userAuth,wishlistController.toggleWishlist);
router.get('/removeFromWishlist',userAuth,wishlistController.removeProduct);












module.exports=router;