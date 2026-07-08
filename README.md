![logo](https://github.com/moddroid94/STLVault/blob/main/frontend/assets/android-chrome-192x192.png)

# STLVault

![Project Status](https://img.shields.io/badge/Status-Beta-orange?style=for-the-badge)
![GitHub Release](https://img.shields.io/github/v/release/moddroid94/STLVault?display_name=release&style=for-the-badge&logo=github)
![GitHub Repo stars](https://img.shields.io/github/stars/moddroid94/STLVault?style=for-the-badge&logo=github)

[![Docker Frontend CI](https://img.shields.io/github/actions/workflow/status/moddroid94/STLVault/Docker%20Frontend%20CI.yml?style=for-the-badge&logo=docker&label=Frontend)](https://github.com/moddroid94/STLVault/actions/workflows/Docker%20Frontend%20CI.yml)
[![Docker Frontend CI](https://img.shields.io/github/actions/workflow/status/moddroid94/STLVault/Docker%20Backend%20CI.yml?style=for-the-badge&logo=docker&label=Backend)](https://github.com/moddroid94/STLVault/actions/workflows/Docker%20Backend%20CI.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/moddroid94/stlvault-frontend?style=for-the-badge&logo=docker)](https://hub.docker.com/u/moddroid94)

![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**STLVault** is a containerized 3D Model library manager and organizer, designed specifically for 3D printing enthusiasts. It provides a clean, modern web interface to manage your growing collection of STL, STEP, and 3MF files.

> **Note:** This project is still in Beta. While the core functionality (importing, organizing, viewing) works, expect changes and improvements.

---

## ✨ Features

- **📖 Manuals:** Include markdown manuals for every model, with github style compatibility.
- **📂 Nestable Folders:** Organize your models into a deep hierarchy that makes sense to you.
- **🪄 Open in Slicers:** Let's you open the model direclty in your preferred slicers.
- **🔗 URL Import:** Import multiple files from Printables or Makerworld, with granular file selection. (Only models URL)
- **🖱️ Drag n' Drop:** Seamlessly import new models or move files between folders.
- **📦 Bulk Actions:** Tag, move, delete, download, or upload multiple files at once.
- **👁️ 3D Preview:** Integrated web-based 3D viewer for STL, 3MF, STEP and STP files, with Trackball/Orbit controls switch to allow full rotational freedom (beta)
- **🖼️ Custom Thumbnails:** Generate a thumbnail of the model from the 3D viewer directly or upload an image to be shown as a thumbnail.
- **🏷️ Metadata Management:** Add tags, descriptions, and metadata to your models for easy retrieval.
- **🔍 Global Search:** Sidebar search and filtering to find models library-wide.

---

## 🛠️ Tech Stack

- **Frontend:** React (TS), Vite
- **Backend:** Python (FastAPI)
- **Database:** SQLite
- **Package Manager:** NPM, UV
- **Containerization:** Docker & Docker Compose

---

## 📸 Screenshots

![Dashboard Preview](https://github.com/user-attachments/assets/33be62e6-d7fd-455b-9ef1-e1d363bff6f8)
![Model Viewer/Info Preview](https://github.com/user-attachments/assets/db0c4141-51f6-408d-a6c5-9b3df20a3fc7)![ModelViewer2](https://github.com/user-attachments/assets/dc470ef9-0cf3-4f08-b60d-3985d2461576)
![Setting Page](https://github.com/user-attachments/assets/23c703ce-73b0-43bb-9ff4-f4a64c5f7147)

---

## 🚀 Deployment

The recommended way to deploy STLVault is using **Docker Compose** or via a container management tool like **Portainer**.

Replace the variables or create a .env file to let docker handle the injection.

`An example .env file is in the section below.`

## Docker Compose with Images

```
services:
  stlvbackend:
    image: moddroid94/stlvault-backend:latest
    pull_policy: build
    environment:
      - FILE_STORAGE=/app/uploads #DO NOT CHANGE, MODIFY THE BINDS
      - MANUAL_STORAGE=/app/uploads/manuals #DO NOT CHANGE, MODIFY THE BINDS
      - DB_PATH=/app/data/data.db #DO NOT CHANGE, MODIFY THE BINDS
      - WEBUI_URL: "${APP_URL}"
    ports:
      - '8998:8080'
    volumes:
      - YOUR_FOLDER_PATH:/app/uploads
      - YOUR_FOLDER_PATH:/app/data
      - YOUR_FOLDER_PATH:/app/manuals #OPTIONAL
    restart: always
  stlvfrontend:
    image: moddroid94/stlvault-frontend:latest
    pull_policy: build
    environment:
      - TERA_API_URL: "${API_URL}"
      - TERA_APP_URL: "${APP_URL}"
    volumes:
      - node_modules:/app/node_modules
    ports:
      - '8999:5173'
    depends_on:
      - stlvbackend
    restart: always
volumes:
  node_modules: null
```

### Docker Compose (CLI)

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/moddroid94/STLVault.git
    cd STLVault
    ```

2.  **Configure Environment:**
    Review the `.env` file. You can modify the ports/URL if necessary.

    ```bash
    # .env example
    APP_URL=http://192.168.0.17:8999
    API_URL=http://192.168.0.17:8998
    APP_PORT=8999
    API_PORT=8998
    UPLOAD_PATH=/your/mount/path
    DATA_PATH=/your/mount/otherpath
    ```

3.  **Start the Stack:**

    ```bash
    docker-compose up -d
    ```

4.  **Access the App:**
    Open your browser and navigate to `http://localhost:8999` (or the port you configured).

### GitOps (Deploy from Repo)

You can deploy STLVault directly from any git deploy compatible docker manager using the repository as a stack source.

1.  Create a new **Stack**.
2.  Select **Repository** as the build method.
3.  Enter the repository URL: `https://github.com/moddroid94/STLVault`.
4.  **Environment Variables:** Define the environment variables in the Docker Manager UI.

---

## 📂 Volume Configuration

The application requires two main volumes to persist data. If you are using the default `docker-compose.yml`, these are mapped automatically relative to the backend folder:

- `/backend/uploads`: Stores your actual 3D model files.
- `/backend/data`: Stores the SQLite database file.

---

## 🗺️ Roadmap

- [x] Basic File Management (Upload, Move, Delete)
- [x] 3D Viewer (STL, 3MF, STEP)
- [ ] Storage Template for saving files orderly