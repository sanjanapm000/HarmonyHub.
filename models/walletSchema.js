const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: { type: mongoose.Types.ObjectId, required: true, ref:'User'},
    date:
    {
        type: Date,
        default: new Date()
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String, // e.g., "Returned", "Added", "Deducted"
        required: true
    },
    description: {
        type: String
    }
});


const Wallet = mongoose.model("Wallet", walletSchema);

module.exports = Wallet;