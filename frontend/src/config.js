// API Configuration for different environments
const getApiBaseUrl = () => {
  // Use environment variable if set (for production)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In development, use local backend
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();