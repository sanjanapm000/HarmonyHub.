const PDFDocument = require("pdfkit");
const Order = require('../models/orderSchema');
const Address = require('../models/addressSchema')




function generateHeader(doc) {
  doc
    .fillColor("#444444")
    .fontSize(20)
    .text("HarmonyHub.", 110, 57)
    .fontSize(10)
    .text("HarmonyHub., JM Street, Ahmedabad, Gujarat, India ", 200, 65, {
      align: "right",
    })
    .text(" Ahmedabad,  6100025", 200, 80, { align: "right" })
    .moveDown();
}

function generateFooter(doc) {
  doc.fontSize(10).text("Thank You! Shop with us again :)", 50, 750, {
    align: "center",
    width: 500,
  });
}

 




async function generateCustomerInformation(doc, orderData) {
  try {
      // Get address directly from populated orderData
      const address = await Address.findById(orderData.addressChosen);
      
      if (!address) {
          throw new Error('Address not found');
      }

      doc
          .text(`Order Number: ${orderData.orderNumber}`, 50, 100)
          .text(
              `Order Date: ${new Date(orderData.orderDate).toLocaleDateString()}`,
              50,
              115
          )
          .text(`Total Price: ${orderData.grandTotalCost}`, 50, 130)
          .text(
              `${address.addressType || 'Shipping Address'}`,
              300,
              100
          )
          .text(
              `Address: ${address.name} ${address.city} ${address.state} ${address.landMark} ${address.pincode}`,
              300,
              115
          )
          .text(`Phone: ${address.phone}`, 300, 150)
          .moveDown();

  } catch (error) {
      console.error('Error generating customer information:', error);
      // Add fallback information
      doc
          .text(`Order Number: ${orderData.orderNumber}`, 50, 100)
          .text(
              `Order Date: ${new Date(orderData.orderDate).toLocaleDateString()}`,
              50,
              115
          )
          .text(`Total Price: ${orderData.grandTotalCost}`, 50, 130)
          .moveDown();
  }
}











 



function generateBody(doc, orderData) {
    generateHr(doc, 90);

    doc.fontSize(15).text("Invoice", 210, 170);

    // Headers
    doc.font("Helvetica-Bold").fontSize(14)
        .text("Product", 50, 240)
        .text("Quantity", 200, 240)
        .text("Price", 300, 240)
        .text("Total", 400, 240, { width: 100, align: "right" });

    doc.moveDown();
    generateHr(doc, 260);

    let yPosition = 280;
    const lineHeight = 20;

    // Products with offers
    orderData.cartData.forEach((item, i) => {
        // Product details
        doc.fontSize(10)
            .text(item.productId.productName, 50, yPosition)
            .text(item.productQty.toString(), 200, yPosition)
            .text('INR ' + item.productId.salePrice, 300, yPosition)
            .text('INR ' + item.totalCostPerProduct, 400, yPosition, {
                width: 100,
                align: "right"
            });

        yPosition += lineHeight;

        // Product Offer
        if (item.productId.productOffer > 0) {
            const productDiscount = (item.productId.regularPrice * item.productId.productOffer / 100) * item.productQty;
            doc.fontSize(9)
                .fillColor("green")
                .text(`Product Offer (${item.productId.productOffer}%): -INR ${productDiscount.toFixed(2)}`, 70, yPosition);
            yPosition += lineHeight;
        }

        // Category Offer
        if (item.productId.category && item.productId.category.categoryOffer > 0) {
            const categoryDiscount = (item.productId.regularPrice * item.productId.category.categoryOffer / 100) * item.productQty;
            doc.fontSize(9)
                .fillColor("green")
                .text(`Category Offer (${item.productId.category.categoryOffer}%): -INR ${categoryDiscount.toFixed(2)}`, 70, yPosition);
            yPosition += lineHeight;
        }

        doc.fillColor("black"); // Reset color
        yPosition += 10;
    });

    generateHr(doc, yPosition);
    yPosition += 20;

    // Summary section
    doc.fontSize(12);

    // Original Total
    doc.text("Subtotal:", 300, yPosition);
    doc.text(`INR ${orderData.grandTotalCost}`, 400, yPosition, { width: 100, align: "right" });
    yPosition += lineHeight;

    // Coupon discount if applied
    if (orderData.couponApplied && orderData.discountAmount > 0) {
        doc.text("Coupon Discount:", 300, yPosition);
        doc.text(`-INR ${orderData.discountAmount}`, 400, yPosition, { width: 100, align: "right" });
        yPosition += lineHeight;
    }

    // Calculate total offers
    let totalOffers = 0;
    orderData.cartData.forEach(item => {
        if (item.productId.productOffer > 0) {
            totalOffers += (item.productId.regularPrice * item.productId.productOffer / 100) * item.productQty;
        }
        if (item.productId.category && item.productId.category.categoryOffer > 0) {
            totalOffers += (item.productId.regularPrice * item.productId.category.categoryOffer / 100) * item.productQty;
        }
    });

    if (totalOffers > 0) {
        doc.text("Total Offers:", 300, yPosition);
        doc.text(`-INR ${totalOffers.toFixed(2)}`, 400, yPosition, { width: 100, align: "right" });
        yPosition += lineHeight;
    }

    // Final Total
    generateHr(doc, yPosition);
    yPosition += 10;
    doc.fontSize(14)
        .font("Helvetica-Bold")
        .text("Grand Total:", 300, yPosition)
        .text(`INR ${orderData.grandTotalAfterDiscount}`, 400, yPosition, { width: 100, align: "right" });

    // Payment Information
    yPosition += lineHeight * 2;
    doc.fontSize(10)
        .font("Helvetica")
        .text(`Payment Method: ${orderData.paymentType}`, 50, yPosition)
        .text(`Payment Status: ${orderData.paymentStatus}`, 300, yPosition);
}



function generateHr(doc, y) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}



const generatevoice = async (dataCallback, endCallback, orderData) => {
    let doc = new PDFDocument({ size: "A4", margin: 50 });
console.log(doc);
    generateHeader(doc);
    await generateCustomerInformation(doc, orderData);
    generateBody(doc, orderData);
    generateFooter(doc);
    doc.on("data", dataCallback);
    doc.on("end", endCallback);

    doc.end();
  }



module.exports = {generatevoice}