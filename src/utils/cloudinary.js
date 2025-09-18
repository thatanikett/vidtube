import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";
import dotenv from "dotenv";

dotenv.config()

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const CloudinaryUpload = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        }
    )
    console.log("file uploaded on cloudinary at src:"+ response.url)
    //once uploaded delete from server
    fs.unlinkSync(localFilePath)
    return response
    
    } catch (error) {
        fs.unlinkSync(localFilePath)
        return null;
    }
}


const CloudinaryDelete = async (publicId) => {
    try {
        const result =  cloudinary.uploader.destroy(publicId)
        console.log("deleted from cloudinafy, publicID: ",publicId)
    } catch(error) {
        console.log("error deleting files from cloudinary ",error)
        return null
    }
}

export {CloudinaryUpload, CloudinaryDelete}