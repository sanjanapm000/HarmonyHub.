const mongoose = require('mongoose');
const {Schema} = mongoose;
const cartSchema = new Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref:'User'
    },
    productId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref:'Product'
    },
    productQty:{
        type:Number,
        required:true,
        default:1,
        min:1,
    },
    totalCostPerProduct:{
        type:Number,
    }
},{strictPopulate:false});

const Cart = mongoose.model("Cart",cartSchema);

module.exports=Cart;