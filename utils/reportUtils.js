// utils/reportUtils.js
// const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const pdf = require('pdfkit');
const streamBuffers = require('stream-buffers');


const generatePDF = (data, reportType) => {
    return new Promise((resolve, reject) => {
        const doc = new pdf();
        const writableStream = new streamBuffers.WritableStreamBuffer();

        doc.pipe(writableStream);

        // Set up the page size and margins
        doc.page.margins = { top: 50, left: 50, bottom: 50, right: 50 };

        // Title - Centered
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('Sales Report', { align: 'center' });

        // Add a horizontal line after title
        doc.moveDown(1).lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();

        // Add spacing after title
        doc.moveDown(2);

        // Add Report Type and Date to make it unique
        const reportDate = new Date().toLocaleDateString();
        doc.fontSize(12).font('Helvetica').text(`Report Type: ${reportType} | Date: ${reportDate}`, { align: 'center' });

        // Add spacing
        doc.moveDown(2);

        // Total Information Section
        doc.fontSize(12).font('Helvetica');
        doc.text(`Total Sales Count: ${data.totalSalesCount}`, { width: 500, align: 'left' });
        doc.text(`Total Order Amount: INR ${formatCurrency(data.totalOrderAmount)}`, { width: 500, align: 'left' });
        doc.text(`Total Discount: INR ${formatCurrency(data.totalDiscount)}`, { width: 500, align: 'left' });
        // doc.text(`Total Coupon Deduction: INR ${formatCurrency(data.totalCouponDeduction)}`, { width: 500, align: 'left' });

        // Add spacing
        doc.moveDown(2);

        // Add Order Details Heading
        doc.fontSize(16).font('Helvetica-Bold').text('Order Details:', { underline: true });

        // Create a table of orders
        const tableTop = doc.y;
        const orderData = data.orders;

        // Table Headers
        const headers = ['Order ID', 'Order Date', 'Grand Total', 'Discount'];
        const tableColumnWidth = [140, 140, 140, 140];
        const tableHeight = 30; // Row height
        const tableWidth = 560; // Total table width (left margin to right margin)

        // Draw table header row with grid lines
        doc.fontSize(10).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            const x = 50 + tableColumnWidth[i] * i;
            doc.text(header, x + 5, tableTop + 10, { width: tableColumnWidth[i], align: 'center' });
            // Draw header cell borders
            doc.rect(x, tableTop, tableColumnWidth[i], tableHeight).stroke();
        });

        // Add horizontal line after the headers
        doc.moveDown(1);
        doc.lineWidth(0.5);
        doc.moveTo(50, tableTop + tableHeight).lineTo(550, tableTop + tableHeight).stroke();

        // Draw the order rows with more spacing
        doc.fontSize(10).font('Helvetica');
        orderData.forEach((order, index) => {
            const yPosition = tableTop + (index + 1) * tableHeight; // Increased spacing between rows

            // Draw each cell in the row and add borders
            headers.forEach((header, colIndex) => {
                const x = 50 + tableColumnWidth[colIndex] * colIndex;
                const content = header === 'Order ID' ? order._id :
                                header === 'Order Date' ? new Date(order.orderDate).toLocaleString() :
                                header === 'Grand Total' ? `INR ${formatCurrency(order.grandTotalCost)}` :
                                header === 'Discount' ? `INR ${formatCurrency(order.discountAmount)}` :
                                `INR ${formatCurrency(order.couponAmount || 0)}`;

                doc.text(content, x + 5, yPosition + 10, { width: tableColumnWidth[colIndex], align: 'center' });
                // Draw cell borders
                doc.rect(x, yPosition, tableColumnWidth[colIndex], tableHeight).stroke();
            });
        });

        // Finalize PDF
        doc.end();

        writableStream.on('finish', () => {
            // Generate unique filename with the report type and date
            const filename = `sales_report_${reportType}_${reportDate}.pdf`.replace(/\//g, '-'); // Sanitize the date format
            resolve({ pdfBuffer: writableStream.getContents(), filename });
        });

        writableStream.on('error', reject);
    });
};

// Helper function to format numbers in INR with commas
const formatCurrency = (amount) => {
    return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const generateExcel = async (reportData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 30 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
    ];

    reportData.orders.forEach(order => {
        worksheet.addRow({
            orderId: order._id,
            totalAmount: order.grandTotalCost,
            discount: order.discountAmount,
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
};

module.exports = { generatePDF , generateExcel,};