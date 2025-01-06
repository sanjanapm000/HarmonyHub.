const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require('fs');
const fsm = require("fs").promises;  // Use fs.promises for async file operations
const path = require("path");
const sharp = require("sharp");
const { log } = require("console");
const STATUS_CODES = require("../../constants/statusCodes"); 



const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


const deleteFileWithRetry = async (filePath, retries = 3, delayTime = 1000) => {
    try {
        await fsm.rm(filePath, { force: true });
        console.log(`File deleted: ${filePath}`);
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying to delete file: ${filePath}`);
            await delay(delayTime); 
            await deleteFileWithRetry(filePath, retries - 1, delayTime);  
        } else {
            console.error("Failed to delete file after retries:", error);
        }
    }
};

// Get the Add Product Page
const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        res.render("product-add", {
            cat: category,
            brand: brand
        });
    } catch (error) {
        console.log("Error loading add product page", error);
        res.redirect("/admin/pageerror");
    }
};

// Add Product
const addProducts = async (req, res) => {
    try {
        const products = req.body;
        
        console.log('Received product data:', products);


        const productExists = await Product.findOne({
            productName: products.productName,
        });

        if (productExists) {
            return res.status(STATUS_CODES.BAD_REQUEST).json("Product already exists");
        }

        const images = [];

        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;
                const resizedImageName = path.basename(req.files[i].filename, path.extname(req.files[i].filename)) + '-resized' + path.extname(req.files[i].filename);
                const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedImageName);

                try {
                    await sharp(originalImagePath)
                        .resize({ width: 400, height: 440 })
                        .toFile(resizedImagePath);

                    images.push(resizedImageName);

                    await deleteFileWithRetry(originalImagePath); 

                } catch (err) {
                    console.error("Error resizing or deleting image:", err);
                    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ message: "Error processing images" });
                }
            }
        }

        const categoryId = await Category.findOne({ name: products.category });

        if (!categoryId) {
            return res.status(400).json({ message: "Invalid category name" });
        }

        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: categoryId._id,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice,
            createdOn: new Date(),
            quantity: products.quantity,
            productImg: images,
            status: "Available"
        });

        await newProduct.save();

        return res.redirect("/admin/addProducts");
    } catch (error) {
        console.log("Error in saving product:", error);
        return res.redirect("/admin/pageerror");
    }
};

// Edit Product
const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        
        const product = await Product.findById(id);

        const listedCategories = await Category.find({ isListed: true });

        const data = req.body;
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ error: "Product already exists" });
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                images.push(req.files[i].filename);
            }
        }

        const updateFields = {
            productName: data.productName,
            description: data.description,
            brand: data.brand,
            category: data.category, 
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            quantity: data.quantity,
            color: data.color
        };

        if (images.length > 0) {
            updateFields.$push = { productImg: { $each: images } };
        }

        const updatedProduct = await Product.findByIdAndUpdate(id, updateFields, { new: true });

        res.redirect('/admin/products'); 

    } catch (error) {
        console.error(error);
        res.send("pageError");
    }
};



// Delete Single Image
const deleteSingleImage = async (req, res) => {
   
 
    try {
        const { imageNameToServer, productIdToServer } = req.body;

        if (!imageNameToServer || !productIdToServer) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ status: false, message: "Missing required parameters: imageName or productId" });
        }
        const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImg:imageNameToServer}});

       

        const imagePath = path.join('public','uploads','product-images',imageNameToServer);
        console.log('Path to image:', imagePath);  

        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
            
        }
        else{
            console.log(`Image ${imageNameToServer} not found`);
            
        }
        res.send({status:true});
    } catch (error) {
        console.error("Error deleting image:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ status: false, message: "Internal Server Error" });
    }
}


const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
            ],
           
        }).sort({ createdAt: -1 }).limit(limit * 1).skip((page - 1) * limit).populate('category').exec();

        const count = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
            ]
        }).countDocuments();

        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        const lowStockThreshold = 5;
        productData.forEach(product => {
            product.isLowStock = product.stock < lowStockThreshold;  
        });

        if (category && brand) {
            res.render("products", {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                brand: brand,
                lowStockThreshold,
            });
        } else {
            res.send("Error,Page-404");
        }
    } catch (error) {
        console.log(error);
        res.send("pageerror");
    }
};

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findById(id).exec();

        console.log('Product:', product); 

        if (!product) {
            return res.status(STATUS_CODES.NOT_FOUND).send("Product not found");
        }

        const listedCategories = await Category.find({ isListed: true });
        const category = await Category.find({});
      
        res.render("edit-product", {
            product: product,
            cat: category,
            listedCategories: listedCategories,
            
        });
    } catch (error) {
        console.error(error);
        res.send("pageError");
    }
};






const toggleBlockProduct = async (req, res) => {
    try {
        const { productId } = req.body;  
        
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(STATUS_CODES.NOT_FOUND).send("Product not found");
        }

        product.isBlocked = !product.isBlocked;

        await product.save();

        res.json({
            status: "success",
            isBlocked: product.isBlocked,
            message: product.isBlocked ? "Product blocked" : "Product unblocked"
        });
    } catch (error) {
        console.error("Error blocking/unblocking product:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("Error blocking/unblocking product");
    }
};

const updateProductStatus = async (req, res) => {
    try {
        const { productId, newStatus } = req.body;
        console.log('Received productId:', productId);  
        console.log('Received newStatus:', newStatus);
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ status: 'error', message: 'Product not found' });
        }

        product.status = newStatus;

        const updatedProduct = await product.save();
        
        console.log('Updated Product:', updatedProduct);  

        res.json({ status: 'success', message: 'Product status updated successfully' });
    } catch (error) {
        console.error('Error updating status:', error);

        if (!res.headersSent) {
            res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ status: 'error', message: 'Internal Server Error' });
        }
    }
};


const addProductOffer=async(req,res)=>{
    try {

        const{productId,percentage}=req.body;
        const findProduct=await Product.findOne({_id:productId});
        const findCategory=await Category.findOne({_id:findProduct.category});
        if(findCategory.categoryOffer>percentage){
            return res.json({status:false,message:"This products category already has a category offer"})
        }

        findProduct.salePrice=findProduct.regularPrice-Math.floor(findProduct.regularPrice*(percentage/100));
        findProduct.productOffer= parseInt(percentage);
        await findProduct.save();
        findCategory.categoryOffer=0;
        await findCategory.save();
        res.json({status:true});
        
    } catch (error) {
        res.redirect("/admin/pageerror");
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({status:false,message:"Internal Server Error"});
        
    }
}

const removeProductOffer = async(req,res)=>{
    try {
        const {productId}=req.body
        const findProduct = await Product.findOne({_id:productId});
        const  percentage=findProduct.productOffer;
        findProduct.salePrice=findProduct.salePrice+Math.floor(findProduct.regularPrice*(percentage/100));
        findProduct.productOffer=0;
        await findProduct.save();
        res.json({status:true})
        
    } catch (error) {
        res.redirect("/pageerror")
        
    }
}

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    updateProductStatus,
    toggleBlockProduct,
    addProductOffer,
    removeProductOffer,
};
