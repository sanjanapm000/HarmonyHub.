//adminRouter.js
const express = require("express");
const path = require("path");
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const orderController = require('../controllers/admin/orderController')
const customerController=require('../controllers/admin/customerController');
const categoryController=require("../controllers/admin/categoryController");
const productController=require("../controllers/admin/productController");
const couponController = require("../controllers/admin/couponController");
const salesController = require('../controllers/admin/salesController')
const multer = require("multer");
// const upload = multer({ dest: 'uploads/' }).array('images',4);
const {userAuth,adminAuth} = require("../middlewares/auth");

// Set up multer storage configuration (e.g., saving uploaded files to disk)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Save files in the 'uploads/' folder (make sure this folder exists)
      cb(null, 'public/uploads/product-images');
    },
    filename: function (req, file, cb) {
      // Name the file uniquely by appending the timestamp to the original file name
      cb(null, Date.now() + path.extname(file.originalname)); // Ensure unique filenames
    }
  });
  
  // Initialize multer with the storage configuration
  const uploads = multer({ storage: storage, limits: { files: 4 } }); // Limit to 4 files


router.get("/pageerror",adminController.pageerror )
router.get('/',adminController.loadDashboard);
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get("/logout",adminController.logout);


//customer management 
router.get("/users",adminAuth,customerController.customerInfo);
router.get('/blockCustomer',adminAuth,customerController.customerBlocked);
router.get('/unblockCustomer',adminAuth,customerController.customerunBlocked);

// Category Management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer);
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer);
router.get("/listCategory",adminAuth,categoryController.listCategory);
router.get("/unlistCategory",adminAuth,categoryController.unlistCategory);
router.get('/editCategory',adminAuth,categoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);
router.post('/checkCategoryName', adminAuth, categoryController.checkCategoryName);


//Product management

router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts);
router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);
router.post('/toggle-block', adminAuth, productController.toggleBlockProduct);
router.post('/update-status',productController.updateProductStatus);




//order management

router.get('/orderManagement', orderController.orderManagement)
router.get('/orderManagement/pending/:id', orderController.changeStatusPending)
router.get('/orderManagement/shipped/:id', orderController.changeStatusShipped)
router.get('/orderManagement/delivered/:id', orderController.changeStatusDelivered)
router.get('/orderManagement/return/:id', orderController.changeStatusReturn)
router.get('/orderManagement/cancelled/:id', orderController.changeStatusCancelled)


//coupon management

router.get('/coupon',adminAuth,couponController.loadCoupon);
router.post('/createCoupon',adminAuth,couponController.createCoupon);
router.get('/editCoupon',adminAuth,couponController.editCoupon);
router.post('/updateCoupon',adminAuth,couponController.updateCoupon);
router.get('/deleteCoupon',adminAuth,couponController.deleteCoupon);



//sales report

router.get('/generate-sales-report',adminAuth,salesController.getReport);
router.post('/generate-sales-report',adminAuth,salesController.generateSalesReport);


//dashboard
 router.get('/sales-data', adminAuth, adminController.getDashboard);
 router.get('/dashboard',adminAuth,adminController.loadDashboard);


 //ledger book
 router.get('/generate-ledger',adminAuth,salesController.generateLedger);

module.exports = router;