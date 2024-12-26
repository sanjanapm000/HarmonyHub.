const mongoose = require("mongoose");
const {Schema} = mongoose;


const productSchema = new Schema({
    productName:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true,
    },
    // brand:{
    //     type:String,
    //     required:false
    // },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    regularPrice:{
        type:Number,
        required:true
    },
    color:{
      type:String,
      required:false
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0
    },
    quantity:{
        type:Number,
        default:0
    },
    productImg:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    salesCount: {
        type: Number,
        default: 0
    },
    status:{
        type:String,
        enum:["Available","Out of Stock","Unavailable"],
        required:true,
        default:"Available"
    },
    averageRating: {
        type: Number,
        default: 0
    },
    isFeatured: {  
        type: Boolean,
        default: false,  
    },
    // isCancelled:{
    //     type: Boolean,
    //     default:false,
    // }
   
},{timestamps:true});



productSchema.pre('save', function (next) {
    if (this.quantity === 0) {
        this.status = 'Out of Stock';
    } else if (this.quantity > 0) {
        this.status = 'Available';
    }

    
    if (this.quantity < 0) {
        this.status = 'Sold out';
    }

    next(); 
});


productSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.quantity !== undefined) {
        if (update.quantity === 0) {
            update.status = 'Out of Stock';
        } else if (update.quantity > 0) {
            update.status = 'Available';
        }

        if (update.quantity < 0) {
            update.status = 'Sold out';
        }
    }
    next();
});


const Product = mongoose.model("Product",productSchema);

module.exports = Product;