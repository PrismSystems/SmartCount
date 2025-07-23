const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

const uploadToS3 = async (file) => {
    const fileContent = fs.readFileSync(file.path);
    const fileName = `${Date.now()}-${file.originalname}`;

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `pdfs/${fileName}`,
        Body: fileContent,
        ContentType: file.mimetype
    };

    try {
        const result = await s3.upload(params).promise();
        
        // Clean up local file
        fs.unlinkSync(file.path);
        
        return result.Location;
    } catch (error) {
        console.error('S3 upload error:', error);
        throw new Error('File upload failed');
    }
};

const deleteFromS3 = async (fileUrl) => {
    try {
        const key = fileUrl.split('/').slice(-2).join('/'); // Extract key from URL
        
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key
        };

        await s3.deleteObject(params).promise();
    } catch (error) {
        console.error('S3 delete error:', error);
        // Don't throw error for delete failures
    }
};

module.exports = { uploadToS3, deleteFromS3 };