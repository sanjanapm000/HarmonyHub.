const User = require('../../models/userSchema');
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema")
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const mongoose = require("mongoose")
require('dotenv').config();
const nodemailer = require('nodemailer');
const Review = require('../../models/reviewSchema');


const submitReview = async (req, res) => {
    try {
        const productId = req.params.productId;
        const { rating, comment } = req.body;
        console.log(req.body);

        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ message: 'You must be logged in to submit a review.' });
        }

        console.log('Received Review:', { productId, rating, comment, userId });

        if (!userId) {
            return res.redirect('/login'); 
        }

      
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
        }

        // Create a new review
        const newReview = new Review({
            product: productId,
            user: userId,
            rating: rating,
            comment: comment
        });

        await newReview.save();

        const reviews = await Review.find({ product: productId });
        const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

        await Product.findByIdAndUpdate(productId, { averageRating: averageRating });

        return res.json({ success: true, message: "Review submitted successfully!" });
    } catch (error) {
        console.error("Error submitting review:", error);
        res.status(500).json({ success: false, message: "Error submitting review. Please try again later." });
    }
};

const getProductReviews = async (req, res) => {
    try {
        const productId = req.params.productId;

        const reviews = await Review.find({ product: productId })
            .populate('user', 'name') 
            .exec();

        return res.json({ success: true, reviews });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ success: false, message: "Error fetching reviews. Please try again later." });
    }
};



