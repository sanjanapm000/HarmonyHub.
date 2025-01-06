 //categoryController.js
 const Category = require("../../models/categorySchema");
 const Product = require("../../models/productSchema");
 const Order = require("../../models/orderSchema");
 const STATUS_CODES = require("../../constants/statusCodes");




const categoryInfo = async(req,res)=>{
    try {
        const page=parseInt(req.query.page) || 1;
        const limit=4;
        const skip=(page-1)*limit;

        const categoryData = await Category.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

const totalCategories = await Category.countDocuments();
const totalPages = Math.ceil(totalCategories/limit);
res.render("category",{
    cat:categoryData,
    currentPage:page,
    totalPages:totalPages,
    totalCategories:totalCategories
})

    } catch (error) {
        console.error(error);
        res.redirect("/pageerror");
    }
}


const addCategory = async(req,res)=>{
    const {name,description} = req.body;
    if (!name || !description) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ error: "Name and description are required" });
    }
    try{
         const existingCategory = await Category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
         if(existingCategory){
            return res.status(STATUS_CODES.BAD_REQUEST).json({error:"Category already exists"})
         }
         const newCategory = new Category({
            name,
            description,
         })
         await newCategory.save();
         return res.status(STATUS_CODES.CREATED).json({message:"Category added successfully"})
    }catch(error){
        console.error("Error adding category:", error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({error:"Internal server error"})
    }
}

const addCategoryOffer = async (req,res)=>{
    try{
      const percentage = parseInt(req.body.percentage);
      const categoryId = req.body.categoryId;
      const category = await Category.findById(categoryId);
      if(!category){
        return res.status(STATUS_CODES.NOT_FOUND).json({status:false, message:"Category not found"})
      }
      const products = await Product.find({category:category._id});
      const hasProductOffer = products.some((product)=>product.productOffer > percentage);
      if(hasProductOffer){
        return res.json({status:false,message:"Products within this category already have product offers"});
      }
      await Category.updateOne({_id:categoryId},{$set:{categoryOffer:percentage}});

      for(const product of products){
        // product.productOffer = percentage;
        product.salePrice = product.regularPrice-Math.floor(product.regularPrice*(percentage/100));
        await product.save();
      }
      res.json({status:true});
    }catch(error){
         res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({status:false,message:"Internal server error"})
    }
}

const removeCategoryOffer= async(req,res)=>{
    try {
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);

        if(!category){
            return res.status(STATUS_CODES.NOT_FOUND).json({status:false,message:"Category not found"});
        }

        const percentage = category.categoryOffer;
        const products = await Product.find({category:category._id})

        if(products.length > 0){
            for(const product of products){
                product.salePrice += Math.floor(product.regularPrice * (percentage/100));
                product.productOffer=0;
                await product.save()
            }
        }
        category.categoryOffer=0;
        await category.save();
        res.json({status:true});
    } catch (error) {
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({status:false,message:"Internal server error"})
    }
};

const listCategory=async (req, res) => {
    try {
        let id=req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect("/admin/category");
    } catch (error) {
        res.redirect("/pageerror");
    }
}



const unlistCategory=async (req, res) => {
  
    try {
       let id=req.query.id;
       await Category.updateOne({_id:id},{$set:{isListed:true}});
       res.redirect("/admin/category");
    } catch (error) {
       res.redirect("/pageerror");
    }
}


const getEditCategory = async (req,res)=>{
    try {
        const id=req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("edit-category",{category:category})
    } catch (error) {
        res.redirect("/pageerror")
    }
}

const editCategory= async(req,res)=>{
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        const existingCategory = await Category.findOne({ name: categoryName });

        if (existingCategory && existingCategory._id.toString() !== id) {
            return res.render('edit-category',{
                category: { _id: id, name: categoryName, description },
                errorCategoryName:"Category name already exists"
            })
        }

        const updateCategory = await Category.findByIdAndUpdate(
            id,
            {
                name: categoryName,
                description: description,
            },
            { new: true }
        );

        if (updateCategory) {
            res.redirect("/admin/category");
        } else {
            res.status(STATUS_CODES.NOT_FOUND).json({ error: "Category not found" });
        }
    } catch (error) {
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
    }
}

const checkCategoryName = async (req, res) => {
    try {
        const { categoryName, categoryId } = req.body;

        const existingCategory = await Category.findOne({ name: categoryName });

        if (existingCategory && existingCategory._id.toString() !== categoryId) {
            return res.json({ exists: true });
        }

        return res.json({ exists: false });
    } catch (error) {
        console.error('Error checking category name:', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
    }
};



module.exports={
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    listCategory,
    unlistCategory,
    getEditCategory,
    editCategory,
    checkCategoryName
}