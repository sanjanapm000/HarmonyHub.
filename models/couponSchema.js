const mongoose = require('mongoose')

const couponSchema = new mongoose.Schema({
    name:
    {
        type: String,
        required: true,
        unique:true,
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true,
    },
    expireOn:
    {
        type: Date,
        required: true
    },
    offerPrice:
    {
        type: Number,
        required: true
    },
    minimumPrice:
    {
        type: Number,
        required: true
    },
    isList:{
        type:Boolean,
        default:true
    },
    // userId:[{
    //     type:mongoose.Schema.Types.ObjectId,
    //     ref:'User'
    // }],
    usageLimitPerCustomer: {  
        type: Number,
        required: true,
        default: 1,  
    },
    usageCountByUser: {  
        type: Object,  // Change this to Object
        default: {}
    },
})

const Coupon = mongoose.model('Coupon', couponSchema)

module.exports = Coupon;