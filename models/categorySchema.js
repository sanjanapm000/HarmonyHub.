const mongoose = require('mongoose');

// Define the Category schema
const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // Ensure category names are unique
        trim: true // Remove whitespace from both ends
    },
    description: {
        type: String,
        required: true,
        trim: true // Optional: clean up the description
    },
    isListed: {
         type: Boolean, 
         default: true 
        },
    categoryOffer:{
        type:Number,
        default:0
    }  ,  
    totalSales:{
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now // Automatically set the date when a category is created
    }
});

// Create the Category model
const Category = mongoose.model('Category', categorySchema);

// Export the model
module.exports = Category;
