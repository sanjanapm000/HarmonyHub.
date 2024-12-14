const mongoose = require('mongoose');

const { Schema } = mongoose;


const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,

    },
    facebookId: {
        type: String,

    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",
    }],
    wallet: {
        type: Number,
        default: 0
    },
    wishlist: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            default: []
        }
    ],
    walletHistory: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet'
        }
    ]
}, { timestamps: true });


const User = mongoose.model("User", userSchema);

module.exports = User;