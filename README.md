# STLVault

![Project Status](https://img.shields.io/badge/Status-Work_In_Progress-orange?style=for-the-badge)
![GitHub Release](https://img.shields.io/github/v/release/moddroid94/STLVault?display_name=release&style=for-the-badge&logo=github)

[![Docker Frontend CI](https://img.shields.io/github/actions/workflow/status/moddroid94/STLVault/Docker%20Frontend%20CI.yml?style=for-the-badge&logo=docker)](https://github.com/moddroid94/STLVault/actions/workflows/Docker%20Frontend%20CI.yml)
![Docker Pulls](https://img.shields.io/docker/pulls/moddroid94/stlvault-frontend?style=for-the-badge&logo=docker)

![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**STLVault** is a containerized 3D Model library manager and organizer, designed specifically for 3D printing enthusiasts. It provides a clean, modern web interface to manage your growing collection of STL, STEP, and 3MF files.

> **Note:** This project is currently **Heavily Work In Progress (WIP)**. While the core functionality (importing, organizing, viewing) works, expect changes and improvements.

---

## ✨ Features

- **📂 Nestable Folders:** Organize your models into a deep hierarchy that makes sense to you.
- **🪄 Open in Slicer:** Let's you open the model direclty in your slicer.
- **🖱️ Drag n' Drop:** Seamlessly import new models or move files between folders.
- **📦 Bulk Actions:** Tag, move, delete, download, or upload multiple files at once.
- **👁️ 3D Preview:** Integrated web-based 3D viewer for STL and 3MF files.
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

![Dashboard Preview](https://github.com/user-attachments/assets/3c1fe88f-d2e4-42ee-a99d-9c22809d64ca)
![Upload Modal Preview](https://github.com/user-attachments/assets/34f995d3-bc09-489f-92f3-1408bf0196a0)
![Model Viewer/Info Preview](https://github.com/user-attachments/assets/ac373cf5-3952-4336-8b56-e2864127c3aa)
![Settings Preview](https://github.com/user-attachments/assets/95adf21c-f8e8-45ad-b07c-1fac7f821b62)


---

## 🚀 Deployment

The recommended way to deploy STLVault is using **Docker Compose** or via a container management tool like **Portainer**.

### Option 1: Docker Compose (CLI)

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/moddroid94/STLVault.git
    cd STLVault
    ```

2.  **Configure Environment:**
    Review the `stack.env` file. You can modify the ports or URL if necessary, don't change the SEMVER tag.

    ```bash
    # stack.env example
    BASE_URL=http://0.0.0.0
    WWW_PORT=8989
    API_PORT=8988
    SEMVER=x.x.x
    ```

3.  **Start the Stack:**

    ```bash
    docker-compose up -d
    ```

4.  **Access the App:**
    Open your browser and navigate to `http://localhost:8989` (or the port you configured).

### Option 2: Portainer or GitOps (Recommended)

You can deploy STLVault directly from Portainer using the repository as a stack source.

1.  Create a new **Stack**.
2.  Select **Repository** as the build method.
3.  Enter the repository URL: `https://github.com/moddroid94/STLVault`.
4.  **Environment Variables:** Define the variables below in the Portainer UI (variable substitution will automatically update `stack.env`).

    | Variable   | Default          | Description                       |
    | :--------- | :--------------- | :-------------------------------- |
    | `BASE_URL` | `http://0.0.0.0` | The base URL for the application. |
    | `WWW_PORT` | `8989`           | Port for the Frontend Web UI.     |
    | `API_PORT` | `8988`           | Port for the Backend API.         |

---

## 📂 Volume Configuration

The application requires two main volumes to persist data. If you are using the default `docker-compose.yml`, these are mapped automatically relative to the backend folder:

- `/backend/uploads`: Stores your actual 3D model files.
- `/backend/data`: Stores the SQLite database file.

> **Tip:** If deploying on a NAS or server, map `/backend/uploads` to your existing 3D model library folder to ingest them (import functionality may be required).

---

## 🗺️ Roadmap

- [x] Basic File Management (Upload, Move, Delete)
- [x] 3D Viewer (STL, 3MF)
- [x] Open in Slicer settings
- [ ] Thumbnails / 3D viewer for STEP
- [ ] Model import via Printables URL
- [ ] User Authentication

---

## 🤝 Contributing

Contributions are welcome! Since this project uses a standard React + FastAPI stack, it is easy to set up for development.

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📝 License

[MIT License](LICENSE)
