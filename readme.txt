# Backend Setup

1. Install Go: https://go.dev/doc/install  
2. Clone the repository  
3. Go to the backend folder  
4. Initialize dependencies: `go mod tidy`  
5. Run the server: `go run . serve`  
6. In backend folder, add a `.env` file with your Gemini API key  
7. On first PocketBase initialization, create a super admin account  
8. Import collections from `pb_schema` via PocketBase settings
9. Add an OpenID Connect (OIDC) provider for the `users` collection

# Frontend Setup as Chrome Extension

1. Open Chrome and go to `chrome://extensions/`  
2. Enable Developer mode  
3. Click Load unpacked  
4. Select the `frontend` folder  
5. The extension will appear in the toolbar  
6. Make sure the backend server is running for full functionality