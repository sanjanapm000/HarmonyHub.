const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new mongoose.Schema({
    userId:
    {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    orderNumber:
    {
        type: Number,
        required: true
    },
    orderDate:
    {
        type: Date,
        required: true,
        default: Date.now
    },
    // products: [{
    //     productId: {
    //       type: mongoose.Schema.Types.ObjectId,
    //       ref: 'Product'
    //     },
    //     productQty: {
    //       type: Number
    //     }
    //   }],
    paymentType:
    {
        type: String,
        enum:['COD', 'Razorpay','Pending','Wallet'],
        default: 'Pending'
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Pending'
    },
    orderStatus:
    {
        type: String,
        enum:['Pending','Shipped','Delivered','Cancelled','Return'],
        default: 'Pending'
    },
    cancelled: {
        type: Boolean,
        default: false
      },
    addressChosen:
    {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Address'
    },
    grandTotalCost:
    {
        type: Number
     
    },
    paymentId: 
    { 
        type: String, 

    },
    couponApplied: {        
        type: Boolean,
        default: false,
    },
    couponName: {           
        type: String,
    },
    discountAmount: {       
        type: Number,
        default: 0,
    },
    grandTotalAfterDiscount: {   
        type: Number,
        required:true
    },
    cartData: 
    { 
        type: Array

    },
},{timestamps:true})

const Order = mongoose.model('Order', orderSchema)

module.exports = Order