const loadSignup = async (req, res) => {
    try {
        return res.render('signup');
    } catch (error) {
        console.log("Signup page not loading", error);
        res.status(500).send('Server Error');
    }
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`

        })
        return info.accepted.length > 0

    } catch (error) {
        console.error("Error in sending email", error);
        return false;
    }
}



const signup = async (req, res) => {
    const { name, phone, email, password } = req.body
    try {
        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User already exists" })
        }

        const otp = generateOtp();

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json("email-error")
        }
        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };



        res.render('verify-otp')
        console.log("otp:", otp);


    } catch (error) {
        console.error("Signup error", error);
        // res.redirect('/pageNotFound')
    }
}

const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render("login")
        } else {
            res.redirect('/')
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const findUser = await User.findOne({ isAdmin: 0, email: email });
        if (!findUser) {
            return res.render("login", { message: "User not found" })
        }
        if (findUser.isBlocked) {
            return res.render("login", { message: "User is blocked by admin" })
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.render("login", { message: "Email/Password is incorrect" })
        }
        req.session.user = {
            _id: findUser._id,
            name: findUser.name,
            email: findUser.email,
            // You can add other details as needed
        };
        res.redirect('/');
    } catch (error) {
        console.error("Login error", error);
        res.render("login", { message: "login failed. Please try again later." })
    }
}



const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;

    } catch (error) {

    }
}

const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(otp);

        if (!req.session.userOtp) {
            console.log("OTP session data not found.");
            return res.status(400).json({ success: false, message: "OTP session data not found." });
        }

        console.log("Session OTP:", req.session.userOtp);

        if (otp.trim() === req.session.userOtp.trim()) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
                googleId: user.googleId || undefined,
                facebookId: user.facebookId || undefined
            })

            await saveUserData.save();
            req.session.user = saveUserData._id;
            delete req.session.userOtp; 
            delete req.session.userData;
            return res.json({ success: true, redirectUrl: '/' });
        } else {
            console.log("Invalid OTP entered.");
            return res.status(400).json({ success: false, message: "Invalid OTP, Please try again!" })
        }

    } catch (error) {
        console.error("Error in verifying OTP", error);
        res.status(500).json({ success: false, message: "An error occured" })
    }
}

const resendOTP = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" })
        }
        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resend otp", otp);
            res.status(200).json({ success: true, message: "OTP resent successfully" })
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP, Please try again " })
        }
    } catch (error) {
        console.error("Error in resending OTP", error);
        res.status(500).json({ success: false, message: "Internal Server Error" })
    }
}

const pageNotFound = async (req, res) => {
    try {
        res.render('page-404');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}






const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true });
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        }).sort({ createdAt: -1 });

        productData = productData.slice(0, 4);
        console.log("CATEGORIES:",categories);
        console.log("PRODUCTDATA:",productData);
       

        const userWishlist = req.user ? req.user.wishlist : [];
        if (user) {

            const userData = await User.findById(user);
            res.render('home', { user: userData, products: productData ,userWishlist});
        } else {
            return res.render('home', { products: productData,userWishlist:[] });
        }
        console.log("USERWISHLIST:",userWishlist);
    } catch (error) {
        console.log('Home page not loading', error);
        res.status(500).send('Server Error')
    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Session destruction error", err.message);
                return res.redirect("/pageNotFound")
            }
            res.clearCookie('connect.sid');
            return res.redirect("/")
        })
    } catch (error) {
        console.log("logout error", error);
        res.redirect("/pageNotFound")
    }
}

const getProductDetails = async (req, res) => {
    try {
        const user = req.session.user;
        const productId = req.params.productId;
        const selectedProduct = await Product.findById(productId).populate('category');

        if (!selectedProduct) {
            return res.status(404).send('Product not found');
        }

        const product = await Product.findById(productId)
            .populate('category', 'name')
            .exec();

        if (!product) {
            return res.redirect('/pageNotFound');
        }


        const relatedProducts = await Product.find({
            category: selectedProduct.category._id,
            status: { $ne: 'Out of Stock' },
            _id: { $ne: product._id }
        }).limit(4);


        const reviews = await Review.find({ product: productId })
            .populate('user', 'name')
            .exec();


        const breadcrumbs = [
            { name: 'Home', link: '/' },
            { name: product.category.name, link: `/category/${product.category.name}` },
            { name: product.productName, link: '' }
        ];
        let userData = null;
        if (user) {
            userData = await User.findById(user);
        }
        res.render('product-details', {
            product: selectedProduct,
            relatedProducts: relatedProducts,
            reviews: reviews,
            breadcrumbs: breadcrumbs,
            title: product.productName,
            productId,
        });
    } catch (error) {
        console.error("Error fetching product details:", error);
        res.redirect('/pageNotFound');
    }
};
const getAllProducts = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });
        const userdata = await User.findOne({ _id: user }).populate('wishlist');
       
        
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        
        const sortOrder = req.query.sortOrder || '';
        const selectedCategory = req.query.category || '';
        const searchQuery = req.query.query || '';

        

        let filterQuery = { isBlocked : false };
       

        if (selectedCategory) {
            filterQuery.category = selectedCategory;
        }

        if (searchQuery) {
            filterQuery.$or = [
                { productName: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        let sortOptions = {};
        switch (sortOrder) {
            case 'productName_asc':
                sortOptions = { productName: 1 };
                break;
            case 'productName_desc':
                sortOptions = { productName: -1 };
                break;
            case 'price_asc':
                sortOptions = { salePrice: 1 };
                break;
            case 'price_desc':
                sortOptions = { salePrice: -1 };
                break;
            case 'sales_asc':
                sortOptions = { salesCount: 1 };
                break;
            case 'sales_desc':
                sortOptions = { salesCount: -1 };
                break;
            case 'newArrivals':
                sortOptions = { createdAt: -1 };
                break;
            case 'rating_asc':
                sortOptions = { averageRating: 1 };
                break;
            case 'rating_desc':
                sortOptions = { averageRating: -1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }

        if (sortOrder === 'featured') {
            filterQuery.isFeatured = true;
        }

        const products = await Product.find(filterQuery)
            .populate('category')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments(filterQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        const categoriesForView = categories.map(category => ({
            _id: category._id,
            name: category.name,
            isSelected: category._id.toString() === selectedCategory
        }));

        const userWishlist = userdata.wishlist.map(product => product._id.toString());


        res.render("shop", {
            user: userData,
            products: products,
            categories: categoriesForView,
            totalProducts,
            currentPage: page,
            totalPages,
            selectedCategory,
            selectedSortOrder: sortOrder,
            searchQuery: searchQuery,
            userWishlist,
        });

    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.status(500).send("Error fetching products");
    }
};

// const getAllProducts = async (req, res) => {
//     try {
//         const user = req.session.user;
//         const userData = await User.findOne({ _id: user });
//         const categories = await Category.find({ isListed: true });
//         const categoryIds = categories.map((category) => category._id.toString());
//         const page = parseInt(req.query.page) || 1;
//         const limit = 9;
//         const skip = (page - 1) * limit;

//         const sortOrder = req.query.sortOrder || '';
//         const query = req.body.query || req.query.query || '';

//         // Start with the category filter
//         let filterQuery = {
//             isBlocked: false,
//             category: { $in: categoryIds },
//         };

//         if (req.query.category) {
//             filterQuery.category = req.query.category;
//         }

//         // Add the search query filter
//         if (query) {
//             filterQuery.$or = [
//                 { productName: { $regex: query, $options: 'i' } },
//                 { description: { $regex: query, $options: 'i' } },
//             ];
//         }

//         // Define the sort query based on sortOrder
//         let sortQuery = {};
//         if (sortOrder === 'productName_asc') {
//             sortQuery.productName = 1;
//         } else if (sortOrder === 'productName_desc') {
//             sortQuery.productName = -1;
//         } else if (sortOrder === 'price_asc') {
//             sortQuery.salePrice = 1;
//         } else if (sortOrder === 'price_desc') {
//             sortQuery.salePrice = -1;
//         } else if (sortOrder === 'sales_asc') {
//             sortQuery.salesCount = 1;
//         } else if (sortOrder === 'sales_desc') {
//             sortQuery.salesCount = -1;
//         } else if (sortOrder === 'newArrivals') {
//             sortQuery.createdAt = -1;
//         } else if (sortOrder === 'featured') {
//             filterQuery.isFeatured = true;
//             sortQuery.createdAt = -1;
//         } else if (sortOrder === 'rating_asc') {
//             sortQuery.averageRating = 1;
//         } else if (sortOrder === 'rating_desc') {
//             sortQuery.averageRating = -1;
//         }

//         // Apply the default sorting by salePrice if no sort option is selected
//         if (Object.keys(sortQuery).length === 0) {
//             sortQuery.salePrice = 1;  
//         }

//         // Fetch the filtered and sorted products
//         const products = await Product.find(filterQuery)
//             .populate('category')
//             .sort(sortQuery) // Apply sorting only on filtered products
//             .skip(skip)
//             .limit(limit);

//         products.forEach(product => {
//             product.isOutOfStock = product.quantity === 0;
//         });

//         const totalProducts = await Product.countDocuments(filterQuery); // Count based on filtered products
//         const totalPages = Math.ceil(totalProducts / limit);

//         const categoriesWithIds = categories.map(category => ({ _id: category._id, name: category.name }));

//         res.render("shop", {
//             user: userData,
//             products: products,
//             categories: categoriesWithIds,
//             totalProducts: totalProducts,
//             currentPage: page,
//             totalPages: totalPages,
//             selectedCategory: req.query.category || null,
//             selectedSortOrder: sortOrder,
//             query: query,
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Error fetching products");
//     }
// };


// const filterProduct = async (req, res) => {
//     try {
//         const sortOrder = req.query.sortOrder || '';
//         const user = req.session.user;
//         const category = req.query.category;
//         const findCategory = category ? await Category.findOne({ _id: category }) : null;

//         const query = {
//             isBlocked: false,
//         };

//         if (findCategory) {
//             query.category = findCategory._id;
//         }

//         let findProducts = await Product.find(query).lean();

//         // Apply sorting after filtering by category
//         if (sortOrder === 'productName_asc') {
//             findProducts.sort((a, b) => a.productName.localeCompare(b.productName));
//         } else if (sortOrder === 'productName_desc') {
//             findProducts.sort((a, b) => b.productName.localeCompare(a.productName));
//         } else if (sortOrder === 'price_asc') {
//             findProducts.sort((a, b) => a.salePrice - b.salePrice);
//         } else if (sortOrder === 'price_desc') {
//             findProducts.sort((a, b) => b.salePrice - a.salePrice);
//         } else if (sortOrder === 'sales_asc') {
//             findProducts.sort((a, b) => a.salesCount - b.salesCount);
//         } else if (sortOrder === 'sales_desc') {
//             findProducts.sort((a, b) => b.salesCount - a.salesCount);
//         } else if (sortOrder === 'newArrivals') {
//             findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//         } else if (sortOrder === 'featured') {
//             findProducts = findProducts.filter(product => product.isFeatured);
//             findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//         } else if (sortOrder === 'rating_asc') {
//             findProducts.sort((a, b) => a.averageRating - b.averageRating);
//         } else if (sortOrder === 'rating_desc') {
//             findProducts.sort((a, b) => b.averageRating - a.averageRating);
//         }

//         const categories = await Category.find({ isListed: true });
//         let itemsPerPage = 6;
//         let currentPage = parseInt(req.query.page) || 1;
//         let startIndex = (currentPage - 1) * itemsPerPage;
//         let endIndex = startIndex + itemsPerPage;
//         let totalPages = Math.ceil(findProducts.length / itemsPerPage);
//         const currentProduct = findProducts.slice(startIndex, endIndex);

//         let userData = null;
//         if (user) {
//             userData = await User.findOne({ _id: user });
//             if (userData) {
//                 if (!userData.searchHistory) {
//                     userData.searchHistory = [];
//                 }
//                 const searchEntry = {
//                     category: findCategory ? findCategory._id : null,
//                     searchedOn: new Date(),
//                 };
//                 userData.searchHistory.push(searchEntry);
//                 await userData.save();
//             }
//         }

//         req.session.filterProducts = currentProduct;
//         res.render("shop", {
//             user: userData,
//             products: currentProduct,
//             categories: categories,
//             totalPages,
//             currentPage,
//             selectedCategory: req.query.category || null,
//             selectedSortOrder: sortOrder,
//             query: req.query.query || '',
//         });
//     } catch (error) {
//         console.error(error);
//         res.send("page is not found");
//     }
// };

const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const userdata = user ? await User.findOne({ _id: user }).populate('wishlist') : null; // Safe check for user
        const sortOrder = req.query.sortOrder || '';
        const categoryId = req.query.category;
        const searchQuery = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 6;

        let query = { isBlocked:false };

        if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
            query.category = new mongoose.Types.ObjectId(categoryId);
        }

        if (searchQuery) {
            query.$or = [
                { productName: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        let sortOptions = {};
        switch(sortOrder) {
            case 'productName_asc': sortOptions = { productName: 1 }; break;
            case 'productName_desc': sortOptions = { productName: -1 }; break;
            case 'price_asc': sortOptions = { salePrice: 1 }; break;
            case 'price_desc': sortOptions = { salePrice: -1 }; break;
            case 'sales_asc': sortOptions = { salesCount: 1 }; break;
            case 'sales_desc': sortOptions = { salesCount: -1 }; break;
            case 'newArrivals': sortOptions = { createdAt: -1 }; break;
            case 'rating_asc': sortOptions = { averageRating: 1 }; break;
            case 'rating_desc': sortOptions = { averageRating: -1 }; break;
            default: sortOptions = { createdAt: -1 };
        }

        if (sortOrder === 'featured') {
            query.isFeatured = true;
            sortOptions = { createdAt: -1 };
        }

        const skip = (page - 1) * limit;

        const products = await Product.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .populate('category');

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const categories = await Category.find({ isListed: true });

        let userData = null;
        let userWishlist = [];
        if (userdata) {
            userData = await User.findById(req.session.user);
            userWishlist = userdata.wishlist.map(product => product._id.toString()); // Safe to access here
        }

        res.render("shop", {
            user: userData,
            products: products,
            categories: categories,
            totalPages,
            currentPage: page,
            selectedCategory: categoryId,
            selectedSortOrder: sortOrder,
            searchQuery: searchQuery,
            noProductsFound: products.length === 0,
            totalProducts,
            userWishlist,
        });

    } catch (error) {
        console.error("Error in filterProduct:", error);
        res.status(500).send("Error filtering products");
    }
};



module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOTP,
    resendOTP,
    loadLogin,
    login,
    logout,
    getProductDetails,
    getProductReviews,
    submitReview,
    getAllProducts,
    filterProduct


}