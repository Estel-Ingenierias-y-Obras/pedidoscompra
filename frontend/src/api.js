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
  const savedUser = localStorage.getItem("user");

  config.headers = config.headers || {};

  if (microsoftAuthToken) {
    config.headers.Authorization = `Bearer ${microsoftAuthToken}`;
  }

  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);

      if (user?.email) {
        config.headers["x-user-email"] = user.email;
      }
    } catch (_) {
      localStorage.removeItem("user");
    }
  }

  return config;
});

export default api;