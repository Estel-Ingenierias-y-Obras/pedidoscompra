import axios from "axios";

const api = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "http://localhost:5000")
});

api.interceptors.request.use((config) => {
  const microsoftAuthToken = localStorage.getItem("microsoftAuthToken");

  config.headers = config.headers || {};

  if (microsoftAuthToken) {
    config.headers.Authorization = `Bearer ${microsoftAuthToken}`;
  }

  return config;
});

export default api;
