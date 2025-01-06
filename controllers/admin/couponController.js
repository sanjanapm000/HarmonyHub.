const Coupon = require('../../models/couponSchema');
const mongoose = require('mongoose');
const STATUS_CODES = require('../../constants/statusCodes');


const loadCoupon = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        // Count the total number of coupons
        const count = await Coupon.countDocuments();

        // Fetch the coupons for the current page
        const coupons = await Coupon.find().skip(skip).limit(limit);

        res.render('coupon', {
            coupons,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        console.log(error);
    }
}

  


const createCoupon = async (req,res)=>{
    try {
        const data ={
            couponName:req.body.couponName,
            startDate: new Date(req.body.startDate + "T00:00:00Z"),
            endDate:new Date(req.body.endDate + "T00:00:00Z"),
            offerPrice:parseInt(req.body.offerPrice),
            minimumPrice:parseInt(req.body.minimumPrice),
        }
        const newCoupon = new Coupon({
            name:data.couponName,
            createdOn:data.startDate,
            expireOn:data.endDate,
            offerPrice:data.offerPrice,
            minimumPrice:data.minimumPrice
        });
        await newCoupon.save();
        return res.redirect("/admin/coupon")
    } catch (error) {
        res.send("page error")
    }
}


const editCoupon = async (req,res)=>{
    try {
        const id = req.query.id;
        const findCoupon = await Coupon.findOne({_id:id});
        res.render('edit-coupon',{
            findCoupon,

        })
    } catch (error) {
        console.log(error);
        res.send('page error');
    }
}

const updateCoupon = async (req,res)=>{
    try {
        couponId = req.body.couponId;
        const oid = new mongoose.Types.ObjectId(couponId);
        const selectedCoupon = await Coupon.findOne({_id:oid});
        if(selectedCoupon){
            const startDate = new Date(req.body.startDate);
            const endDate = new Date(req.body.endDate);
            const updatedCoupon = await Coupon.updateOne(
                {_id:oid},
                {
                    $set:{
                        name:req.body.couponName,
                        createdOn:startDate,
                        expireOn:endDate,
                        offerPrice:parseInt(req.body.offerPrice),
                        minimumPrice:parseInt(req.body.minimumPrice)
                    }
                },{new:true}
            )
            if(updatedCoupon !== null){
                res.send("Coupon updated successfully")
            }else{
                res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("coupon update failed")
            }
        }
    } catch (error) {
        console.log(error);
        
    }
}

const deleteCoupon = async (req,res)=>{
     try {
        const id = req.query.id;
        await Coupon.deleteOne({_id:id});
        res.status(STATUS_CODES.OK).send({success:true,message:"Coupon deleted successfully"});
     } catch (error) {
        console.error("error deleting coupon",error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send({success:false,message:"Failed to delete coupon"})
     }
}
module.exports={
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon,
}