import cloudinary from '../config/cloudinary';

/**
 * Uploads a base64 image or file path to Cloudinary
 * @param fileData Base64 string or file path
 * @param folder Cloudinary folder name
 */
export const uploadImage = async (fileData: string, folder: string = 'opengaz/shops') => {
  try {
    const result = await cloudinary.uploader.upload(fileData, {
      folder,
      resource_type: 'auto',
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};
