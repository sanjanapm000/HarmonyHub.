const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const STATUS_CODES = require('../../constants/statusCodes');

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        const products = await Product.find({ _id: { $in: user.wishlist } }).populate('category');
        

        res.render('wishlist', {
            user,
            wishlist: products,
        });
    } catch (error) {
        console.error(error);
        res.send("page error");
    }
};

const toggleWishlist = async (req, res) => {
    try {
        const productId = req.body.productId;
        const userId = req.session.user;
        const user = await User.findById(userId);

        const productIndex = user.wishlist.indexOf(productId);

        if (productIndex === -1) {
            user.wishlist.push(productId);
            await user.save();
            return res.status(STATUS_CODES.OK).json({ status: true, added: true, message: 'Product added to wishlist' });
        } else {
            user.wishlist.splice(productIndex, 1);
            await user.save();
            return res.status(STATUS_CODES.OK).json({ status: true, added: false, message: 'Product removed from wishlist' });
        }
    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Server error' });
    }
};

const removeProduct = async (req, res) => {
    try {
        const productId = req.query.productId;
        const userId = req.session.user;
        const user = await User.findById(userId);
        const index = user.wishlist.indexOf(productId);
        user.wishlist.splice(index, 1);
        await user.save();
        return res.redirect('/wishlist');
    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Server error' });
    }
};

module.exports = {
    loadWishlist,
    toggleWishlist, 
    removeProduct,
};
